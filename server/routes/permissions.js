import { Router } from 'express'
import { all, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { AVAILABLE_PERMISSIONS } from '../services/permissions.js'

export function createPermissionsRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/available', async (_req, res) => {
    return res.json({ permissions: AVAILABLE_PERMISSIONS })
  })

  router.get('/my', async (req, res) => {
    const rows = await all(
      db,
      `SELECT permission, created_at FROM permissions WHERE user_id = ? ORDER BY permission ASC`,
      [req.user.id],
    )
    return res.json({ role: req.user.role, permissions: rows.map((row) => row.permission) })
  })

  router.get('/moderators', requirePermission(db, 'manage_permissions'), async (_req, res) => {
    const rows = await all(
      db,
      `SELECT u.id, u.email, u.phone, u.role, p.permission
       FROM users u
       LEFT JOIN permissions p ON p.user_id = u.id
       WHERE u.role IN ('moderator', 'admin')
       ORDER BY u.id DESC`,
    )
    return res.json({ moderators: rows })
  })

  router.get('/user/:userId', requirePermission(db, 'manage_permissions'), async (req, res) => {
    const userId = Number(req.params.userId)
    const rows = await all(db, `SELECT permission FROM permissions WHERE user_id = ?`, [userId])
    return res.json({ userId, permissions: rows.map((row) => row.permission) })
  })

  router.post('/grant', requirePermission(db, 'manage_permissions'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const permission = String(req.body?.permission || '')
    if (!userId || !AVAILABLE_PERMISSIONS.includes(permission)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    await run(
      db,
      `INSERT OR IGNORE INTO permissions (user_id, permission, granted_by) VALUES (?, ?, ?)`,
      [userId, permission, req.user.id],
    )
    return res.json({ ok: true })
  })

  router.post('/revoke', requirePermission(db, 'manage_permissions'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const permission = String(req.body?.permission || '')
    if (!userId || !permission) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `DELETE FROM permissions WHERE user_id = ? AND permission = ?`, [userId, permission])
    return res.json({ ok: true })
  })

  return router
}
