import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { hashPassword } from '../auth.js'
import { markReferralAsVerifiedIfDeposited } from '../services/verification.js'

async function withTransaction(db, fn) {
  await run(db, 'BEGIN')
  try {
    const result = await fn()
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
              SELECT 1 FROM balance_transactions bt_dep
              WHERE bt_dep.user_id = u.id
                AND bt_dep.type IN ('add', 'deposit', 'bonus_add')
            )`
          : `NOT EXISTS (
              SELECT 1 FROM balance_transactions bt_dep
              WHERE bt_dep.user_id = u.id
                AND bt_dep.type IN ('add', 'deposit', 'bonus_add')
            )`,
      )
    }
    if (hasPendingWithdrawal !== null) {
      clauses.push(
        hasPendingWithdrawal
          ? `EXISTS (
              SELECT 1 FROM balance_transactions bt_wd
              WHERE bt_wd.user_id = u.id
                AND bt_wd.type = 'withdraw_pending'
            )`
          : `NOT EXISTS (
              SELECT 1 FROM balance_transactions bt_wd
              WHERE bt_wd.user_id = u.id
                AND bt_wd.type = 'withdraw_pending'
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
      u.display_name, u.verification_status, u.blue_badge, u.vip_level, u.profile_color, u.profile_badge,
      u.phone_verified, u.identity_submitted, u.country, u.preferred_language, u.preferred_currency,
      u.referral_code, u.invited_by, u.referred_by, u.total_deposit, u.points, u.is_owner, u.last_login_at, u.last_ip, u.last_user_agent,
      COALESCE(bal.total_balance, 0) AS wallet_balance,
      COALESCE(dep.total_deposits, 0) AS deposits_total,
      COALESCE(wd.total_withdrawals, 0) AS withdrawals_total,
      COALESCE(rf.referrals_count, 0) AS referrals_count,
      COALESCE(rf.referrals_earnings, 0) AS referrals_earnings,
      COALESCE(pw.pending_withdrawals, 0) AS pending_withdrawals
    FROM users u
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total_balance FROM balances GROUP BY user_id
    ) bal ON bal.user_id = u.id
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total_deposits
      FROM balance_transactions
      WHERE type IN ('add', 'deposit', 'bonus_add')
      GROUP BY user_id
    ) dep ON dep.user_id = u.id
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total_withdrawals
      FROM balance_transactions
      WHERE type IN ('deduct', 'withdraw', 'bonus_deduct')
      GROUP BY user_id
    ) wd ON wd.user_id = u.id
    LEFT JOIN (
      SELECT u.invited_by, COUNT(*) AS referrals_count, COALESCE(SUM(rr.reward_amount), 0) AS referrals_earnings
      FROM users u
      LEFT JOIN referral_rewards rr ON rr.referred_user_id = u.id
      WHERE u.invited_by IS NOT NULL
        AND (u.verification_status = 'verified' OR u.is_approved = 1)
        AND EXISTS (
          SELECT 1 FROM balance_transactions bt
          WHERE bt.user_id = u.id
            AND bt.type = 'deposit'
        )
      GROUP BY u.invited_by
    ) rf ON rf.invited_by = u.id
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

    const isOwner = req.user.role === 'owner'
    const users = isOwner ? rows : rows.map((u) => ({ ...u, email: null, phone: null }))
    return res.json({ users })
  })

  router.get('/:id/profile', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.params.id)
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_USER' })

    const user = await get(
      db,
      `SELECT
        u.id, u.email, u.phone, u.role, u.is_approved, u.is_banned, u.is_frozen, u.banned_until, u.created_at,
        u.display_name, u.verification_status, u.blue_badge, u.vip_level, u.profile_color, u.profile_badge, u.phone_verified, u.identity_submitted,
        u.country, u.preferred_language, u.preferred_currency, u.referral_code, u.invited_by, u.referred_by,
        u.total_deposit, u.points, u.is_owner,
        u.last_login_at, u.last_ip, u.last_user_agent,
        COALESCE(bal.total_balance, 0) AS wallet_balance,
        COALESCE(dep.total_deposits, 0) AS deposits_total,
        COALESCE(wd.total_withdrawals, 0) AS withdrawals_total,
        COALESCE(rf.referrals_count, 0) AS referrals_count,
        COALESCE(rf.referrals_earnings, 0) AS referrals_earnings
      FROM users u
      LEFT JOIN (SELECT user_id, SUM(amount) AS total_balance FROM balances GROUP BY user_id) bal ON bal.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(amount) AS total_deposits FROM balance_transactions
        WHERE type IN ('add', 'deposit', 'bonus_add') GROUP BY user_id
      ) dep ON dep.user_id = u.id
      LEFT JOIN (
        SELECT user_id, SUM(amount) AS total_withdrawals FROM balance_transactions
        WHERE type IN ('deduct', 'withdraw', 'bonus_deduct') GROUP BY user_id
      ) wd ON wd.user_id = u.id
      LEFT JOIN (
        SELECT u.invited_by, COUNT(*) AS referrals_count, COALESCE(SUM(rr.reward_amount), 0) AS referrals_earnings
        FROM users u
        LEFT JOIN referral_rewards rr ON rr.referred_user_id = u.id
        WHERE u.invited_by IS NOT NULL
          AND (u.verification_status = 'verified' OR u.is_approved = 1)
          AND EXISTS (
            SELECT 1 FROM balance_transactions bt
            WHERE bt.user_id = u.id
              AND bt.type = 'deposit'
          )
        GROUP BY u.invited_by
      ) rf ON rf.invited_by = u.id
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

    return res.json({ user, activity, notes })
  })

  router.post('/approve', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const isApproved = Number(req.body?.isApproved) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'INVALID_USER' })
    }
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

  router.post('/ban', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const isBanned = Number(req.body?.isBanned) ? 1 : 0
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
    await run(db, `UPDATE users SET is_frozen = ? WHERE id = ?`, [isFrozen, userId])
    await logAdminAction(db, req.user.id, 'users', 'freeze_toggle', userId, { isFrozen })
    return res.json({ ok: true })
  })

  router.post('/ban-temporary', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const days = Math.max(1, Math.min(365, Number(req.body?.days || 1)))
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_USER' })
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
    let next = 0
    try {
      await withTransaction(db, async () => {
        const existing = await get(
          db,
          `SELECT amount FROM balances WHERE user_id = ? AND currency = ? LIMIT 1`,
          [userId, currency],
        )
        const current = Number(existing?.amount || 0)
        next = Number((type === 'add' ? current + amount : current - amount).toFixed(8))
        if (next < 0) throw new Error('INSUFFICIENT_BALANCE')
        await run(
          db,
          `INSERT INTO balances (user_id, currency, amount, updated_at)
           VALUES (?, ?, ?, datetime('now'))
           ON CONFLICT(user_id, currency) DO UPDATE SET
             amount = excluded.amount,
             updated_at = excluded.updated_at`,
          [userId, currency, next],
        )
        await run(
          db,
          `INSERT INTO balance_transactions (user_id, admin_id, type, currency, amount, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, req.user.id, type === 'add' ? 'bonus_add' : 'bonus_deduct', currency, amount, 'owner bonus action'],
        )
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })
      }
      throw error
    }
    await logAdminAction(db, req.user.id, 'finance', 'bonus_adjust', userId, { type, currency, amount })
    return res.json({ ok: true, balance: { userId, currency, amount: next } })
  })

  router.post('/notify', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()
    if (!Number.isFinite(userId) || userId <= 0 || !title || !body) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    await run(
      db,
      `INSERT INTO notifications (user_id, title, body, is_read, created_at)
       VALUES (?, ?, ?, 0, datetime('now'))`,
      [userId, title, body],
    )
    await logAdminAction(db, req.user.id, 'notifications', 'send_private_notification', userId, { title })
    return res.json({ ok: true })
  })

  router.post('/note', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const note = String(req.body?.note || '').trim()
    if (!Number.isFinite(userId) || userId <= 0 || !note) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
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
    await run(db, `UPDATE users SET role = ? WHERE id = ?`, [role, userId])
    await logAdminAction(db, req.user.id, 'staff_permissions', 'promote_role', userId, { role })
    return res.json({ ok: true })
  })

  router.delete('/:id', requirePermission(db, 'manage_users'), async (req, res) => {
    const targetUserId = Number(req.params.id)
    await run(db, `DELETE FROM users WHERE id = ?`, [targetUserId])
    await logAdminAction(db, req.user.id, 'users', 'delete_user', targetUserId, {})
    return res.json({ ok: true })
  })

  return router
}
