import { Router } from 'express'
import { all, get } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

function parsePerks(value) {
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : []
  } catch {
    return []
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
      `SELECT level, title, min_deposit, referral_percent, perks_json
       FROM vip_tiers
       WHERE is_active = 1
       ORDER BY level ASC`,
    )
    const tiers = tiersRows.map((row) => ({
      level: Number(row.level || 0),
      title: String(row.title || `VIP ${row.level || 0}`),
      min_deposit: toFiniteNumber(row.min_deposit, 0),
      referral_percent: toFiniteNumber(row.referral_percent, 3),
      perks: parsePerks(row.perks_json),
    }))

    const currentVipLevel = Number(user.vip_level || 0)
    const totalDeposit = toFiniteNumber(user.total_deposit, 0)
    const currentTier = tiers.filter((tier) => tier.level <= currentVipLevel).sort((a, b) => b.level - a.level)[0] || null
    const nextTier = tiers.find((tier) => tier.level > currentVipLevel) || null

    let progressPct = 100
    if (nextTier) {
      const startDeposit = currentTier ? toFiniteNumber(currentTier.min_deposit, 0) : 0
      const targetDeposit = Math.max(startDeposit, toFiniteNumber(nextTier.min_deposit, 0))
      const denominator = Math.max(1, targetDeposit - startDeposit)
      const ratio = (totalDeposit - startDeposit) / denominator
      progressPct = Math.max(0, Math.min(100, Number((ratio * 100).toFixed(2))))
    }

    return res.json({
      currentVipLevel,
      totalDeposit,
      nextLevel: nextTier ? nextTier.level : null,
      nextMinDeposit: nextTier ? nextTier.min_deposit : null,
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

  return router
}

