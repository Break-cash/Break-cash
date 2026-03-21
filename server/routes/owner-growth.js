import { Router } from 'express'
import { all, get, run } from '../db.js'
import { hashPassword } from '../auth.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'
import { normalizeVipTierConfig, toVipTierStoragePayload } from '../services/vip-rules.js'
import {
  getRewardPayoutConfig,
  normalizeRewardLockHours,
  normalizeRewardPayoutMode,
  normalizeRewardSourceType,
  reapplyRewardPoliciesToPendingEntries,
} from '../services/wallet-service.js'
import {
  reconcileAll,
  verifyDepositWithdrawalLinkage,
  verifyEarningTransfers,
  verifyUnexpectedZeroBalances,
} from '../services/wallet-reconciliation.js'

function toIso(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

function parseJsonOrNull(value) {
  if (value == null || value === '') return null
  try {
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return null
  }
}

function randomDelayMinutes(min = 10, max = 180) {
  const nMin = Math.max(1, Number(min || 10))
  const nMax = Math.max(nMin, Number(max || 180))
  return Math.floor(Math.random() * (nMax - nMin + 1)) + nMin
}

function toIsoAfterMinutes(minutes) {
  return new Date(Date.now() + Number(minutes) * 60 * 1000).toISOString()
}

async function logAudit(db, actorUserId, section, action, targetUserId = null, metadata = {}) {
  await run(
    db,
    `INSERT INTO admin_audit_logs (actor_user_id, target_user_id, section, action, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [actorUserId, targetUserId, section, action, JSON.stringify(metadata || {})],
  )
}

function buildValuesPlaceholders(rowCount, colCount) {
  const rows = []
  for (let i = 0; i < rowCount; i += 1) {
    rows.push(`(${new Array(colCount).fill('?').join(', ')})`)
  }
  return rows.join(', ')
}

function parseVipTierPayload(row) {
  const normalized = normalizeVipTierConfig(Number(row.level || 0), {
    ...(parseJsonOrNull(row.perks_json) || {}),
    level: Number(row.level || 0),
    title: row.title,
    minDeposit: Number(row.min_deposit || 0),
    minTradeVolume: Number(row.min_trade_volume || 0),
    referralMultiplier: Number(row.referral_multiplier || 0),
    referralPercent: Number(row.referral_percent || 0),
  })
  return {
    ...row,
    perks: normalized.perks,
    daily_mining_percent: normalized.dailyMiningPercent,
    mining_speed_percent: normalized.miningSpeedPercent,
    daily_withdrawal_limit: normalized.dailyWithdrawalLimit,
    processing_hours_min: normalized.processingHoursMin,
    processing_hours_max: normalized.processingHoursMax,
    withdrawal_fee_percent: normalized.withdrawalFeePercent,
    active_extra_fee_percent: normalized.activeExtraFeePercent,
    level2_referral_percent: normalized.level2ReferralPercent,
    level3_referral_percent: normalized.level3ReferralPercent,
    profit_multiplier: normalized.profitMultiplier,
    auto_reinvest: normalized.autoReinvest ? 1 : 0,
    daily_bonus: normalized.dailyBonus ? 1 : 0,
  }
}

function buildAccountRestrictionLabels(row) {
  const labels = []
  if (Number(row?.is_banned || 0) === 1) labels.push('محظور')
  if (Number(row?.is_frozen || 0) === 1) labels.push('مجمّد')
  if (Number(row?.is_approved || 0) !== 1) labels.push('بانتظار الاعتماد')
  if (row?.banned_until && !Number.isNaN(Date.parse(String(row.banned_until))) && Date.parse(String(row.banned_until)) > Date.now()) {
    labels.push(`حظر مؤقت حتى ${new Date(String(row.banned_until)).toISOString()}`)
  }
  return labels
}

const REWARD_PAYOUT_SOURCE_TYPES = ['mining', 'tasks', 'referrals', 'deposits']

function getMonthRange(rawValue) {
  const raw = String(rawValue || '').trim()
  const now = new Date()
  const fallbackMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const month = /^\d{4}-\d{2}$/.test(raw) ? raw : fallbackMonth
  const [yearPart, monthPart] = month.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart)
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return getMonthRange(fallbackMonth)
  }
  const startAt = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0))
  const endAt = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0))
  return {
    month: `${year}-${String(monthIndex).padStart(2, '0')}`,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
  }
}

function normalizeRewardSourceModes(raw) {
  const sourceModes = {}
  if (!raw || typeof raw !== 'object') return sourceModes
  for (const sourceType of REWARD_PAYOUT_SOURCE_TYPES) {
    if (sourceType in raw) sourceModes[sourceType] = normalizeRewardPayoutMode(raw[sourceType])
  }
  return sourceModes
}

function normalizeRewardSourceLockHours(raw) {
  const sourceLockHours = {}
  if (!raw || typeof raw !== 'object') return sourceLockHours
  for (const sourceType of REWARD_PAYOUT_SOURCE_TYPES) {
    if (sourceType in raw) sourceLockHours[sourceType] = normalizeRewardLockHours(raw[sourceType], 0)
  }
  return sourceLockHours
}

function parseRewardUserIds(...values) {
  const seen = new Set()
  const userIds = []
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const id = Number(item)
        if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
          seen.add(id)
          userIds.push(id)
        }
      }
      continue
    }
    const tokens = String(value || '')
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    for (const token of tokens) {
      const id = Number(token)
      if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
        seen.add(id)
        userIds.push(id)
      }
    }
  }
  return userIds
}

function mapRewardOverrideRow(row) {
  return {
    overrideKey: `${String(row.override_kind || 'typed')}:${Number(row.id || 0)}`,
    id: Number(row.id || 0),
    legacy: String(row.override_kind || 'typed') === 'legacy',
    userId: Number(row.user_id || 0),
    sourceType: normalizeRewardSourceType(row.source_type, 'all'),
    payoutMode: normalizeRewardPayoutMode(row.payout_mode),
    lockHours: row.lock_hours == null ? null : normalizeRewardLockHours(row.lock_hours, 0),
    note: row.note || null,
    updatedBy: row.updated_by == null ? null : Number(row.updated_by),
    updatedAt: row.updated_at || null,
    pendingCount: Number(row.pending_count || 0),
    pendingAmount: Number(row.pending_amount || 0),
    user: {
      displayName: row.display_name || null,
      email: row.email || null,
      phone: row.phone || null,
    },
  }
}

async function getRewardPayoutOverrides(db, limit = 200) {
  const rows = await all(
    db,
    `SELECT *
     FROM (
       SELECT
         'typed' AS override_kind,
         o.id,
         o.user_id,
         o.source_type,
         o.payout_mode,
         o.lock_hours,
         o.note,
         o.updated_by,
         o.updated_at,
         u.display_name,
         u.email,
         u.phone,
         COALESCE(p.pending_count, 0) AS pending_count,
         COALESCE(p.pending_amount, 0) AS pending_amount
       FROM user_reward_payout_overrides o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN (
         SELECT user_id, source_type, COUNT(*) AS pending_count, COALESCE(SUM(amount), 0) AS pending_amount
         FROM earning_entries
         WHERE status = 'pending'
         GROUP BY user_id, source_type
       ) p ON p.user_id = o.user_id AND p.source_type = o.source_type

       UNION ALL

       SELECT
         'legacy' AS override_kind,
         o.id,
         o.user_id,
         'all' AS source_type,
         o.payout_mode,
         NULL AS lock_hours,
         o.note,
         o.updated_by,
         o.updated_at,
         u.display_name,
         u.email,
         u.phone,
         COALESCE(p.pending_count, 0) AS pending_count,
         COALESCE(p.pending_amount, 0) AS pending_amount
       FROM user_reward_mode_overrides o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS pending_count, COALESCE(SUM(amount), 0) AS pending_amount
         FROM earning_entries
         WHERE status = 'pending'
         GROUP BY user_id
       ) p ON p.user_id = o.user_id
       WHERE NOT EXISTS (
         SELECT 1
         FROM user_reward_payout_overrides current_override
         WHERE current_override.user_id = o.user_id
           AND current_override.source_type = 'all'
       )
     ) overrides
     ORDER BY updated_at DESC, id DESC
     LIMIT ?`,
    [limit],
  )
  return rows.map((row) => mapRewardOverrideRow(row))
}

async function getRewardPayoutOverridesCount(db) {
  const row = await get(
    db,
    `SELECT
       (
         SELECT COUNT(*)
         FROM user_reward_payout_overrides
       ) +
       (
         SELECT COUNT(*)
         FROM user_reward_mode_overrides legacy
         WHERE NOT EXISTS (
           SELECT 1
           FROM user_reward_payout_overrides current_override
           WHERE current_override.user_id = legacy.user_id
             AND current_override.source_type = 'all'
         )
       ) AS count`,
  )
  return Number(row?.count || 0)
}

export function createOwnerGrowthRouter(db) {
  const router = Router()
  router.use(requireAuth(db), requireRole('owner'))

  router.get('/daily-trades', async (req, res) => {
    const limit = Math.min(300, Math.max(20, Number(req.query.limit) || 120))
    const items = await all(
      db,
      `SELECT id, title, symbol, side, entry_price, take_profit, stop_loss,
              success_rate, visibility_scope, min_vip_level, is_visible,
              starts_at, ends_at, created_at
       FROM daily_trade_campaigns
       ORDER BY id DESC
       LIMIT ?`,
      [limit],
    )
    return res.json({ items })
  })

  router.post('/daily-trades', async (req, res) => {
    const title = String(req.body?.title || '').trim()
    const symbol = String(req.body?.symbol || '').trim().toUpperCase() || null
    const side = String(req.body?.side || '').trim().toLowerCase() || null
    const entryPrice = Number(req.body?.entryPrice || 0)
    const takeProfit = Number(req.body?.takeProfit || 0)
    const stopLoss = Number(req.body?.stopLoss || 0)
    const successRate = Number(req.body?.successRate || 0)
    const visibilityScope = String(req.body?.visibilityScope || 'all').trim().toLowerCase()
    const minVipLevel = Math.max(0, Math.min(5, Number(req.body?.minVipLevel || 0)))
    const isVisible = Number(req.body?.isVisible) ? 1 : 0
    const startsAt = toIso(req.body?.startsAt)
    const endsAt = toIso(req.body?.endsAt)
    if (!title) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!['all', 'depositors', 'vip', 'vip_level'].includes(visibilityScope)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    await run(
      db,
      `INSERT INTO daily_trade_campaigns
      (title, symbol, side, entry_price, take_profit, stop_loss, success_rate, visibility_scope, min_vip_level, is_visible, starts_at, ends_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, symbol, side, entryPrice, takeProfit, stopLoss, successRate, visibilityScope, minVipLevel, isVisible, startsAt, endsAt, req.user.id],
    )
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'daily_trades' })
    return res.json({ ok: true })
  })

  router.post('/daily-trades/toggle', async (req, res) => {
    const id = Number(req.body?.id)
    const isVisible = Number(req.body?.isVisible) ? 1 : 0
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `UPDATE daily_trade_campaigns SET is_visible = ? WHERE id = ?`, [isVisible, id])
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'daily_trades' })
    return res.json({ ok: true })
  })

  router.get('/bonus-rules', async (req, res) => {
    const limit = Math.min(300, Math.max(20, Number(req.query.limit) || 120))
    const items = await all(
      db,
      `SELECT id, rule_type, title, conditions_json, reward_json, is_active, starts_at, ends_at, created_at
       FROM bonus_rules
       ORDER BY id DESC
       LIMIT ?`,
      [limit],
    )
    return res.json({
      items: items.map((row) => ({
        ...row,
        conditions: parseJsonOrNull(row.conditions_json),
        reward: parseJsonOrNull(row.reward_json),
      })),
    })
  })

  router.post('/bonus-rules', async (req, res) => {
    const id = Number(req.body?.id || 0)
    const ruleType = String(req.body?.ruleType || '').trim().toLowerCase()
    const title = String(req.body?.title || '').trim()
    const isActive = Number(req.body?.isActive) ? 1 : 0
    const startsAt = toIso(req.body?.startsAt)
    const endsAt = toIso(req.body?.endsAt)
    const conditions = req.body?.conditions || {}
    const reward = req.body?.reward || {}
    if (!title || !['deposit', 'first_deposit', 'referral', 'seasonal'].includes(ruleType)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (id > 0) {
      await run(
        db,
        `UPDATE bonus_rules
         SET rule_type = ?, title = ?, conditions_json = ?, reward_json = ?, is_active = ?, starts_at = ?, ends_at = ?
         WHERE id = ?`,
        [ruleType, title, JSON.stringify(conditions), JSON.stringify(reward), isActive, startsAt, endsAt, id],
      )
      publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'bonus_rules' })
      return res.json({ ok: true, id })
    }
    await run(
      db,
      `INSERT INTO bonus_rules
      (rule_type, title, conditions_json, reward_json, is_active, starts_at, ends_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ruleType, title, JSON.stringify(conditions), JSON.stringify(reward), isActive, startsAt, endsAt, req.user.id],
    )
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'bonus_rules' })
    return res.json({ ok: true })
  })

  router.post('/bonus-rules/toggle', async (req, res) => {
    const id = Number(req.body?.id || 0)
    const isActive = Number(req.body?.isActive) ? 1 : 0
    if (!id) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `UPDATE bonus_rules SET is_active = ? WHERE id = ?`, [isActive, id])
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'bonus_rules' })
    return res.json({ ok: true })
  })

  router.delete('/bonus-rules/:id', async (req, res) => {
    const id = Number(req.params.id || 0)
    if (!id) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `DELETE FROM bonus_rules WHERE id = ?`, [id])
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'bonus_rules' })
    return res.json({ ok: true })
  })

  router.get('/vip-tiers', async (req, res) => {
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25))
    const items = await all(
      db,
      `SELECT id, level, title, min_deposit, min_trade_volume, referral_multiplier, referral_percent, perks_json, is_active
       FROM vip_tiers
       ORDER BY level ASC
       LIMIT ?`,
      [limit],
    )
    return res.json({
      items: items.map((row) => parseVipTierPayload(row)),
    })
  })

  router.get('/reward-payout-rules', async (req, res) => {
    const limit = Math.min(300, Math.max(20, Number(req.query.limit) || 200))
    const [config, overrides, overridesCount] = await Promise.all([
      getRewardPayoutConfig(db),
      getRewardPayoutOverrides(db, limit),
      getRewardPayoutOverridesCount(db),
    ])
    return res.json({
      defaultMode: normalizeRewardPayoutMode(config?.defaultMode),
      sourceModes: normalizeRewardSourceModes(config?.sourceModes),
      defaultLockHours: normalizeRewardLockHours(config?.defaultLockHours, 0),
      sourceLockHours: normalizeRewardSourceLockHours(config?.sourceLockHours),
      overridesCount,
      overrides,
    })
  })

  router.post('/reward-payout-rules/global', async (req, res) => {
    const defaultMode = normalizeRewardPayoutMode(req.body?.defaultMode)
    const sourceModes = normalizeRewardSourceModes(req.body?.sourceModes)
    const defaultLockHours = normalizeRewardLockHours(req.body?.defaultLockHours, 0)
    const sourceLockHours = normalizeRewardSourceLockHours(req.body?.sourceLockHours)
    const applyPending = Number(req.body?.applyPending) === 1 || req.body?.applyPending === true
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('reward_payout_config', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify({ defaultMode, sourceModes, defaultLockHours, sourceLockHours })],
    )
    const applyPendingResult = applyPending
      ? await reapplyRewardPoliciesToPendingEntries(db, { sourceType: 'all' })
      : { processedEntries: 0, lockedEntries: 0, lockedAmount: 0, bonusLockedEntries: 0, bonusLockedAmount: 0, releasedEntries: 0, releasedAmount: 0 }
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'reward_payout_config' })
    return res.json({ ok: true, defaultMode, sourceModes, defaultLockHours, sourceLockHours, applyPendingResult })
  })

  router.post('/reward-payout-rules/overrides', async (req, res) => {
    const userIds = parseRewardUserIds(req.body?.userIds, req.body?.userIdsText)
    const sourceType = normalizeRewardSourceType(req.body?.sourceType, 'all')
    const payoutMode = normalizeRewardPayoutMode(req.body?.payoutMode)
    const lockHours = normalizeRewardLockHours(req.body?.lockHours, 0)
    const note = String(req.body?.note || '').trim() || null
    const applyPending = Number(req.body?.applyPending) === 1 || req.body?.applyPending === true
    if (userIds.length === 0) return res.status(400).json({ error: 'INVALID_INPUT' })

    const placeholders = userIds.map(() => '?').join(', ')
    const existingUsers = await all(
      db,
      `SELECT id FROM users WHERE id IN (${placeholders})`,
      userIds,
    )
    const validUserIds = existingUsers.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0)
    if (validUserIds.length === 0) return res.status(404).json({ error: 'NOT_FOUND' })

    for (const userId of validUserIds) {
      await run(
        db,
        `INSERT INTO user_reward_payout_overrides (user_id, source_type, payout_mode, lock_hours, note, updated_by)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, source_type) DO UPDATE SET
           payout_mode = excluded.payout_mode,
           lock_hours = excluded.lock_hours,
           note = excluded.note,
           updated_by = excluded.updated_by,
           updated_at = CURRENT_TIMESTAMP`,
        [userId, sourceType, payoutMode, lockHours, note, req.user.id],
      )
      if (sourceType === 'all') {
        await run(db, `DELETE FROM user_reward_mode_overrides WHERE user_id = ?`, [userId])
      }
    }

    const applyPendingResult = applyPending
      ? await reapplyRewardPoliciesToPendingEntries(db, { userIds: validUserIds, sourceType })
      : { processedEntries: 0, lockedEntries: 0, lockedAmount: 0, bonusLockedEntries: 0, bonusLockedAmount: 0, releasedEntries: 0, releasedAmount: 0 }

    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'reward_payout_config' })
    return res.json({
      ok: true,
      affectedUsers: validUserIds.length,
      lockHours,
      applyPendingResult,
    })
  })

  router.post('/reward-payout-rules/overrides/delete', async (req, res) => {
    const rawOverrideKey = String(req.body?.overrideKey || '').trim()
    if (!rawOverrideKey.includes(':')) return res.status(400).json({ error: 'INVALID_INPUT' })
    const [kind, idPart] = rawOverrideKey.split(':')
    const id = Number(idPart || 0)
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (kind === 'legacy') {
      await run(db, `DELETE FROM user_reward_mode_overrides WHERE id = ?`, [id])
    } else {
      await run(db, `DELETE FROM user_reward_payout_overrides WHERE id = ?`, [id])
    }
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'reward_payout_config' })
    return res.json({ ok: true })
  })

  router.get('/reward-payout-config', async (_req, res) => {
    const [config, overridesCount] = await Promise.all([
      getRewardPayoutConfig(db),
      getRewardPayoutOverridesCount(db),
    ])
    return res.json({
      defaultMode: normalizeRewardPayoutMode(config?.defaultMode),
      defaultLockHours: normalizeRewardLockHours(config?.defaultLockHours, 0),
      overridesCount,
    })
  })

  router.post('/reward-payout-config', async (req, res) => {
    const currentConfig = await getRewardPayoutConfig(db)
    const defaultMode = normalizeRewardPayoutMode(req.body?.defaultMode)
    const sourceModes = normalizeRewardSourceModes(currentConfig?.sourceModes)
    const defaultLockHours =
      req.body?.defaultLockHours == null
        ? normalizeRewardLockHours(currentConfig?.defaultLockHours, 0)
        : normalizeRewardLockHours(req.body?.defaultLockHours, 0)
    const sourceLockHours = normalizeRewardSourceLockHours(currentConfig?.sourceLockHours)
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('reward_payout_config', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify({ defaultMode, sourceModes, defaultLockHours, sourceLockHours })],
    )
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'reward_payout_config' })
    return res.json({ ok: true, defaultMode, defaultLockHours })
  })

  router.post('/vip-tiers', async (req, res) => {
    const level = Math.max(1, Math.min(5, Number(req.body?.level || 1)))
    const title = String(req.body?.title || '').trim()
    const minDeposit = Number(req.body?.minDeposit || 0)
    const minTradeVolume = Number(req.body?.minTradeVolume || 0)
    const referralMultiplier = Number(req.body?.referralMultiplier || 1)
    const referralPercentRaw = Number(req.body?.referralPercent)
    const referralPercent =
      Number.isFinite(referralPercentRaw) && referralPercentRaw > 0
        ? Number(referralPercentRaw.toFixed(4))
        : Math.max(3, Number((3 + level).toFixed(4)))
    const perks = Array.isArray(req.body?.perks) ? req.body.perks : []
    const isActive = Number(req.body?.isActive) ? 1 : 0
    if (!title) return res.status(400).json({ error: 'INVALID_INPUT' })
    const vipConfig = toVipTierStoragePayload({
      level,
      title,
      minDeposit,
      minTradeVolume,
      referralMultiplier,
      referralPercent,
      dailyMiningPercent: Number(req.body?.dailyMiningPercent || 0),
      miningSpeedPercent: Number(req.body?.miningSpeedPercent || 0),
      dailyWithdrawalLimit: Number(req.body?.dailyWithdrawalLimit || 0),
      processingHoursMin: Number(req.body?.processingHoursMin || 0),
      processingHoursMax: Number(req.body?.processingHoursMax || 0),
      withdrawalFeePercent: Number(req.body?.withdrawalFeePercent || 0),
      activeExtraFeePercent: Number(req.body?.activeExtraFeePercent || 0),
      level2ReferralPercent: Number(req.body?.level2ReferralPercent || 0),
      level3ReferralPercent: Number(req.body?.level3ReferralPercent || 0),
      profitMultiplier: Number(req.body?.profitMultiplier || 0),
      autoReinvest: Number(req.body?.autoReinvest) === 1 || req.body?.autoReinvest === true,
      dailyBonus: Number(req.body?.dailyBonus) === 1 || req.body?.dailyBonus === true,
      perks,
    })
    await run(
      db,
      `INSERT INTO vip_tiers (level, title, min_deposit, min_trade_volume, referral_multiplier, referral_percent, perks_json, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(level) DO UPDATE SET
         title = excluded.title,
         min_deposit = excluded.min_deposit,
         min_trade_volume = excluded.min_trade_volume,
         referral_multiplier = excluded.referral_multiplier,
         referral_percent = excluded.referral_percent,
         perks_json = excluded.perks_json,
         is_active = excluded.is_active`,
      [level, title, minDeposit, minTradeVolume, referralMultiplier, referralPercent, JSON.stringify(vipConfig), isActive],
    )
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'vip_tiers' })
    return res.json({ ok: true })
  })

  router.get('/partners', async (req, res) => {
    const limit = Math.min(300, Math.max(20, Number(req.query.limit) || 120))
    const items = await all(
      db,
      `SELECT p.id, p.user_id, p.commission_rate, p.status, p.notes, p.created_at,
              u.display_name, u.email, u.phone,
              COALESCE(r.referrals_count, 0) AS referrals_count
       FROM partner_profiles p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN (
         SELECT referrer_user_id, COUNT(*) AS referrals_count
         FROM referral_rewards
         GROUP BY referrer_user_id
       ) r ON r.referrer_user_id = p.user_id
       ORDER BY p.id DESC
       LIMIT ?`,
      [limit],
    )
    return res.json({ items })
  })

  router.post('/partners', async (req, res) => {
    const userId = Number(req.body?.userId)
    const commissionRate = Number(req.body?.commissionRate || 0)
    const status = String(req.body?.status || 'active').trim().toLowerCase()
    const notes = String(req.body?.notes || '').trim()
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `INSERT INTO partner_profiles (user_id, commission_rate, status, notes)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         commission_rate = excluded.commission_rate,
         status = excluded.status,
         notes = excluded.notes`,
      [userId, commissionRate, status, notes],
    )
    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'partners' })
    return res.json({ ok: true })
  })

  router.get('/referrals/stats', async (_req, res) => {
    const row = await get(
      db,
      `SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status IN ('active', 'reward_released') THEN 1 ELSE 0 END) AS qualified_count,
        SUM(CASE WHEN status = 'reward_released' THEN 1 ELSE 0 END) AS reward_released_count,
        COALESCE(SUM(CASE WHEN status IN ('active', 'reward_released') THEN reward_amount ELSE 0 END), 0) AS total_rewards_value
       FROM referrals`,
    )
    return res.json({
      pendingCount: Number(row?.pending_count || 0),
      qualifiedCount: Number(row?.qualified_count || 0),
      rewardReleasedCount: Number(row?.reward_released_count || 0),
      totalRewardsValue: Number(row?.total_rewards_value || 0),
    })
  })

  router.get('/referrals', async (req, res) => {
    const userId = Number(req.query.userId || 0)
    const limit = Math.min(500, Math.max(20, Number(req.query.limit) || 200))
    if (userId > 0) {
      const rows = await all(
        db,
        `SELECT r.id, r.referred_user_id, r.status, r.created_at, r.qualified_at, r.reward_released_at,
                r.qualifying_deposit_request_id, r.first_deposit_amount, r.reward_amount, r.reward_percent,
                u.display_name, u.email, u.phone, u.created_at AS user_created_at,
                COALESCE(dep.total_deposits, 0) AS deposits_total
         FROM referrals r
         LEFT JOIN users u ON u.id = r.referred_user_id
         LEFT JOIN (
           SELECT user_id, SUM(amount) AS total_deposits
           FROM wallet_transactions
           WHERE transaction_type = 'deposit'
           GROUP BY user_id
         ) dep ON dep.user_id = r.referred_user_id
         WHERE r.referrer_user_id = ?
         ORDER BY r.id DESC
         LIMIT ?`,
        [userId, limit],
      )
      return res.json({ referrals: rows })
    }

    const summary = await all(
      db,
      `SELECT u.id AS user_id, u.display_name, u.referral_code,
              COUNT(r.id) AS total_referrals,
              SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
              SUM(CASE WHEN r.status IN ('active', 'reward_released') THEN 1 ELSE 0 END) AS active_count,
              SUM(CASE WHEN r.status = 'reward_released' THEN 1 ELSE 0 END) AS reward_released_count,
              COALESCE(SUM(CASE WHEN r.status IN ('active', 'reward_released') THEN r.reward_amount ELSE 0 END), 0) AS rewards_value
       FROM users u
       LEFT JOIN referrals r ON r.referrer_user_id = u.id
       GROUP BY u.id, u.display_name, u.referral_code
       HAVING COUNT(r.id) > 0
       ORDER BY active_count DESC, total_referrals DESC
       LIMIT ?`,
      [limit],
    )
    return res.json({ summary })
  })

  router.post('/content-campaigns', async (req, res) => {
    const campaignType = String(req.body?.campaignType || '').trim().toLowerCase()
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()
    const targetFilters = req.body?.targetFilters || {}
    const scheduleAt = toIso(req.body?.scheduleAt)
    const expiresAt = toIso(req.body?.expiresAt)
    const isActive = Number(req.body?.isActive) ? 1 : 0
    if (!title || !['notification', 'popup', 'banner', 'news'].includes(campaignType)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    await run(
      db,
      `INSERT INTO content_campaigns
      (campaign_type, title, body, target_filters_json, schedule_at, expires_at, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [campaignType, title, body, JSON.stringify(targetFilters), scheduleAt, expiresAt, isActive, req.user.id],
    )

    const shouldSendNow = isActive === 1 && (!scheduleAt || Date.now() >= Date.parse(scheduleAt))
    if (shouldSendNow && campaignType === 'notification') {
      const filters = targetFilters || {}
      const users = await all(
        db,
        `SELECT u.id, u.country, u.preferred_language, u.vip_level,
                COALESCE(dep.total_deposits, 0) AS total_deposits
         FROM users u
         LEFT JOIN (
           SELECT user_id, SUM(amount) AS total_deposits
           FROM wallet_transactions
           WHERE transaction_type = 'deposit'
           GROUP BY user_id
         ) dep ON dep.user_id = u.id
         WHERE u.is_banned = 0 AND u.is_frozen = 0`,
      )
      const targetUsers = users.filter((u) => {
        if (filters.country && String(u.country || '').toLowerCase() !== String(filters.country).toLowerCase()) return false
        if (filters.language && String(u.preferred_language || '').toLowerCase() !== String(filters.language).toLowerCase()) return false
        if (filters.vipOnly && Number(u.vip_level || 0) <= 0) return false
        if (Number(filters.minVipLevel || 0) > Number(u.vip_level || 0)) return false
        if (filters.depositorsOnly && Number(u.total_deposits || 0) <= 0) return false
        if (filters.nonDepositorsOnly && Number(u.total_deposits || 0) > 0) return false
        return true
      })
      if (targetUsers.length > 0) {
        const valuesSql = buildValuesPlaceholders(targetUsers.length, 3)
        const params = targetUsers.flatMap((u) => [u.id, title, body || ''])
        await run(
          db,
          `INSERT INTO notifications (user_id, title, body, is_read, created_at)
           VALUES ${valuesSql.replace(/\)/g, ', 0, CURRENT_TIMESTAMP)')}`,
          params,
        )
      }
    }

    publishLiveUpdate({ type: 'home_content_updated', source: 'owner_growth', key: 'content_campaigns' })
    return res.json({ ok: true })
  })

  router.get('/content-campaigns', async (req, res) => {
    const limit = Math.min(300, Math.max(20, Number(req.query.limit) || 120))
    const items = await all(
      db,
      `SELECT id, campaign_type, title, body, target_filters_json, schedule_at, expires_at, is_active, created_at
       FROM content_campaigns
       ORDER BY id DESC
       LIMIT ?`,
      [limit],
    )
    return res.json({
      items: items.map((row) => ({ ...row, targetFilters: parseJsonOrNull(row.target_filters_json) || {} })),
    })
  })

  router.get('/dashboard-summary', async (_req, res) => {
    const activeDailyTrades = await get(
      db,
      `SELECT COUNT(*) AS count FROM daily_trade_campaigns WHERE is_visible = 1`,
    )
    const activeBonusRules = await get(
      db,
      `SELECT COUNT(*) AS count FROM bonus_rules WHERE is_active = 1`,
    )
    const activePartners = await get(
      db,
      `SELECT COUNT(*) AS count FROM partner_profiles WHERE status = 'active'`,
    )
    const activeContent = await get(
      db,
      `SELECT COUNT(*) AS count FROM content_campaigns WHERE is_active = 1`,
    )
    return res.json({
      activeDailyTrades: Number(activeDailyTrades?.count || 0),
      activeBonusRules: Number(activeBonusRules?.count || 0),
      activePartners: Number(activePartners?.count || 0),
      activeContent: Number(activeContent?.count || 0),
    })
  })

  router.get('/reports/monthly-finance', async (req, res) => {
    const { month, startAt, endAt } = getMonthRange(req.query.month)

    const miningItemsRaw = await all(
      db,
      `SELECT wt.user_id,
              MAX(u.display_name) AS display_name,
              MAX(u.email) AS email,
              MAX(u.phone) AS phone,
              COUNT(*) AS subscription_count,
              COALESCE(SUM(ABS(wt.amount)), 0) AS original_subscription_total,
              MIN(wt.created_at) AS first_subscription_at,
              MAX(wt.created_at) AS last_subscription_at
       FROM wallet_transactions wt
       LEFT JOIN users u ON u.id = wt.user_id
       WHERE wt.source_type = 'mining'
         AND wt.transaction_type = 'lock'
         AND wt.reference_type = 'mining_subscription'
         AND wt.created_at >= ?
         AND wt.created_at < ?
       GROUP BY wt.user_id
       ORDER BY original_subscription_total DESC, last_subscription_at DESC
       LIMIT 500`,
      [startAt, endAt],
    )
    const miningItems = miningItemsRaw.map((row) => ({
      ...row,
      user_id: Number(row.user_id || 0),
      subscription_count: Number(row.subscription_count || 0),
      original_subscription_total: Number(row.original_subscription_total || 0),
    }))

    const depositItemsRaw = await all(
      db,
      `SELECT d.user_id,
              MAX(u.display_name) AS display_name,
              MAX(u.email) AS email,
              MAX(u.phone) AS phone,
              COUNT(*) AS deposits_count,
              COALESCE(SUM(d.amount), 0) AS total_deposits,
              MIN(COALESCE(d.completed_at, d.reviewed_at, d.updated_at, d.created_at)) AS first_deposit_at,
              MAX(COALESCE(d.completed_at, d.reviewed_at, d.updated_at, d.created_at)) AS last_deposit_at
       FROM deposit_requests d
       LEFT JOIN users u ON u.id = d.user_id
       WHERE LOWER(COALESCE(d.request_status, 'pending')) IN ('approved', 'completed')
         AND COALESCE(d.completed_at, d.reviewed_at, d.updated_at, d.created_at) >= ?
         AND COALESCE(d.completed_at, d.reviewed_at, d.updated_at, d.created_at) < ?
       GROUP BY d.user_id
       ORDER BY total_deposits DESC, last_deposit_at DESC
       LIMIT 500`,
      [startAt, endAt],
    )
    const depositItems = depositItemsRaw.map((row) => ({
      ...row,
      user_id: Number(row.user_id || 0),
      deposits_count: Number(row.deposits_count || 0),
      total_deposits: Number(row.total_deposits || 0),
    }))

    return res.json({
      month,
      mining: {
        subscriberCount: miningItems.length,
        subscriptionCount: miningItems.reduce((sum, row) => sum + Number(row.subscription_count || 0), 0),
        totalOriginalSubscriptions: Number(
          miningItems.reduce((sum, row) => sum + Number(row.original_subscription_total || 0), 0).toFixed(8),
        ),
        items: miningItems,
      },
      deposits: {
        depositorCount: depositItems.length,
        depositsCount: depositItems.reduce((sum, row) => sum + Number(row.deposits_count || 0), 0),
        totalDeposits: Number(
          depositItems.reduce((sum, row) => sum + Number(row.total_deposits || 0), 0).toFixed(8),
        ),
        items: depositItems,
      },
    })
  })

  router.get('/recovery-code-requests', async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase()
    const params = []
    const where = []
    if (status) {
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'INVALID_INPUT' })
      }
      where.push(`LOWER(r.request_status) = ?`)
      params.push(status)
    }
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const items = await all(
      db,
      `SELECT r.id, r.user_id, r.recovery_code, r.request_status, r.request_note,
              r.contact_channel, r.contact_value, r.submitted_ip, r.submitted_user_agent,
              r.created_at, r.reviewed_at,
              u.display_name, u.email, u.phone
       FROM recovery_code_review_requests r
       LEFT JOIN users u ON u.id = r.user_id
       ${sqlWhere}
       ORDER BY CASE WHEN LOWER(r.request_status) = 'pending' THEN 0 ELSE 1 END, r.id DESC
       LIMIT 300`,
      params,
    )
    return res.json({ items })
  })

  router.post('/recovery-code-requests/review', async (req, res) => {
    const requestId = Number(req.body?.requestId || 0)
    const decision = String(req.body?.decision || '').trim().toLowerCase()
    const requestNote = String(req.body?.requestNote || '').trim() || null
    if (!Number.isFinite(requestId) || requestId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'INVALID_INPUT' })

    const row = await get(
      db,
      `SELECT id, user_id, request_status
       FROM recovery_code_review_requests
       WHERE id = ?
       LIMIT 1`,
      [requestId],
    )
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' })

    const nextStatus = decision === 'approve' ? 'approved' : 'rejected'
    await run(
      db,
      `UPDATE recovery_code_review_requests
       SET request_status = ?,
           request_note = ?,
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nextStatus, requestNote, req.user.id, requestId],
    )
    await logAudit(db, req.user.id, 'recovery_code', nextStatus, Number(row.user_id || 0), { requestId })
    publishLiveUpdate({ type: 'owner_recovery_request_updated', source: 'owner_growth', requestId, status: nextStatus })
    return res.json({ ok: true })
  })

  router.get('/security/overview', async (_req, res) => {
    const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const suspiciousIps = await all(
      db,
      `SELECT ip_address, COUNT(*) AS failed_count
       FROM login_attempts
       WHERE success = 0
         AND created_at >= ?
         AND ip_address IS NOT NULL
       GROUP BY ip_address
       HAVING COUNT(*) >= 5
       ORDER BY failed_count DESC
       LIMIT 20`,
      [dayAgoIso],
    )
    const multiDeviceUsers = await all(
      db,
      `SELECT us.user_id, u.display_name, u.email, u.phone, COUNT(*) AS active_sessions
       FROM user_sessions us
       LEFT JOIN users u ON u.id = us.user_id
       WHERE us.is_active = 1
       GROUP BY us.user_id, u.display_name, u.email, u.phone
       HAVING COUNT(*) > 1
       ORDER BY active_sessions DESC
       LIMIT 30`,
    )
    const proxyAlerts = await all(
      db,
      `SELECT id, user_id, alert_type, severity, ip_address, user_agent, metadata, created_at
       FROM security_alerts
       WHERE alert_type IN ('proxy_vpn_suspected')
       ORDER BY id DESC
       LIMIT 40`,
    )
    const unusualActivity = await all(
      db,
      `SELECT id, user_id, alert_type, severity, ip_address, user_agent, metadata, created_at
       FROM security_alerts
       WHERE alert_type IN ('unusual_activity', 'new_ip_login', 'multiple_devices_detected')
       ORDER BY id DESC
       LIMIT 40`,
    )
    const recentLoginLogs = await all(
      db,
      `SELECT l.id, l.identifier, l.user_id, u.display_name, l.ip_address, l.user_agent, l.success, l.failure_reason, l.created_at
       FROM login_attempts l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.id DESC
       LIMIT 80`,
    )
    const recentAuditLogs = await all(
      db,
      `SELECT a.id, a.actor_user_id, au.display_name AS actor_name, a.target_user_id, tu.display_name AS target_name,
              a.section, a.action, a.metadata, a.created_at
       FROM admin_audit_logs a
       LEFT JOIN users au ON au.id = a.actor_user_id
       LEFT JOIN users tu ON tu.id = a.target_user_id
       ORDER BY a.id DESC
       LIMIT 80`,
    )
    return res.json({
      suspiciousIps,
      multiDeviceUsers,
      proxyAlerts,
      unusualActivity,
      recentLoginLogs,
      recentAuditLogs,
    })
  })

  router.get('/security/sessions', async (req, res) => {
    const userId = Number(req.query.userId || 0)
    const items = userId > 0
      ? await all(
          db,
          `SELECT id, user_id, session_id, ip_address, user_agent, is_active, created_at, last_seen_at, revoked_at
           FROM user_sessions
           WHERE user_id = ?
           ORDER BY id DESC
           LIMIT 150`,
          [userId],
        )
      : await all(
          db,
          `SELECT id, user_id, session_id, ip_address, user_agent, is_active, created_at, last_seen_at, revoked_at
           FROM user_sessions
           ORDER BY id DESC
           LIMIT 200`,
        )
    return res.json({ items })
  })

  router.post('/security/revoke-all-sessions', async (req, res) => {
    const userId = Number(req.body?.userId || 0)
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `UPDATE user_sessions
       SET is_active = 0, revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND is_active = 1`,
      [userId],
    )
    await run(
      db,
      `INSERT INTO user_activity_logs (user_id, action, metadata)
       VALUES (?, 'logout_all_by_owner', ?)`,
      [userId, JSON.stringify({ ownerId: req.user.id })],
    )
    await logAudit(db, req.user.id, 'security', 'revoke_all_sessions', userId, {})
    return res.json({ ok: true })
  })

  router.post('/security/two-factor', async (req, res) => {
    const userId = Number(req.body?.userId || 0)
    const enabled = Number(req.body?.enabled) ? 1 : 0
    const forAdminActions = Number(req.body?.forAdminActions) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `UPDATE users
       SET two_factor_enabled = ?, two_factor_for_admin_actions = ?
       WHERE id = ?`,
      [enabled, forAdminActions, userId],
    )
    await logAudit(db, req.user.id, 'security', 'set_two_factor', userId, { enabled, forAdminActions })
    return res.json({ ok: true })
  })

  router.post('/security/detect-unusual', async (req, res) => {
    const tenMinutesAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const rows = await all(
      db,
      `SELECT user_id, COUNT(*) AS action_count
       FROM user_activity_logs
       WHERE created_at >= ?
       GROUP BY user_id
       HAVING COUNT(*) >= 12`,
      [tenMinutesAgoIso],
    )
    for (const row of rows) {
      await run(
        db,
        `INSERT INTO security_alerts (user_id, alert_type, severity, metadata)
         VALUES (?, 'unusual_activity', 'high', ?)`,
        [row.user_id, JSON.stringify({ actionCount: Number(row.action_count || 0), windowMinutes: 10 })],
      )
    }
    await logAudit(db, req.user.id, 'security', 'detect_unusual_activity', null, { alertsCreated: rows.length })
    return res.json({ ok: true, alertsCreated: rows.length })
  })

  router.get('/security/login-logs', async (_req, res) => {
    const items = await all(
      db,
      `SELECT id, identifier, user_id, ip_address, user_agent, success, failure_reason, created_at
       FROM login_attempts
       ORDER BY id DESC
       LIMIT 300`,
    )
    return res.json({ items })
  })

  router.get('/security/audit-logs', async (_req, res) => {
    const items = await all(
      db,
      `SELECT id, actor_user_id, target_user_id, section, action, metadata, created_at
       FROM admin_audit_logs
       ORDER BY id DESC
       LIMIT 300`,
    )
    return res.json({ items })
  })

  router.get('/staff/list', async (_req, res) => {
    const items = await all(
      db,
      `SELECT u.id, u.display_name, u.email, u.phone, u.role, u.is_banned, u.is_frozen, u.created_at,
              COALESCE(s.admin_role, 'admin') AS admin_role,
              COALESCE(s.is_active, 1) AS is_active,
              COALESCE(s.can_view_sensitive, 0) AS can_view_sensitive,
              COALESCE(pc.permissions_count, 0) AS permissions_count
       FROM users u
       LEFT JOIN admin_staff_profiles s ON s.user_id = u.id
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS permissions_count
         FROM permissions
         GROUP BY user_id
       ) pc ON pc.user_id = u.id
       WHERE u.role IN ('admin', 'moderator')
       ORDER BY u.id DESC`,
    )
    return res.json({ items })
  })

  router.post('/staff/create', async (req, res) => {
    const identifier = String(req.body?.identifier || '').trim()
    const password = String(req.body?.password || '')
    const adminRole = String(req.body?.adminRole || 'admin').trim().toLowerCase()
    const accessPreset = String(req.body?.accessPreset || 'read_only').trim().toLowerCase()
    const displayName = String(req.body?.displayName || '').trim() || null
    if (!identifier || password.length < 6) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!['super_admin', 'admin', 'finance', 'support', 'moderator'].includes(adminRole)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    const isEmail = identifier.includes('@')
    const email = isEmail ? identifier : null
    const phone = !isEmail ? identifier : null
    const existing = await get(
      db,
      `SELECT id FROM users WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?) LIMIT 1`,
      [email, phone],
    )
    if (existing) return res.status(409).json({ error: 'ALREADY_EXISTS' })

    const role = adminRole === 'moderator' ? 'moderator' : 'admin'
    const passwordHash = await hashPassword(password)
    const userCreated = await run(
      db,
      `INSERT INTO users (email, phone, password_hash, role, is_approved, is_banned, is_frozen, display_name)
       VALUES (?, ?, ?, ?, 1, 0, 0, ?)
       RETURNING id`,
      [email, phone, passwordHash, role, displayName],
    )
    const userId = Number(userCreated.rows?.[0]?.id || 0)
    if (!userId) return res.status(500).json({ error: 'SERVER_ERROR' })
    await run(
      db,
      `INSERT INTO admin_staff_profiles (user_id, admin_role, is_active, can_view_sensitive, created_by)
       VALUES (?, ?, 1, 0, ?)`,
      [userId, adminRole, req.user.id],
    )
    const permissionPresets = {
      read_only: ['dashboard.overview.view', 'reports.view', 'view_reports'],
      finance: ['dashboard.overview.view', 'wallets.manage', 'deposits.manage', 'withdrawals.manage', 'reports.view', 'manage_balances', 'view_reports'],
      kyc: ['dashboard.overview.view', 'kyc.manage', 'reports.view', 'view_reports'],
      trading: ['dashboard.overview.view', 'trades.manage', 'assets.manage', 'reports.view', 'view_reports'],
      marketing: ['dashboard.overview.view', 'notifications.manage', 'bonuses.manage', 'referrals.manage', 'reports.view', 'view_reports'],
      support: ['dashboard.overview.view', 'support.manage', 'users.manage', 'manage_users', 'reports.view', 'view_reports'],
      full_admin: [
        'dashboard.overview.view', 'users.manage', 'manage_users', 'wallets.manage', 'manage_balances', 'deposits.manage', 'withdrawals.manage',
        'trades.manage', 'assets.manage', 'vip.manage', 'referrals.manage', 'bonuses.manage', 'kyc.manage',
        'notifications.manage', 'support.manage', 'security.manage', 'reports.view', 'view_reports', 'settings.manage', 'manage_permissions',
      ],
    }
    const toGrant = permissionPresets[accessPreset] || permissionPresets.read_only
    if (toGrant.length > 0) {
      const valuesSql = buildValuesPlaceholders(toGrant.length, 3)
      const params = toGrant.flatMap((permission) => [userId, permission, req.user.id])
      await run(
        db,
        `INSERT INTO permissions (user_id, permission, granted_by)
         VALUES ${valuesSql}
         ON CONFLICT(user_id, permission) DO NOTHING`,
        params,
      )
    }
    await logAudit(db, req.user.id, 'staff_permissions', 'create_staff_member', userId, { adminRole, accessPreset })
    return res.json({ ok: true, userId })
  })

  router.post('/staff/role', async (req, res) => {
    const userId = Number(req.body?.userId || 0)
    const adminRole = String(req.body?.adminRole || 'admin').trim().toLowerCase()
    const enabled = Number(req.body?.enabled) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!['super_admin', 'admin', 'finance', 'support', 'moderator'].includes(adminRole)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    await run(
      db,
      `INSERT INTO admin_staff_profiles (user_id, admin_role, is_active, can_view_sensitive, created_by)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         admin_role = excluded.admin_role,
         is_active = excluded.is_active`,
      [userId, adminRole, enabled, req.user.id],
    )
    await run(db, `UPDATE users SET role = ? WHERE id = ?`, [adminRole === 'moderator' ? 'moderator' : 'admin', userId])
    await logAudit(db, req.user.id, 'staff_permissions', 'update_staff_role', userId, { adminRole, enabled })
    return res.json({ ok: true })
  })

  router.post('/staff/permissions/set', async (req, res) => {
    const userId = Number(req.body?.userId || 0)
    const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions.map((v) => String(v).trim()).filter(Boolean) : []
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `DELETE FROM permissions WHERE user_id = ?`, [userId])
    if (permissions.length > 0) {
      const valuesSql = buildValuesPlaceholders(permissions.length, 3)
      const params = permissions.flatMap((permission) => [userId, permission, req.user.id])
      await run(
        db,
        `INSERT INTO permissions (user_id, permission, granted_by)
         VALUES ${valuesSql}
         ON CONFLICT(user_id, permission) DO NOTHING`,
        params,
      )
    }
    await logAudit(db, req.user.id, 'staff_permissions', 'replace_permissions', userId, { permissionsCount: permissions.length })
    return res.json({ ok: true })
  })

  router.post('/staff/sensitive-access', async (req, res) => {
    const userId = Number(req.body?.userId || 0)
    const canViewSensitive = Number(req.body?.canViewSensitive) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `INSERT INTO admin_staff_profiles (user_id, admin_role, is_active, can_view_sensitive, created_by)
       VALUES (?, 'admin', 1, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET can_view_sensitive = excluded.can_view_sensitive`,
      [userId, canViewSensitive, req.user.id],
    )
    await logAudit(db, req.user.id, 'staff_permissions', 'set_sensitive_access', userId, { canViewSensitive })
    return res.json({ ok: true })
  })

  router.post('/staff/account-health-scan', async (req, res) => {
    const [userStats, restrictedRows, blockedSessionRows, staffPermissionRows, reconcileIssues, linkageCheck, earningCheck, zeroCheck] = await Promise.all([
      get(
        db,
        `SELECT
           COUNT(*) AS total_users,
           SUM(CASE WHEN COALESCE(is_banned, 0) = 1 THEN 1 ELSE 0 END) AS banned_users,
           SUM(CASE WHEN COALESCE(is_frozen, 0) = 1 THEN 1 ELSE 0 END) AS frozen_users,
           SUM(CASE WHEN COALESCE(is_approved, 0) != 1 THEN 1 ELSE 0 END) AS unapproved_users,
           SUM(CASE WHEN banned_until IS NOT NULL AND banned_until > CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS temp_banned_users,
           SUM(
             CASE
               WHEN COALESCE(is_banned, 0) = 1
                 OR COALESCE(is_frozen, 0) = 1
                 OR COALESCE(is_approved, 0) != 1
                 OR (banned_until IS NOT NULL AND banned_until > CURRENT_TIMESTAMP)
               THEN 1
               ELSE 0
             END
           ) AS restricted_users
         FROM users`,
      ),
      all(
        db,
        `SELECT id, display_name, email, phone, is_banned, is_frozen, is_approved, banned_until
         FROM users
         WHERE COALESCE(is_banned, 0) = 1
            OR COALESCE(is_frozen, 0) = 1
            OR COALESCE(is_approved, 0) != 1
            OR (banned_until IS NOT NULL AND banned_until > CURRENT_TIMESTAMP)
         ORDER BY id DESC
         LIMIT 120`,
      ),
      all(
        db,
        `SELECT
           u.id AS user_id,
           u.display_name,
           u.email,
           u.phone,
           u.is_banned,
           u.is_frozen,
           u.is_approved,
           u.banned_until,
           COUNT(us.id) AS active_sessions
         FROM users u
         INNER JOIN user_sessions us
           ON us.user_id = u.id
          AND COALESCE(us.is_active, 0) = 1
         WHERE COALESCE(u.is_banned, 0) = 1
            OR COALESCE(u.is_frozen, 0) = 1
            OR COALESCE(u.is_approved, 0) != 1
            OR (u.banned_until IS NOT NULL AND u.banned_until > CURRENT_TIMESTAMP)
         GROUP BY u.id, u.display_name, u.email, u.phone, u.is_banned, u.is_frozen, u.is_approved, u.banned_until
         ORDER BY active_sessions DESC, u.id DESC
         LIMIT 120`,
      ),
      all(
        db,
        `SELECT
           u.id AS user_id,
           u.display_name,
           u.email,
           u.phone,
           u.role,
           COALESCE(s.admin_role, CASE WHEN u.role = 'moderator' THEN 'moderator' ELSE 'admin' END) AS admin_role,
           COALESCE(s.is_active, 1) AS staff_active,
           COALESCE(pc.permissions_count, 0) AS permissions_count
         FROM users u
         LEFT JOIN admin_staff_profiles s ON s.user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS permissions_count
           FROM permissions
           GROUP BY user_id
         ) pc ON pc.user_id = u.id
         WHERE u.role IN ('admin', 'moderator')
           AND (
             (COALESCE(s.is_active, 1) = 0 AND COALESCE(pc.permissions_count, 0) > 0)
             OR (COALESCE(s.is_active, 1) = 1 AND COALESCE(pc.permissions_count, 0) = 0)
           )
         ORDER BY u.id DESC
         LIMIT 120`,
      ),
      reconcileAll(db, 100000),
      verifyDepositWithdrawalLinkage(db, 100000),
      verifyEarningTransfers(db, 100000),
      verifyUnexpectedZeroBalances(db, 100000),
    ])

    const issues = []
    const pushIssue = (issue) => {
      if (issues.length < 200) issues.push(issue)
    }

    for (const row of blockedSessionRows) {
      pushIssue({
        kind: 'blocked_active_session',
        severity: 'error',
        user_id: Number(row.user_id || 0),
        display_name: row.display_name || null,
        email: row.email || null,
        phone: row.phone || null,
        title: 'حساب مقيّد مع جلسات نشطة',
        details: `يوجد ${Number(row.active_sessions || 0)} جلسة نشطة رغم حالة الحساب: ${buildAccountRestrictionLabels(row).join(' | ') || 'قيد غير محدد'}`,
      })
    }

    for (const row of staffPermissionRows) {
      pushIssue({
        kind: 'staff_permission_mismatch',
        severity: Number(row.staff_active || 0) === 0 ? 'warning' : 'error',
        user_id: Number(row.user_id || 0),
        display_name: row.display_name || null,
        email: row.email || null,
        phone: row.phone || null,
        title: Number(row.staff_active || 0) === 0 ? 'عضو طاقم معطّل لكن صلاحياته ما زالت موجودة' : 'عضو طاقم مفعّل بدون أي صلاحيات',
        details: `الدور ${row.admin_role || row.role || 'admin'} | عدد الصلاحيات الحالية: ${Number(row.permissions_count || 0)}`,
      })
    }

    for (const item of reconcileIssues) {
      pushIssue({
        kind: 'wallet_integrity',
        severity: 'error',
        user_id: Number(item.userId || 0),
        display_name: null,
        email: null,
        phone: null,
        title: 'عدم تطابق في أرصدة المحفظة',
        details: `${item.currency}: ${item.message}`,
      })
    }

    for (const item of linkageCheck.issues || []) {
      pushIssue({
        kind: 'wallet_linkage',
        severity: 'error',
        user_id: Number(item.userId || 0),
        display_name: null,
        email: null,
        phone: null,
        title: 'طلب مالي معتمد بدون ربط بحركة محفظة',
        details: `${item.type} #${item.id} | amount=${Number(item.amount || 0)} | status=${item.status || ''}`,
      })
    }

    for (const item of earningCheck.issues || []) {
      pushIssue({
        kind: 'earning_transfer',
        severity: 'error',
        user_id: null,
        display_name: null,
        email: null,
        phone: null,
        title: 'خلل في تحويل الأرباح إلى المحفظة',
        details: `earning_entry #${Number(item.earningEntryId || 0)} | ${item.issue}${item.txnAmount != null ? ` | txn=${item.txnAmount}` : ''}${item.entryAmount != null ? ` | entry=${item.entryAmount}` : ''}`,
      })
    }

    for (const item of zeroCheck.issues || []) {
      pushIssue({
        kind: 'wallet_zero_balance_mismatch',
        severity: 'error',
        user_id: Number(item.userId || 0),
        display_name: null,
        email: null,
        phone: null,
        title: 'مخالفة بين الرصيد الحالي ومجموع القيود',
        details: `${item.currency}: ledger=${Number(item.ledgerSum || 0)} | wallet=${Number(item.walletBalance || 0)}`,
      })
    }

    const restrictedAccounts = restrictedRows.map((row) => ({
      user_id: Number(row.id || 0),
      display_name: row.display_name || null,
      email: row.email || null,
      phone: row.phone || null,
      states: buildAccountRestrictionLabels(row),
      banned_until: row.banned_until || null,
    }))

    const summary = {
      scanned_users: Number(userStats?.total_users || 0),
      restricted_users: Number(userStats?.restricted_users || 0),
      banned_users: Number(userStats?.banned_users || 0),
      frozen_users: Number(userStats?.frozen_users || 0),
      unapproved_users: Number(userStats?.unapproved_users || 0),
      temp_banned_users: Number(userStats?.temp_banned_users || 0),
      active_blocked_session_issues: blockedSessionRows.length,
      staff_permission_issues: staffPermissionRows.length,
      wallet_integrity_issues: reconcileIssues.length,
      linkage_issues: Number(linkageCheck?.issues?.length || 0),
      earning_transfer_issues: Number(earningCheck?.issues?.length || 0),
      zero_balance_issues: Number(zeroCheck?.issues?.length || 0),
      issues_total:
        blockedSessionRows.length +
        staffPermissionRows.length +
        reconcileIssues.length +
        Number(linkageCheck?.issues?.length || 0) +
        Number(earningCheck?.issues?.length || 0) +
        Number(zeroCheck?.issues?.length || 0),
      scanned_at: new Date().toISOString(),
    }

    await logAudit(db, req.user.id, 'staff_permissions', 'account_health_scan', null, {
      scannedUsers: summary.scanned_users,
      restrictedUsers: summary.restricted_users,
      issuesTotal: summary.issues_total,
    })

    return res.json({
      ok: true,
      summary,
      restricted_accounts: restrictedAccounts,
      issues,
    })
  })

  router.get('/kyc/submissions', async (req, res) => {
    const status = String(req.query.status || '').trim().toLowerCase()
    const q = String(req.query.q || '').trim()
    const params = []
    const where = []
    if (status) {
      where.push(`LOWER(k.review_status) = ?`)
      params.push(status)
    }
    if (q) {
      where.push(`(CAST(u.id AS TEXT) LIKE ? OR LOWER(COALESCE(u.display_name, '')) LIKE ? OR LOWER(COALESCE(u.email, '')) LIKE ? OR LOWER(COALESCE(u.phone, '')) LIKE ?)`)
      const token = `%${q.toLowerCase()}%`
      params.push(token, token, token, token)
    }
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const items = await all(
      db,
      `SELECT k.id, k.user_id, k.id_document_path, k.selfie_path, k.review_status, k.rejection_reason,
              k.full_name_match_score, k.face_match_score, k.aml_risk_level, k.auto_review_at, k.reviewed_note,
              k.reviewed_by, k.reviewed_at, k.created_at,
              u.display_name, u.email, u.phone, u.verification_status, u.is_approved
       FROM kyc_submissions k
       LEFT JOIN users u ON u.id = k.user_id
       ${sqlWhere}
       ORDER BY k.id DESC
       LIMIT 200`,
      params,
    )
    return res.json({ items })
  })

  router.post('/kyc/review', async (req, res) => {
    const submissionId = Number(req.body?.submissionId || 0)
    const decision = String(req.body?.decision || '').trim().toLowerCase() // approve | reject | auto
    const rejectionReason = String(req.body?.rejectionReason || '').trim() || null
    const reviewedNote = String(req.body?.reviewedNote || '').trim() || null
    const fullNameMatchScore = Number(req.body?.fullNameMatchScore || 0)
    const faceMatchScore = Number(req.body?.faceMatchScore || 0)
    const amlRiskLevel = String(req.body?.amlRiskLevel || 'low').trim().toLowerCase()
    if (!Number.isFinite(submissionId) || submissionId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!['approve', 'reject', 'auto'].includes(decision)) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!['low', 'medium', 'high'].includes(amlRiskLevel)) return res.status(400).json({ error: 'INVALID_INPUT' })
    const row = await get(db, `SELECT id, user_id FROM kyc_submissions WHERE id = ? LIMIT 1`, [submissionId])
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' })

    if (decision === 'auto') {
      const delayMinutes = randomDelayMinutes(10, 180)
      const autoReviewAt = toIsoAfterMinutes(delayMinutes)
      await run(
        db,
        `UPDATE kyc_submissions
         SET review_status = 'pending_auto',
             auto_review_at = ?,
             rejection_reason = NULL,
             full_name_match_score = ?,
             face_match_score = ?,
             aml_risk_level = ?,
             reviewed_note = ?,
             reviewed_by = ?,
             reviewed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [autoReviewAt, fullNameMatchScore, faceMatchScore, amlRiskLevel, reviewedNote, req.user.id, submissionId],
      )
      await run(db, `UPDATE users SET verification_status = 'pending' WHERE id = ?`, [row.user_id])
      await logAudit(db, req.user.id, 'kyc', 'schedule_auto_review', row.user_id, { submissionId, delayMinutes })
      return res.json({ ok: true, autoReviewAt, delayMinutes })
    }

    const approved = decision === 'approve'
    await run(
      db,
      `UPDATE kyc_submissions
       SET review_status = ?,
           rejection_reason = ?,
           full_name_match_score = ?,
           face_match_score = ?,
           aml_risk_level = ?,
           reviewed_note = ?,
           reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP,
           auto_review_at = NULL
       WHERE id = ?`,
      [approved ? 'approved' : 'rejected', approved ? null : rejectionReason, fullNameMatchScore, faceMatchScore, amlRiskLevel, reviewedNote, req.user.id, submissionId],
    )
    await run(
      db,
      `UPDATE users
       SET verification_status = ?, is_approved = ?, verification_ready_at = NULL
       WHERE id = ?`,
      [approved ? 'verified' : 'unverified', approved ? 1 : 0, row.user_id],
    )
    await logAudit(db, req.user.id, 'kyc', approved ? 'approve_kyc' : 'reject_kyc', row.user_id, { submissionId, rejectionReason })
    return res.json({ ok: true })
  })

  router.post('/kyc/process-auto', async (req, res) => {
    const due = await all(
      db,
      `SELECT id, user_id
       FROM kyc_submissions
       WHERE review_status = 'pending_auto'
         AND auto_review_at IS NOT NULL
         AND auto_review_at <= CURRENT_TIMESTAMP
       ORDER BY id ASC
       LIMIT 200`,
    )
    if (due.length > 0) {
      const submissionIds = due.map((row) => Number(row.id))
      const userIds = due.map((row) => Number(row.user_id))
      const submissionPlaceholders = submissionIds.map(() => '?').join(', ')
      const userPlaceholders = userIds.map(() => '?').join(', ')
      await run(
        db,
        `UPDATE kyc_submissions
         SET review_status = 'approved',
             reviewed_at = CURRENT_TIMESTAMP,
             reviewed_note = COALESCE(reviewed_note, 'auto_approved')
         WHERE id IN (${submissionPlaceholders})`,
        submissionIds,
      )
      await run(
        db,
        `UPDATE users
         SET verification_status = 'verified',
             is_approved = 1,
             verification_ready_at = NULL
         WHERE id IN (${userPlaceholders})`,
        userIds,
      )
    }
    await logAudit(db, req.user.id, 'kyc', 'process_auto_reviews', null, { approvedCount: due.length })
    return res.json({ ok: true, approvedCount: due.length })
  })

  router.get('/kyc/watchlist', async (_req, res) => {
    const items = await all(
      db,
      `SELECT id, user_id, note, source, is_active, created_by, created_at
       FROM kyc_watchlist
       ORDER BY id DESC
       LIMIT 200`,
    )
    return res.json({ items })
  })

  router.post('/kyc/watchlist', async (req, res) => {
    const userId = Number(req.body?.userId || 0) || null
    const note = String(req.body?.note || '').trim()
    const source = String(req.body?.source || '').trim() || null
    if (!note) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `INSERT INTO kyc_watchlist (user_id, note, source, is_active, created_by)
       VALUES (?, ?, ?, 1, ?)`,
      [userId, note, source, req.user.id],
    )
    await logAudit(db, req.user.id, 'kyc', 'add_watchlist_entry', userId, { source })
    return res.json({ ok: true })
  })

  router.post('/kyc/watchlist/toggle', async (req, res) => {
    const id = Number(req.body?.id || 0)
    const isActive = Number(req.body?.isActive) ? 1 : 0
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `UPDATE kyc_watchlist SET is_active = ? WHERE id = ?`, [isActive, id])
    await logAudit(db, req.user.id, 'kyc', 'toggle_watchlist_entry', null, { id, isActive })
    return res.json({ ok: true })
  })

  return router
}
