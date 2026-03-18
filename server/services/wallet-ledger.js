/**
 * Unified wallet ledger service.
 * Every balance-changing operation should go through this service.
 * Source of truth: wallet_accounts + wallet_transactions + earning_entries.
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
 * Get all wallet account balances for user, aggregated by source_type per currency.
 * @returns {Promise<{ total_assets: number, by_currency: Record<string, number>, by_source: Array<{ source_type, currency, balance }> }>}
 */
export async function getWalletAccountsOverview(db, userId) {
  const rows = await all(
    db,
    `SELECT currency, account_type, source_type, balance_amount
     FROM wallet_accounts WHERE user_id = ?`,
    [userId],
  )
  let totalAssets = 0
  const byCurrency = {}
  const bySource = []
  for (const r of rows) {
    const amt = Number(r.balance_amount || 0)
    totalAssets = Number((totalAssets + amt).toFixed(8))
    const curr = String(r.currency || 'USDT').toUpperCase()
    byCurrency[curr] = Number((Number(byCurrency[curr] || 0) + amt).toFixed(8))
    bySource.push({
      source_type: String(r.source_type || 'system'),
      currency: curr,
      account_type: String(r.account_type || 'main'),
      balance: amt,
    })
  }
  const bySourceAgg = {}
  for (const s of bySource) {
    const key = `${s.source_type}:${s.currency}`
    if (!bySourceAgg[key]) bySourceAgg[key] = { source_type: s.source_type, currency: s.currency, balance: 0 }
    bySourceAgg[key].balance = Number((Number(bySourceAgg[key].balance) + s.balance).toFixed(8))
  }
  return {
    total_assets: totalAssets,
    by_currency: byCurrency,
    by_source: Object.values(bySourceAgg).filter((x) => x.balance > 0),
  }
}

/**
 * Get main balance for user (sum of main+system account).
 * Source of truth: wallet_accounts.
 * If no row exists, creates one with balance 0 (lazy init) so we don't log errors on first read.
 */
export async function getMainBalance(db, userId, currency) {
  const curr = String(currency || 'USDT').trim().toUpperCase()
  let row = await get(
    db,
    `SELECT COALESCE(balance_amount, 0) AS balance FROM wallet_accounts
     WHERE user_id = ? AND currency = ? AND account_type = 'main' AND source_type = 'system'
     LIMIT 1`,
    [userId, curr],
  )
  if (row == null) {
    await getOrCreateWalletAccount(db, userId, curr, 'main', 'system')
    row = await get(
      db,
      `SELECT COALESCE(balance_amount, 0) AS balance FROM wallet_accounts
       WHERE user_id = ? AND currency = ? AND account_type = 'main' AND source_type = 'system'
       LIMIT 1`,
      [userId, curr],
    )
  }
  return row != null ? Number(row.balance || 0) : 0
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

/** Human-readable labels for transaction types */
export const TRANSACTION_TYPE_LABELS = Object.freeze({
  deposit: 'deposit',
  withdrawal: 'withdrawal',
  transfer: 'transfer',
  earning_credit: 'earning_credit',
  lock: 'lock',
  unlock: 'unlock',
  adjust: 'adjust',
  fee: 'fee',
})

/** Human-readable labels for source types */
export const SOURCE_TYPE_LABELS = Object.freeze({
  system: 'system',
  mining: 'mining',
  tasks: 'tasks',
  referrals: 'referrals',
  deposits: 'deposits',
})

/**
 * Get wallet transaction history for user (audit-safe)
 * @param {object} opts - { currency?, sourceType?, transactionType?, dateFrom?, dateTo?, limit? } or (currency, limit) for backward compat
 */
export async function getWalletHistory(db, userId, optsOrCurrency = {}, maybeLimit = null) {
  let currency = null
  let sourceType = null
  let transactionType = null
  let dateFrom = null
  let dateTo = null
  let limit = 100
  if (optsOrCurrency != null && typeof optsOrCurrency === 'object' && !Array.isArray(optsOrCurrency)) {
    currency = optsOrCurrency.currency ?? null
    sourceType = optsOrCurrency.sourceType ?? null
    transactionType = optsOrCurrency.transactionType ?? null
    dateFrom = optsOrCurrency.dateFrom ?? null
    dateTo = optsOrCurrency.dateTo ?? null
    limit = optsOrCurrency.limit ?? 100
  } else if (typeof optsOrCurrency === 'string') {
    currency = optsOrCurrency
    limit = typeof maybeLimit === 'number' ? maybeLimit : 100
  }

  const curr = currency ? String(currency).trim().toUpperCase() : null
  const src = sourceType ? String(sourceType).trim().toLowerCase() : null
  const txnType = transactionType ? String(transactionType).trim().toLowerCase() : null
  const fromDate = dateFrom ? String(dateFrom).trim().slice(0, 10) : null
  const toDate = dateTo ? String(dateTo).trim().slice(0, 10) : null
  const lim = Math.min(Number(limit) || 100, 200)

  const conditions = ['user_id = ?']
  const params = [userId]
  if (curr) {
    conditions.push('currency = ?')
    params.push(curr)
  }
  if (src) {
    conditions.push('source_type = ?')
    params.push(src)
  }
  if (txnType) {
    conditions.push('transaction_type = ?')
    params.push(txnType)
  }
  if (fromDate) {
    conditions.push("DATE(created_at) >= ?")
    params.push(fromDate)
  }
  if (toDate) {
    conditions.push("DATE(created_at) <= ?")
    params.push(toDate)
  }
  params.push(lim)

  const whereClause = conditions.join(' AND ')
  const rows = await all(
    db,
    `SELECT id, currency, transaction_type, source_type, reference_type, reference_id,
            amount, fee_amount, net_amount, balance_before, balance_after, metadata, created_at
     FROM wallet_transactions
     WHERE ${whereClause}
     ORDER BY created_at DESC LIMIT ?`,
    params,
  )
  return rows.map((r) => ({
    ...r,
    label_key: `wallet_txn_${r.transaction_type}`,
    source_label_key: `wallet_source_${r.source_type}`,
  }))
}

/**
 * Get earning entries history for user (audit-safe)
 * Returns flat list with label keys; optionally grouped by source_type.
 * @param {object} opts - { sourceType?, limit?, grouped? } or (sourceType, limit) for backward compat
 */
export async function getEarningHistory(db, userId, optsOrSourceType = {}, maybeLimit = null) {
  let sourceType = null
  let limit = 100
  let grouped = false
  if (typeof optsOrSourceType === 'string') {
    sourceType = optsOrSourceType
    limit = typeof maybeLimit === 'number' ? maybeLimit : 100
  } else if (optsOrSourceType != null && typeof optsOrSourceType === 'object') {
    sourceType = optsOrSourceType.sourceType ?? null
    limit = optsOrSourceType.limit ?? 100
    grouped = optsOrSourceType.grouped ?? false
  }

  const src = sourceType ? String(sourceType).trim().toLowerCase() : null
  const lim = Math.min(Number(limit) || 100, 200)

  const conditions = ['user_id = ?']
  const params = [userId]
  if (src) {
    conditions.push('source_type = ?')
    params.push(src)
  }
  params.push(lim)

  const whereClause = conditions.join(' AND ')
  const rows = await all(
    db,
    `SELECT id, source_type, reference_type, reference_id, currency, amount, status,
            transferred_at, transferred_wallet_txn_id, created_at
     FROM earning_entries
     WHERE ${whereClause}
     ORDER BY created_at DESC LIMIT ?`,
    params,
  )

  const entries = rows.map((r) => ({
    ...r,
    label_key: `earning_source_${r.source_type}`,
    status_label_key: r.status === 'transferred' ? 'earning_status_transferred' : 'earning_status_pending',
  }))

  if (!grouped) return entries

  const bySource = {}
  for (const e of entries) {
    const key = String(e.source_type || 'system')
    if (!bySource[key]) bySource[key] = { source_type: key, entries: [], total_amount: 0, transferred_count: 0, pending_count: 0 }
    bySource[key].entries.push(e)
    bySource[key].total_amount = Number((Number(bySource[key].total_amount) + Number(e.amount || 0)).toFixed(8))
    if (e.status === 'transferred') bySource[key].transferred_count += 1
    else bySource[key].pending_count += 1
  }
  return { entries, grouped: Object.values(bySource) }
}
