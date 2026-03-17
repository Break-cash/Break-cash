/**
 * Wallet-based read helpers - Phase 2 migration.
 * Source of truth: wallet_accounts, wallet_transactions.
 * Use these instead of legacy balances / balance_transactions.
 */
import { all, get } from '../db.js'

/**
 * Get total main balance for user (sum of main+system wallet_accounts).
 */
export async function getWalletBalanceByUser(db) {
  const rows = await all(
    db,
    `SELECT user_id, SUM(balance_amount) AS total_balance
     FROM wallet_accounts
     WHERE account_type = 'main' AND source_type = 'system'
     GROUP BY user_id`,
  )
  return new Map(rows.map((r) => [Number(r.user_id), Number(r.total_balance || 0)]))
}

/**
 * Get deposits total per user from wallet_transactions.
 */
export async function getDepositsTotalByUser(db) {
  const rows = await all(
    db,
    `SELECT user_id, COALESCE(SUM(amount), 0) AS total_deposits
     FROM wallet_transactions
     WHERE transaction_type = 'deposit' AND amount > 0
     GROUP BY user_id`,
  )
  return new Map(rows.map((r) => [Number(r.user_id), Number(r.total_deposits || 0)]))
}

/**
 * Get withdrawals total per user from wallet_transactions.
 */
export async function getWithdrawalsTotalByUser(db) {
  const rows = await all(
    db,
    `SELECT user_id, COALESCE(SUM(ABS(amount)), 0) AS total_withdrawals
     FROM wallet_transactions
     WHERE transaction_type = 'withdrawal' AND amount < 0
     GROUP BY user_id`,
  )
  return new Map(rows.map((r) => [Number(r.user_id), Number(r.total_withdrawals || 0)]))
}

/**
 * Get platform-wide totals from wallet_accounts and wallet_transactions.
 */
export async function getPlatformWalletTotals(db) {
  const balanceRow = await get(
    db,
    `SELECT COUNT(*) AS balancesCount, COALESCE(SUM(balance_amount), 0) AS totalAmount
     FROM wallet_accounts
     WHERE account_type = 'main' AND source_type = 'system'`,
  )
  const txRow = await get(db, `SELECT COUNT(*) AS count FROM wallet_transactions`)
  return {
    balancesCount: Number(balanceRow?.balancesCount || 0),
    totalAmount: Number(balanceRow?.totalAmount || 0),
    transactionsCount: Number(txRow?.count || 0),
  }
}

/**
 * Get transaction stats (deposits/withdrawals totals) from wallet_transactions.
 */
export async function getTransactionStats(db) {
  const row = await get(
    db,
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type = 'deposit' AND amount > 0 THEN amount ELSE 0 END), 0) AS depositsTotal,
       COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' AND amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS withdrawTotal
     FROM wallet_transactions`,
  )
  return {
    depositsTotal: Number(row?.depositsTotal || 0),
    withdrawTotal: Number(row?.withdrawTotal || 0),
  }
}

/**
 * Get mining monthly aggregate from wallet_transactions (earning_credit + mining source).
 */
export async function getMiningMonthlyAggregate(db, userId, startIso, endIso) {
  const row = await get(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM wallet_transactions
     WHERE user_id = ?
       AND transaction_type = 'earning_credit'
       AND source_type = 'mining'
       AND created_at >= ?
       AND created_at < ?`,
    [userId, startIso, endIso],
  )
  return Number(row?.total || 0)
}
