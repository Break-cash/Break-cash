/**
 * Wallet reconciliation service.
 * Verifies consistency between wallet_accounts, wallet_transactions, and legacy balances.
 * Phase 1: Stabilization and verification.
 */
import { all, get } from '../db.js'
import { getMainBalance } from './wallet-ledger.js'

/**
 * Recompute expected balance from wallet_transactions for a user/currency.
 * Sum of net_amount for main+system account.
 */
export async function computeBalanceFromLedger(db, userId, currency) {
  const curr = String(currency || 'USDT').trim().toUpperCase()
  const rows = await all(
    db,
    `SELECT net_amount FROM wallet_transactions
     WHERE user_id = ? AND currency = ?
     AND COALESCE(account_type_before, 'main') = 'main'
     AND source_type = 'system'
     ORDER BY id ASC`,
    [userId, curr],
  )
  const sum = rows.reduce((acc, r) => acc + Number(r?.net_amount || 0), 0)
  return Number(sum.toFixed(8))
}

/**
 * Get wallet_accounts balance for user/currency (main+system).
 */
export async function getWalletAccountBalance(db, userId, currency) {
  const row = await get(
    db,
    `SELECT balance_amount FROM wallet_accounts
     WHERE user_id = ? AND currency = ? AND account_type = 'main' AND source_type = 'system'
     LIMIT 1`,
    [userId, currency],
  )
  return Number(row?.balance_amount || 0)
}

/**
 * Get legacy balances.amount for user/currency.
 */
export async function getLegacyBalance(db, userId, currency) {
  const row = await get(
    db,
    `SELECT amount FROM balances WHERE user_id = ? AND currency = ? LIMIT 1`,
    [userId, currency],
  )
  return Number(row?.amount || 0)
}

/**
 * Reconcile a single user/currency.
 * Returns { ok, walletBalance, legacyBalance, ledgerSum, drift, message }
 */
export async function reconcileUserCurrency(db, userId, currency = 'USDT') {
  const walletBalance = await getWalletAccountBalance(db, userId, currency)
  const legacyBalance = await getLegacyBalance(db, userId, currency)
  const ledgerSum = await computeBalanceFromLedger(db, userId, currency)

  const walletVsLegacy = Math.abs(walletBalance - legacyBalance) < 0.00000001
  const walletVsLedger = Math.abs(walletBalance - ledgerSum) < 0.00000001

  const ok = walletVsLegacy && walletVsLedger
  if (!ok) {
    console.warn(
      `[wallet-reconciliation] Integrity mismatch user=${userId} currency=${currency}: ` +
        (walletVsLegacy ? '' : `legacy drift=${(walletBalance - legacyBalance).toFixed(8)} `) +
        (walletVsLedger ? '' : `ledger sum=${ledgerSum} wallet=${walletBalance}`),
    )
  }

  return {
    userId,
    currency,
    walletBalance,
    legacyBalance,
    ledgerSum,
    walletVsLegacyOk: walletVsLegacy,
    walletVsLedgerOk: walletVsLedger,
    ok,
    drift: walletVsLegacy ? 0 : Number((walletBalance - legacyBalance).toFixed(8)),
    message: ok
      ? 'OK'
      : !walletVsLegacy
        ? `Legacy drift: ${(walletBalance - legacyBalance).toFixed(8)}`
        : `Ledger sum mismatch: wallet=${walletBalance} ledger=${ledgerSum}`,
  }
}

/**
 * Reconcile all users with wallet_accounts or balances.
 * Returns list of discrepancies.
 */
export async function reconcileAll(db, limit = 500) {
  const walletUsers = await all(
    db,
    `SELECT DISTINCT user_id, currency FROM wallet_accounts
     WHERE account_type = 'main' AND source_type = 'system'
     LIMIT ?`,
    [limit],
  )
  const legacyUsers = await all(
    db,
    `SELECT DISTINCT user_id, currency FROM balances LIMIT ?`,
    [limit],
  )

  const seen = new Set(walletUsers.map((r) => `${r.user_id}:${r.currency}`))
  for (const r of legacyUsers) {
    const key = `${r.user_id}:${r.currency}`
    if (!seen.has(key)) seen.add(key)
  }

  const results = []
  for (const key of seen) {
    const [uid, curr] = key.split(':')
    const userId = Number(uid)
    const currency = String(curr || 'USDT').trim().toUpperCase()
    if (!userId || !currency) continue
    const result = await reconcileUserCurrency(db, userId, currency)
    if (!result.ok) results.push(result)
  }
  return results
}

/**
 * Integrity check: earning_entries transferred should have matching wallet_transaction.
 */
export async function verifyEarningTransfers(db, limit = 100) {
  const rows = await all(
    db,
    `SELECT ee.id, ee.user_id, ee.amount, ee.transferred_wallet_txn_id, ee.status
     FROM earning_entries ee
     WHERE ee.status = 'transferred' AND ee.transferred_wallet_txn_id IS NOT NULL
     ORDER BY ee.id DESC LIMIT ?`,
    [limit],
  )
  const issues = []
  for (const r of rows) {
    const txn = await get(
      db,
      `SELECT id, net_amount, reference_type, reference_id FROM wallet_transactions WHERE id = ?`,
      [r.transferred_wallet_txn_id],
    )
    if (!txn) {
      issues.push({ earningEntryId: r.id, issue: 'Missing wallet_transaction' })
    } else if (Math.abs(Number(txn.net_amount) - Number(r.amount)) > 0.00000001) {
      issues.push({ earningEntryId: r.id, issue: 'Amount mismatch', txnAmount: txn.net_amount, entryAmount: r.amount })
    }
  }
  if (issues.length > 0) {
    console.warn(`[wallet-reconciliation] Failed earning transfers: ${issues.length} issue(s)`, issues.slice(0, 5))
  }
  return { checked: rows.length, issues }
}

/**
 * Verify approved/completed deposit and withdrawal requests have wallet_transaction_id.
 */
export async function verifyDepositWithdrawalLinkage(db, limit = 200) {
  const deposits = await all(
    db,
    `SELECT id, user_id, amount, currency, request_status, wallet_transaction_id
     FROM deposit_requests
     WHERE request_status IN ('approved', 'completed') AND wallet_transaction_id IS NULL
     ORDER BY id DESC LIMIT ?`,
    [limit],
  )
  const withdrawals = await all(
    db,
    `SELECT id, user_id, amount, currency, request_status, wallet_transaction_id
     FROM withdrawal_requests
     WHERE request_status IN ('approved', 'completed') AND wallet_transaction_id IS NULL
     ORDER BY id DESC LIMIT ?`,
    [limit],
  )
  const issues = [
    ...deposits.map((r) => ({ type: 'deposit', id: r.id, userId: r.user_id, amount: r.amount, status: r.request_status })),
    ...withdrawals.map((r) => ({ type: 'withdrawal', id: r.id, userId: r.user_id, amount: r.amount, status: r.request_status })),
  ]
  if (issues.length > 0) {
    console.warn(`[wallet-reconciliation] Failed deposit/withdrawal linkage: ${issues.length} request(s) missing wallet_transaction_id`, issues.slice(0, 5))
  }
  return { depositIssues: deposits.length, withdrawalIssues: withdrawals.length, issues }
}

/**
 * Verify users with positive ledger sum have matching wallet_accounts balance.
 */
export async function verifyUnexpectedZeroBalances(db, limit = 100) {
  const rows = await all(
    db,
    `SELECT user_id, currency, SUM(net_amount) AS ledger_sum
     FROM wallet_transactions
     WHERE COALESCE(account_type_before, 'main') = 'main' AND source_type = 'system'
     GROUP BY user_id, currency
     HAVING SUM(net_amount) > 0.00000001
     LIMIT ?`,
    [limit],
  )
  const issues = []
  for (const r of rows) {
    const wallet = await getWalletAccountBalance(db, r.user_id, r.currency)
    const ledgerSum = Number(r.ledger_sum || 0)
    if (Math.abs(wallet - ledgerSum) > 0.00000001) {
      issues.push({ userId: r.user_id, currency: r.currency, ledgerSum, walletBalance: wallet })
    }
  }
  if (issues.length > 0) {
    console.warn(`[wallet-reconciliation] Unexpected zero/mismatch: ${issues.length} user(s)`, issues.slice(0, 5))
  }
  return { checked: rows.length, issues }
}
