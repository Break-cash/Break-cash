import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { get, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'

const MINING_PERMISSION = 'تعدين'
const DAY_MS = 24 * 60 * 60 * 1000
const MONTH_MS = 30 * DAY_MS

const DEFAULT_MINING_CONFIG = {
  minSubscription: 500,
  planOptions: [500, 1000, 3000],
  emergencyFeePercent: 18,
  dailyTiers: [
    { minBalance: 0, maxBalance: 999.9999, percent: 0.2 },
    { minBalance: 1000, maxBalance: 4999.9999, percent: 0.28 },
    { minBalance: 5000, maxBalance: null, percent: 0.35 },
  ],
  monthlyTiers: [
    { minBalance: 0, maxBalance: 999.9999, percent: 3.2 },
    { minBalance: 1000, maxBalance: 4999.9999, percent: 4.2 },
    { minBalance: 5000, maxBalance: null, percent: 5.5 },
  ],
  mediaItems: [],
}

function normalizeText(value, max = 180) {
  return String(value || '').trim().slice(0, max)
}

function normalizePercent(value, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 1000) return fallback
  return Number(n.toFixed(4))
}

function normalizeAmount(value, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Number(n.toFixed(8))
}

function normalizeTiers(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => ({
      minBalance: Number(item?.minBalance || 0),
      maxBalance: item?.maxBalance == null || item?.maxBalance === '' ? null : Number(item.maxBalance),
      percent: Number(item?.percent || 0),
    }))
    .filter((item) => Number.isFinite(item.minBalance) && item.minBalance >= 0 && Number.isFinite(item.percent) && item.percent >= 0)
    .map((item) => ({
      minBalance: Number(item.minBalance.toFixed(8)),
      maxBalance: item.maxBalance != null && Number.isFinite(item.maxBalance) ? Number(item.maxBalance.toFixed(8)) : null,
      percent: Number(item.percent.toFixed(4)),
    }))
    .sort((a, b) => a.minBalance - b.minBalance)
    .slice(0, 24)
}

function normalizeMediaItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item, idx) => ({
      id: normalizeText(item?.id || `media_${idx + 1}`, 40),
      type: String(item?.type || 'image').trim().toLowerCase() === 'video' ? 'video' : 'image',
      url: normalizeText(item?.url, 240),
      title: normalizeText(item?.title, 80),
      enabled: item?.enabled !== false,
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : idx + 1,
    }))
    .filter((item) => item.id && item.url)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .slice(0, 20)
}

function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const minSubscription = Math.max(500, normalizeAmount(source.minSubscription, DEFAULT_MINING_CONFIG.minSubscription))
  const planOptions = Array.isArray(source.planOptions)
    ? source.planOptions
        .map((x) => normalizeAmount(x, 0))
        .filter((x) => x >= minSubscription)
        .slice(0, 8)
    : DEFAULT_MINING_CONFIG.planOptions
  const safePlans = planOptions.length > 0 ? planOptions : DEFAULT_MINING_CONFIG.planOptions
  const dailyTiers = normalizeTiers(source.dailyTiers)
  const monthlyTiers = normalizeTiers(source.monthlyTiers)
  return {
    minSubscription,
    planOptions: safePlans,
    emergencyFeePercent: normalizePercent(source.emergencyFeePercent, DEFAULT_MINING_CONFIG.emergencyFeePercent),
    dailyTiers: dailyTiers.length > 0 ? dailyTiers : DEFAULT_MINING_CONFIG.dailyTiers,
    monthlyTiers: monthlyTiers.length > 0 ? monthlyTiers : DEFAULT_MINING_CONFIG.monthlyTiers,
    mediaItems: normalizeMediaItems(source.mediaItems),
  }
}

function resolveTierPercent(balanceAmount, tiers, fallbackPercent) {
  const balance = Number(balanceAmount || 0)
  for (const tier of tiers) {
    const minOk = balance >= Number(tier.minBalance || 0)
    const maxOk = tier.maxBalance == null ? true : balance <= Number(tier.maxBalance)
    if (minOk && maxOk) return Number(tier.percent || 0)
  }
  return Number(fallbackPercent || 0)
}

async function getMiningConfig(db) {
  const row = await get(db, `SELECT value FROM settings WHERE key='mining_config' LIMIT 1`)
  if (!row?.value) return { ...DEFAULT_MINING_CONFIG }
  try {
    return normalizeConfig(JSON.parse(String(row.value)))
  } catch {
    return { ...DEFAULT_MINING_CONFIG }
  }
}

async function saveMiningConfig(db, config) {
  await run(
    db,
    `INSERT INTO settings (key, value) VALUES ('mining_config', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(config)],
  )
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
        // ignore
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

function parseDateTime(value) {
  if (!value) return null
  const ms = Date.parse(String(value))
  return Number.isFinite(ms) ? ms : null
}

function toIso(valueMs) {
  return new Date(valueMs).toISOString()
}

function getMonthBoundsUtc(nowMs) {
  const now = new Date(nowMs)
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0)
  return {
    startIso: new Date(start).toISOString(),
    endIso: new Date(end).toISOString(),
  }
}

function computeAccrual(profile, nowMs) {
  const principal = Number(profile?.principal_amount || 0)
  const dailyPercent = Number(profile?.daily_percent || 0)
  const monthlyPercent = Number(profile?.monthly_percent || 0)
  const startedMs = parseDateTime(profile?.started_at) || nowMs
  const lastDailyClaimMs = parseDateTime(profile?.last_daily_claim_at) || startedMs
  const elapsedDailyMs = Math.max(0, nowMs - lastDailyClaimMs)
  const elapsedMonthlyMs = Math.max(0, nowMs - startedMs)
  const dailyClaimable = Number(((principal * (dailyPercent / 100) * elapsedDailyMs) / DAY_MS).toFixed(8))
  const monthlyAccrued = Number(((principal * (monthlyPercent / 100) * elapsedMonthlyMs) / MONTH_MS).toFixed(8))
  return { dailyClaimable, monthlyAccrued }
}

async function getUserTotalBalance(tx, userId) {
  const row = await get(tx, `SELECT COALESCE(SUM(amount), 0) AS total_amount FROM balances WHERE user_id = ?`, [userId])
  return Number(row?.total_amount || 0)
}

export function createMiningRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  const uploadsRoot = path.join(process.cwd(), 'server', 'uploads')
  const miningMediaDir = path.join(uploadsRoot, 'mining-media')
  fs.mkdirSync(miningMediaDir, { recursive: true })
  const uploadMedia = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, miningMediaDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.bin'
        cb(null, `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`)
      },
    }),
    limits: { fileSize: 35 * 1024 * 1024 },
  })

  router.get('/my', async (req, res) => {
    const config = await getMiningConfig(db)
    const profile = await get(
      db,
      `SELECT * FROM mining_profiles WHERE user_id = ? LIMIT 1`,
      [req.user.id],
    )
    const nowMs = Date.now()
    const accrual = computeAccrual(profile, nowMs)
    const balanceRow = await get(
      db,
      `SELECT amount FROM balances WHERE user_id = ? AND currency = 'USDT' LIMIT 1`,
      [req.user.id],
    )
    const personalBalance = Number(balanceRow?.amount || 0)
    const releaseAtMs = parseDateTime(profile?.principal_release_at)
    const monthlyLockUntilMs = parseDateTime(profile?.monthly_lock_until)
    const canReleasePrincipal =
      String(profile?.status || '') === 'cancelled_pending_release' &&
      releaseAtMs != null &&
      nowMs >= releaseAtMs &&
      Number(profile?.principal_amount || 0) > 0
    let monthlyAggregate = 0
    if (profile) {
      const monthRange = getMonthBoundsUtc(nowMs)
      const monthlyRow = await get(
        db,
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM balance_transactions
         WHERE user_id = ?
           AND type = 'mining_daily_claim'
           AND created_at >= ?
           AND created_at < ?`,
        [req.user.id, monthRange.startIso, monthRange.endIso],
      )
      monthlyAggregate = Number(monthlyRow?.total || 0)
    }
    return res.json({
      config,
      mediaItems: (config.mediaItems || []).filter((item) => item.enabled),
      profile: profile
        ? {
            ...profile,
            principal_amount: Number(profile.principal_amount || 0),
            daily_percent: Number(profile.daily_percent || 0),
            monthly_percent: Number(profile.monthly_percent || 0),
            emergency_fee_percent: Number(profile.emergency_fee_percent || 0),
            daily_profit_claimed_total: Number(profile.daily_profit_claimed_total || 0),
            monthly_profit_accrued_total: Number(profile.monthly_profit_accrued_total || 0),
            daily_claimable: accrual.dailyClaimable,
            monthly_accrued_live: Number(monthlyAggregate.toFixed(8)),
            can_release_principal: canReleasePrincipal,
            monthly_lock_until_ms: monthlyLockUntilMs,
            personal_balance: personalBalance,
          }
        : null,
    })
  })

  router.post('/subscribe', async (req, res) => {
    const amount = normalizeAmount(req.body?.amount, 0)
    const currency = 'USDT'
    if (!amount || amount <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    const config = await getMiningConfig(db)
    if (amount < Number(config.minSubscription || 500)) return res.status(400).json({ error: 'MIN_SUBSCRIPTION' })

    try {
      const payload = await withTransaction(db, async (tx) => {
        const currentProfile = await get(
          tx,
          `SELECT * FROM mining_profiles WHERE user_id = ? LIMIT 1`,
          [req.user.id],
        )
        if (currentProfile && String(currentProfile.status || '') === 'active') {
          throw new Error('MINING_ALREADY_ACTIVE')
        }

        const personalBalanceRow = await get(
          tx,
          `SELECT amount FROM balances WHERE user_id = ? AND currency = ? LIMIT 1`,
          [req.user.id, currency],
        )
        const currentBalance = Number(personalBalanceRow?.amount || 0)
        if (currentBalance < amount) throw new Error('INSUFFICIENT_BALANCE')

        const totalBalance = await getUserTotalBalance(tx, req.user.id)
        const dailyPercent = resolveTierPercent(totalBalance, config.dailyTiers || [], 0)
        const monthlyPercent = resolveTierPercent(totalBalance, config.monthlyTiers || [], 0)
        const emergencyFeePercent = Number(config.emergencyFeePercent || 0)
        const nowMs = Date.now()
        const monthlyLockUntil = toIso(nowMs + MONTH_MS)
        const nowIso = toIso(nowMs)
        const nextBalance = Number((currentBalance - amount).toFixed(8))

        await run(
          tx,
          `INSERT INTO balances (user_id, currency, amount, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, currency) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
          [req.user.id, currency, nextBalance],
        )
        await run(
          tx,
          `INSERT INTO balance_transactions (user_id, admin_id, type, currency, amount, note)
           VALUES (?, NULL, 'mining_subscribe', ?, ?, ?)`,
          [req.user.id, currency, amount, `Mining subscription amount ${amount.toFixed(2)}`],
        )
        await run(
          tx,
          `INSERT INTO mining_profiles (
            user_id, status, currency, principal_amount, daily_percent, monthly_percent, emergency_fee_percent,
            started_at, monthly_lock_until, last_daily_claim_at, cancel_requested_at, principal_release_at,
            principal_released_at, emergency_withdrawn_at, updated_at
          )
          VALUES (?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id) DO UPDATE SET
            status = 'active',
            currency = excluded.currency,
            principal_amount = excluded.principal_amount,
            daily_percent = excluded.daily_percent,
            monthly_percent = excluded.monthly_percent,
            emergency_fee_percent = excluded.emergency_fee_percent,
            started_at = excluded.started_at,
            monthly_lock_until = excluded.monthly_lock_until,
            last_daily_claim_at = excluded.last_daily_claim_at,
            cancel_requested_at = NULL,
            principal_release_at = NULL,
            principal_released_at = NULL,
            emergency_withdrawn_at = NULL,
            updated_at = CURRENT_TIMESTAMP`,
          [req.user.id, currency, amount, dailyPercent, monthlyPercent, emergencyFeePercent, nowIso, monthlyLockUntil, nowIso],
        )
        const miningNoticeBody = `Subscription active with ${amount.toFixed(2)} USDT.`
        const latestMiningNotice = await get(
          tx,
          `SELECT id, body, created_at
           FROM notifications
           WHERE user_id = ? AND title = 'Mining subscription active'
           ORDER BY id DESC
           LIMIT 1`,
          [req.user.id],
        )
        const latestNoticeAtMs = parseDateTime(latestMiningNotice?.created_at)
        const isRecentDuplicateNotice =
          latestNoticeAtMs != null &&
          Date.now() - latestNoticeAtMs < 90 * 1000 &&
          String(latestMiningNotice?.body || '') === miningNoticeBody
        if (!isRecentDuplicateNotice) {
          await run(
            tx,
            `INSERT INTO notifications (user_id, title, body)
             VALUES (?, 'Mining subscription active', ?)`,
            [req.user.id, miningNoticeBody],
          )
        }
        return { amount, dailyPercent, monthlyPercent, emergencyFeePercent, monthlyLockUntil, balanceAfter: nextBalance }
      })
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'mining_subscribe' })
      return res.json({ ok: true, ...payload })
    } catch (error) {
      const codes = new Set(['MINING_ALREADY_ACTIVE', 'INSUFFICIENT_BALANCE'])
      if (error instanceof Error && codes.has(error.message)) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.post('/claim-daily', async (req, res) => {
    try {
      const result = await withTransaction(db, async (tx) => {
        const profile = await get(tx, `SELECT * FROM mining_profiles WHERE user_id = ? LIMIT 1`, [req.user.id])
        if (!profile || String(profile.status || '') !== 'active') throw new Error('MINING_NOT_ACTIVE')
        const nowMs = Date.now()
        const { dailyClaimable } = computeAccrual(profile, nowMs)
        if (!dailyClaimable || dailyClaimable <= 0) throw new Error('NO_DAILY_PROFIT')

        const currentUsdc = await get(
          tx,
          `SELECT amount FROM balances WHERE user_id = ? AND currency = 'USDT' LIMIT 1`,
          [req.user.id],
        )
        const nextAmount = Number((Number(currentUsdc?.amount || 0) + dailyClaimable).toFixed(8))
        await run(
          tx,
          `INSERT INTO balances (user_id, currency, amount, updated_at)
           VALUES (?, 'USDT', ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, currency) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
          [req.user.id, nextAmount],
        )
        await run(
          tx,
          `UPDATE mining_profiles
           SET last_daily_claim_at = CURRENT_TIMESTAMP,
               daily_profit_claimed_total = COALESCE(daily_profit_claimed_total, 0) + ?,
               monthly_profit_accrued_total = COALESCE(monthly_profit_accrued_total, 0) + ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [dailyClaimable, dailyClaimable, req.user.id],
        )
        await run(
          tx,
          `INSERT INTO balance_transactions (user_id, admin_id, type, currency, amount, note)
           VALUES (?, NULL, 'mining_daily_claim', 'USDT', ?, 'Daily mining profit claim')`,
          [req.user.id, dailyClaimable],
        )
        return { claimedAmount: dailyClaimable, balanceAfter: nextAmount }
      })
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'mining_claim' })
      return res.json({ ok: true, ...result })
    } catch (error) {
      const codes = new Set(['MINING_NOT_ACTIVE', 'NO_DAILY_PROFIT'])
      if (error instanceof Error && codes.has(error.message)) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.post('/cancel', async (req, res) => {
    try {
      const payload = await withTransaction(db, async (tx) => {
        const profile = await get(tx, `SELECT * FROM mining_profiles WHERE user_id = ? LIMIT 1`, [req.user.id])
        if (!profile || String(profile.status || '') !== 'active') throw new Error('MINING_NOT_ACTIVE')
        const monthlyLockUntilMs = parseDateTime(profile.monthly_lock_until) || Date.now() + MONTH_MS
        await run(
          tx,
          `UPDATE mining_profiles
           SET status = 'cancelled_pending_release',
               cancel_requested_at = CURRENT_TIMESTAMP,
               principal_release_at = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [toIso(monthlyLockUntilMs), req.user.id],
        )
        return { releaseAt: toIso(monthlyLockUntilMs) }
      })
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'mining_cancel' })
      return res.json({ ok: true, ...payload })
    } catch (error) {
      if (error instanceof Error && error.message === 'MINING_NOT_ACTIVE') {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.post('/release-principal', async (req, res) => {
    try {
      const payload = await withTransaction(db, async (tx) => {
        const profile = await get(tx, `SELECT * FROM mining_profiles WHERE user_id = ? LIMIT 1`, [req.user.id])
        if (!profile || String(profile.status || '') !== 'cancelled_pending_release') {
          throw new Error('PRINCIPAL_NOT_READY')
        }
        const releaseAtMs = parseDateTime(profile.principal_release_at)
        if (releaseAtMs == null || Date.now() < releaseAtMs) throw new Error('PRINCIPAL_LOCKED')
        const principal = Number(profile.principal_amount || 0)
        if (principal <= 0) throw new Error('PRINCIPAL_NOT_READY')

        const currentUsdc = await get(
          tx,
          `SELECT amount FROM balances WHERE user_id = ? AND currency = 'USDT' LIMIT 1`,
          [req.user.id],
        )
        const nextAmount = Number((Number(currentUsdc?.amount || 0) + principal).toFixed(8))
        await run(
          tx,
          `INSERT INTO balances (user_id, currency, amount, updated_at)
           VALUES (?, 'USDT', ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, currency) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
          [req.user.id, nextAmount],
        )
        await run(
          tx,
          `UPDATE mining_profiles
           SET status = 'inactive',
               principal_amount = 0,
               principal_released_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [req.user.id],
        )
        await run(
          tx,
          `INSERT INTO balance_transactions (user_id, admin_id, type, currency, amount, note)
           VALUES (?, NULL, 'mining_principal_release', 'USDT', ?, 'Mining principal released after lock')`,
          [req.user.id, principal],
        )
        return { releasedAmount: principal, balanceAfter: nextAmount }
      })
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'mining_release_principal' })
      return res.json({ ok: true, ...payload })
    } catch (error) {
      const codes = new Set(['PRINCIPAL_NOT_READY', 'PRINCIPAL_LOCKED'])
      if (error instanceof Error && codes.has(error.message)) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.post('/emergency-withdraw', async (req, res) => {
    try {
      const payload = await withTransaction(db, async (tx) => {
        const profile = await get(tx, `SELECT * FROM mining_profiles WHERE user_id = ? LIMIT 1`, [req.user.id])
        if (!profile || !['active', 'cancelled_pending_release'].includes(String(profile.status || ''))) {
          throw new Error('MINING_NOT_ACTIVE')
        }
        const principal = Number(profile.principal_amount || 0)
        if (principal <= 0) throw new Error('MINING_NOT_ACTIVE')
        const feePercent = Number(profile.emergency_fee_percent || 0)
        const feeAmount = Number(((principal * feePercent) / 100).toFixed(8))
        const netAmount = Number(Math.max(0, principal - feeAmount).toFixed(8))

        const currentUsdc = await get(
          tx,
          `SELECT amount FROM balances WHERE user_id = ? AND currency = 'USDT' LIMIT 1`,
          [req.user.id],
        )
        const nextAmount = Number((Number(currentUsdc?.amount || 0) + netAmount).toFixed(8))
        await run(
          tx,
          `INSERT INTO balances (user_id, currency, amount, updated_at)
           VALUES (?, 'USDT', ?, CURRENT_TIMESTAMP)
           ON CONFLICT(user_id, currency) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at`,
          [req.user.id, nextAmount],
        )
        await run(
          tx,
          `UPDATE mining_profiles
           SET status = 'inactive',
               principal_amount = 0,
               emergency_withdrawn_at = CURRENT_TIMESTAMP,
               principal_released_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [req.user.id],
        )
        await run(
          tx,
          `INSERT INTO balance_transactions (user_id, admin_id, type, currency, amount, note)
           VALUES (?, NULL, 'mining_emergency_withdraw', 'USDT', ?, ?)`,
          [req.user.id, netAmount, `Emergency withdraw with fee ${feePercent}%`],
        )
        return { principal, feePercent, feeAmount, netAmount, balanceAfter: nextAmount }
      })
      publishLiveUpdate({ type: 'balance_updated', scope: 'user', userId: req.user.id, source: 'mining_emergency_withdraw' })
      return res.json({ ok: true, ...payload })
    } catch (error) {
      if (error instanceof Error && error.message === 'MINING_NOT_ACTIVE') {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.get('/admin/config', requirePermission(db, MINING_PERMISSION), async (_req, res) => {
    const config = await getMiningConfig(db)
    return res.json({ config })
  })

  router.post('/admin/config', requirePermission(db, MINING_PERMISSION), async (req, res) => {
    const config = normalizeConfig(req.body?.config)
    await saveMiningConfig(db, config)
    publishLiveUpdate({ type: 'home_content_updated', source: 'mining_admin_config', key: 'mining_config' })
    return res.json({ ok: true, config })
  })

  router.post('/admin/media-upload', requirePermission(db, MINING_PERMISSION), async (req, res) => {
    await new Promise((resolve, reject) => {
      uploadMedia.single('media')(req, res, (error) => {
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
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' })
    const mime = String(req.file.mimetype || '').toLowerCase()
    if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
      return res.status(400).json({ error: 'INVALID_FILE_TYPE' })
    }
    const fileUrl = `/uploads/mining-media/${path.basename(req.file.path).replaceAll('\\', '/')}`
    const type = mime.startsWith('video/') ? 'video' : 'image'
    return res.json({ ok: true, url: fileUrl, type })
  })

  return router
}
