/**
 * Centralized wallet service - the ONLY entry point for financial operations.
 * All balance-changing actions MUST go through these functions.
 * Source of truth: wallet_accounts + wallet_transactions + earning_entries.
 * Legacy balances/balance_transactions: one-way sync only (transition layer).
 */
import { get } from '../db.js'
import {
  getMainBalance,
  getOrCreateWalletAccount,
  recordTransaction,
  createEarningEntry,
  transferEarningToMain,
  syncToLegacyBalances,
  appendLegacyBalanceTransaction,
  getWalletHistory,
  getEarningHistory,
} from './wallet-ledger.js'

// Re-export for consumers
export { getMainBalance, getWalletHistory, getEarningHistory }

/**
 * Create deposit (credit main balance). Idempotent.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, currency, amount, referenceType, referenceId, idempotencyKey, createdBy }
 * @returns {{ walletTxnId, legacyTxnId, balanceAfter }}
 */
export async function createDeposit(db, opts) {
  const { userId, currency = 'USDT', amount, referenceType = 'deposit_request', referenceId, idempotencyKey, createdBy } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_INPUT')
  const txn = await recordTransaction(db, {
    userId,
    currency,
    transactionType: 'deposit',
    sourceType: 'system',
    referenceType,
    referenceId,
    amount,
    idempotencyKey,
    createdBy,
  })
  const legacyId = await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: createdBy || null,
    type: 'deposit',
    currency,
    amount,
    note: opts.note || `Deposit ${referenceType} #${referenceId || ''}`,
  })
  const balanceAfter = await getMainBalance(db, userId, currency)
  return { walletTxnId: txn.id, legacyTxnId: legacyId, balanceAfter }
}

/**
 * Approve deposit - alias for createDeposit when admin approves a request.
 */
export async function approveDeposit(db, opts) {
  return createDeposit(db, { ...opts, referenceType: 'deposit_request' })
}

/**
 * Create withdrawal (debit main balance). Idempotent.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, currency, amount, referenceType, referenceId, idempotencyKey, createdBy }
 * @returns {{ walletTxnId, legacyTxnId, balanceAfter }}
 */
export async function createWithdrawal(db, opts) {
  const { userId, currency = 'USDT', amount, referenceType = 'withdrawal_request', referenceId, idempotencyKey, createdBy } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_INPUT')
  const balance = await getMainBalance(db, userId, currency)
  if (balance < amount) throw new Error('INSUFFICIENT_BALANCE')
  const txn = await recordTransaction(db, {
    userId,
    currency,
    transactionType: 'withdrawal',
    sourceType: 'system',
    referenceType,
    referenceId,
    amount: -amount,
    idempotencyKey,
    createdBy,
  })
  const legacyId = await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: createdBy || null,
    type: 'withdraw',
    currency,
    amount,
    note: opts.note || `Withdrawal ${referenceType} #${referenceId || ''}`,
  })
  const balanceAfter = await getMainBalance(db, userId, currency)
  return { walletTxnId: txn.id, legacyTxnId: legacyId, balanceAfter }
}

/**
 * Approve withdrawal - alias for createWithdrawal when admin approves a request.
 */
export async function approveWithdrawal(db, opts) {
  return createWithdrawal(db, { ...opts, referenceType: 'withdrawal_request' })
}

/**
 * Create mining subscription - lock principal from main balance. Idempotent.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, currency, amount, idempotencyKey }
 * @returns {{ walletTxnId, legacyTxnId, balanceAfter }}
 */
export async function createMiningSubscription(db, opts) {
  const { userId, currency = 'USDT', amount, idempotencyKey } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_INPUT')
  const balance = await getMainBalance(db, userId, currency)
  if (balance < amount) throw new Error('INSUFFICIENT_BALANCE')
  const txn = await recordTransaction(db, {
    userId,
    currency,
    transactionType: 'lock',
    sourceType: 'mining',
    referenceType: 'mining_subscription',
    referenceId: userId,
    amount: -amount,
    idempotencyKey: idempotencyKey || `mining_subscribe_${userId}_${Math.floor(Date.now() / 1000)}`,
  })
  const legacyId = await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: null,
    type: 'mining_subscribe',
    currency,
    amount,
    note: `Mining subscription ${amount}`,
  })
  const balanceAfter = await getMainBalance(db, userId, currency)
  return { walletTxnId: txn.id, legacyTxnId: legacyId, balanceAfter }
}

/**
 * Record mining daily profit as earning entry, then transfer to main. Idempotent.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, amount, profileId, referenceId (unique per claim) }
 * @returns {{ earningEntryId, walletTxnId, legacyTxnId, balanceAfter }}
 */
export async function recordMiningDailyProfit(db, opts) {
  const { userId, amount, profileId, referenceId } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0 || !referenceId) throw new Error('INVALID_INPUT')
  const earningResult = await createEarningEntry(db, {
    userId,
    sourceType: 'mining',
    referenceType: 'mining_daily_claim',
    referenceId,
    currency: 'USDT',
    amount,
  })
  const entryRow = typeof earningResult?.id === 'number' ? earningResult : await get(db, `SELECT id FROM earning_entries WHERE source_type = 'mining' AND reference_type = 'mining_daily_claim' AND reference_id = ? LIMIT 1`, [referenceId])
  const entryId = entryRow?.id
  if (!entryId) throw new Error('EARNING_ENTRY_FAILED')
  const txn = await transferEarningToMain(db, entryId, `mining_daily_${userId}_${referenceId}`)
  if (!txn) return null
  const legacyId = await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: null,
    type: 'mining_daily_claim',
    currency: 'USDT',
    amount,
    note: 'Daily mining profit claim',
  })
  const balanceAfter = await getMainBalance(db, userId, 'USDT')
  return { earningEntryId: entryId, walletTxnId: txn.id, legacyTxnId: legacyId, balanceAfter }
}

/**
 * Transfer source earnings to main balance. For mining daily, use recordMiningDailyProfit.
 * For tasks, referrals, etc. - create earning entry first, then call this.
 * @param {object} db - Database handle
 * @param {object} opts - { earningEntryId, idempotencyKey }
 * @returns {{ walletTxnId, balanceAfter } | null}
 */
export async function transferSourceEarningsToMain(db, opts) {
  const { earningEntryId, idempotencyKey } = opts
  if (!earningEntryId) return null
  const txn = await transferEarningToMain(db, earningEntryId, idempotencyKey)
  if (!txn) return null
  const entry = await get(db, `SELECT user_id, currency FROM earning_entries WHERE id = ? LIMIT 1`, [earningEntryId])
  const balanceAfter = entry ? await getMainBalance(db, entry.user_id, entry.currency) : 0
  return { walletTxnId: txn.id, balanceAfter }
}

/**
 * Settle mining at maturity - return principal to main. Idempotent.
 * Invariant: principal cannot be returned twice.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, principal, profileId, idempotencyKey }
 * @returns {{ walletTxnId, legacyTxnId, balanceAfter }}
 */
export async function settleMiningAtMaturity(db, opts) {
  const { userId, principal, profileId, idempotencyKey } = opts
  if (!userId || !Number.isFinite(principal) || principal <= 0) throw new Error('INVALID_INPUT')
  const key = idempotencyKey || `mining_release_${userId}`
  const txn = await recordTransaction(db, {
    userId,
    currency: 'USDT',
    transactionType: 'unlock',
    sourceType: 'mining',
    referenceType: 'mining_principal_release',
    referenceId: profileId,
    amount: principal,
    idempotencyKey: key,
  })
  const legacyId = await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: null,
    type: 'mining_principal_release',
    currency: 'USDT',
    amount: principal,
    note: 'Mining principal released at maturity',
  })
  const balanceAfter = await getMainBalance(db, userId, 'USDT')
  return { walletTxnId: txn.id, legacyTxnId: legacyId, balanceAfter }
}

/**
 * Execute mining emergency withdrawal. Apply fee, return net to main. Idempotent.
 * Invariant: cannot run after maturity settlement; subscription must be closed.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, principal, feeAmount, profileId, idempotencyKey }
 * @returns {{ walletTxnId, legacyTxnId, netAmount, balanceAfter }}
 */
export async function executeMiningEmergencyWithdrawal(db, opts) {
  const { userId, principal, feeAmount = 0, profileId, idempotencyKey } = opts
  if (!userId || !Number.isFinite(principal) || principal <= 0) throw new Error('INVALID_INPUT')
  const netAmount = Number(Math.max(0, principal - feeAmount).toFixed(8))
  const key = idempotencyKey || `mining_emergency_${userId}`
  const txn = await recordTransaction(db, {
    userId,
    currency: 'USDT',
    transactionType: 'transfer',
    sourceType: 'mining',
    referenceType: 'mining_emergency_withdraw',
    referenceId: profileId,
    amount: principal,
    feeAmount,
    idempotencyKey: key,
  })
  const legacyId = await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: null,
    type: 'mining_emergency_withdraw',
    currency: 'USDT',
    amount: netAmount,
    note: `Emergency withdraw, fee ${feeAmount}`,
  })
  const balanceAfter = await getMainBalance(db, userId, 'USDT')
  return { walletTxnId: txn.id, legacyTxnId: legacyId, netAmount, balanceAfter }
}

/**
 * Admin/owner balance adjustment. Idempotent.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, currency, delta, referenceType, referenceId, idempotencyKey, createdBy }
 * @returns {{ walletTxnId, legacyTxnId, balanceAfter }}
 */
export async function adjustBalance(db, opts) {
  const { userId, currency = 'USDT', delta, referenceType = 'admin_adjust', referenceId, idempotencyKey, createdBy } = opts
  if (!userId || !Number.isFinite(delta)) throw new Error('INVALID_INPUT')
  const balance = await getMainBalance(db, userId, currency)
  const balanceAfter = Number((balance + delta).toFixed(8))
  if (balanceAfter < 0) throw new Error('INSUFFICIENT_BALANCE')
  const key = idempotencyKey || `adjust_${userId}_${currency}_${Date.now()}`
  const txn = await recordTransaction(db, {
    userId,
    currency,
    transactionType: 'adjust',
    sourceType: 'system',
    referenceType,
    referenceId: referenceId ?? createdBy,
    amount: delta,
    idempotencyKey: key,
    createdBy,
  })
  const type = delta >= 0 ? 'add' : 'deduct'
  const legacyId = await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: createdBy || null,
    type,
    currency,
    amount: Math.abs(delta),
    note: opts.note || 'Balance adjustment',
  })
  return { walletTxnId: txn.id, legacyTxnId: legacyId, balanceAfter }
}

/**
 * Create referral reward - earning entry + transfer to main. Idempotent.
 */
export async function createReferralReward(db, opts) {
  const { userId, amount, referralRewardId, currency = 'USDT' } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0 || !referralRewardId) throw new Error('INVALID_INPUT')
  const earningResult = await createEarningEntry(db, {
    userId,
    sourceType: 'referrals',
    referenceType: 'referral_reward',
    referenceId: referralRewardId,
    currency,
    amount,
  })
  if (!earningResult?.id) return null
  const txn = await transferEarningToMain(db, earningResult.id, `referral_reward_${referralRewardId}`)
  if (!txn) return null
  await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: null,
    type: 'referral_reward',
    currency,
    amount,
    note: opts.note || `Referral reward #${referralRewardId}`,
  })
  return { walletTxnId: txn.id, balanceAfter: await getMainBalance(db, userId, currency) }
}

/**
 * Create task reward - earning entry + transfer to main. Idempotent.
 */
export async function createTaskReward(db, opts) {
  const { userId, amount, redemptionId, currency = 'USDT' } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0 || !redemptionId) throw new Error('INVALID_INPUT')
  const earningResult = await createEarningEntry(db, {
    userId,
    sourceType: 'tasks',
    referenceType: 'task_redemption',
    referenceId: redemptionId,
    currency,
    amount,
  })
  const entryId = earningResult?.id ?? (await get(db, `SELECT id FROM earning_entries WHERE source_type = 'tasks' AND reference_type = 'task_redemption' AND reference_id = ? LIMIT 1`, [redemptionId]))?.id
  if (!entryId) throw new Error('EARNING_ENTRY_FAILED')
  const txn = await transferEarningToMain(db, entryId, `task_redemption_${redemptionId}`)
  if (!txn) return null
  await appendLegacyBalanceTransaction(db, {
    userId,
    adminId: null,
    type: 'task_code_bonus',
    currency,
    amount,
    note: opts.note || `Task redemption #${redemptionId}`,
  })
  return { walletTxnId: txn.id, balanceAfter: await getMainBalance(db, userId, currency) }
}
