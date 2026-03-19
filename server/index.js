import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import * as Sentry from '@sentry/node'
import { openDb } from './db.js'
import { ensureBaseSeed } from './services/seed.js'
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

const PORT = Number(process.env.PORT || 5174)
const HOST = process.env.HOST || '0.0.0.0'
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

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'uploads')))

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

  app.use((err, _req, res, _next) => {
    if (SENTRY_DSN) Sentry.captureException(err)
    return res.status(500).json({ error: 'SERVER_ERROR' })
  })

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist')
    app.use(express.static(distPath))
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')))
  }

  app.listen(PORT, HOST, () => {
    console.log(`BREAK CASH API running on http://${HOST}:${PORT}`)
  })
}

bootstrap().catch((error) => {
  if (SENTRY_DSN) Sentry.captureException(error)
  console.error('Server bootstrap failed:', error)
  process.exit(1)
})
