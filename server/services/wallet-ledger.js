/**
 * Unified wallet ledger service.
 * Every balance-changing operation should go through this service.
 * Supports idempotency, multi-source accounting, and extensible earning sources.
 * Source of truth: wallet_accounts + wallet_transactions.
 * Legacy balances/balance_transactions: transition layer only (dual-write for compatibility).
 */
import { all, get, run } from '../db.js'

export const ACCOUNT_TYPES = Object.freeze(['main', 'locked', 'withdrawable', 'pending'])
export const SOURCE_TYPES = Object.freeze(['system', 'mining', 'tasks', 'referrals', 'deposits'])
export const TRANSACTION_TYPES = Object.freeze([
  'deposit',
  'withdrawal',
  'transfer',
  'earning_credit',
  'lock',
  'unlock',
  'adjust',
  'fee',
])

/**
 * Get or create wallet account for (user_id, currency, account_type, source_type)
 */
export async function getOrCreateWalletAccount(db, userId, currency, accountType = 'main', sourceType = 'system') {
  const curr = String(currency || 'USDT').trim().toUpperCase()
  const acc = String(accountType || 'main').trim().toLowerCase()
  const src = String(sourceType || 'system').trim().toLowerCase()

  let row = await get(
    db,
    `SELECT id, balance_amount FROM wallet_accounts
     WHERE user_id = ? AND currency = ? AND account_type = ? AND source_type = ?
     LIMIT 1`,
    [userId, curr, acc, src],
  )
  if (row) return row

  await run(
    db,
    `INSERT INTO wallet_accounts (user_id, currency, account_type, source_type, balance_amount)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(user_id, currency, account_type, source_type) DO NOTHING`,
    [userId, curr, acc, src],
  )
  row = await get(
    db,
    `SELECT id, balance_amount FROM wallet_accounts
     WHERE user_id = ? AND currency = ? AND account_type = ? AND source_type = ?
     LIMIT 1`,
    [userId, curr, acc, src],
  )
  return row || { id: null, balance_amount: 0 }
}

/**
 * Get main balance for user (sum of main+system account).
 * Source of truth: wallet_accounts. Phase 2: no legacy fallback.
 */
export async function getMainBalance(db, userId, currency) {
  const curr = String(currency || 'USDT').trim().toUpperCase()
  const row = await get(
    db,
    `SELECT COALESCE(balance_amount, 0) AS balance FROM wallet_accounts
     WHERE user_id = ? AND currency = ? AND account_type = 'main' AND source_type = 'system'
     LIMIT 1`,
    [userId, curr],
  )
  return row != null ? Number(row.balance || 0) : 0
}

/**
 * Sync wallet_accounts main balance to legacy balances table (transition layer).
 * LEGACY: One-way write only. Phase 3: remove when legacy tables retired.
 */
export async function syncToLegacyBalances(db, userId, currency, amount) {
  const curr = String(currency || 'USDT').trim().toUpperCase()
  await run(
    db,
    `INSERT INTO balances (user_id, currency, amount, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, currency) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
    [userId, curr, Number(amount)],
  )
}

/**
 * Append to legacy balance_transactions (transition layer). Returns txn id for processed_txn_id FK.
 * LEGACY: One-way write only. Phase 3: remove when processed_txn_id deprecated.
 */
export async function appendLegacyBalanceTransaction(db, payload) {
  const res = await run(
    db,
    `INSERT INTO balance_transactions (user_id, admin_id, type, currency, amount, note)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    [payload.userId, payload.adminId || null, payload.type, payload.currency, payload.amount, payload.note || null],
  )
  return Number(res.rows?.[0]?.id ?? res.lastID ?? 0)
}

/**
 * Record a wallet transaction with idempotency.
 * If idempotencyKey is provided and already exists, returns existing transaction.
 */
export async function recordTransaction(db, payload) {
  const {
    userId,
    currency = 'USDT',
    transactionType,
    sourceType = 'system',
    referenceType,
    referenceId,
    amount,
    feeAmount = 0,
    accountType = 'main',
    metadata,
    idempotencyKey,
    createdBy,
  } = payload

  const curr = String(currency).trim().toUpperCase()
  const netAmount = Number((Number(amount) - Number(feeAmount)).toFixed(8))

  if (idempotencyKey) {
    const existing = await get(
      db,
      `SELECT id, user_id, net_amount FROM wallet_transactions WHERE idempotency_key = ? LIMIT 1`,
      [idempotencyKey],
    )
    if (existing) return { id: existing.id, isExisting: true }
  }

  const account = await getOrCreateWalletAccount(db, userId, curr, accountType, sourceType)
  const balanceBefore = Number(account?.balance_amount || 0)
  const balanceAfter = Number((balanceBefore + netAmount).toFixed(8))

  if (balanceAfter < 0) {
    throw new Error('INSUFFICIENT_BALANCE')
  }

  const metaJson = metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : metadata || null

  const result = await run(
    db,
    `INSERT INTO wallet_transactions (
      user_id, currency, transaction_type, source_type, reference_type, reference_id,
      amount, fee_amount, net_amount, balance_before, balance_after,
      account_type_before, account_type_after, metadata, idempotency_key, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      userId,
      curr,
      transactionType,
      sourceType,
      referenceType || null,
      referenceId || null,
      amount,
      feeAmount,
      netAmount,
      balanceBefore,
      balanceAfter,
      accountType,
      accountType,
      metaJson,
      idempotencyKey || null,
      createdBy || null,
    ],
  )

  const txnId = result.rows?.[0]?.id ?? result.lastID

  await run(
    db,
    `UPDATE wallet_accounts SET balance_amount = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND currency = ? AND account_type = ? AND source_type = ?`,
    [balanceAfter, userId, curr, accountType, sourceType],
  )

  if (accountType === 'main' && sourceType === 'system') {
    await syncToLegacyBalances(db, userId, curr, balanceAfter)
  }

  return { id: txnId, isExisting: false }
}

/**
 * Create earning entry (pending transfer to main balance)
 */
export async function createEarningEntry(db, payload) {
  const { userId, sourceType, referenceType, referenceId, currency = 'USDT', amount } = payload

  const result = await run(
    db,
    `INSERT INTO earning_entries (user_id, source_type, reference_type, reference_id, currency, amount, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')
     ON CONFLICT(source_type, reference_type, reference_id) DO NOTHING`,
    [userId, sourceType, referenceType, referenceId, currency, amount],
  )

  const id = result.lastID || result.rows?.[0]?.id
  return id ? { id } : await get(db, `SELECT id FROM earning_entries WHERE source_type = ? AND reference_type = ? AND reference_id = ? LIMIT 1`, [sourceType, referenceType, referenceId])
}

/**
 * Transfer earning entry to main balance and record in ledger
 */
export async function transferEarningToMain(db, earningEntryId, idempotencyKey = null) {
  const entry = await get(db, `SELECT * FROM earning_entries WHERE id = ? AND status = 'pending' LIMIT 1`, [earningEntryId])
  if (!entry) return null

  const txn = await recordTransaction(db, {
    userId: entry.user_id,
    currency: entry.currency,
    transactionType: 'earning_credit',
    sourceType: entry.source_type,
    referenceType: 'earning_entry',
    referenceId: entry.id,
    amount: entry.amount,
    idempotencyKey: idempotencyKey || `earning_${entry.id}`,
  })

  await run(
    db,
    `UPDATE earning_entries SET status = 'transferred', transferred_at = CURRENT_TIMESTAMP, transferred_wallet_txn_id = ?
     WHERE id = ?`,
    [txn.id, earningEntryId],
  )

  return txn
}

/**
 * Get wallet transaction history for user (audit-safe)
 */
export async function getWalletHistory(db, userId, currency = null, limit = 100) {
  const curr = currency ? String(currency).trim().toUpperCase() : null
  const rows = curr
    ? await all(
        db,
        `SELECT id, currency, transaction_type, source_type, reference_type, reference_id,
                amount, fee_amount, net_amount, balance_before, balance_after, created_at
         FROM wallet_transactions WHERE user_id = ? AND currency = ?
         ORDER BY created_at DESC LIMIT ?`,
        [userId, curr, limit],
      )
    : await all(
        db,
        `SELECT id, currency, transaction_type, source_type, reference_type, reference_id,
                amount, fee_amount, net_amount, balance_before, balance_after, created_at
         FROM wallet_transactions WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ?`,
        [userId, limit],
      )
  return rows
}

/**
 * Get earning entries history for user (audit-safe)
 */
export async function getEarningHistory(db, userId, sourceType = null, limit = 100) {
  const src = sourceType ? String(sourceType).trim().toLowerCase() : null
  const rows = src
    ? await all(
        db,
        `SELECT id, source_type, reference_type, reference_id, currency, amount, status,
                transferred_at, transferred_wallet_txn_id, created_at
         FROM earning_entries WHERE user_id = ? AND source_type = ?
         ORDER BY created_at DESC LIMIT ?`,
        [userId, src, limit],
      )
    : await all(
        db,
        `SELECT id, source_type, reference_type, reference_id, currency, amount, status,
                transferred_at, transferred_wallet_txn_id, created_at
         FROM earning_entries WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ?`,
        [userId, limit],
      )
  return rows
}
