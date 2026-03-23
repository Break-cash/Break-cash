import { all, get, run } from '../db.js'
import { adjustBalance } from './wallet-service.js'

export const DEFAULT_OWNER_FINANCIAL_GUARD_CONFIG = {
  enabled: true,
  watchDepositApprovals: true,
  watchManualBalanceAdds: true,
  watchBonusAdds: true,
}

function normalizeGuardConfig(raw) {
  const base = raw && typeof raw === 'object' ? raw : {}
  return {
    enabled: base.enabled !== false,
    watchDepositApprovals: base.watchDepositApprovals !== false,
    watchManualBalanceAdds: base.watchManualBalanceAdds !== false,
    watchBonusAdds: base.watchBonusAdds !== false,
  }
}

function normalizeStatus(raw) {
  const value = String(raw || 'pending').trim().toLowerCase()
  return ['pending', 'approved', 'rejected'].includes(value) ? value : 'pending'
}

function normalizeActionType(raw) {
  const value = String(raw || '').trim().toLowerCase()
  return ['deposit_approval', 'manual_balance_add', 'bonus_add'].includes(value) ? value : 'manual_balance_add'
}

function parseMetadata(value) {
  if (!value) return null
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return null
  }
}

function isOwnerUser(user) {
  return String(user?.role || '').trim().toLowerCase() === 'owner' || Number(user?.is_owner || 0) === 1
}

export function shouldTrackOwnerFinancialApproval(config, actionType) {
  const normalized = normalizeGuardConfig(config)
  if (!normalized.enabled) return false
  if (actionType === 'deposit_approval') return normalized.watchDepositApprovals
  if (actionType === 'manual_balance_add') return normalized.watchManualBalanceAdds
  if (actionType === 'bonus_add') return normalized.watchBonusAdds
  return false
}

export async function getOwnerFinancialGuardConfig(db) {
  const row = await get(db, `SELECT value FROM settings WHERE key = 'owner_financial_guard_config' LIMIT 1`)
  if (!row?.value) return { ...DEFAULT_OWNER_FINANCIAL_GUARD_CONFIG }
  try {
    return normalizeGuardConfig(JSON.parse(String(row.value)))
  } catch {
    return { ...DEFAULT_OWNER_FINANCIAL_GUARD_CONFIG }
  }
}

export async function saveOwnerFinancialGuardConfig(db, rawConfig) {
  const config = normalizeGuardConfig(rawConfig)
  await run(
    db,
    `INSERT INTO settings (key, value) VALUES ('owner_financial_guard_config', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(config)],
  )
  return config
}

export async function queueOwnerFinancialApproval(db, payload) {
  const actionType = normalizeActionType(payload?.actionType)
  const targetUserId = Number(payload?.targetUserId || 0)
  const actorUserId = Number(payload?.actorUserId || 0)
  const walletTransactionId = Number(payload?.walletTransactionId || 0)
  const amount = Number(payload?.amount || 0)
  if (!targetUserId || !actorUserId || !walletTransactionId || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('INVALID_INPUT')
  }
  await run(
    db,
    `INSERT INTO owner_financial_approval_reports (
       action_type, status, target_user_id, actor_user_id, currency, amount,
       reference_type, reference_id, wallet_transaction_id, note, metadata
     )
     VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(wallet_transaction_id) DO NOTHING`,
    [
      actionType,
      targetUserId,
      actorUserId,
      String(payload?.currency || 'USDT').trim().toUpperCase() || 'USDT',
      Number(amount.toFixed(8)),
      payload?.referenceType ? String(payload.referenceType).trim().slice(0, 80) : null,
      payload?.referenceId == null ? null : Number(payload.referenceId || 0),
      walletTransactionId,
      payload?.note ? String(payload.note).trim().slice(0, 500) : null,
      payload?.metadata ? JSON.stringify(payload.metadata) : null,
    ],
  )
  return get(db, `SELECT * FROM owner_financial_approval_reports WHERE wallet_transaction_id = ? LIMIT 1`, [walletTransactionId])
}

export async function maybeQueueOwnerFinancialApproval(db, payload) {
  const actor = payload?.actorUser || null
  if (isOwnerUser(actor)) return null
  const config = await getOwnerFinancialGuardConfig(db)
  if (!shouldTrackOwnerFinancialApproval(config, payload?.actionType)) return null
  return queueOwnerFinancialApproval(db, payload)
}

export async function listOwnerFinancialApprovals(db, status = 'pending', limit = 100) {
  const normalizedStatus = status === 'all' ? 'all' : normalizeStatus(status)
  const params = []
  let whereClause = ''
  if (normalizedStatus !== 'all') {
    whereClause = `WHERE r.status = ?`
    params.push(normalizedStatus)
  }
  params.push(Math.max(1, Math.min(300, Number(limit || 100))))
  const items = await all(
    db,
    `SELECT
       r.*,
       tu.email AS target_email,
       tu.phone AS target_phone,
       tu.display_name AS target_display_name,
       tu.referral_code AS target_referral_code,
       au.email AS actor_email,
       au.phone AS actor_phone,
       au.display_name AS actor_display_name,
       au.role AS actor_role,
       ru.email AS reviewer_email,
       ru.display_name AS reviewer_display_name
     FROM owner_financial_approval_reports r
     LEFT JOIN users tu ON tu.id = r.target_user_id
     LEFT JOIN users au ON au.id = r.actor_user_id
     LEFT JOIN users ru ON ru.id = r.reviewed_by
     ${whereClause}
     ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC, r.id DESC
     LIMIT ?`,
    params,
  )
  const summaryRows = await all(
    db,
    `SELECT status, COUNT(*) AS total, COALESCE(SUM(amount), 0) AS amount_total
     FROM owner_financial_approval_reports
     GROUP BY status`,
  )
  const summary = {
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    pendingAmount: 0,
  }
  for (const row of summaryRows) {
    const rowStatus = normalizeStatus(row?.status)
    const total = Number(row?.total || 0)
    const amountTotal = Number(row?.amount_total || 0)
    if (rowStatus === 'pending') {
      summary.pendingCount = total
      summary.pendingAmount = amountTotal
    } else if (rowStatus === 'approved') {
      summary.approvedCount = total
    } else if (rowStatus === 'rejected') {
      summary.rejectedCount = total
    }
  }
  return {
    config: await getOwnerFinancialGuardConfig(db),
    summary,
    items: items.map((row) => ({
      id: Number(row.id || 0),
      actionType: normalizeActionType(row.action_type),
      status: normalizeStatus(row.status),
      targetUserId: Number(row.target_user_id || 0),
      actorUserId: Number(row.actor_user_id || 0),
      reviewedBy: row.reviewed_by == null ? null : Number(row.reviewed_by),
      currency: row.currency || 'USDT',
      amount: Number(row.amount || 0),
      referenceType: row.reference_type || null,
      referenceId: row.reference_id == null ? null : Number(row.reference_id),
      walletTransactionId: row.wallet_transaction_id == null ? null : Number(row.wallet_transaction_id),
      note: row.note || null,
      ownerNote: row.owner_note || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
      reviewedAt: row.reviewed_at || null,
      reversedAt: row.reversed_at || null,
      metadata: parseMetadata(row.metadata),
      targetUser: {
        id: Number(row.target_user_id || 0),
        displayName: row.target_display_name || null,
        email: row.target_email || null,
        phone: row.target_phone || null,
        referralCode: row.target_referral_code || null,
      },
      actorUser: {
        id: Number(row.actor_user_id || 0),
        displayName: row.actor_display_name || null,
        email: row.actor_email || null,
        phone: row.actor_phone || null,
        role: row.actor_role || null,
      },
      reviewerUser: row.reviewed_by
        ? {
            id: Number(row.reviewed_by),
            displayName: row.reviewer_display_name || null,
            email: row.reviewer_email || null,
          }
        : null,
    })),
  }
}

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
      } catch {}
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

export async function reviewOwnerFinancialApproval(db, opts) {
  const reportId = Number(opts?.reportId || 0)
  const decision = String(opts?.decision || '').trim().toLowerCase()
  const reviewerUserId = Number(opts?.reviewerUserId || 0)
  const ownerNote = String(opts?.ownerNote || '').trim().slice(0, 500) || null
  if (!reportId || !reviewerUserId || !['approve', 'reject'].includes(decision)) {
    throw new Error('INVALID_INPUT')
  }
  return withTransaction(db, async (tx) => {
    const report = await get(
      tx,
      `SELECT *
       FROM owner_financial_approval_reports
       WHERE id = ? AND status = 'pending'
       LIMIT 1`,
      [reportId],
    )
    if (!report) throw new Error('NOT_FOUND')
    if (decision === 'approve') {
      await run(
        tx,
        `UPDATE owner_financial_approval_reports
         SET status = 'approved',
             owner_note = ?,
             reviewed_by = ?,
             reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [ownerNote, reviewerUserId, reportId],
      )
      return { decision: 'approved', reversed: false }
    }
    const reverse = await adjustBalance(tx, {
      userId: Number(report.target_user_id),
      currency: String(report.currency || 'USDT').trim().toUpperCase() || 'USDT',
      delta: -Math.abs(Number(report.amount || 0)),
      referenceType: 'owner_financial_reject',
      referenceId: reportId,
      idempotencyKey: `owner_financial_reject_${reportId}`,
      createdBy: reviewerUserId,
      note: ownerNote || `Owner rejected financial action #${reportId}`,
    })
    if (normalizeActionType(report.action_type) === 'deposit_approval' && Number(report.reference_id || 0) > 0) {
      await run(
        tx,
        `UPDATE user_principal_locks
         SET lock_status = 'unlocked',
             unlocked_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?
           AND source_type = 'deposit_request'
           AND source_id = ?
           AND lock_status = 'locked'`,
        [Number(report.target_user_id), Number(report.reference_id)],
      )
    }
    await run(
      tx,
      `UPDATE owner_financial_approval_reports
       SET status = 'rejected',
           owner_note = ?,
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           reversed_at = CURRENT_TIMESTAMP,
           reversal_wallet_transaction_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [ownerNote, reviewerUserId, reverse.walletTxnId, reportId],
    )
    return { decision: 'rejected', reversed: true, reversalWalletTxnId: reverse.walletTxnId }
  })
}
