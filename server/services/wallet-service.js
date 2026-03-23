/**
 * Centralized wallet service - the ONLY entry point for financial operations.
 * All balance-changing actions MUST go through these functions.
 * Source of truth: wallet_accounts + wallet_transactions + earning_entries.
 */
import { all, get, run } from '../db.js'
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

const REWARD_SOURCE_TYPES = new Set(['mining', 'tasks', 'referrals', 'deposits'])
const MAX_REWARD_LOCK_HOURS = 24 * 365

export function normalizeRewardPayoutMode(value) {
  return String(value || '').trim().toLowerCase() === 'bonus_locked' ? 'bonus_locked' : 'withdrawable'
}

export function normalizeRewardLockHours(value, fallback = 0) {
  const raw = Number(value)
  if (!Number.isFinite(raw)) return Math.max(0, Math.floor(Number(fallback) || 0))
  return Math.max(0, Math.min(MAX_REWARD_LOCK_HOURS, Math.floor(raw)))
}

export function normalizeRewardSourceType(value, fallback = 'all') {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'all') return 'all'
  return REWARD_SOURCE_TYPES.has(normalized) ? normalized : fallback
}

function normalizeRewardSourceModes(raw) {
  const sourceModes = {}
  if (!raw || typeof raw !== 'object') return sourceModes
  for (const sourceType of REWARD_SOURCE_TYPES) {
    if (sourceType in raw) sourceModes[sourceType] = normalizeRewardPayoutMode(raw[sourceType])
  }
  return sourceModes
}

function normalizeRewardSourceLockHours(raw) {
  const sourceLockHours = {}
  if (!raw || typeof raw !== 'object') return sourceLockHours
  for (const sourceType of REWARD_SOURCE_TYPES) {
    if (sourceType in raw) sourceLockHours[sourceType] = normalizeRewardLockHours(raw[sourceType], 0)
  }
  return sourceLockHours
}

export async function getRewardPayoutConfig(db) {
  const row = await get(db, `SELECT value FROM settings WHERE key = 'reward_payout_config' LIMIT 1`)
  if (!row?.value) return { defaultMode: 'withdrawable', sourceModes: { referrals: 'withdrawable' }, defaultLockHours: 0, sourceLockHours: {} }
  try {
    const parsed = JSON.parse(String(row.value))
    return {
      defaultMode: normalizeRewardPayoutMode(parsed?.defaultMode),
      sourceModes: { referrals: 'withdrawable', ...normalizeRewardSourceModes(parsed?.sourceModes) },
      defaultLockHours: normalizeRewardLockHours(parsed?.defaultLockHours, 0),
      sourceLockHours: normalizeRewardSourceLockHours(parsed?.sourceLockHours),
    }
  } catch {
    return { defaultMode: 'withdrawable', sourceModes: { referrals: 'withdrawable' }, defaultLockHours: 0, sourceLockHours: {} }
  }
}

async function getRewardPayoutOverrideSet(db, userId, sourceType = 'all') {
  if (!userId) return null
  const normalizedSourceType = normalizeRewardSourceType(sourceType, 'all')
  const [specificOverride, globalOverride, legacyOverride] = await Promise.all([
    normalizedSourceType === 'all'
      ? Promise.resolve(null)
      : get(
          db,
          `SELECT payout_mode, lock_hours, source_type
           FROM user_reward_payout_overrides
           WHERE user_id = ? AND source_type = ?
           LIMIT 1`,
          [userId, normalizedSourceType],
        ),
    get(
      db,
      `SELECT payout_mode, lock_hours, source_type
       FROM user_reward_payout_overrides
       WHERE user_id = ? AND source_type = 'all'
       LIMIT 1`,
      [userId],
    ),
    get(
      db,
      `SELECT payout_mode, 'all' AS source_type
       FROM user_reward_mode_overrides
       WHERE user_id = ? LIMIT 1`,
      [userId],
    ),
  ])
  return { specificOverride, globalOverride, legacyOverride }
}

export async function getEffectiveRewardPayoutMode(db, userId, sourceType = 'all') {
  const policy = await getEffectiveRewardPayoutPolicy(db, userId, sourceType)
  return policy.payoutMode
}

export async function getEffectiveRewardPayoutPolicy(db, userId, sourceType = 'all') {
  const normalizedSourceType = normalizeRewardSourceType(sourceType, 'all')
  const [config, overrideSet] = await Promise.all([
    getRewardPayoutConfig(db),
    getRewardPayoutOverrideSet(db, userId, normalizedSourceType),
  ])
  const sourceMode = config?.sourceModes?.[normalizedSourceType]
  const sourceLockHours = config?.sourceLockHours?.[normalizedSourceType]
  const specificOverride = overrideSet?.specificOverride || null
  const globalOverride = overrideSet?.globalOverride || null
  const legacyOverride = overrideSet?.legacyOverride || null
  return {
    payoutMode: normalizeRewardPayoutMode(
      specificOverride?.payout_mode || globalOverride?.payout_mode || legacyOverride?.payout_mode || sourceMode || config.defaultMode,
    ),
    lockHours: normalizeRewardLockHours(
      specificOverride?.lock_hours ?? globalOverride?.lock_hours ?? sourceLockHours ?? config?.defaultLockHours ?? 0,
      0,
    ),
  }
}

function buildLockedUntilIso(lockHours, baseDate = new Date()) {
  const safeLockHours = normalizeRewardLockHours(lockHours, 0)
  return new Date(baseDate.getTime() + safeLockHours * 60 * 60 * 1000).toISOString()
}

async function updatePendingEarningPolicy(db, entryId, { payoutMode, lockedUntil = null }) {
  await run(
    db,
    `UPDATE earning_entries
     SET payout_mode = ?, locked_until = ?
     WHERE id = ? AND status = 'pending'`,
    [normalizeRewardPayoutMode(payoutMode), lockedUntil, entryId],
  )
}

async function finalizeRewardTransfer(db, { userId, currency, entryId, idempotencyKey, sourceType = 'all' }) {
  const policy = await getEffectiveRewardPayoutPolicy(db, userId, sourceType)
  const payoutMode = policy.payoutMode
  if (payoutMode === 'bonus_locked') {
    await updatePendingEarningPolicy(db, entryId, { payoutMode: 'bonus_locked', lockedUntil: null })
    return {
      walletTxnId: null,
      balanceAfter: await getMainBalance(db, userId, currency),
      payoutMode,
      lockHours: 0,
      lockedUntil: null,
    }
  }
  if (policy.lockHours > 0) {
    const lockedUntil = buildLockedUntilIso(policy.lockHours)
    await updatePendingEarningPolicy(db, entryId, { payoutMode: 'withdrawable', lockedUntil })
    return {
      walletTxnId: null,
      balanceAfter: await getMainBalance(db, userId, currency),
      payoutMode,
      lockHours: policy.lockHours,
      lockedUntil,
    }
  }
  await updatePendingEarningPolicy(db, entryId, { payoutMode: 'withdrawable', lockedUntil: null })
  const txn = await transferEarningToMain(db, entryId, idempotencyKey)
  if (!txn) return null
  return {
    walletTxnId: txn.id,
    balanceAfter: await getMainBalance(db, userId, currency),
    payoutMode,
    lockHours: 0,
    lockedUntil: null,
  }
}

function buildRewardEntryScopeFilter(userIds = [], sourceType = 'all') {
  const clauses = [`status = 'pending'`]
  const params = []
  if (Array.isArray(userIds) && userIds.length > 0) {
    clauses.push(`user_id IN (${userIds.map(() => '?').join(', ')})`)
    params.push(...userIds)
  }
  const normalizedSourceType = normalizeRewardSourceType(sourceType, 'all')
  if (normalizedSourceType !== 'all') {
    clauses.push(`source_type = ?`)
    params.push(normalizedSourceType)
  }
  return {
    whereClause: clauses.join(' AND '),
    params,
  }
}

export async function releaseEligibleRewardEntries(db, opts = {}) {
  const { userIds = [], sourceType = 'all' } = opts || {}
  const { whereClause, params } = buildRewardEntryScopeFilter(userIds, sourceType)
  const rows = await all(
    db,
    `SELECT id, amount
     FROM earning_entries
     WHERE ${whereClause}
       AND payout_mode <> 'bonus_locked'
       AND (locked_until IS NULL OR locked_until <= CURRENT_TIMESTAMP)
     ORDER BY id ASC`,
    params,
  )
  if (rows.length === 0) {
    return {
      processedEntries: 0,
      lockedEntries: 0,
      lockedAmount: 0,
      bonusLockedEntries: 0,
      bonusLockedAmount: 0,
      releasedEntries: 0,
      releasedAmount: 0,
    }
  }

  const stamp = Date.now()
  let releasedAmount = 0
  let releasedEntries = 0
  for (const row of rows) {
    const txn = await transferEarningToMain(db, Number(row.id), `reward_release_${stamp}_${Number(row.id)}`)
    if (!txn) continue
    releasedEntries += 1
    releasedAmount += Number(row.amount || 0)
  }
  return {
    processedEntries: releasedEntries,
    lockedEntries: 0,
    lockedAmount: 0,
    bonusLockedEntries: 0,
    bonusLockedAmount: 0,
    releasedEntries,
    releasedAmount: Number(releasedAmount.toFixed(8)),
  }
}

export async function reapplyRewardPoliciesToPendingEntries(db, opts = {}) {
  const { userIds = [], sourceType = 'all' } = opts || {}
  const { whereClause, params } = buildRewardEntryScopeFilter(userIds, sourceType)
  const rows = await all(
    db,
    `SELECT id, user_id, source_type, amount, locked_until
     FROM earning_entries
     WHERE ${whereClause}
     ORDER BY id ASC`,
    params,
  )
  if (rows.length === 0) {
    return {
      processedEntries: 0,
      lockedEntries: 0,
      lockedAmount: 0,
      bonusLockedEntries: 0,
      bonusLockedAmount: 0,
      releasedEntries: 0,
      releasedAmount: 0,
    }
  }

  let lockedEntries = 0
  let lockedAmount = 0
  let bonusLockedEntries = 0
  let bonusLockedAmount = 0
  const nowMs = Date.now()

  for (const row of rows) {
    const policy = await getEffectiveRewardPayoutPolicy(db, Number(row.user_id), String(row.source_type || 'all'))
    if (policy.payoutMode === 'bonus_locked') {
      await updatePendingEarningPolicy(db, Number(row.id), { payoutMode: 'bonus_locked', lockedUntil: null })
      bonusLockedEntries += 1
      bonusLockedAmount += Number(row.amount || 0)
      continue
    }

    if (policy.lockHours > 0) {
      const currentLockMs = row.locked_until ? Date.parse(String(row.locked_until)) : Number.NaN
      const baseMs = Number.isFinite(currentLockMs) && currentLockMs > nowMs ? currentLockMs : nowMs
      const lockedUntil = buildLockedUntilIso(policy.lockHours, new Date(baseMs))
      await updatePendingEarningPolicy(db, Number(row.id), { payoutMode: 'withdrawable', lockedUntil })
      lockedEntries += 1
      lockedAmount += Number(row.amount || 0)
      continue
    }

    await updatePendingEarningPolicy(db, Number(row.id), { payoutMode: 'withdrawable', lockedUntil: null })
  }

  const released = await releaseEligibleRewardEntries(db, { userIds, sourceType })
  return {
    processedEntries: rows.length,
    lockedEntries,
    lockedAmount: Number(lockedAmount.toFixed(8)),
    bonusLockedEntries,
    bonusLockedAmount: Number(bonusLockedAmount.toFixed(8)),
    releasedEntries: released.releasedEntries,
    releasedAmount: released.releasedAmount,
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
  const txn = await finalizeRewardTransfer(db, {
    userId,
    currency: 'USDT',
    entryId,
    idempotencyKey: `mining_daily_${userId}_${referenceId}`,
    sourceType: 'mining',
  })
  if (!txn) return null
  const balanceAfter = await getMainBalance(db, userId, 'USDT')
  return { earningEntryId: entryId, walletTxnId: txn.walletTxnId, balanceAfter, payoutMode: txn.payoutMode }
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
    sourceType: 'referrals',
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
    sourceType: 'tasks',
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
    sourceType: 'tasks',
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
    sourceType: 'deposits',
  })
}
