import { Router } from 'express'
import { all, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'

export function createUsersRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/list', requirePermission(db, 'manage_users'), async (req, res) => {
    const q = String(req.query.q || '').trim()
    const role = String(req.query.role || '').trim()
    const clauses = []
    const params = []

    if (q) {
      clauses.push('(email LIKE ? OR phone LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }
    if (role) {
      clauses.push('role = ?')
      params.push(role)
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
    const rows = await all(
      db,
      `SELECT
        id, email, phone, role, is_approved, is_banned, created_at,
        display_name, verification_status, blue_badge, vip_level,
        phone_verified, identity_submitted
       FROM users ${where}
       ORDER BY id DESC`,
      params,
    )
    const isOwner = req.user.role === 'owner'
    const users = isOwner ? rows : rows.map((u) => ({ ...u, email: null, phone: null }))
    return res.json({ users })
  })

  router.post('/approve', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const isApproved = Number(req.body?.isApproved) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'INVALID_USER' })
    }
    await run(
      db,
      `UPDATE users
       SET is_approved = ?,
           verification_status = CASE WHEN ? = 1 THEN 'verified' ELSE 'unverified' END,
           verification_ready_at = CASE WHEN ? = 1 THEN NULL ELSE verification_ready_at END
       WHERE id = ?`,
      [isApproved, isApproved, isApproved, userId],
    )
    return res.json({ ok: true })
  })

  router.post('/ban', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const isBanned = Number(req.body?.isBanned) ? 1 : 0
    await run(db, `UPDATE users SET is_banned = ? WHERE id = ?`, [isBanned, userId])
    return res.json({ ok: true })
  })

  router.post('/promote', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const role = String(req.body?.role || 'user')
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'INVALID_ROLE' })
    }
    await run(db, `UPDATE users SET role = ? WHERE id = ?`, [role, userId])
    return res.json({ ok: true })
  })

  router.delete('/:id', requirePermission(db, 'manage_users'), async (req, res) => {
    await run(db, `DELETE FROM users WHERE id = ?`, [Number(req.params.id)])
    return res.json({ ok: true })
  })

  return router
}
