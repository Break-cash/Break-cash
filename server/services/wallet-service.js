/**
 * Centralized wallet service - the ONLY entry point for financial operations.
 * All balance-changing actions MUST go through these functions.
 * Source of truth: wallet_accounts + wallet_transactions + earning_entries.
 */
import { get } from '../db.js'
import {
  getMainBalance,
  recordTransaction,
  createEarningEntry,
  transferEarningToMain,
  getWalletHistory,
  getEarningHistory,
} from './wallet-ledger.js'

// Re-export for consumers
export { getMainBalance, getWalletHistory, getEarningHistory }

function normalizeRewardPayoutMode(value) {
  return String(value || '').trim().toLowerCase() === 'bonus_locked' ? 'bonus_locked' : 'withdrawable'
}

async function getRewardPayoutConfig(db) {
  const row = await get(db, `SELECT value FROM settings WHERE key = 'reward_payout_config' LIMIT 1`)
  if (!row?.value) return { defaultMode: 'withdrawable' }
  try {
    const parsed = JSON.parse(String(row.value))
    return { defaultMode: normalizeRewardPayoutMode(parsed?.defaultMode) }
  } catch {
    return { defaultMode: 'withdrawable' }
  }
}

async function getRewardPayoutOverride(db, userId) {
  if (!userId) return null
  return get(
    db,
    `SELECT payout_mode
     FROM user_reward_mode_overrides
     WHERE user_id = ? LIMIT 1`,
    [userId],
  )
}

export async function getEffectiveRewardPayoutMode(db, userId) {
  const [config, override] = await Promise.all([
    getRewardPayoutConfig(db),
    getRewardPayoutOverride(db, userId),
  ])
  return normalizeRewardPayoutMode(override?.payout_mode || config.defaultMode)
}

async function finalizeRewardTransfer(db, { userId, currency, entryId, idempotencyKey }) {
  const payoutMode = await getEffectiveRewardPayoutMode(db, userId)
  if (payoutMode === 'bonus_locked') {
    return {
      walletTxnId: null,
      balanceAfter: await getMainBalance(db, userId, currency),
      payoutMode,
    }
  }
  const txn = await transferEarningToMain(db, entryId, idempotencyKey)
  if (!txn) return null
  return {
    walletTxnId: txn.id,
    balanceAfter: await getMainBalance(db, userId, currency),
    payoutMode,
  }
}

async function moveBalanceBetweenBuckets(
  db,
  {
    userId,
    currency = 'USDT',
    amount,
    fromSourceType,
    fromAccountType = 'main',
    toSourceType,
    toAccountType = 'main',
    debitTransactionType = 'transfer',
    creditTransactionType = debitTransactionType,
    referenceType,
    referenceId,
    idempotencyKey,
    createdBy,
  },
) {
  if (!userId || !Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_INPUT')
  if (!fromSourceType || !toSourceType) throw new Error('INVALID_INPUT')

  const baseKey = idempotencyKey || `${referenceType || 'wallet_move'}_${userId}_${Date.now()}`
  const debitTxn = await recordTransaction(db, {
    userId,
    currency,
    transactionType: debitTransactionType,
    sourceType: fromSourceType,
    referenceType,
    referenceId,
    amount: -amount,
    accountType: fromAccountType,
    idempotencyKey: `${baseKey}_debit`,
    createdBy,
  })
  await recordTransaction(db, {
    userId,
    currency,
    transactionType: creditTransactionType,
    sourceType: toSourceType,
    referenceType,
    referenceId,
    amount,
    accountType: toAccountType,
    idempotencyKey: `${baseKey}_credit`,
    createdBy,
  })
  return {
    walletTxnId: debitTxn.id,
    balanceAfter: await getMainBalance(db, userId, currency),
  }
}

/**
 * Create deposit (credit main balance). Idempotent.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, currency, amount, referenceType, referenceId, idempotencyKey, createdBy }
 * @returns {{ walletTxnId, balanceAfter }}
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
  const balanceAfter = await getMainBalance(db, userId, currency)
  return { walletTxnId: txn.id, balanceAfter }
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
 * @returns {{ walletTxnId, balanceAfter }}
 */
export async function createWithdrawal(db, opts) {
  const {
    userId,
    currency = 'USDT',
    amount,
    feeAmount = 0,
    referenceType = 'withdrawal_request',
    referenceId,
    idempotencyKey,
    createdBy,
  } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_INPUT')
  const balance = await getMainBalance(db, userId, currency)
  if (balance < amount) throw new Error('INSUFFICIENT_BALANCE')
  const safeFeeAmount = Number.isFinite(Number(feeAmount)) && Number(feeAmount) > 0 ? Number(Number(feeAmount).toFixed(8)) : 0
  const payoutAmount = Number(Math.max(0, amount - safeFeeAmount).toFixed(8))
  const txn = await recordTransaction(db, {
    userId,
    currency,
    transactionType: 'withdrawal',
    sourceType: 'system',
    referenceType,
    referenceId,
    amount: -payoutAmount,
    feeAmount: safeFeeAmount,
    idempotencyKey,
    createdBy,
  })
  const balanceAfter = await getMainBalance(db, userId, currency)
  return { walletTxnId: txn.id, balanceAfter }
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
 * @returns {{ walletTxnId, balanceAfter }}
 */
export async function createMiningSubscription(db, opts) {
  const { userId, currency = 'USDT', amount, idempotencyKey } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_INPUT')
  const balance = await getMainBalance(db, userId, currency)
  if (balance < amount) throw new Error('INSUFFICIENT_BALANCE')
  return moveBalanceBetweenBuckets(db, {
    userId,
    currency,
    amount,
    fromSourceType: 'system',
    fromAccountType: 'main',
    toSourceType: 'mining',
    toAccountType: 'locked',
    debitTransactionType: 'lock',
    creditTransactionType: 'lock',
    referenceType: 'mining_subscription',
    referenceId: userId,
    idempotencyKey: idempotencyKey || `mining_subscribe_${userId}_${Math.floor(Date.now() / 1000)}`,
  })
}

/**
 * Record mining daily profit as earning entry, then transfer to main. Idempotent.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, amount, profileId, referenceId (unique per claim) }
 * @returns {{ earningEntryId, walletTxnId, balanceAfter }}
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
  const balanceAfter = await getMainBalance(db, userId, 'USDT')
  return { earningEntryId: entryId, walletTxnId: txn.id, balanceAfter }
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
 * @returns {{ walletTxnId, balanceAfter }}
 */
export async function settleMiningAtMaturity(db, opts) {
  const { userId, principal, profileId, idempotencyKey } = opts
  if (!userId || !Number.isFinite(principal) || principal <= 0) throw new Error('INVALID_INPUT')
  return moveBalanceBetweenBuckets(db, {
    userId,
    currency: 'USDT',
    amount: principal,
    fromSourceType: 'mining',
    fromAccountType: 'locked',
    toSourceType: 'system',
    toAccountType: 'main',
    debitTransactionType: 'unlock',
    creditTransactionType: 'unlock',
    referenceType: 'mining_principal_release',
    referenceId: profileId,
    idempotencyKey: idempotencyKey || `mining_release_${userId}`,
  })
}

/**
 * Execute mining emergency withdrawal. Apply fee, return net to main. Idempotent.
 * Invariant: cannot run after maturity settlement; subscription must be closed.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, principal, feeAmount, profileId, idempotencyKey }
 * @returns {{ walletTxnId, netAmount, balanceAfter }}
 */
export async function executeMiningEmergencyWithdrawal(db, opts) {
  const { userId, principal, feeAmount = 0, profileId, idempotencyKey } = opts
  if (!userId || !Number.isFinite(principal) || principal <= 0) throw new Error('INVALID_INPUT')
  const netAmount = Number(Math.max(0, principal - feeAmount).toFixed(8))
  const transfer = await moveBalanceBetweenBuckets(db, {
    userId,
    currency: 'USDT',
    amount: principal,
    fromSourceType: 'mining',
    fromAccountType: 'locked',
    toSourceType: 'system',
    toAccountType: 'main',
    debitTransactionType: 'transfer',
    creditTransactionType: 'transfer',
    referenceType: 'mining_emergency_withdraw',
    referenceId: profileId,
    idempotencyKey: idempotencyKey || `mining_emergency_${userId}`,
  })

  if (feeAmount > 0) {
    await recordTransaction(db, {
      userId,
      currency: 'USDT',
      transactionType: 'fee',
      sourceType: 'system',
      referenceType: 'mining_emergency_fee',
      referenceId: profileId,
      amount: -feeAmount,
      accountType: 'main',
      idempotencyKey: `${idempotencyKey || `mining_emergency_${userId}`}_fee`,
    })
  }

  return {
    walletTxnId: transfer.walletTxnId,
    netAmount,
    balanceAfter: await getMainBalance(db, userId, 'USDT'),
  }
}

/**
 * Admin/owner balance adjustment. Idempotent.
 * @param {object} db - Database handle
 * @param {object} opts - { userId, currency, delta, referenceType, referenceId, idempotencyKey, createdBy }
 * @returns {{ walletTxnId, balanceAfter }}
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
  return { walletTxnId: txn.id, balanceAfter }
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
  return finalizeRewardTransfer(db, {
    userId,
    currency,
    entryId: earningResult.id,
    idempotencyKey: `referral_reward_${referralRewardId}`,
  })
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
  return finalizeRewardTransfer(db, {
    userId,
    currency,
    entryId,
    idempotencyKey: `task_redemption_${redemptionId}`,
  })
}

/**
 * Create a promotional strategy reward through the unified earning pipeline.
 */
export async function createStrategyPromoReward(db, opts) {
  const { userId, amount, usageId, currency = 'USDT' } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0 || !usageId) throw new Error('INVALID_INPUT')
  const earningResult = await createEarningEntry(db, {
    userId,
    sourceType: 'tasks',
    referenceType: 'strategy_code_bonus',
    referenceId: usageId,
    currency,
    amount,
  })
  const entryId =
    earningResult?.id ??
    (await get(
      db,
      `SELECT id
       FROM earning_entries
       WHERE source_type = 'tasks'
         AND reference_type = 'strategy_code_bonus'
         AND reference_id = ?
       LIMIT 1`,
      [usageId],
    ))?.id
  if (!entryId) throw new Error('EARNING_ENTRY_FAILED')
  return finalizeRewardTransfer(db, {
    userId,
    currency,
    entryId,
    idempotencyKey: `strategy_code_bonus_${usageId}`,
  })
}

/**
 * Create first deposit bonus reward through the unified earning pipeline.
 */
export async function createFirstDepositBonusReward(db, opts) {
  const { userId, amount, depositRequestId, currency = 'USDT' } = opts
  if (!userId || !Number.isFinite(amount) || amount <= 0 || !depositRequestId) throw new Error('INVALID_INPUT')
  const earningResult = await createEarningEntry(db, {
    userId,
    sourceType: 'deposits',
    referenceType: 'first_deposit_bonus',
    referenceId: depositRequestId,
    currency,
    amount,
  })
  const entryId =
    earningResult?.id ??
    (await get(
      db,
      `SELECT id
       FROM earning_entries
       WHERE source_type = 'deposits'
         AND reference_type = 'first_deposit_bonus'
         AND reference_id = ?
       LIMIT 1`,
      [depositRequestId],
    ))?.id
  if (!entryId) throw new Error('EARNING_ENTRY_FAILED')
  return finalizeRewardTransfer(db, {
    userId,
    currency,
    entryId,
    idempotencyKey: `first_deposit_bonus_${depositRequestId}`,
  })
}
