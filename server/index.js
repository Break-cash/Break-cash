import express from 'express'
import cors from 'cors'
import path from 'node:path'
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
const app = express()

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use('/uploads', express.static(path.join(process.cwd(), 'server', 'uploads')))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

async function bootstrap() {
  const db = await openDb()
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

  app.listen(PORT, () => {
    console.log(`BREAK CASH API running on http://localhost:${PORT}`)
  })
}

bootstrap().catch((error) => {
  console.error('Server bootstrap failed:', error)
  process.exit(1)
})

