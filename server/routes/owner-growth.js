import { Router } from 'express'
import { all, get, run } from '../db.js'
import { hashPassword } from '../auth.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'

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
      items: items.map((row) => ({ ...row, perks: parseJsonOrNull(row.perks_json) || [] })),
    })
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
      [level, title, minDeposit, minTradeVolume, referralMultiplier, referralPercent, JSON.stringify(perks), isActive],
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
      read_only: ['dashboard.overview.view', 'reports.view'],
      finance: ['dashboard.overview.view', 'wallets.manage', 'deposits.manage', 'withdrawals.manage', 'reports.view'],
      kyc: ['dashboard.overview.view', 'kyc.manage', 'reports.view'],
      trading: ['dashboard.overview.view', 'trades.manage', 'assets.manage', 'reports.view'],
      marketing: ['dashboard.overview.view', 'notifications.manage', 'bonuses.manage', 'referrals.manage', 'reports.view'],
      support: ['dashboard.overview.view', 'support.manage', 'users.manage', 'reports.view'],
      full_admin: [
        'dashboard.overview.view', 'users.manage', 'wallets.manage', 'deposits.manage', 'withdrawals.manage',
        'trades.manage', 'assets.manage', 'vip.manage', 'referrals.manage', 'bonuses.manage', 'kyc.manage',
        'notifications.manage', 'support.manage', 'security.manage', 'reports.view', 'settings.manage',
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
