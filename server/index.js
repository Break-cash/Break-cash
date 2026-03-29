import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import * as Sentry from '@sentry/node'
import { verifyToken } from './auth.js'
import { openDb } from './db.js'
import { get } from './db.js'
import { ensureBaseSeed } from './services/seed.js'
import { subscribeLiveClient } from './services/live-updates.js'
import { createAuthRouter } from './routes/auth.js'
import { createInvitesRouter } from './routes/invites.js'
import { createPermissionsRouter } from './routes/permissions.js'
import { createUsersRouter } from './routes/users.js'
import { createBalanceRouter } from './routes/balance.js'
import { createProfileRouter } from './routes/profile.js'
import { createNotificationsRouter } from './routes/notifications.js'
import { createSettingsRouter } from './routes/settings.js'
import { createPortfolioRouter } from './routes/portfolio.js'
import { createMarketRouter } from './routes/market.js'
import { createStatsRouter } from './routes/stats.js'
import { createFriendsRouter } from './routes/friends.js'
import { createOwnerGrowthRouter } from './routes/owner-growth.js'
import { createTasksRouter, runDueStrategyTradeSettlementSweep } from './routes/tasks.js'
import { createMiningRouter } from './routes/mining.js'
import { createRewardsRouter } from './routes/rewards.js'
import { createAdsRouter } from './routes/ads.js'
import { createSupportRouter } from './routes/support.js'
import { getUploadStorageKey, getUploadedAssetByKey } from './services/uploaded-assets.js'
import { backfillUploadedAssets } from './services/upload-backfill.js'
import { migrateUploadReferences } from './services/upload-reference-migration.js'
import { cleanupOldNotifications } from './services/notifications.js'
import { backfillUserAvatarBlobs } from './services/user-avatars.js'

const PORT = Number(process.env.PORT || 5174)
const app = express()
const SENTRY_DSN = String(process.env.SENTRY_DSN || '').trim()

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
  })
}

let dbRef = null
let strategyTradeSweepRunning = false
let notificationsCleanupRunning = false

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use('/uploads', async (req, res, next) => {
  if (!dbRef) return next()
  try {
    const storageKey = getUploadStorageKey(`/uploads${String(req.path || '')}`)
    if (!storageKey) return next()
    const asset = await getUploadedAssetByKey(dbRef, storageKey)
    if (!asset?.content_base64) return next()
    const buffer = Buffer.from(String(asset.content_base64), 'base64')
    res.setHeader('Content-Type', String(asset.mime_type || 'application/octet-stream'))
    res.setHeader('Content-Length', String(buffer.length))
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    return res.end(buffer)
  } catch {
    return next()
  }
})
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'server', 'uploads'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    },
  }),
)
app.use('/uploads', (_req, res) => {
  return res.status(404).send('UPLOAD_NOT_FOUND')
})

app.get('/api/health/live', (_req, res) => {
  return res.json({ ok: true, service: 'api', uptimeSec: Math.floor(process.uptime()) })
})

app.get('/api/health/ping', (req, res) => {
  const token = String(process.env.UPTIME_PING_TOKEN || '').trim()
  if (token) {
    const q = String(req.query.token || '')
    if (q !== token) return res.status(403).json({ ok: false, error: 'FORBIDDEN' })
  }
  return res.json({ ok: true, ts: new Date().toISOString() })
})

app.get('/api/health/ready', async (_req, res) => {
  if (!dbRef) return res.status(503).json({ ok: false, ready: false, reason: 'DB_NOT_INITIALIZED' })
  try {
    await dbRef.query('SELECT 1')
    return res.json({ ok: true, ready: true })
  } catch {
    return res.status(503).json({ ok: false, ready: false, reason: 'DB_UNAVAILABLE' })
  }
})

app.get('/api/live/stream', async (req, res) => {
  const token = String(req.query.token || '').trim()
  if (!token || !dbRef) return res.status(401).json({ error: 'AUTH_REQUIRED' })
  let payload = null
  try {
    payload = verifyToken(token)
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' })
  }
  const user = await get(dbRef, `SELECT id FROM users WHERE id = ? LIMIT 1`, [payload.sub])
  if (!user) return res.status(401).json({ error: 'INVALID_TOKEN' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  const close = subscribeLiveClient({ userId: user.id, res })
  res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`)
  req.on('close', () => close())
})

app.get('/api/health', async (_req, res) => {
  if (!dbRef) {
    return res.status(503).json({ ok: false, db: 'disconnected' })
  }
  try {
    const startedAt = Date.now()
    await dbRef.query('SELECT 1')
    return res.json({
      ok: true,
      db: 'up',
      dbLatencyMs: Date.now() - startedAt,
      uptimeSec: Math.floor(process.uptime()),
    })
  } catch (error) {
    if (SENTRY_DSN) Sentry.captureException(error)
    return res.status(503).json({ ok: false, db: 'down', error: 'DB_UNAVAILABLE' })
  }
})

async function bootstrap() {
  const db = await openDb()
  dbRef = db
  await ensureBaseSeed(db)
  try {
    const migration = await migrateUploadReferences(db)
    if (
      migration.avatarsUpdated > 0 ||
      migration.avatarsCleared > 0 ||
      migration.kycUpdated > 0 ||
      migration.depositProofsUpdated > 0
    ) {
      console.log(
        `[uploads] normalized references avatars=${migration.avatarsUpdated} cleared=${migration.avatarsCleared} kyc=${migration.kycUpdated} depositProofs=${migration.depositProofsUpdated}`,
      )
    }
  } catch (error) {
    if (SENTRY_DSN) Sentry.captureException(error)
    console.warn('[uploads] reference migration failed', error instanceof Error ? error.message : String(error))
  }
  try {
    const uploadBackfill = await backfillUploadedAssets(db)
    if (uploadBackfill.persisted > 0 || uploadBackfill.missing > 0) {
      console.log(
        `[uploads] backfill persisted=${uploadBackfill.persisted} skipped=${uploadBackfill.skipped} missing=${uploadBackfill.missing}`,
      )
    }
  } catch (error) {
    if (SENTRY_DSN) Sentry.captureException(error)
    console.warn('[uploads] backfill failed', error instanceof Error ? error.message : String(error))
  }
  try {
    const avatarBackfill = await backfillUserAvatarBlobs(db)
    if (avatarBackfill.backfilled > 0 || avatarBackfill.missing > 0) {
      console.log(`[avatars] backfill users=${avatarBackfill.backfilled} missing=${avatarBackfill.missing}`)
    }
  } catch (error) {
    if (SENTRY_DSN) Sentry.captureException(error)
    console.warn('[avatars] backfill failed', error instanceof Error ? error.message : String(error))
  }

  const strategyTradeSweepIntervalMs = Math.max(15000, Number(process.env.STRATEGY_TRADE_SWEEP_INTERVAL_MS || 30000))
  const notificationsCleanupIntervalMs = Math.max(
    60 * 60 * 1000,
    Number(process.env.NOTIFICATIONS_CLEANUP_INTERVAL_MS || 6 * 60 * 60 * 1000),
  )
  const notificationsRetentionDays = Math.max(7, Number(process.env.NOTIFICATIONS_RETENTION_DAYS || 30))
  setInterval(async () => {
    if (!dbRef || strategyTradeSweepRunning) return
    strategyTradeSweepRunning = true
    try {
      await runDueStrategyTradeSettlementSweep(dbRef, 100)
    } catch (error) {
      if (SENTRY_DSN) Sentry.captureException(error)
      console.warn('[strategy-trade] sweep failed', error instanceof Error ? error.message : String(error))
    } finally {
      strategyTradeSweepRunning = false
    }
  }, strategyTradeSweepIntervalMs)
  setInterval(async () => {
    if (!dbRef || notificationsCleanupRunning) return
    notificationsCleanupRunning = true
    try {
      const deletedCount = await cleanupOldNotifications(dbRef, notificationsRetentionDays)
      if (deletedCount > 0) {
        console.log(`[notifications] deleted ${deletedCount} old read notifications`)
      }
    } catch (error) {
      if (SENTRY_DSN) Sentry.captureException(error)
      console.warn('[notifications] cleanup failed', error instanceof Error ? error.message : String(error))
    } finally {
      notificationsCleanupRunning = false
    }
  }, notificationsCleanupIntervalMs)

  app.use('/api/auth', createAuthRouter(db))
  app.use('/api/invites', createInvitesRouter(db))
  app.use('/api/permissions', createPermissionsRouter(db))
  app.use('/api/users', createUsersRouter(db))
  app.use('/api/balance', createBalanceRouter(db))
  app.use('/api/profile', createProfileRouter(db))
  app.use('/api/notifications', createNotificationsRouter(db))
  app.use('/api/settings', createSettingsRouter(db))
  app.use('/api/portfolio', createPortfolioRouter(db))
  app.use('/api/market', createMarketRouter())
  app.use('/api/stats', createStatsRouter(db))
  app.use('/api/friends', createFriendsRouter(db))
  app.use('/api/owner-growth', createOwnerGrowthRouter(db))
  app.use('/api/tasks', createTasksRouter(db))
  app.use('/api/mining', createMiningRouter(db))
  app.use('/api/rewards', createRewardsRouter(db))
  app.use('/api/ads', createAdsRouter(db))
  app.use('/api/support', createSupportRouter(db))

  app.get('/manifest.json', async (_req, res) => {
    const defaults = {
      name: 'Break cash',
      short_name: 'Break cash',
      description: 'Invite-only trading dashboard PWA',
      background_color: '#0A0E17',
      theme_color: '#00C853',
      icon_192: '/break-cash-logo-premium.png',
      icon_512: '/break-cash-logo-premium.png',
    }
    let config = { ...defaults }
    try {
      const row = await get(db, `SELECT value FROM settings WHERE key='pwa_config' LIMIT 1`)
      const parsed = JSON.parse(String(row?.value || 'null'))
      if (parsed && typeof parsed === 'object') {
        config = {
          ...config,
          ...parsed,
        }
      }
    } catch {
      // keep defaults on parse/query errors
    }
    return res.json({
      name: config.name || defaults.name,
      short_name: config.short_name || defaults.short_name,
      description: config.description || defaults.description,
      start_url: '/',
      display: 'standalone',
      background_color: config.background_color || defaults.background_color,
      theme_color: config.theme_color || defaults.theme_color,
      icons: [
        {
          src: config.icon_192 || defaults.icon_192,
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable',
        },
        {
          src: config.icon_512 || defaults.icon_512,
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    })
  })

  app.use((err, _req, res, _next) => {
    if (SENTRY_DSN) Sentry.captureException(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  })

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist')
    app.use(express.static(distPath))
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))
  }

  app.listen(PORT, () => {
    console.log(`BREAK CASH API running on http://localhost:${PORT}`)
  })
}

bootstrap().catch((error) => {
  if (SENTRY_DSN) Sentry.captureException(error)
  console.error('Server bootstrap failed:', error)
  process.exit(1)
})

