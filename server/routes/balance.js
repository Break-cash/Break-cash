import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { all, get, run } from '../db.js'
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'
import {
  getMainBalance,
  getWalletHistory,
  getEarningHistory,
  createDeposit,
  createWithdrawal,
  adjustBalance,
  createReferralReward,
  createFirstDepositBonusReward,
} from '../services/wallet-service.js'
import { getWalletAccountsOverview } from '../services/wallet-ledger.js'
import {
  reconcileUserCurrency,
  reconcileAll,
  verifyEarningTransfers,
  verifyDepositWithdrawalLinkage,
  verifyUnexpectedZeroBalances,
} from '../services/wallet-reconciliation.js'
import { createLocalizedNotification } from '../services/notifications.js'
import { getDefaultVipTierRows, getVipRuntimeRules, normalizeVipTierConfig, toVipTierStoragePayload } from '../services/vip-rules.js'

const REQUEST_STATUSES = new Set(['pending', 'approved', 'rejected', 'completed'])
const PRINCIPAL_UNLOCK_RATIO = 0
const DEFAULT_BALANCE_RULES = {
  minDeposit: 10,
  minWithdrawal: 10,
  depositMethods: ['USDT TRC20', 'Bank Transfer'],
  withdrawalMethods: ['USDT TRC20'],
  manualReview: true,
  withdrawalFeePercent: 0,
  minimumProfitToUnlock: 0,
  defaultUnlockRatio: PRINCIPAL_UNLOCK_RATIO,
  unlockRatioByLevel: { 0: PRINCIPAL_UNLOCK_RATIO, 1: PRINCIPAL_UNLOCK_RATIO, 2: PRINCIPAL_UNLOCK_RATIO, 3: PRINCIPAL_UNLOCK_RATIO, 4: PRINCIPAL_UNLOCK_RATIO, 5: PRINCIPAL_UNLOCK_RATIO },
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

function normalizeCurrency(raw) {
  const value = String(raw || 'USDT').trim().toUpperCase()
  return value || 'USDT'
}

function normalizeMethod(raw) {
  return String(raw || '').trim().slice(0, 64)
}

function normalizeText(raw, max = 280) {
  return String(raw || '').trim().slice(0, max)
}

function parsePositiveAmount(raw) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return null
  return Number(value.toFixed(8))
}

function normalizeRules(raw) {
  const base = raw && typeof raw === 'object' ? raw : {}
  const toStringList = (value, fallback) => {
    if (!Array.isArray(value)) return fallback
    const normalized = value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .filter((item, idx, arr) => arr.indexOf(item) === idx)
      .slice(0, 12)
    return normalized.length > 0 ? normalized : fallback
  }
  const minDeposit = Number(base.minDeposit)
  const minWithdrawal = Number(base.minWithdrawal)
  const withdrawalFeePercent = Number(base.withdrawalFeePercent)
  const minimumProfitToUnlock = Number(base.minimumProfitToUnlock)
  const defaultUnlockRatio = Number(base.defaultUnlockRatio)
  const normalizeRatio = (value, fallback) =>
    Number.isFinite(value) && value >= 0 && value <= 10 ? Number(value.toFixed(4)) : fallback
  const map = base.unlockRatioByLevel && typeof base.unlockRatioByLevel === 'object' ? base.unlockRatioByLevel : {}
  const unlockRatioByLevel = { ...DEFAULT_BALANCE_RULES.unlockRatioByLevel }
  for (const [k, v] of Object.entries(map)) {
    const key = String(k).trim()
    if (!/^\d+$/.test(key)) continue
    unlockRatioByLevel[key] = normalizeRatio(Number(v), unlockRatioByLevel[key] ?? DEFAULT_BALANCE_RULES.defaultUnlockRatio)
  }
  return {
    minDeposit: Number.isFinite(minDeposit) && minDeposit >= 0 ? Number(minDeposit.toFixed(8)) : DEFAULT_BALANCE_RULES.minDeposit,
    minWithdrawal: Number.isFinite(minWithdrawal) && minWithdrawal >= 0 ? Number(minWithdrawal.toFixed(8)) : DEFAULT_BALANCE_RULES.minWithdrawal,
    depositMethods: toStringList(base.depositMethods, DEFAULT_BALANCE_RULES.depositMethods),
    withdrawalMethods: toStringList(base.withdrawalMethods, DEFAULT_BALANCE_RULES.withdrawalMethods),
    manualReview: base.manualReview !== false,
    withdrawalFeePercent:
      Number.isFinite(withdrawalFeePercent) && withdrawalFeePercent >= 0 && withdrawalFeePercent <= 100
        ? Number(withdrawalFeePercent.toFixed(4))
        : DEFAULT_BALANCE_RULES.withdrawalFeePercent,
    minimumProfitToUnlock:
      Number.isFinite(minimumProfitToUnlock) && minimumProfitToUnlock >= 0
        ? Number(minimumProfitToUnlock.toFixed(8))
        : DEFAULT_BALANCE_RULES.minimumProfitToUnlock,
    defaultUnlockRatio: normalizeRatio(defaultUnlockRatio, DEFAULT_BALANCE_RULES.defaultUnlockRatio),
    unlockRatioByLevel,
  }
}

async function getRules(db) {
  const row = await get(db, `SELECT value FROM settings WHERE key='balance_rules' LIMIT 1`)
  if (!row?.value) return { ...DEFAULT_BALANCE_RULES }
  try {
    return normalizeRules(JSON.parse(String(row.value)))
  } catch {
    return { ...DEFAULT_BALANCE_RULES }
  }
}

async function upsertRules(db, rules) {
  await run(
    db,
    `INSERT INTO settings (key, value) VALUES ('balance_rules', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(rules)],
  )
}

async function getBalanceAmount(db, userId, currency) {
  return getMainBalance(db, userId, currency)
}

async function createAdminAuditLog(db, payload) {
  await run(
    db,
    `INSERT INTO admin_audit_logs (actor_user_id, target_user_id, section, action, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [payload.actorUserId, payload.targetUserId || null, payload.section, payload.action, payload.metadata || null],
  )
}

/**
 * Temporary detailed log for every admin financial action.
 * Source of truth: wallet_accounts + wallet_transactions. Logs to console and adds to audit metadata.
 */
function logAdminFinancialAction(payload) {
  const {
    adminUserId,
    targetUserId,
    actionType,
    sourceTable = 'wallet_transactions',
    targetTable = 'wallet_accounts',
    transactionId = null,
    balanceBefore = null,
    balanceAfter = null,
    extra = {},
  } = payload
  const line = {
    admin_user_id: adminUserId,
    target_user_id: targetUserId,
    action_type: actionType,
    source_table: sourceTable,
    target_table: targetTable,
    transaction_id: transactionId,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    ...extra,
  }
  console.log('[admin-financial]', JSON.stringify(line))
}

async function getUserUnlockOverride(db, userId) {
  const row = await get(
    db,
    `SELECT user_id, force_unlock_principal, custom_unlock_ratio, custom_min_profit, note
     FROM user_unlock_overrides
     WHERE user_id = ? LIMIT 1`,
    [userId],
  )
  if (!row) {
    return {
      user_id: userId,
      force_unlock_principal: 0,
      custom_unlock_ratio: null,
      custom_min_profit: null,
      note: null,
    }
  }
  return row
}

async function getEffectiveUnlockProfile(db, userId, currency, rules) {
  const user = await get(db, `SELECT id, vip_level FROM users WHERE id = ? LIMIT 1`, [userId])
  const vipLevel = Number(user?.vip_level || 0)
  const override = await getUserUnlockOverride(db, userId)
  const levelRatioRaw =
    rules?.unlockRatioByLevel && typeof rules.unlockRatioByLevel === 'object'
      ? rules.unlockRatioByLevel[String(vipLevel)]
      : null
  const ratioFromLevel =
    levelRatioRaw != null && Number.isFinite(Number(levelRatioRaw))
      ? Number(levelRatioRaw)
      : Number(rules?.defaultUnlockRatio ?? PRINCIPAL_UNLOCK_RATIO)
  const unlockRatio =
    override?.custom_unlock_ratio != null
      ? Number(override.custom_unlock_ratio)
      : Number.isFinite(ratioFromLevel)
        ? ratioFromLevel
        : PRINCIPAL_UNLOCK_RATIO
  const minimumProfitToUnlock =
    override?.custom_min_profit != null
      ? Number(override.custom_min_profit)
      : Number(rules.minimumProfitToUnlock || 0)
  return {
    userId,
    currency,
    vipLevel,
    forceUnlockPrincipal: Number(override?.force_unlock_principal || 0) === 1,
    unlockRatio: Number.isFinite(unlockRatio) && unlockRatio >= 0 ? unlockRatio : PRINCIPAL_UNLOCK_RATIO,
    minimumProfitToUnlock: Number.isFinite(minimumProfitToUnlock) && minimumProfitToUnlock >= 0 ? minimumProfitToUnlock : 0,
    overrideNote: String(override?.note || ''),
  }
}

async function createPrincipalLock(db, payload) {
  if (payload.forceUnlockPrincipal) return
  const requiredProfitByRatio = Number((Number(payload.principalAmount) * Number(payload.unlockRatio || 0)).toFixed(8))
  const requiredProfitAmount = Number(
    Math.max(requiredProfitByRatio, Number(payload.minimumProfitToUnlock || 0)).toFixed(8),
  )
  if (requiredProfitAmount <= 0 || Number(payload.principalAmount || 0) <= 0) return
  await run(
    db,
    `INSERT INTO user_principal_locks (
      user_id, currency, principal_amount, required_profit_amount, unlock_ratio,
      source_type, source_id, lock_status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'locked', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      payload.userId,
      payload.currency,
      Number(payload.principalAmount),
      requiredProfitAmount,
      Number(payload.unlockRatio || 0),
      String(payload.sourceType || 'deposit_request'),
      Number(payload.sourceId || 0),
    ],
  )
}

function calculateRequiredProfitAmount(principalAmount, unlockRatio, minimumProfitToUnlock) {
  const principal = Number(principalAmount || 0)
  const ratio = Number(unlockRatio || 0)
  const minimumProfit = Number(minimumProfitToUnlock || 0)
  const requiredByRatio = Number((principal * ratio).toFixed(8))
  return Number(Math.max(requiredByRatio, minimumProfit).toFixed(8))
}

async function reapplyPrincipalLocksForUser(db, userId, currency, rules = null) {
  const safeRules = rules || (await getRules(db))
  const normalizedCurrency = normalizeCurrency(currency || 'USDT')
  const profile = await getEffectiveUnlockProfile(db, userId, normalizedCurrency, safeRules)
  const lockedRows = await all(
    db,
    `SELECT id, principal_amount
     FROM user_principal_locks
     WHERE user_id = ? AND currency = ? AND lock_status = 'locked'
     ORDER BY id ASC`,
    [userId, normalizedCurrency],
  )
  if (!lockedRows.length) return 0

  if (profile.forceUnlockPrincipal) {
    const unlockRes = await run(
      db,
      `UPDATE user_principal_locks
       SET lock_status = 'unlocked', unlocked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND currency = ? AND lock_status = 'locked'`,
      [userId, normalizedCurrency],
    )
    return Number(unlockRes?.changes || unlockRes?.rowCount || 0)
  }

  let affected = 0
  for (const row of lockedRows) {
    const requiredProfitAmount = calculateRequiredProfitAmount(
      row.principal_amount,
      profile.unlockRatio,
      profile.minimumProfitToUnlock,
    )
    if (requiredProfitAmount <= 0) {
      const unlockRes = await run(
        db,
        `UPDATE user_principal_locks
         SET required_profit_amount = 0,
             unlock_ratio = ?,
             lock_status = 'unlocked',
             unlocked_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [Number(profile.unlockRatio.toFixed(4)), Number(row.id)],
      )
      affected += Number(unlockRes?.changes || unlockRes?.rowCount || 0)
      continue
    }
    const updateRes = await run(
      db,
      `UPDATE user_principal_locks
       SET required_profit_amount = ?, unlock_ratio = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [requiredProfitAmount, Number(profile.unlockRatio.toFixed(4)), Number(row.id)],
    )
    affected += Number(updateRes?.changes || updateRes?.rowCount || 0)
  }

  await unlockAllPrincipalLocksIfEligible(db, userId, normalizedCurrency, safeRules)
  return affected
}

async function reapplyPrincipalLocksForAllUsers(db, rules = null) {
  const safeRules = rules || (await getRules(db))
  const rows = await all(
    db,
    `SELECT DISTINCT user_id, currency
     FROM user_principal_locks
     WHERE lock_status = 'locked'`,
  )
  let affected = 0
  for (const row of rows) {
    affected += await reapplyPrincipalLocksForUser(db, Number(row.user_id || 0), String(row.currency || 'USDT'), safeRules)
  }
  return affected
}

async function ensureVipTierDefaults(db) {
  for (const tier of getDefaultVipTierRows()) {
    const storagePayload = toVipTierStoragePayload(tier)
    await run(
      db,
      `INSERT INTO vip_tiers (
        level, title, min_deposit, min_trade_volume, referral_multiplier, referral_percent, perks_json, is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(level) DO NOTHING`,
      [
        tier.level,
        tier.title,
        tier.minDeposit,
        tier.minTeamVolume,
        tier.minReferrals,
        tier.referralPercent,
        JSON.stringify(storagePayload),
      ],
    )
  }
}

async function getVipTierRows(db) {
  return all(
    db,
    `SELECT level, title, min_deposit, min_trade_volume, referral_multiplier, referral_percent, perks_json
     FROM vip_tiers
     WHERE is_active = 1
     ORDER BY level ASC`,
  )
}

async function getVipRulesFromDb(db, vipLevel) {
  const safeLevel = Math.max(0, Math.min(5, Number(vipLevel || 0)))
  const row = await get(
    db,
    `SELECT level, title, min_deposit, min_trade_volume, referral_multiplier, referral_percent, perks_json
     FROM vip_tiers
     WHERE level = ? AND is_active = 1
     LIMIT 1`,
    [safeLevel],
  )
  if (!row) return normalizeVipTierConfig(safeLevel, {})
  const parsed = parseJsonSafe(row.perks_json, {}) || {}
  return normalizeVipTierConfig(safeLevel, {
    ...parsed,
    level: Number(row.level || safeLevel),
    title: row.title,
    minDeposit: Number(row.min_deposit || 0),
    minTradeVolume: Number(row.min_trade_volume || 0),
    referralMultiplier: Number(row.referral_multiplier || 0),
    referralPercent: Number(row.referral_percent || 0),
  })
}

async function getVipNetworkMetrics(db, userId) {
  const counts = await get(
    db,
    `SELECT COUNT(*) AS direct_referrals
     FROM referrals
     WHERE referrer_user_id = ?
       AND status IN ('active', 'reward_released')`,
    [userId],
  )
  const teamVolumeRow = await get(
    db,
    `SELECT COALESCE(SUM(total_deposit), 0) AS team_volume
     FROM users
     WHERE referred_by = ?`,
    [userId],
  )
  return {
    directReferrals: Number(counts?.direct_referrals || 0),
    teamVolume: Number(teamVolumeRow?.team_volume || 0),
  }
}

async function resolveVipLevelForUser(db, userId, totalDeposit) {
  const tiers = await getVipTierRows(db)
  const metrics = await getVipNetworkMetrics(db, userId)
  let level = 0
  for (const tier of tiers) {
    const minDeposit = Number(tier.min_deposit || 0)
    const minTeamVolume = Number(tier.min_trade_volume || 0)
    const minReferrals = Number(tier.referral_multiplier || 0)
    if (
      Number(totalDeposit || 0) >= minDeposit &&
      metrics.teamVolume >= minTeamVolume &&
      metrics.directReferrals >= minReferrals
    ) {
      level = Number(tier.level || 0)
    }
  }
  return { level, metrics, tiers }
}

async function persistVipLevel(db, userId, totalDeposit) {
  const nextTotalDeposit = Number(Number(totalDeposit || 0).toFixed(8))
  const resolved = await resolveVipLevelForUser(db, userId, nextTotalDeposit)
  await run(
    db,
    `UPDATE users
     SET total_deposit = ?, vip_level = ?
     WHERE id = ?`,
    [nextTotalDeposit, resolved.level, userId],
  )
  return {
    totalDeposit: nextTotalDeposit,
    vipLevel: resolved.level,
    directReferrals: resolved.metrics.directReferrals,
    teamVolume: resolved.metrics.teamVolume,
  }
}

async function resolveReferralPercentByVip(db, vipLevel) {
  const tierRules = await getVipRulesFromDb(db, vipLevel)
  return Number(tierRules.referralPercent || getVipRuntimeRules(vipLevel).referralPercent || 3)
}

async function resolveReferralRewardRule(db, amount) {
  const rules = await all(
    db,
    `SELECT id, conditions_json, reward_json
     FROM bonus_rules
     WHERE rule_type = 'referral'
       AND is_active = 1
       AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
       AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
     ORDER BY id DESC`,
  )
  if (!rules.length) return null

  let bestMatch = null
  for (const rule of rules) {
    const conditions = parseJsonSafe(rule.conditions_json, {}) || {}
    const reward = parseJsonSafe(rule.reward_json, {}) || {}
    const minDeposit = Number(conditions.minDeposit ?? conditions.depositAmount ?? 0)
    const maxDepositRaw = conditions.maxDeposit
    const maxDeposit = maxDepositRaw == null || maxDepositRaw === '' ? null : Number(maxDepositRaw)
    if (Number.isFinite(minDeposit) && amount < minDeposit) continue
    if (maxDeposit != null && Number.isFinite(maxDeposit) && amount > maxDeposit) continue

    const rewardMode = normalizeRewardMode(reward.mode)
    const rewardValue = Number(reward.value ?? reward.amount ?? reward.percent ?? 0)
    if (!Number.isFinite(rewardValue) || rewardValue <= 0) continue
    const rewardAmount =
      rewardMode === 'fixed'
        ? Number(rewardValue.toFixed(8))
        : Number(((amount * rewardValue) / 100).toFixed(8))
    if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) continue
    if (!bestMatch || rewardAmount > bestMatch.rewardAmount) {
      bestMatch = {
        id: Number(rule.id),
        rewardAmount,
        rewardMode,
        rewardValue,
      }
    }
  }
  return bestMatch
}

function parseJsonSafe(value, fallback = null) {
  try {
    if (value == null || value === '') return fallback
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return fallback
  }
}

function normalizeRewardMode(value) {
  return String(value || '').trim().toLowerCase() === 'fixed' ? 'fixed' : 'percent'
}

async function applyFirstDepositBonus(db, payload) {
  const amount = Number(payload.amount || 0)
  const depositRequestId = Number(payload.depositRequestId || 0)
  const currency = String(payload.currency || 'USDT').trim().toUpperCase() || 'USDT'
  if (!Number.isFinite(amount) || amount <= 0 || !depositRequestId) {
    return { bonusRuleId: null, bonusAmount: 0, walletTxnId: null }
  }

  const approvedDepositsRow = await get(
    db,
    `SELECT COUNT(*) AS count
     FROM deposit_requests
     WHERE user_id = ?
       AND request_status IN ('approved', 'completed')`,
    [payload.userId],
  )
  if (Number(approvedDepositsRow?.count || 0) !== 1) {
    return { bonusRuleId: null, bonusAmount: 0, walletTxnId: null }
  }

  const priorBonus = await get(
    db,
    `SELECT id
     FROM earning_entries
     WHERE source_type = 'deposits'
       AND reference_type = 'first_deposit_bonus'
       AND reference_id = ?
     LIMIT 1`,
    [depositRequestId],
  )
  if (priorBonus?.id) {
    return { bonusRuleId: null, bonusAmount: 0, walletTxnId: null }
  }

  const rules = await all(
    db,
    `SELECT id, title, conditions_json, reward_json
     FROM bonus_rules
     WHERE rule_type = 'first_deposit'
       AND is_active = 1
       AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
       AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
     ORDER BY id DESC`,
  )
  if (!rules.length) return { bonusRuleId: null, bonusAmount: 0, walletTxnId: null }

  let bestMatch = null
  for (const rule of rules) {
    const conditions = parseJsonSafe(rule.conditions_json, {}) || {}
    const reward = parseJsonSafe(rule.reward_json, {}) || {}
    const minDeposit = Number(conditions.minDeposit ?? conditions.depositAmount ?? 0)
    const maxDepositRaw = conditions.maxDeposit
    const maxDeposit = maxDepositRaw == null || maxDepositRaw === '' ? null : Number(maxDepositRaw)
    if (Number.isFinite(minDeposit) && amount < minDeposit) continue
    if (maxDeposit != null && Number.isFinite(maxDeposit) && amount > maxDeposit) continue

    const rewardMode = normalizeRewardMode(reward.mode)
    const rewardValue = Number(reward.value ?? reward.amount ?? reward.percent ?? 0)
    if (!Number.isFinite(rewardValue) || rewardValue <= 0) continue
    const bonusAmount =
      rewardMode === 'fixed'
        ? Number(rewardValue.toFixed(8))
        : Number(((amount * rewardValue) / 100).toFixed(8))
    if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) continue

    if (!bestMatch || bonusAmount > bestMatch.bonusAmount) {
      bestMatch = {
        id: Number(rule.id),
        bonusAmount,
      }
    }
  }

  if (!bestMatch) return { bonusRuleId: null, bonusAmount: 0, walletTxnId: null }

  const rewardRes = await createFirstDepositBonusReward(db, {
    userId: payload.userId,
    amount: bestMatch.bonusAmount,
    depositRequestId,
    currency,
  })
  await createLocalizedNotification(db, payload.userId, 'first_deposit_bonus', {
    amount: bestMatch.bonusAmount,
    currency,
  })
  return {
    bonusRuleId: bestMatch.id,
    bonusAmount: bestMatch.bonusAmount,
    walletTxnId: rewardRes?.walletTxnId || null,
  }
}

async function getReferralChain(db, userId, maxDepth = 3) {
  const chain = []
  let currentUserId = Number(userId || 0)
  const seen = new Set([currentUserId])
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const row = await get(
      db,
      `SELECT referred_by, invited_by
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [currentUserId],
    )
    const nextUserId = Number(row?.referred_by || row?.invited_by || 0)
    if (!nextUserId || seen.has(nextUserId)) break
    const user = await get(
      db,
      `SELECT id, vip_level
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [nextUserId],
    )
    if (!user?.id) break
    chain.push({
      userId: Number(user.id),
      vipLevel: Number(user.vip_level || 0),
      depth,
    })
    seen.add(nextUserId)
    currentUserId = nextUserId
  }
  return chain
}

async function creditReferralReward(db, payload) {
  const insertRes = await run(
    db,
    `INSERT INTO referral_rewards (
      referrer_user_id, referred_user_id, deposit_request_id, source_amount, reward_percent, reward_amount, level_depth
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(referrer_user_id, referred_user_id, level_depth) DO NOTHING
    RETURNING id`,
    [
      payload.referrerUserId,
      payload.referredUserId,
      payload.depositRequestId || null,
      payload.sourceAmount,
      payload.rewardPercent,
      payload.rewardAmount,
      payload.levelDepth,
    ],
  )
  const referralRewardId = Number(insertRes.lastID || insertRes.rows?.[0]?.id || 0)
  if (!referralRewardId) return false
  await createReferralReward(db, {
    userId: payload.referrerUserId,
    amount: payload.rewardAmount,
    referralRewardId,
    currency: payload.currency,
    note: `Referral reward L${payload.levelDepth} from user #${payload.referredUserId} first deposit #${payload.depositRequestId || 0}`,
  })
  await createLocalizedNotification(db, payload.referrerUserId, 'referral_reward', {
    amount: payload.rewardAmount,
    currency: payload.currency,
  })
  return true
}

async function applyVipAndReferralAfterDeposit(db, payload) {
  await ensureVipTierDefaults(db)
  const amount = Number(payload.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { totalDeposit: 0, vipLevel: 0, rewardedReferrerUserId: null, rewardAmount: 0 }
  }
  const user = await get(
    db,
    `SELECT id, total_deposit, referred_by, invited_by
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [payload.userId],
  )
  if (!user?.id) {
    return { totalDeposit: 0, vipLevel: 0, rewardedReferrerUserId: null, rewardAmount: 0 }
  }

  const nextTotalDeposit = Number((Number(user.total_deposit || 0) + amount).toFixed(8))
  const vipState = await persistVipLevel(db, payload.userId, nextTotalDeposit)

  const referrerUserId = Number(user.referred_by || user.invited_by || 0)
  if (!referrerUserId || referrerUserId === Number(payload.userId)) {
    return { totalDeposit: vipState.totalDeposit, vipLevel: vipState.vipLevel, rewardedReferrerUserId: null, rewardAmount: 0 }
  }
  await persistVipLevel(
    db,
    referrerUserId,
    Number((await get(db, `SELECT total_deposit FROM users WHERE id = ? LIMIT 1`, [referrerUserId]))?.total_deposit || 0),
  )

  const referral = await get(
    db,
    `SELECT id, status FROM referrals WHERE referred_user_id = ? LIMIT 1`,
    [payload.userId],
  )
  if (!referral || String(referral.status || '') !== 'pending') {
    return { totalDeposit: vipState.totalDeposit, vipLevel: vipState.vipLevel, rewardedReferrerUserId: null, rewardAmount: 0 }
  }

  const successfulDeposits = await get(
    db,
    `SELECT COUNT(*) AS count
     FROM deposit_requests
     WHERE user_id = ?
       AND request_status IN ('approved', 'completed')`,
    [payload.userId],
  )
  if (Number(successfulDeposits?.count || 0) !== 1) {
    return { totalDeposit: vipState.totalDeposit, vipLevel: vipState.vipLevel, rewardedReferrerUserId: null, rewardAmount: 0 }
  }

  const rules = payload.rules || (await getRules(db))
  const minDeposit = Number(rules.minDeposit || 10)
  if (amount < minDeposit) {
    return { totalDeposit: vipState.totalDeposit, vipLevel: vipState.vipLevel, rewardedReferrerUserId: null, rewardAmount: 0 }
  }

  const directReferrer = await get(db, `SELECT vip_level FROM users WHERE id = ? LIMIT 1`, [referrerUserId])

  const referralRule = await resolveReferralRewardRule(db, amount)
  const directRewardPercent =
    referralRule?.rewardMode === 'percent'
      ? Number(referralRule.rewardValue || 0)
      : await resolveReferralPercentByVip(db, Number(directReferrer?.vip_level || 0))
  const directRewardAmount = referralRule
    ? Number(referralRule.rewardAmount || 0)
    : Number(((amount * directRewardPercent) / 100).toFixed(8))

  await run(
    db,
    `UPDATE referrals
     SET status = 'active', qualified_at = CURRENT_TIMESTAMP,
         qualifying_deposit_request_id = ?, first_deposit_amount = ?, reward_amount = ?, reward_percent = ?
     WHERE referred_user_id = ? AND status = 'pending'`,
    [payload.depositRequestId || null, amount, directRewardAmount, directRewardPercent, payload.userId],
  )

  const chain = await getReferralChain(db, payload.userId, 3)
  const rewardResults = []
  for (const ancestor of chain) {
    const tierRules = await getVipRulesFromDb(db, ancestor.vipLevel)
    const rewardPercent =
      ancestor.depth === 1
        ? directRewardPercent
        : ancestor.depth === 2
          ? Number(tierRules.level2ReferralPercent || 0)
          : Number(tierRules.level3ReferralPercent || 0)
    const rewardAmount =
      ancestor.depth === 1
        ? directRewardAmount
        : Number(((amount * rewardPercent) / 100).toFixed(8))
    if (!Number.isFinite(rewardPercent) || rewardPercent <= 0 || !Number.isFinite(rewardAmount) || rewardAmount <= 0) {
      continue
    }
    const rewarded = await creditReferralReward(db, {
      referrerUserId: ancestor.userId,
      referredUserId: payload.userId,
      depositRequestId: payload.depositRequestId || null,
      sourceAmount: amount,
      rewardPercent,
      rewardAmount,
      levelDepth: ancestor.depth,
      currency: payload.currency,
    })
    if (rewarded) {
      rewardResults.push({
        userId: ancestor.userId,
        depth: ancestor.depth,
        rewardPercent,
        rewardAmount,
      })
    }
  }

  if (rewardResults.some((item) => item.depth === 1)) {
    await run(
      db,
      `UPDATE referrals SET status = 'reward_released', reward_released_at = CURRENT_TIMESTAMP
       WHERE referred_user_id = ? AND status = 'active'`,
      [payload.userId],
    )
  }
  const firstDepositBonus = await applyFirstDepositBonus(db, payload)

  return {
    totalDeposit: vipState.totalDeposit,
    vipLevel: vipState.vipLevel,
    rewardedReferrerUserId: referrerUserId,
    rewardAmount: directRewardAmount,
    firstDepositBonusAmount: Number(firstDepositBonus.bonusAmount || 0),
    firstDepositBonusRuleId: firstDepositBonus.bonusRuleId,
  }
}

async function hasActiveMiningOrTrade(db, userId) {
  const mining = await get(
    db,
    `SELECT id FROM mining_profiles WHERE user_id = ? AND status = 'active' LIMIT 1`,
    [userId],
  )
  if (mining?.id) return true
  const trade = await get(
    db,
    `SELECT id FROM strategy_code_usages WHERE user_id = ? AND status = 'trade_active' LIMIT 1`,
    [userId],
  )
  return Boolean(trade?.id)
}

async function getEffectiveWithdrawalPolicy(db, userId) {
  const user = await get(db, `SELECT vip_level FROM users WHERE id = ? LIMIT 1`, [userId])
  const vipLevel = Number(user?.vip_level || 0)
  const vipRules = await getVipRulesFromDb(db, vipLevel)
  const activeExtraFee = (await hasActiveMiningOrTrade(db, userId)) ? Number(vipRules.activeExtraFeePercent || 0) : 0
  return {
    vipLevel,
    dailyLimit: Number(vipRules.dailyWithdrawalLimit || 0),
    feePercent: Number(vipRules.withdrawalFeePercent || 0) + activeExtraFee,
    processingHoursMin: Number(vipRules.processingHoursMin || 0),
    processingHoursMax: Number(vipRules.processingHoursMax || 0),
  }
}

async function getDailyWithdrawalRequestedAmount(db, userId, currency) {
  const row = await get(
    db,
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM withdrawal_requests
     WHERE user_id = ?
       AND currency = ?
       AND request_status IN ('pending', 'approved', 'completed')
       AND created_at >= CURRENT_DATE
       AND created_at < (CURRENT_DATE + INTERVAL '1 day')`,
    [userId, currency],
  )
  return Number(row?.total || 0)
}

async function calculateWithdrawalSummary(db, userId, currency, rules = null) {
  const safeRules = rules || (await getRules(db))
  const balance = await getBalanceAmount(db, userId, currency)
  const profile = await getEffectiveUnlockProfile(db, userId, currency, safeRules)
  const withdrawalPolicy = await getEffectiveWithdrawalPolicy(db, userId)
  const lockRows = await all(
    db,
    `SELECT id, principal_amount, required_profit_amount
     FROM user_principal_locks
     WHERE user_id = ? AND currency = ? AND lock_status = 'locked'
     ORDER BY id ASC`,
    [userId, currency],
  )
  const principalLocked = Number(lockRows.reduce((acc, row) => acc + Number(row.principal_amount || 0), 0).toFixed(8))
  const unlockTargetProfit = Number(lockRows.reduce((acc, row) => acc + Number(row.required_profit_amount || 0), 0).toFixed(8))
  const earnedProfit = Number(Math.max(0, balance - principalLocked).toFixed(8))
  const isPrincipalUnlocked =
    profile.forceUnlockPrincipal ||
    principalLocked <= 0 ||
    unlockTargetProfit <= 0 ||
    earnedProfit >= unlockTargetProfit
  const unlockedBalance = Number((isPrincipalUnlocked ? balance : Math.max(0, earnedProfit)).toFixed(8))
  const todayRequestedAmount = await getDailyWithdrawalRequestedAmount(db, userId, currency)
  const dailyRemaining =
    withdrawalPolicy.dailyLimit > 0
      ? Number(Math.max(0, withdrawalPolicy.dailyLimit - todayRequestedAmount).toFixed(8))
      : unlockedBalance
  const withdrawableBalance = Number(Math.min(unlockedBalance, dailyRemaining).toFixed(8))
  const remainingProfitToUnlock = Number((isPrincipalUnlocked ? 0 : Math.max(0, unlockTargetProfit - earnedProfit)).toFixed(8))
  const unlockProgressPct = Number(
    (
      isPrincipalUnlocked
        ? 100
        : unlockTargetProfit <= 0
          ? 0
          : Math.min(100, (earnedProfit / unlockTargetProfit) * 100)
    ).toFixed(2),
  )
  return {
    currency,
    current_balance: Number(balance.toFixed(8)),
    deposited_principal: principalLocked,
    locked_balance: isPrincipalUnlocked ? 0 : principalLocked,
    earned_profit: earnedProfit,
    withdrawable_balance: withdrawableBalance,
    unlock_target_profit: unlockTargetProfit,
    remaining_profit_to_unlock: remainingProfitToUnlock,
    unlock_progress_pct: unlockProgressPct,
    is_principal_unlocked: isPrincipalUnlocked,
    unlock_ratio: Number(profile.unlockRatio.toFixed(4)),
    minimum_profit_to_unlock: Number(profile.minimumProfitToUnlock.toFixed(8)),
    vip_level: withdrawalPolicy.vipLevel,
    force_unlock_principal: profile.forceUnlockPrincipal,
    withdrawal_fee_percent: Number(withdrawalPolicy.feePercent.toFixed(4)),
    daily_withdrawal_limit: Number(withdrawalPolicy.dailyLimit || 0),
    daily_withdrawal_requested: Number(todayRequestedAmount.toFixed(8)),
    daily_withdrawal_remaining: dailyRemaining,
    processing_hours_min: withdrawalPolicy.processingHoursMin,
    processing_hours_max: withdrawalPolicy.processingHoursMax,
  }
}

async function unlockAllPrincipalLocksIfEligible(db, userId, currency, rules = null) {
  const summary = await calculateWithdrawalSummary(db, userId, currency, rules)
  if (!summary.is_principal_unlocked) return summary
  await run(
    db,
    `UPDATE user_principal_locks
     SET lock_status = 'unlocked', unlocked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND currency = ? AND lock_status = 'locked'`,
    [userId, currency],
  )
  return { ...summary, locked_balance: 0 }
}

function buildLockBreakdown(locks, earnedProfitPool) {
  let remainingPool = Number(earnedProfitPool || 0)
  return (locks || []).map((row) => {
    const required = Number(row.required_profit_amount || 0)
    const consumed = required > 0 ? Math.min(required, Math.max(0, remainingPool)) : 0
    remainingPool = Number((remainingPool - consumed).toFixed(8))
    const remaining = Number(Math.max(0, required - consumed).toFixed(8))
    const progress = required <= 0 ? 100 : Number(Math.min(100, (consumed / required) * 100).toFixed(2))
    const unlockedByProgress = required <= 0 || remaining <= 0
    return {
      id: Number(row.id),
      source_type: String(row.source_type || ''),
      source_id: Number(row.source_id || 0),
      principal_amount: Number(row.principal_amount || 0),
      required_profit_amount: required,
      consumed_profit_amount: consumed,
      remaining_profit_to_unlock: remaining,
      unlock_ratio: Number(row.unlock_ratio || 0),
      lock_status: String(row.lock_status || 'locked'),
      progress_pct: unlockedByProgress ? 100 : progress,
      unlocked_at: row.unlocked_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
  })
}

export function createBalanceRouter(db) {
  const router = Router()
  const uploadsRoot = path.join(process.cwd(), 'server', 'uploads')
  const proofsDir = path.join(uploadsRoot, 'payment-proofs')
  fs.mkdirSync(proofsDir, { recursive: true })
  const uploadProof = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, proofsDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
        cb(null, `proof_u${req.user?.id || 'x'}_${Date.now()}${ext}`)
      },
    }),
    limits: { fileSize: 12 * 1024 * 1024 },
  })
  router.use(requireAuth(db))

  router.get('/my', async (req, res) => {
    const walletRows = await all(
      db,
      `SELECT currency, balance_amount AS amount, updated_at FROM wallet_accounts
       WHERE user_id = ? AND account_type = 'main' AND source_type = 'system'`,
      [req.user.id],
    )
    return res.json({ balances: walletRows, source: 'wallet_accounts' })
  })

  router.get('/getUser', requirePermission(db, 'manage_balances'), async (req, res) => {
    const userId = Number(req.query.userId)
    const walletRows = await all(
      db,
      `SELECT currency, balance_amount AS amount, updated_at FROM wallet_accounts
       WHERE user_id = ? AND account_type = 'main' AND source_type = 'system'`,
      [userId],
    )
    return res.json({ userId, balances: walletRows, source: 'wallet_accounts' })
  })

  router.get('/history', requirePermission(db, 'manage_balances'), async (req, res) => {
    const userId = Number(req.query.userId || 0)
    const rows = userId
      ? await all(
          db,
          `SELECT id, user_id, created_by AS admin_id,
                  transaction_type AS type, currency, amount,
                  metadata AS note, created_at
           FROM wallet_transactions
           WHERE user_id = ?
           ORDER BY id DESC LIMIT 300`,
          [userId],
        )
      : await all(
          db,
          `SELECT id, user_id, created_by AS admin_id,
                  transaction_type AS type, currency, amount,
                  metadata AS note, created_at
           FROM wallet_transactions
           ORDER BY id DESC LIMIT 200`,
        )
    const history = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      admin_id: r.admin_id,
      type: r.type === 'withdrawal' ? 'withdraw' : r.type,
      currency: r.currency,
      amount: r.amount,
      note: typeof r.note === 'string' ? r.note : null,
      created_at: r.created_at,
    }))
    return res.json({ history, source: 'wallet_transactions' })
  })

  router.get('/overview', async (req, res) => {
    const currency = normalizeCurrency(req.query.currency || 'USDT')
    const [accountsOverview, rules] = await Promise.all([
      getWalletAccountsOverview(db, req.user.id),
      getRules(db),
    ])
    await reapplyPrincipalLocksForUser(db, req.user.id, currency, rules)
    const withdrawSummary = await calculateWithdrawalSummary(db, req.user.id, currency, rules)
    return res.json({
      total_assets: accountsOverview.total_assets,
      by_currency: accountsOverview.by_currency,
      by_source: accountsOverview.by_source,
      main_balance: withdrawSummary.current_balance,
      locked_balance: withdrawSummary.locked_balance,
      withdrawable_balance: withdrawSummary.withdrawable_balance,
      withdraw_summary: withdrawSummary,
    })
  })

  router.get('/wallet-history', async (req, res) => {
    const currency = req.query.currency ? String(req.query.currency).trim().toUpperCase() : null
    const sourceType = req.query.sourceType ? String(req.query.sourceType).trim().toLowerCase() : null
    const transactionType = req.query.transactionType ? String(req.query.transactionType).trim().toLowerCase() : null
    const dateFrom = req.query.dateFrom ? String(req.query.dateFrom).trim().slice(0, 10) : null
    const dateTo = req.query.dateTo ? String(req.query.dateTo).trim().slice(0, 10) : null
    const limit = Math.min(Number(req.query.limit) || 100, 200)
    const rows = await getWalletHistory(db, req.user.id, {
      currency,
      sourceType,
      transactionType,
      dateFrom,
      dateTo,
      limit,
    })
    return res.json({ transactions: rows })
  })

  router.get('/earning-history', async (req, res) => {
    const sourceType = req.query.sourceType ? String(req.query.sourceType).trim().toLowerCase() : null
    const limit = Math.min(Number(req.query.limit) || 100, 200)
    const grouped = req.query.grouped === 'true' || req.query.grouped === '1'
    const result = await getEarningHistory(db, req.user.id, { sourceType, limit, grouped })
    if (grouped && result && typeof result === 'object' && 'grouped' in result) {
      return res.json({ entries: result.entries, grouped: result.grouped })
    }
    return res.json({ entries: Array.isArray(result) ? result : [] })
  })

  router.get('/admin/user-wallet', requirePermission(db, 'manage_balances'), async (req, res) => {
    const userId = Number(req.query.userId || 0)
    const currency = normalizeCurrency(req.query.currency || 'USDT')
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    if (!userId || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    const [accountsOverview, rules, walletTxns, earningEntries] = await Promise.all([
      getWalletAccountsOverview(db, userId),
      getRules(db),
      getWalletHistory(db, userId, { currency, limit }),
      getEarningHistory(db, userId, { limit }),
    ])
    await reapplyPrincipalLocksForUser(db, userId, currency, rules)
    const withdrawSummary = await calculateWithdrawalSummary(db, userId, currency, rules)
    const userRow = await get(db, `SELECT id, email, phone, display_name FROM users WHERE id = ? LIMIT 1`, [userId])
    return res.json({
      user: userRow ? { id: userRow.id, email: userRow.email, phone: userRow.phone, display_name: userRow.display_name } : null,
      overview: {
        total_assets: accountsOverview.total_assets,
        by_currency: accountsOverview.by_currency,
        by_source: accountsOverview.by_source,
        main_balance: withdrawSummary.current_balance,
        locked_balance: withdrawSummary.locked_balance,
        withdrawable_balance: withdrawSummary.withdrawable_balance,
      },
      withdraw_summary: withdrawSummary,
      transactions: walletTxns,
      earning_entries: Array.isArray(earningEntries) ? earningEntries : [],
    })
  })

  router.get('/admin/reconcile', requireRole('owner'), async (req, res) => {
    const userId = Number(req.query.userId || 0)
    const currency = req.query.currency ? String(req.query.currency).trim().toUpperCase() : 'USDT'
    const limit = Math.min(Number(req.query.limit) || 500, 1000)
    try {
      if (userId > 0) {
        const result = await reconcileUserCurrency(db, userId, currency)
        return res.json({ reconciliation: result })
      }
      const discrepancies = await reconcileAll(db, limit)
      const earningCheck = await verifyEarningTransfers(db, 100)
      const linkageCheck = await verifyDepositWithdrawalLinkage(db, 200)
      const zeroCheck = await verifyUnexpectedZeroBalances(db, 100)
      return res.json({
        discrepancies,
        earningTransferCheck: earningCheck,
        depositWithdrawalLinkage: linkageCheck,
        unexpectedZeroBalances: zeroCheck,
        summary: {
          totalDiscrepancies: discrepancies.length,
          earningIssues: earningCheck.issues.length,
          linkageIssues: linkageCheck.issues.length,
          zeroBalanceMismatches: zeroCheck.issues.length,
        },
      })
    } catch (error) {
      return res.status(500).json({ error: 'RECONCILIATION_FAILED', message: String(error?.message || '') })
    }
  })

  router.post('/adjust', requirePermission(db, 'manage_balances'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const currency = String(req.body?.currency || 'USDT').toUpperCase()
    const amount = Number(req.body?.amount || 0)
    const type = String(req.body?.type || 'add')
    const note = String(req.body?.note || '')
    if (!userId || !amount || !['add', 'deduct'].includes(type)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    const delta = type === 'deduct' ? -Math.abs(amount) : Math.abs(amount)
    try {
      await withTransaction(db, async (tx) => {
        const balanceBeforeAdjust = await getMainBalance(tx, userId, currency)
        const { walletTxnId, balanceAfter: balanceAfterAdjust } = await adjustBalance(tx, {
          userId,
          currency,
          delta,
          referenceType: 'admin_adjust',
          referenceId: req.user.id,
          createdBy: req.user.id,
          note: note || 'Admin balance adjustment',
        })
        logAdminFinancialAction({
          adminUserId: req.user.id,
          targetUserId: userId,
          actionType: 'balance_adjust',
          sourceTable: 'wallet_transactions',
          targetTable: 'wallet_accounts',
          transactionId: walletTxnId,
          balanceBefore: balanceBeforeAdjust,
          balanceAfter: balanceAfterAdjust,
          extra: { delta, currency },
        })
          await createLocalizedNotification(tx, userId, 'balance_adjusted', {
            currency,
            amount: Math.abs(amount),
            operation: type === 'deduct' ? 'deducted' : 'added',
          })
      })
    } catch (error) {
      if (error instanceof Error && error.message === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })
      }
      throw error
    }
    const nextAmount = await getMainBalance(db, userId, currency)
    publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId, source: 'balance_adjust' })
    return res.json({ ok: true, balance: { userId, currency, amount: nextAmount } })
  })

  router.get('/rules', async (_req, res) => {
    const rules = await getRules(db)
    return res.json({ rules })
  })

  router.post('/rules', requireRole('owner'), async (req, res) => {
    const nextRules = normalizeRules(req.body?.rules)
    await upsertRules(db, nextRules)
    await reapplyPrincipalLocksForAllUsers(db, nextRules)
    publishLiveUpdate({ type: 'home_content_updated', source: 'balance_rules', key: 'balance_rules' })
    publishLiveUpdate({ type: 'balance_rules_updated', source: 'balance_rules', key: 'balance_rules' })
    return res.json({ ok: true, rules: nextRules })
  })

  router.get('/withdraw-summary/my', async (req, res) => {
    const currency = normalizeCurrency(req.query.currency || 'USDT')
    const rules = await getRules(db)
    await reapplyPrincipalLocksForUser(db, req.user.id, currency, rules)
    const summary = await calculateWithdrawalSummary(db, req.user.id, currency, rules)
    return res.json({ summary })
  })

  router.get('/withdraw-locks/my', async (req, res) => {
    const currency = normalizeCurrency(req.query.currency || 'USDT')
    const rules = await getRules(db)
    await reapplyPrincipalLocksForUser(db, req.user.id, currency, rules)
    await unlockAllPrincipalLocksIfEligible(db, req.user.id, currency, rules)
    const summary = await calculateWithdrawalSummary(db, req.user.id, currency, rules)
    const rows = await all(
      db,
      `SELECT id, source_type, source_id, principal_amount, required_profit_amount, unlock_ratio,
              lock_status, unlocked_at, created_at, updated_at
       FROM user_principal_locks
       WHERE user_id = ? AND currency = ?
       ORDER BY id DESC
       LIMIT 200`,
      [req.user.id, currency],
    )
    const orderedForProgress = [...rows].sort((a, b) => Number(a.id) - Number(b.id))
    const breakdownForward = buildLockBreakdown(orderedForProgress, summary.earned_profit)
    const mapById = new Map(breakdownForward.map((x) => [x.id, x]))
    const items = rows.map((row) => mapById.get(Number(row.id)) || row)
    return res.json({ items, summary })
  })

  router.get('/admin/unlock-override', requireRole('owner'), async (req, res) => {
    const userId = Number(req.query.userId)
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    const override = await getUserUnlockOverride(db, userId)
    const rules = await getRules(db)
    await reapplyPrincipalLocksForUser(db, userId, 'USDT', rules)
    const summary = await calculateWithdrawalSummary(db, userId, 'USDT', rules)
    return res.json({ override, summary })
  })

  router.post('/admin/unlock-override', requireRole('owner'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const forceUnlockPrincipal = req.body?.forceUnlockPrincipal === true ? 1 : 0
    const customUnlockRatioRaw = req.body?.customUnlockRatio
    const customMinProfitRaw = req.body?.customMinProfit
    const note = normalizeText(req.body?.note, 260)
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    const customUnlockRatio =
      customUnlockRatioRaw === '' || customUnlockRatioRaw == null
        ? null
        : Number.isFinite(Number(customUnlockRatioRaw)) && Number(customUnlockRatioRaw) >= 0
          ? Number(Number(customUnlockRatioRaw).toFixed(4))
          : null
    const customMinProfit =
      customMinProfitRaw === '' || customMinProfitRaw == null
        ? null
        : Number.isFinite(Number(customMinProfitRaw)) && Number(customMinProfitRaw) >= 0
          ? Number(Number(customMinProfitRaw).toFixed(8))
          : null
    await withTransaction(db, async (tx) => {
      await run(
        tx,
        `INSERT INTO user_unlock_overrides (
          user_id, force_unlock_principal, custom_unlock_ratio, custom_min_profit, note, updated_by, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          force_unlock_principal = excluded.force_unlock_principal,
          custom_unlock_ratio = excluded.custom_unlock_ratio,
          custom_min_profit = excluded.custom_min_profit,
          note = excluded.note,
          updated_by = excluded.updated_by,
          updated_at = CURRENT_TIMESTAMP`,
        [userId, forceUnlockPrincipal, customUnlockRatio, customMinProfit, note || null, req.user.id],
      )
      const currencies = await all(
        tx,
        `SELECT DISTINCT currency
         FROM user_principal_locks
         WHERE user_id = ? AND lock_status = 'locked'`,
        [userId],
      )
      if (currencies.length) {
        const rules = await getRules(tx)
        for (const row of currencies) {
          await reapplyPrincipalLocksForUser(tx, userId, String(row.currency || 'USDT'), rules)
        }
      }
      await createAdminAuditLog(tx, {
        actorUserId: req.user.id,
        targetUserId: userId,
        section: 'balance_unlock',
        action: 'set_override',
        metadata: JSON.stringify({ forceUnlockPrincipal, customUnlockRatio, customMinProfit }),
      })
    })
    const override = await getUserUnlockOverride(db, userId)
    const rules = await getRules(db)
    const summary = await calculateWithdrawalSummary(db, userId, 'USDT', rules)
    return res.json({ ok: true, override, summary })
  })

  router.post('/deposit-requests', async (req, res) => {
    await new Promise((resolve, reject) => {
      uploadProof.single('proofImage')(req, res, (error) => {
        if (error) return reject(error)
        return resolve(null)
      })
    }).catch((error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'FILE_TOO_LARGE' })
      }
      return res.status(400).json({ error: 'UPLOAD_FAILED' })
    })
    if (res.headersSent) return

    const amount = parsePositiveAmount(req.body?.amount)
    const currency = normalizeCurrency(req.body?.currency || 'USDT')
    const method = normalizeMethod(req.body?.method)
    const transferRef = normalizeText(req.body?.transferRef, 96)
    const notes = normalizeText(req.body?.notes, 500)
    const idempotencyKey = normalizeText(req.body?.idempotencyKey, 80)
    if (!amount || !method || !transferRef) return res.status(400).json({ error: 'INVALID_INPUT' })

    const rules = await getRules(db)
    if (amount < Number(rules.minDeposit || 0)) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!rules.depositMethods.includes(method)) return res.status(400).json({ error: 'INVALID_INPUT' })

    const mime = String(req.file?.mimetype || '').toLowerCase()
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' })
    if (req.file && !mime.startsWith('image/')) return res.status(400).json({ error: 'INVALID_FILE_TYPE' })
    const proofImagePath = req.file
      ? `/uploads/payment-proofs/${path.basename(req.file.path).replaceAll('\\', '/')}`
      : null

    const payload = [req.user.id, amount, currency, method, transferRef, notes || null, proofImagePath, idempotencyKey || null]
    try {
      if (!rules.manualReview) {
        let requestId = 0
        let rewardedReferrerUserId = 0
        await withTransaction(db, async (tx) => {
          const insertRes = await run(
            tx,
            `INSERT INTO deposit_requests (
              user_id, amount, currency, method, transfer_ref, user_notes, proof_image_path, request_status, idempotency_key
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id`,
            payload,
          )
          requestId = Number(insertRes.lastID || insertRes.rows?.[0]?.id || 0)
          const { walletTxnId } = await createDeposit(tx, {
            userId: req.user.id,
            currency,
            amount,
            referenceType: 'deposit_request',
            referenceId: requestId,
            idempotencyKey: `deposit_auto_${requestId}`,
            note: `Auto-approved deposit request #${requestId}`,
          })
          await run(
            tx,
            `UPDATE deposit_requests
             SET request_status = 'approved',
                 wallet_transaction_id = ?,
                 completed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [walletTxnId || null, requestId],
          )
          const unlockProfile = await getEffectiveUnlockProfile(tx, req.user.id, currency, rules)
          await createPrincipalLock(tx, {
            userId: req.user.id,
            currency,
            principalAmount: amount,
            sourceType: 'deposit_request',
            sourceId: requestId,
            unlockRatio: unlockProfile.unlockRatio,
            minimumProfitToUnlock: unlockProfile.minimumProfitToUnlock,
            forceUnlockPrincipal: unlockProfile.forceUnlockPrincipal,
          })
          const vipResult = await applyVipAndReferralAfterDeposit(tx, {
            userId: req.user.id,
            amount,
            currency,
            adminId: null,
            depositRequestId: requestId,
            rules,
          })
          await reapplyPrincipalLocksForUser(tx, req.user.id, currency, rules)
          rewardedReferrerUserId = Number(vipResult.rewardedReferrerUserId || 0)
        })
        publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'deposit_auto_approved' })
        if (rewardedReferrerUserId > 0) {
          publishLiveUpdate({
            type: 'balance_updated',
            scope: 'user',
            userId: rewardedReferrerUserId,
            source: 'referral_reward',
          })
        }
        return res.json({ ok: true, requestId, status: 'approved' })
      }
      const insertRes = await run(
        db,
        `INSERT INTO deposit_requests (
          user_id, amount, currency, method, transfer_ref, user_notes, proof_image_path, request_status, idempotency_key
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?) RETURNING id`,
        payload,
      )
      const requestId = Number(insertRes.lastID || insertRes.rows?.[0]?.id || 0)
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'deposit_request_created' })
      return res.json({ ok: true, requestId, status: 'pending' })
    } catch (error) {
      const msg = String(error?.message || '').toLowerCase()
      if (msg.includes('idempotency_key') || msg.includes('unique')) {
        return res.status(409).json({ error: 'ALREADY_EXISTS' })
      }
      throw error
    }
  })

  router.post('/withdrawal-requests', async (req, res) => {
    const amount = parsePositiveAmount(req.body?.amount)
    const currency = normalizeCurrency(req.body?.currency || 'USDT')
    const method = normalizeMethod(req.body?.method)
    const accountInfo = normalizeText(req.body?.accountInfo, 220)
    const notes = normalizeText(req.body?.notes, 500)
    const idempotencyKey = normalizeText(req.body?.idempotencyKey, 80)
    if (!amount || !method || !accountInfo) return res.status(400).json({ error: 'INVALID_INPUT' })

    const rules = await getRules(db)
    if (amount < Number(rules.minWithdrawal || 0)) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!rules.withdrawalMethods.includes(method)) return res.status(400).json({ error: 'INVALID_INPUT' })

    await reapplyPrincipalLocksForUser(db, req.user.id, currency, rules)
    const summaryBefore = await calculateWithdrawalSummary(db, req.user.id, currency, rules)
    if (Number(summaryBefore.daily_withdrawal_remaining || 0) < amount) {
      return res.status(400).json({ error: 'DAILY_LIMIT_EXCEEDED' })
    }
    if (summaryBefore.withdrawable_balance < amount) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })
    const feePercent = Number(summaryBefore.withdrawal_fee_percent || 0)
    const feeAmount = Number(((amount * feePercent) / 100).toFixed(8))
    const payoutAmount = Number(Math.max(0, amount - feeAmount).toFixed(8))

    try {
      if (!rules.manualReview) {
        let requestId = 0
        await withTransaction(db, async (tx) => {
          const insertRes = await run(
            tx,
            `INSERT INTO withdrawal_requests (
              user_id, amount, currency, method, account_info, user_notes, request_status, idempotency_key,
              fee_percent, fee_amount, payout_amount, vip_level, processing_hours_min, processing_hours_max
            )
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
            [
              req.user.id,
              amount,
              currency,
              method,
              accountInfo,
              notes || null,
              idempotencyKey || null,
              feePercent,
              feeAmount,
              payoutAmount,
              Number(summaryBefore.vip_level || 0),
              Number(summaryBefore.processing_hours_min || 0) || null,
              Number(summaryBefore.processing_hours_max || 0) || null,
            ],
          )
          requestId = Number(insertRes.lastID || insertRes.rows?.[0]?.id || 0)
          const autoSummary = await unlockAllPrincipalLocksIfEligible(tx, req.user.id, currency, rules)
          const current = await getBalanceAmount(tx, req.user.id, currency)
          if (Number(autoSummary.daily_withdrawal_remaining || 0) < amount) throw new Error('DAILY_LIMIT_EXCEEDED')
          if (current < amount || autoSummary.withdrawable_balance < amount) throw new Error('INSUFFICIENT_BALANCE')
          const { walletTxnId } = await createWithdrawal(tx, {
            userId: req.user.id,
            currency,
            amount,
            feeAmount,
            referenceType: 'withdrawal_request',
            referenceId: requestId,
            idempotencyKey: `withdrawal_auto_${requestId}`,
            note: `Auto-approved withdrawal request #${requestId}`,
          })
          await run(
            tx,
            `UPDATE withdrawal_requests
             SET request_status = 'completed',
                 wallet_transaction_id = ?,
                 reviewed_at = CURRENT_TIMESTAMP,
                 completed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [walletTxnId || null, requestId],
          )
        })
        publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'withdraw_auto_completed' })
        return res.json({ ok: true, requestId, status: 'completed' })
      }
      const insertRes = await run(
        db,
        `INSERT INTO withdrawal_requests (
          user_id, amount, currency, method, account_info, user_notes, request_status, idempotency_key,
          fee_percent, fee_amount, payout_amount, vip_level, processing_hours_min, processing_hours_max
        )
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          req.user.id,
          amount,
          currency,
          method,
          accountInfo,
          notes || null,
          idempotencyKey || null,
          feePercent,
          feeAmount,
          payoutAmount,
          Number(summaryBefore.vip_level || 0),
          Number(summaryBefore.processing_hours_min || 0) || null,
          Number(summaryBefore.processing_hours_max || 0) || null,
        ],
      )
      const requestId = Number(insertRes.lastID || insertRes.rows?.[0]?.id || 0)
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'withdraw_request_created' })
      return res.json({ ok: true, requestId, status: 'pending' })
    } catch (error) {
      const msg = String(error?.message || '').toLowerCase()
      if (msg.includes('daily_limit_exceeded')) return res.status(400).json({ error: 'DAILY_LIMIT_EXCEEDED' })
      if (msg.includes('insufficient_balance')) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })
      if (msg.includes('idempotency_key') || msg.includes('unique')) {
        return res.status(409).json({ error: 'ALREADY_EXISTS' })
      }
      throw error
    }
  })

  router.get('/requests/my', async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase()
    const statusFilter = REQUEST_STATUSES.has(status) ? status : ''
    const deposits = statusFilter
      ? await all(
          db,
          `SELECT id, 'deposit' AS request_type, amount, currency, method, transfer_ref, user_notes,
                  proof_image_path, request_status, admin_note, reviewed_by, reviewed_at, completed_at,
                  created_at, updated_at
           FROM deposit_requests
           WHERE user_id = ? AND request_status = ?
           ORDER BY id DESC LIMIT 200`,
          [req.user.id, statusFilter],
        )
      : await all(
          db,
          `SELECT id, 'deposit' AS request_type, amount, currency, method, transfer_ref, user_notes,
                  proof_image_path, request_status, admin_note, reviewed_by, reviewed_at, completed_at,
                  created_at, updated_at
           FROM deposit_requests
           WHERE user_id = ?
           ORDER BY id DESC LIMIT 200`,
          [req.user.id],
        )
    const withdrawals = statusFilter
      ? await all(
          db,
          `SELECT id, 'withdrawal' AS request_type, amount, currency, method, account_info,
                  user_notes, request_status, admin_note, reviewed_by, reviewed_at, completed_at,
                  fee_percent, fee_amount, payout_amount, vip_level, processing_hours_min, processing_hours_max,
                  created_at, updated_at
           FROM withdrawal_requests
           WHERE user_id = ? AND request_status = ?
           ORDER BY id DESC LIMIT 200`,
          [req.user.id, statusFilter],
        )
      : await all(
          db,
          `SELECT id, 'withdrawal' AS request_type, amount, currency, method, account_info,
                  user_notes, request_status, admin_note, reviewed_by, reviewed_at, completed_at,
                  fee_percent, fee_amount, payout_amount, vip_level, processing_hours_min, processing_hours_max,
                  created_at, updated_at
           FROM withdrawal_requests
           WHERE user_id = ?
           ORDER BY id DESC LIMIT 200`,
          [req.user.id],
        )
    return res.json({ deposits, withdrawals })
  })

  router.get('/admin/deposit-requests', requirePermission(db, 'deposits.manage'), async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase()
    const statusFilter = REQUEST_STATUSES.has(status) ? status : ''
    const rows = statusFilter
      ? await all(
          db,
          `SELECT dr.*,
                  u.email AS user_email, u.phone AS user_phone, u.display_name AS user_display_name,
                  rv.display_name AS reviewed_by_name
           FROM deposit_requests dr
           JOIN users u ON u.id = dr.user_id
           LEFT JOIN users rv ON rv.id = dr.reviewed_by
           WHERE dr.request_status = ?
           ORDER BY dr.id DESC LIMIT 400`,
          [statusFilter],
        )
      : await all(
          db,
          `SELECT dr.*,
                  u.email AS user_email, u.phone AS user_phone, u.display_name AS user_display_name,
                  rv.display_name AS reviewed_by_name
           FROM deposit_requests dr
           JOIN users u ON u.id = dr.user_id
           LEFT JOIN users rv ON rv.id = dr.reviewed_by
           ORDER BY dr.id DESC LIMIT 400`,
        )
    return res.json({ items: rows })
  })

  router.get('/admin/withdrawal-requests', requirePermission(db, 'withdrawals.manage'), async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase()
    const statusFilter = REQUEST_STATUSES.has(status) ? status : ''
    const rows = statusFilter
      ? await all(
          db,
          `SELECT wr.*,
                  u.email AS user_email, u.phone AS user_phone, u.display_name AS user_display_name,
                  rv.display_name AS reviewed_by_name
           FROM withdrawal_requests wr
           JOIN users u ON u.id = wr.user_id
           LEFT JOIN users rv ON rv.id = wr.reviewed_by
           WHERE wr.request_status = ?
           ORDER BY wr.id DESC LIMIT 400`,
          [statusFilter],
        )
      : await all(
          db,
          `SELECT wr.*,
                  u.email AS user_email, u.phone AS user_phone, u.display_name AS user_display_name,
                  rv.display_name AS reviewed_by_name
           FROM withdrawal_requests wr
           JOIN users u ON u.id = wr.user_id
           LEFT JOIN users rv ON rv.id = wr.reviewed_by
           ORDER BY wr.id DESC LIMIT 400`,
        )
    return res.json({ items: rows })
  })

  router.post('/admin/deposit-requests/:id/review', requirePermission(db, 'deposits.manage'), async (req, res) => {
    const requestId = Number(req.params.id)
    const action = String(req.body?.action || '').trim().toLowerCase()
    const adminNote = normalizeText(req.body?.adminNote, 500)
    if (!requestId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    let outcomeStatus = 'rejected'
    let rewardedReferrerUserId = 0
    await withTransaction(db, async (tx) => {
      const item = await get(tx, `SELECT * FROM deposit_requests WHERE id = ? LIMIT 1`, [requestId])
      if (!item) throw new Error('NOT_FOUND')
      if (String(item.request_status) !== 'pending') throw new Error('ALREADY_PROCESSED')
      if (action === 'reject') {
        await run(
          tx,
          `UPDATE deposit_requests
           SET request_status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND request_status = 'pending'`,
          [adminNote || null, req.user.id, requestId],
        )
        outcomeStatus = 'rejected'
      } else {
        const balanceBeforeDeposit = await getBalanceAmount(tx, item.user_id, item.currency)
        const { walletTxnId, balanceAfter: balanceAfterDeposit } = await createDeposit(tx, {
          userId: item.user_id,
          currency: item.currency,
          amount: Number(item.amount),
          referenceType: 'deposit_request',
          referenceId: requestId,
          idempotencyKey: `deposit_review_${requestId}`,
          createdBy: req.user.id,
          note: adminNote || `Approved deposit request #${requestId}`,
        })
        const verifiedBalance = await getBalanceAmount(tx, item.user_id, item.currency)
        if (verifiedBalance !== balanceAfterDeposit) {
          console.warn('[admin-financial] deposit approval balance mismatch', {
            requestId,
            userId: item.user_id,
            expected: balanceAfterDeposit,
            actual: verifiedBalance,
            walletTxnId,
          })
        }
        logAdminFinancialAction({
          adminUserId: req.user.id,
          targetUserId: item.user_id,
          actionType: 'deposit_approve',
          sourceTable: 'deposit_requests',
          targetTable: 'wallet_accounts',
          transactionId: walletTxnId,
          balanceBefore: balanceBeforeDeposit,
          balanceAfter: balanceAfterDeposit,
          extra: { requestId, amount: Number(item.amount), currency: item.currency },
        })
        const rules = await getRules(tx)
        const unlockProfile = await getEffectiveUnlockProfile(tx, item.user_id, item.currency, rules)
        await createPrincipalLock(tx, {
          userId: item.user_id,
          currency: item.currency,
          principalAmount: Number(item.amount),
          sourceType: 'deposit_request',
          sourceId: requestId,
          unlockRatio: unlockProfile.unlockRatio,
          minimumProfitToUnlock: unlockProfile.minimumProfitToUnlock,
          forceUnlockPrincipal: unlockProfile.forceUnlockPrincipal,
        })
        const updateRes = await run(
          tx,
          `UPDATE deposit_requests
           SET request_status = 'approved',
               admin_note = ?,
               reviewed_by = ?,
               reviewed_at = CURRENT_TIMESTAMP,
               completed_at = CURRENT_TIMESTAMP,
               wallet_transaction_id = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND request_status = 'pending'`,
          [adminNote || null, req.user.id, walletTxnId || null, requestId],
        )
        if (!updateRes.changes) throw new Error('ALREADY_PROCESSED')
        const vipResult = await applyVipAndReferralAfterDeposit(tx, {
          userId: item.user_id,
          amount: Number(item.amount || 0),
          currency: item.currency,
          adminId: req.user.id,
          depositRequestId: requestId,
          rules,
        })
        await reapplyPrincipalLocksForUser(tx, item.user_id, item.currency, rules)
        rewardedReferrerUserId = Number(vipResult.rewardedReferrerUserId || 0)
        await createLocalizedNotification(tx, item.user_id, 'deposit_approved', { requestId })
        await createAdminAuditLog(tx, {
          actorUserId: req.user.id,
          targetUserId: item.user_id,
          section: 'balance_requests',
          action: 'deposit_approved',
          metadata: JSON.stringify({
            requestId,
            amount: item.amount,
            currency: item.currency,
            walletTxnId,
            balanceBefore: balanceBeforeDeposit,
            balanceAfter: balanceAfterDeposit,
          }),
        })
        outcomeStatus = 'approved'
      }
    }).catch((error) => {
      const msg = String(error?.message || '')
      if (msg === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
      if (msg === 'ALREADY_PROCESSED') return res.status(409).json({ error: 'ALREADY_EXISTS' })
      throw error
    })
    if (res.headersSent) return
    const reviewedItem = await get(db, `SELECT user_id FROM deposit_requests WHERE id = ? LIMIT 1`, [requestId])
    if (reviewedItem?.user_id) {
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: Number(reviewedItem.user_id), source: 'deposit_review' })
    }
    if (rewardedReferrerUserId > 0) {
      publishLiveUpdate({
        type: 'balance_updated',
        scope: 'user',
        userId: rewardedReferrerUserId,
        source: 'referral_reward',
      })
    }
    return res.json({ ok: true, status: outcomeStatus })
  })

  router.post('/admin/withdrawal-requests/:id/review', requirePermission(db, 'withdrawals.manage'), async (req, res) => {
    const requestId = Number(req.params.id)
    const action = String(req.body?.action || '').trim().toLowerCase()
    const adminNote = normalizeText(req.body?.adminNote, 500)
    if (!requestId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    let outcomeStatus = 'rejected'
    await withTransaction(db, async (tx) => {
      const item = await get(tx, `SELECT * FROM withdrawal_requests WHERE id = ? LIMIT 1`, [requestId])
      if (!item) throw new Error('NOT_FOUND')
      if (String(item.request_status) !== 'pending') throw new Error('ALREADY_PROCESSED')

      if (action === 'reject') {
        await run(
          tx,
          `UPDATE withdrawal_requests
           SET request_status = 'rejected', admin_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND request_status = 'pending'`,
          [adminNote || null, req.user.id, requestId],
        )
        outcomeStatus = 'rejected'
      } else {
        const rules = await getRules(tx)
        const summary = await unlockAllPrincipalLocksIfEligible(tx, item.user_id, item.currency, rules)
        const balanceBeforeWithdraw = await getBalanceAmount(tx, item.user_id, item.currency)
        const requestedAmount = Number(item.amount || 0)
        if (Number(summary.daily_withdrawal_remaining || 0) < requestedAmount) {
          throw new Error('DAILY_LIMIT_EXCEEDED')
        }
        if (balanceBeforeWithdraw < requestedAmount || summary.withdrawable_balance < requestedAmount) {
          throw new Error('INSUFFICIENT_BALANCE')
        }
        const { walletTxnId, balanceAfter: balanceAfterWithdraw } = await createWithdrawal(tx, {
          userId: item.user_id,
          currency: item.currency,
          amount: requestedAmount,
          feeAmount: Number(item.fee_amount || 0),
          referenceType: 'withdrawal_request',
          referenceId: requestId,
          idempotencyKey: `withdrawal_review_${requestId}`,
          createdBy: req.user.id,
          note: adminNote || `Approved withdrawal request #${requestId}`,
        })
        logAdminFinancialAction({
          adminUserId: req.user.id,
          targetUserId: item.user_id,
          actionType: 'withdrawal_approve',
          sourceTable: 'withdrawal_requests',
          targetTable: 'wallet_accounts',
          transactionId: walletTxnId,
          balanceBefore: balanceBeforeWithdraw,
          balanceAfter: balanceAfterWithdraw,
          extra: { requestId, amount: requestedAmount, currency: item.currency },
        })
        const updateRes = await run(
          tx,
          `UPDATE withdrawal_requests
           SET request_status = 'approved',
               admin_note = ?,
               reviewed_by = ?,
               reviewed_at = CURRENT_TIMESTAMP,
               wallet_transaction_id = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND request_status = 'pending'`,
          [adminNote || null, req.user.id, walletTxnId || null, requestId],
        )
        if (!updateRes.changes) throw new Error('ALREADY_PROCESSED')
        await createLocalizedNotification(tx, item.user_id, 'withdrawal_approved', { requestId })
        await createAdminAuditLog(tx, {
          actorUserId: req.user.id,
          targetUserId: item.user_id,
          section: 'balance_requests',
          action: 'withdrawal_approved',
          metadata: JSON.stringify({
            requestId,
            amount: requestedAmount,
            currency: item.currency,
            walletTxnId,
            balanceBefore: balanceBeforeWithdraw,
            balanceAfter: balanceAfterWithdraw,
          }),
        })
        outcomeStatus = 'approved'
      }
    }).catch((error) => {
      const msg = String(error?.message || '')
      if (msg === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
      if (msg === 'ALREADY_PROCESSED') return res.status(409).json({ error: 'ALREADY_EXISTS' })
      if (msg === 'DAILY_LIMIT_EXCEEDED') return res.status(400).json({ error: 'DAILY_LIMIT_EXCEEDED' })
      if (msg === 'INSUFFICIENT_BALANCE') return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })
      throw error
    })
    if (res.headersSent) return
    const reviewedItem = await get(db, `SELECT user_id FROM withdrawal_requests WHERE id = ? LIMIT 1`, [requestId])
    if (reviewedItem?.user_id) {
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: Number(reviewedItem.user_id), source: 'withdraw_review' })
    }
    return res.json({ ok: true, status: outcomeStatus })
  })

  router.post('/admin/withdrawal-requests/:id/complete', requirePermission(db, 'withdrawals.manage'), async (req, res) => {
    const requestId = Number(req.params.id)
    const adminNote = normalizeText(req.body?.adminNote, 500)
    if (!requestId) return res.status(400).json({ error: 'INVALID_INPUT' })
    const item = await get(db, `SELECT * FROM withdrawal_requests WHERE id = ? LIMIT 1`, [requestId])
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' })
    if (String(item.request_status) === 'completed') return res.status(409).json({ error: 'ALREADY_EXISTS' })
    if (String(item.request_status) !== 'approved') return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `UPDATE withdrawal_requests
       SET request_status = 'completed',
           completed_at = CURRENT_TIMESTAMP,
           admin_note = ?,
           reviewed_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND request_status = 'approved'`,
      [adminNote || item.admin_note || null, req.user.id, requestId],
    )
    await createLocalizedNotification(db, item.user_id, 'withdrawal_completed', { requestId })
    await createAdminAuditLog(db, {
      actorUserId: req.user.id,
      targetUserId: item.user_id,
      section: 'balance_requests',
      action: 'withdrawal_completed',
      metadata: JSON.stringify({ requestId }),
    })
    publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: Number(item.user_id || 0), source: 'withdraw_completed' })
    return res.json({ ok: true, status: 'completed' })
  })

  router.post('/set', requireRole('owner'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const currency = String(req.body?.currency || 'USDT').toUpperCase()
    const amount = Number(req.body?.amount ?? 0)
    const note = String(req.body?.note || '')
    if (!userId || amount < 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    const fixedAmount = Number(amount.toFixed(8))
    await withTransaction(db, async (tx) => {
      const balanceBeforeSet = await getMainBalance(tx, userId, currency)
      const delta = Number((fixedAmount - balanceBeforeSet).toFixed(8))
      if (delta !== 0) {
        const { walletTxnId } = await adjustBalance(tx, {
          userId,
          currency,
          delta,
          referenceType: 'owner_set',
          referenceId: req.user.id,
          createdBy: req.user.id,
          note: note || 'Set by owner',
        })
        logAdminFinancialAction({
          adminUserId: req.user.id,
          targetUserId: userId,
          actionType: 'owner_set',
          sourceTable: 'wallet_transactions',
          targetTable: 'wallet_accounts',
          transactionId: walletTxnId,
          balanceBefore: balanceBeforeSet,
          balanceAfter: fixedAmount,
          extra: { currency, delta },
        })
      }
        await createLocalizedNotification(tx, userId, 'balance_set', {
          currency,
          amount: fixedAmount,
        })
    })
    publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId, source: 'balance_set' })
    return res.json({ ok: true, balance: { userId, currency, amount: fixedAmount } })
  })

  return router
}
