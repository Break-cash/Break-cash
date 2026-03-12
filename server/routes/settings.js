import { Router } from 'express'
import { get, run } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[settings-route-error]', error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Settings service failed.' })
  }
}

export function createSettingsRouter(db) {
  const router = Router()

  router.get('/wallet-link', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='wallet_link' LIMIT 1`)
    return res.json({ walletLink: row?.value || '' })
  }))

  router.post('/wallet-link', requireAuth(db), requireRole('admin'), asyncRoute(async (req, res) => {
    const walletLink = String(req.body?.walletLink || '').trim()
    if (!walletLink) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('wallet_link', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [walletLink],
    )
    return res.json({ ok: true, walletLink })
  }))

  router.get('/logo-url', asyncRoute(async (_req, res) => {
    const row = await get(db, `SELECT value FROM settings WHERE key='logo_url' LIMIT 1`)
    return res.json({ logoUrl: row?.value || '' })
  }))

  router.post('/logo-url', requireAuth(db), requireRole('admin'), asyncRoute(async (req, res) => {
    const logoUrl = String(req.body?.logoUrl ?? '').trim()
    await run(
      db,
      `INSERT INTO settings (key, value) VALUES ('logo_url', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [logoUrl || ''],
    )
    return res.json({ ok: true, logoUrl: logoUrl || '' })
  }))

  return router
}
