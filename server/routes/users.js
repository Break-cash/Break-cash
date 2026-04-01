import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { hashPassword } from '../auth.js'
import { markReferralAsVerifiedIfDeposited } from '../services/verification.js'
import { createLockedCompensationReward, getMainBalance, adjustBalance, normalizeRewardSourceType } from '../services/wallet-service.js'
import { blockProtectedOwnerAction } from '../services/protected-owners.js'
import { sendPushToUser } from '../services/push-notifications.js'
import { maybeQueueOwnerFinancialApproval } from '../services/owner-financial-approvals.js'
import { buildUserAvatarUrl } from '../services/user-avatars.js'

async function withTransaction(db, fn) {
  if (typeof db.connect === 'function') {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // ignore rollback error
      }
      throw error
    } finally {
      client.release()
    }
  }
  await run(db, 'BEGIN')
  try {
    const result = await fn(db)
    await run(db, 'COMMIT')
    return result
  } catch (error) {
    await run(db, 'ROLLBACK')
    throw error
  }
}

function boolParam(value) {
  if (value === undefined || value === null || value === '') return null
  const raw = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes'].includes(raw)) return 1
  if (['0', 'false', 'no'].includes(raw)) return 0
  return null
}

async function logAdminAction(db, actorUserId, section, action, targetUserId = null, metadata = {}) {
  await run(
    db,
    `INSERT INTO admin_audit_logs (actor_user_id, target_user_id, section, action, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [actorUserId, targetUserId, section, action, JSON.stringify(metadata || {})],
  )
}

async function getPendingProfitTotal(db, userId, sourceType = 'all') {
  const normalizedSourceType = normalizeRewardSourceType(sourceType, 'all')
  const params = [userId]
  let sourceClause = ''
  if (normalizedSourceType !== 'all') {
    sourceClause = `AND source_type = ?`
    params.push(normalizedSourceType)
  }
  const row = await get(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM earning_entries
     WHERE user_id = ?
       AND status = 'pending'
       ${sourceClause}`,
    params,
  )
  return Number(row?.total || 0)
}

export function createUsersRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/list', requirePermission(db, 'manage_users'), async (req, res) => {
    const q = String(req.query.q || '').trim()
    const role = String(req.query.role || '').trim().toLowerCase()
    const isApproved = boolParam(req.query.isApproved)
    const isVerified = boolParam(req.query.isVerified)
    const isVip = boolParam(req.query.isVip)
    const hasDeposit = boolParam(req.query.hasDeposit)
    const hasPendingWithdrawal = boolParam(req.query.hasPendingWithdrawal)
    const country = String(req.query.country || '').trim()
    const language = String(req.query.language || '').trim().toLowerCase()
    const currency = String(req.query.currency || '').trim().toUpperCase()
    const sortBy = String(req.query.sortBy || 'created_at').trim()
    const sortDir = String(req.query.sortDir || 'desc').trim().toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 120))
    const offset = Math.max(0, Number(req.query.offset) || 0)

    const clauses = []
    const params = []

    if (q) {
      clauses.push('(email LIKE ? OR phone LIKE ? OR display_name LIKE ? OR CAST(id AS TEXT) LIKE ? OR referral_code LIKE ?)')
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`)
    }
    if (role) {
      clauses.push('role = ?')
      params.push(role)
    }
    if (isApproved !== null) {
      clauses.push('is_approved = ?')
      params.push(isApproved)
    }
    if (isVerified !== null) {
      clauses.push(`verification_status ${isVerified ? '=' : '!='} 'verified'`)
    }
    if (isVip !== null) {
      clauses.push(`COALESCE(vip_level, 0) ${isVip ? '>' : '='} 0`)
    }
    if (hasDeposit !== null) {
      clauses.push(
        hasDeposit
          ? `EXISTS (
              SELECT 1 FROM wallet_transactions wt_dep
              WHERE wt_dep.user_id = u.id
                AND wt_dep.transaction_type = 'deposit'
            )`
          : `NOT EXISTS (
              SELECT 1 FROM wallet_transactions wt_dep
              WHERE wt_dep.user_id = u.id
                AND wt_dep.transaction_type = 'deposit'
            )`,
      )
    }
    if (hasPendingWithdrawal !== null) {
      clauses.push(
        hasPendingWithdrawal
          ? `EXISTS (
              SELECT 1 FROM withdrawal_requests wr
              WHERE wr.user_id = u.id AND wr.request_status = 'pending'
            )`
          : `NOT EXISTS (
              SELECT 1 FROM withdrawal_requests wr
              WHERE wr.user_id = u.id AND wr.request_status = 'pending'
            )`,
      )
    }
    if (country) {
      clauses.push('LOWER(COALESCE(country, \'\')) = ?')
      params.push(country.toLowerCase())
    }
    if (language) {
      clauses.push('LOWER(COALESCE(preferred_language, \'\')) = ?')
      params.push(language)
    }
    if (currency) {
      clauses.push('UPPER(COALESCE(preferred_currency, \'\')) = ?')
      params.push(currency)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const orderByMap = {
      created_at: 'u.created_at',
      id: 'u.id',
      wallet_balance: 'wallet_balance',
      last_login_at: 'u.last_login_at',
      vip_level: 'u.vip_level',
      deposits_total: 'deposits_total',
    }
    const orderBy = orderByMap[sortBy] || orderByMap.created_at

    const rows = await all(db, `SELECT
      u.id, u.email, u.phone, u.role, u.is_approved, u.is_banned, u.is_frozen, u.banned_until, u.created_at,
      u.display_name, u.avatar_path, u.verification_status, u.blue_badge, u.badge_style, u.vip_level, u.profile_color, u.profile_badge,
      CASE WHEN u.avatar_blob_base64 IS NOT NULL AND u.avatar_blob_base64 <> '' THEN 1 ELSE 0 END AS has_avatar_blob,
      u.phone_verified, u.identity_submitted, u.country, u.preferred_language, u.preferred_currency, u.deposit_privacy_enabled,
      u.referral_code, u.invited_by, u.referred_by, u.total_deposit, u.points, u.is_owner, u.last_login_at, u.last_ip, u.last_user_agent,
      COALESCE(bal.total_balance, 0) AS wallet_balance,
      COALESCE(dep.total_deposits, 0) AS deposits_total,
      COALESCE(wd.total_withdrawals, 0) AS withdrawals_total,
      COALESCE(rf.referrals_count, 0) AS referrals_count,
      COALESCE(rf.referrals_earnings, 0) AS referrals_earnings,
      COALESCE(pw.pending_withdrawals, 0) AS pending_withdrawals
    FROM users u
    LEFT JOIN (
      SELECT user_id, SUM(balance_amount) AS total_balance
      FROM wallet_accounts
      WHERE account_type = 'main' AND source_type = 'system'
      GROUP BY user_id
    ) bal ON bal.user_id = u.id
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total_deposits
      FROM wallet_transactions
      WHERE transaction_type = 'deposit'
      GROUP BY user_id
    ) dep ON dep.user_id = u.id
    LEFT JOIN (
      SELECT user_id, SUM(ABS(amount)) AS total_withdrawals
      FROM wallet_transactions
      WHERE transaction_type = 'withdrawal'
      GROUP BY user_id
    ) wd ON wd.user_id = u.id
    LEFT JOIN (
      SELECT referrer_user_id, COUNT(*) AS referrals_count, COALESCE(SUM(reward_amount), 0) AS referrals_earnings
      FROM referral_rewards
      GROUP BY referrer_user_id
    ) rf ON rf.referrer_user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS pending_withdrawals
      FROM withdrawal_requests
      WHERE request_status = 'pending'
      GROUP BY user_id
    ) pw ON pw.user_id = u.id
    ${where}
    ORDER BY ${orderBy} ${sortDir}
    LIMIT ${limit}
    OFFSET ${offset}`, params)

    const normalizedRows = rows.map((row) => {
      const rawBadgeStyle = String(row.badge_style || '').trim().toLowerCase()
      const badge_color =
        ['none', 'blue', 'gold', 'red', 'green', 'purple', 'silver'].includes(rawBadgeStyle)
          ? rawBadgeStyle
          : Number(row.blue_badge || 0) === 1
            ? 'blue'
            : row.verification_status === 'verified'
              ? 'gold'
              : 'none'
      return {
        ...row,
        badge_color,
        avatar_path: buildUserAvatarUrl(row.id, row.avatar_path, row.has_avatar_blob),
      }
    })
    const isOwner = req.user.role === 'owner'
    const users = isOwner ? normalizedRows : normalizedRows.map((u) => ({ ...u, email: null, phone: null }))
    return res.json({ users })
  })

  router.get('/:id/profile', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.params.id)
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_USER' })

    const user = await get(
      db,
      `SELECT
        u.id, u.email, u.phone, u.role, u.is_approved, u.is_banned, u.is_frozen, u.banned_until, u.created_at,
        u.display_name, u.avatar_path, u.verification_status, u.blue_badge, u.badge_style, u.vip_level, u.profile_color, u.profile_badge, u.phone_verified, u.identity_submitted,
        u.country, u.preferred_language, u.preferred_currency, u.deposit_privacy_enabled, u.referral_code, u.invited_by, u.referred_by,
        u.total_deposit, u.points, u.is_owner,
        u.last_login_at, u.last_ip, u.last_user_agent,
        CASE WHEN u.avatar_blob_base64 IS NOT NULL AND u.avatar_blob_base64 <> '' THEN 1 ELSE 0 END AS has_avatar_blob,
        COALESCE(bal.total_balance, 0) AS wallet_balance,
        COALESCE(dep.total_deposits, 0) AS deposits_total,
        COALESCE(wd.total_withdrawals, 0) AS withdrawals_total,
        COALESCE(rf.referrals_count, 0) AS referrals_count,
        COALESCE(rf.referrals_earnings, 0) AS referrals_earnings
      FROM users u
      LEFT JOIN (
        SELECT user_id, SUM(balance_amount) AS total_balance
        FROM wallet_accounts WHERE account_type = 'main' AND source_type = 'system'
        GROUP BY user_id
      ) bal ON bal.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(amount) AS total_deposits FROM wallet_transactions
        WHERE transaction_type = 'deposit' GROUP BY user_id
      ) dep ON dep.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(ABS(amount)) AS total_withdrawals FROM wallet_transactions
        WHERE transaction_type = 'withdrawal' GROUP BY user_id
      ) wd ON wd.user_id = u.id
      LEFT JOIN (
        SELECT referrer_user_id, COUNT(*) AS referrals_count, COALESCE(SUM(reward_amount), 0) AS referrals_earnings
        FROM referral_rewards
        GROUP BY referrer_user_id
      ) rf ON rf.referrer_user_id = u.id
      WHERE u.id = ?
      LIMIT 1`,
      [userId],
    )
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' })

    const activity = await all(
      db,
      `SELECT id, action, ip_address, user_agent, metadata, created_at
       FROM user_activity_logs
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 50`,
      [userId],
    )
    const notes = await all(
      db,
      `SELECT id, note, admin_id, created_at
       FROM user_admin_notes
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 50`,
      [userId],
    )

    const kyc_submissions = await all(
      db,
      `SELECT id, user_id, id_document_path, selfie_path, review_status, rejection_reason,
              reviewed_at, reviewed_note, reviewed_by, created_at, purged_at, purged_reason
       FROM kyc_submissions
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 25`,
      [userId],
    )

    const deposit_requests = await all(
      db,
      `SELECT id, amount, currency, method, transfer_ref, user_notes, proof_image_path,
              request_status, admin_note, reviewed_at, completed_at, created_at
       FROM deposit_requests
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 30`,
      [userId],
    )

    const rawBadgeStyle = String(user.badge_style || '').trim().toLowerCase()
    const badge_color = ['none', 'blue', 'gold', 'red', 'green', 'purple', 'silver'].includes(rawBadgeStyle)
      ? rawBadgeStyle
      : Number(user.blue_badge || 0) === 1
        ? 'blue'
        : user.verification_status === 'verified'
          ? 'gold'
          : 'none'
    const normalizedUser = {
      ...user,
      badge_color,
      avatar_path: buildUserAvatarUrl(user.id, user.avatar_path, user.has_avatar_blob),
    }
    delete normalizedUser.has_avatar_blob

    const isOwner = req.user.role === 'owner'
    const userOut = isOwner ? normalizedUser : { ...normalizedUser, email: null, phone: null }

    return res.json({
      user: userOut,
      activity,
      notes,
      kyc_submissions,
      deposit_requests,
    })
  })

  router.post('/approve', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const isApproved = Number(req.body?.isApproved) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'INVALID_USER' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return
    await run(
      db,
      `UPDATE users
       SET is_approved = ?,
           verification_status = CASE WHEN ? = 1 THEN 'verified' ELSE 'unverified' END,
           verification_ready_at = CASE WHEN ? = 1 THEN NULL ELSE verification_ready_at END
       WHERE id = ?`,
      [isApproved, isApproved, isApproved, userId],
    )
    
    // If approving and user was referred, mark as active referral if they made a deposit
    if (isApproved === 1) {
      await markReferralAsVerifiedIfDeposited(db, userId)
    }
    
    await logAdminAction(db, req.user.id, 'users', 'approve_toggle', userId, { isApproved })
    return res.json({ ok: true })
  })

  router.post('/verification-review', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const decision = String(req.body?.decision || '').trim().toLowerCase()
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'INVALID_USER' })
    }
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return
    const approved = decision === 'approve' ? 1 : 0
    await run(
      db,
      `UPDATE users
       SET verification_status = ?,
           is_approved = ?,
           verification_ready_at = NULL,
           blue_badge = CASE WHEN ? = 1 THEN blue_badge ELSE 0 END
       WHERE id = ?`,
      [approved ? 'verified' : 'unverified', approved, approved, userId],
    )
    if (approved === 1) {
      await markReferralAsVerifiedIfDeposited(db, userId)
    }
    await logAdminAction(db, req.user.id, 'users', approved ? 'verification_approved' : 'verification_rejected', userId, {})
    return res.json({ ok: true })
  })

  router.post('/ban', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const isBanned = Number(req.body?.isBanned) ? 1 : 0
    if (await blockProtectedOwnerAction(db, res, userId)) return
    await run(db, `UPDATE users SET is_banned = ? WHERE id = ?`, [isBanned, userId])
    await logAdminAction(db, req.user.id, 'users', 'ban_toggle', userId, { isBanned })
    return res.json({ ok: true })
  })

  router.post('/freeze', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const isFrozen = Number(req.body?.isFrozen) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'INVALID_USER' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return
    await run(db, `UPDATE users SET is_frozen = ? WHERE id = ?`, [isFrozen, userId])
    await logAdminAction(db, req.user.id, 'users', 'freeze_toggle', userId, { isFrozen })
    return res.json({ ok: true })
  })

  router.post('/ban-temporary', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const days = Math.max(1, Math.min(365, Number(req.body?.days || 1)))
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_USER' })
    if (await blockProtectedOwnerAction(db, res, userId)) return
    const bannedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    await run(
      db,
      `UPDATE users
       SET is_banned = 1,
           banned_until = ?
       WHERE id = ?`,
      [bannedUntil, userId],
    )
    await logAdminAction(db, req.user.id, 'users', 'temporary_ban', userId, { days, bannedUntil })
    return res.json({ ok: true })
  })

  router.post('/reset-password', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const newPassword = String(req.body?.newPassword || '')
    if (!Number.isFinite(userId) || userId <= 0 || newPassword.length < 6) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return
    const passwordHash = await hashPassword(newPassword)
    await run(db, `UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId])
    await run(
      db,
      `INSERT INTO user_activity_logs (user_id, action, metadata)
       VALUES (?, 'password_reset_by_owner', ?)`,
      [userId, JSON.stringify({ adminId: req.user.id })],
    )
    await logAdminAction(db, req.user.id, 'users', 'reset_password', userId, {})
    return res.json({ ok: true })
  })

  router.post('/bonus', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const currency = String(req.body?.currency || 'USDT').trim().toUpperCase()
    const amount = Number(req.body?.amount)
    const type = String(req.body?.type || '').trim() // add | deduct
    if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (!['add', 'deduct'].includes(type)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return
    const delta = type === 'add' ? amount : -amount
    try {
      await withTransaction(db, async (tx) => {
        const result = await adjustBalance(tx, {
          userId,
          currency,
          delta,
          referenceType: 'admin_bonus',
          referenceId: req.user.id,
          createdBy: req.user.id,
          note: 'owner bonus action',
        })
        if (delta > 0) {
          await maybeQueueOwnerFinancialApproval(tx, {
            actionType: 'bonus_add',
            actorUser: req.user,
            actorUserId: req.user.id,
            targetUserId: userId,
            currency,
            amount: delta,
            referenceType: 'admin_bonus',
            referenceId: req.user.id,
            walletTransactionId: result.walletTxnId,
            note: 'owner bonus action',
            metadata: { action: type },
          })
        }
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })
      }
      throw error
    }
    const next = await getMainBalance(db, userId, currency)
    await logAdminAction(db, req.user.id, 'finance', 'bonus_adjust', userId, { type, currency, amount })
    return res.json({ ok: true, balance: { userId, currency, amount: next } })
  })

  router.post('/compensation', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const currency = String(req.body?.currency || 'USDT').trim().toUpperCase()
    const amount = Number(req.body?.amount)
    const reason = String(req.body?.reason || '').trim().slice(0, 260)
    const campaignKey = Number(req.body?.campaignKey || 0)
    if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(amount) || amount <= 0 || !campaignKey) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return

    try {
      const payload = await withTransaction(db, async (tx) => {
        const compactCampaignKey = Math.max(1, Number(String(campaignKey).slice(-4) || 0))
        const referenceId = Number(compactCampaignKey * 100000 + userId)
        const result = await createLockedCompensationReward(tx, {
          userId,
          currency,
          amount,
          referenceId,
          referenceType: 'admin_compensation',
          sourceType: 'tasks',
        })
        await logAdminAction(tx, req.user.id, 'finance', 'grant_locked_compensation', userId, {
          currency,
          amount,
          campaignKey,
          earningEntryId: result.earningEntryId,
          lockedUntil: result.lockedUntil,
          reason,
        })
        return { ...result, referenceId }
      })
      return res.json({ ok: true, ...payload })
    } catch (error) {
      const message = String(error?.message || '')
      if (message.includes('duplicate key') || message.includes('unique')) {
        return res.status(409).json({ error: 'ALREADY_EXISTS' })
      }
      if (error instanceof Error && (error.message === 'INVALID_INPUT' || error.message === 'EARNING_ENTRY_FAILED')) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.post('/profit-adjust', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const currency = String(req.body?.currency || 'USDT').trim().toUpperCase()
    const amount = Number(req.body?.amount)
    const target = String(req.body?.target || 'main').trim().toLowerCase()
    const sourceType = normalizeRewardSourceType(req.body?.sourceType, 'all')
    const note = String(req.body?.note || '').trim().slice(0, 260)

    if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (!['main', 'pending'].includes(target)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return

    try {
      if (target === 'main') {
        await withTransaction(db, async (tx) => {
          await adjustBalance(tx, {
            userId,
            currency,
            delta: -amount,
            referenceType: 'owner_profit_deduct_general',
            referenceId: req.user.id,
            createdBy: req.user.id,
            note: note || 'owner general profit deduction',
          })
        })
        const remainingMainBalance = await getMainBalance(db, userId, currency)
        await logAdminAction(db, req.user.id, 'finance', 'deduct_general_profit', userId, {
          currency,
          amount,
          note,
        })
        return res.json({
          ok: true,
          target,
          sourceType: 'all',
          amount,
          remainingMainBalance,
          remainingPendingAmount: await getPendingProfitTotal(db, userId, 'all'),
          affectedEntries: 0,
        })
      }

      let affectedEntries = 0
      await withTransaction(db, async (tx) => {
        const pendingRows = await all(
          tx,
          `SELECT id, amount
           FROM earning_entries
           WHERE user_id = ?
             AND status = 'pending'
             ${sourceType === 'all' ? '' : 'AND source_type = ?'}
           ORDER BY created_at ASC, id ASC`,
          sourceType === 'all' ? [userId] : [userId, sourceType],
        )
        const pendingTotal = pendingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
        if (pendingTotal + 1e-8 < amount) {
          throw new Error('INSUFFICIENT_PENDING_PROFIT')
        }

        let remaining = Number(amount.toFixed(8))
        for (const row of pendingRows) {
          if (remaining <= 0) break
          const entryAmount = Number(row.amount || 0)
          const consume = Math.min(entryAmount, remaining)
          const nextAmount = Number((entryAmount - consume).toFixed(8))
          if (nextAmount <= 0) {
            await run(tx, `DELETE FROM earning_entries WHERE id = ?`, [row.id])
          } else {
            await run(tx, `UPDATE earning_entries SET amount = ? WHERE id = ?`, [nextAmount, row.id])
          }
          remaining = Number((remaining - consume).toFixed(8))
          affectedEntries += 1
        }
      })

      const remainingPendingAmount = await getPendingProfitTotal(db, userId, sourceType)
      await logAdminAction(db, req.user.id, 'finance', 'deduct_private_profit', userId, {
        currency,
        amount,
        sourceType,
        note,
        affectedEntries,
      })
      return res.json({
        ok: true,
        target,
        sourceType,
        amount,
        remainingMainBalance: await getMainBalance(db, userId, currency),
        remainingPendingAmount,
        affectedEntries,
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })
      }
      if (error instanceof Error && error.message === 'INSUFFICIENT_PENDING_PROFIT') {
        return res.status(400).json({ error: 'INSUFFICIENT_PENDING_PROFIT' })
      }
      throw error
    }
  })

  router.post('/notify', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()
    if (!Number.isFinite(userId) || userId <= 0 || !title || !body) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return
    await run(
      db,
      `INSERT INTO notifications (user_id, title, body, is_read, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))`,
      [userId, title, body],
    )
    await sendPushToUser(db, userId, { title, body, tag: 'private_notification', url: '/portfolio', data: { title, body } }).catch(() => {})
    await logAdminAction(db, req.user.id, 'notifications', 'send_private_notification', userId, { title })
    return res.json({ ok: true })
  })

  router.post('/note', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const note = String(req.body?.note || '').trim()
    if (!Number.isFinite(userId) || userId <= 0 || !note) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return
    await run(
      db,
      `INSERT INTO user_admin_notes (user_id, admin_id, note, created_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [userId, req.user.id, note],
    )
    await logAdminAction(db, req.user.id, 'users', 'add_internal_note', userId, {})
    return res.json({ ok: true })
  })

  router.post('/promote', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const role = String(req.body?.role || 'user')
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'INVALID_ROLE' })
    }
    if (await blockProtectedOwnerAction(db, res, userId)) return
    await run(db, `UPDATE users SET role = ? WHERE id = ?`, [role, userId])
    await logAdminAction(db, req.user.id, 'staff_permissions', 'promote_role', userId, { role })
    return res.json({ ok: true })
  })

  router.delete('/:id', requirePermission(db, 'manage_users'), async (req, res) => {
    const targetUserId = Number(req.params.id)
    if (await blockProtectedOwnerAction(db, res, targetUserId)) return
    await run(db, `DELETE FROM users WHERE id = ?`, [targetUserId])
    await logAdminAction(db, req.user.id, 'users', 'delete_user', targetUserId, {})
    return res.json({ ok: true })
  })

  return router
}
