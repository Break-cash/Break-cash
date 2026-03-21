import { Router } from 'express'
import { all, get } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { normalizeVipTierConfig, resolveVipMetricsProgress } from '../services/vip-rules.js'

function parsePerks(value) {
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

function parseVipTierRow(row) {
  const normalized = normalizeVipTierConfig(Number(row.level || 0), {
    ...(parseJsonSafe(row.perks_json, {}) || {}),
    level: Number(row.level || 0),
    title: row.title,
    minDeposit: Number(row.min_deposit || 0),
    minTradeVolume: Number(row.min_trade_volume || 0),
    referralMultiplier: Number(row.referral_multiplier || 0),
    referralPercent: Number(row.referral_percent || 0),
  })
  return {
    level: normalized.level,
    title: normalized.title,
    min_deposit: normalized.minDeposit,
    min_team_volume: normalized.minTeamVolume,
    min_referrals: normalized.minReferrals,
    referral_percent: normalized.referralPercent,
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
    perks: normalized.perks,
  }
}

function parseJsonSafe(value, fallback = null) {
  try {
    if (value == null || value === '') return fallback
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return fallback
  }
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function buildReferralLink(req, code) {
  const host = String(req.get('host') || '').trim()
  const protocol = String(req.protocol || 'https')
  const base = host ? `${protocol}://${host}` : String(process.env.APP_BASE_URL || '').trim()
  const safeBase = base || 'https://www.breakcash.cash'
  return `${safeBase}/join/${encodeURIComponent(code)}`
}

async function resolveReferralPercent(db, vipLevel) {
  const row = await get(
    db,
    `SELECT referral_percent
     FROM vip_tiers
     WHERE level = ? AND is_active = 1
     LIMIT 1`,
    [Number(vipLevel || 0)],
  )
  if (row?.referral_percent != null) return toFiniteNumber(row.referral_percent, 3)
  const fallback = { 0: 3, 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 }
  return toFiniteNumber(fallback[Math.max(0, Math.min(5, Number(vipLevel || 0)))], 3)
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
  const teamVolume = await get(
    db,
    `SELECT COALESCE(SUM(total_deposit), 0) AS team_volume
     FROM users
     WHERE referred_by = ?`,
    [userId],
  )
  return {
    directReferrals: Number(counts?.direct_referrals || 0),
    teamVolume: toFiniteNumber(teamVolume?.team_volume, 0),
  }
}

export function createRewardsRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/vip', async (req, res) => {
    const user = await get(
      db,
      `SELECT id, vip_level, total_deposit
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id],
    )
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' })

    const tiersRows = await all(
      db,
      `SELECT level, title, min_deposit, min_trade_volume, referral_multiplier, referral_percent, perks_json
       FROM vip_tiers
       WHERE is_active = 1
       ORDER BY level ASC`,
    )
    const tiers = tiersRows.map((row) => parseVipTierRow(row))

    const currentVipLevel = Number(user.vip_level || 0)
    const totalDeposit = toFiniteNumber(user.total_deposit, 0)
    const network = await getVipNetworkMetrics(db, req.user.id)
    const currentTier = tiers.filter((tier) => tier.level <= currentVipLevel).sort((a, b) => b.level - a.level)[0] || null
    const nextTier = tiers.find((tier) => tier.level > currentVipLevel) || null

    let progressPct = 100
    if (nextTier) {
      const depositProgress = resolveVipMetricsProgress(totalDeposit, nextTier.min_deposit)
      const referralsProgress = resolveVipMetricsProgress(network.directReferrals, nextTier.min_referrals)
      const teamProgress = resolveVipMetricsProgress(network.teamVolume, nextTier.min_team_volume)
      progressPct = Math.min(depositProgress, referralsProgress, teamProgress)
    }

    return res.json({
      currentVipLevel,
      totalDeposit,
      currentDirectReferrals: network.directReferrals,
      currentTeamVolume: network.teamVolume,
      nextLevel: nextTier ? nextTier.level : null,
      nextMinDeposit: nextTier ? nextTier.min_deposit : null,
      nextMinReferrals: nextTier ? nextTier.min_referrals : null,
      nextMinTeamVolume: nextTier ? nextTier.min_team_volume : null,
      progressPct,
      tiers,
    })
  })

  router.get('/referral', async (req, res) => {
    const user = await get(
      db,
      `SELECT id, referral_code, vip_level
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id],
    )
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' })

    const referralCode = String(user.referral_code || '').trim()
    const referralPercent = await resolveReferralPercent(db, Number(user.vip_level || 0))
    const referralRuleRow = await get(
      db,
      `SELECT id, title, conditions_json, reward_json
       FROM bonus_rules
       WHERE rule_type = 'referral'
         AND is_active = 1
         AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
         AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
       ORDER BY id DESC
       LIMIT 1`,
    )
    const referralRule = referralRuleRow
      ? {
          id: Number(referralRuleRow.id),
          title: String(referralRuleRow.title || ''),
          conditions: parseJsonSafe(referralRuleRow.conditions_json, {}) || {},
          reward: parseJsonSafe(referralRuleRow.reward_json, {}) || {},
        }
      : null

    const invited = await get(
      db,
      `SELECT COUNT(*) AS total
       FROM referrals
       WHERE referrer_user_id = ? AND status IN ('active', 'reward_released')`,
      [req.user.id],
    )
    const earnings = await get(
      db,
      `SELECT COALESCE(SUM(reward_amount), 0) AS total
       FROM referral_rewards
       WHERE referrer_user_id = ?`,
      [req.user.id],
    )
    const historyRows = await all(
      db,
      `SELECT
         r.id,
         r.referred_user_id,
         r.status,
         r.created_at,
         r.qualified_at,
         r.reward_released_at,
         r.qualifying_deposit_request_id AS deposit_request_id,
         r.first_deposit_amount AS source_amount,
         r.reward_percent,
         r.reward_amount,
         u.display_name AS referred_display_name
       FROM referrals r
       LEFT JOIN users u ON u.id = r.referred_user_id
       WHERE r.referrer_user_id = ?
       ORDER BY r.id DESC
       LIMIT 200`,
      [req.user.id],
    )

    return res.json({
      referralCode,
      referralLink: referralCode ? buildReferralLink(req, referralCode) : '',
      referralPercent,
      referralRule,
      totalInvitedUsers: Number(invited?.total || 0),
      totalReferralEarnings: toFiniteNumber(earnings?.total, 0),
      rewardHistory: historyRows.map((row) => ({
        id: Number(row.id),
        referred_user_id: Number(row.referred_user_id || 0),
        referred_display_name: row.referred_display_name || null,
        status: String(row.status || 'pending'),
        deposit_request_id: row.deposit_request_id ? Number(row.deposit_request_id) : null,
        source_amount: toFiniteNumber(row.source_amount, 0),
        reward_percent: toFiniteNumber(row.reward_percent, 0),
        reward_amount: toFiniteNumber(row.reward_amount, 0),
        created_at: row.created_at,
        qualified_at: row.qualified_at || null,
        reward_released_at: row.reward_released_at || null,
      })),
    })
  })

  router.get('/promotions', async (_req, res) => {
    const rows = await all(
      db,
      `SELECT id, rule_type, title, conditions_json, reward_json, is_active
       FROM bonus_rules
       WHERE is_active = 1
         AND rule_type IN ('first_deposit', 'referral')
         AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
         AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)
       ORDER BY id DESC`,
    )
    const items = rows.map((row) => ({
      id: Number(row.id),
      rule_type: String(row.rule_type || ''),
      title: String(row.title || ''),
      conditions: parseJsonSafe(row.conditions_json, {}) || {},
      reward: parseJsonSafe(row.reward_json, {}) || {},
      is_active: Number(row.is_active || 0),
    }))
    return res.json({
      firstDeposit: items.filter((item) => item.rule_type === 'first_deposit'),
      referral: items.filter((item) => item.rule_type === 'referral'),
    })
  })

  return router
}

