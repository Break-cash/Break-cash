import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireApproved, requireAuth, requirePermission, requireRole } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'

export function createNotificationsRouter(db) {
  const router = Router()
  router.use(requireAuth(db), requireApproved())

  router.get('/list', async (req, res) => {
    const limit = Math.min(200, Math.max(20, Number(req.query.limit) || 100))
    const rows = await all(
      db,
      `SELECT id, title, body, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT ?`,
      [req.user.id, limit],
    )
    return res.json({ notifications: rows })
  })

  router.get('/unreadCount', async (req, res) => {
    const row = await get(
      db,
      `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [req.user.id],
    )
    return res.json({ unreadCount: Number(row?.count || 0) })
  })

  router.post('/markAsRead', async (req, res) => {
    const id = Number(req.body?.id)
    await run(db, `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [
      id,
      req.user.id,
    ])
    return res.json({ ok: true })
  })

  router.delete('/:id', async (req, res) => {
    await run(db, `DELETE FROM notifications WHERE id = ? AND user_id = ?`, [
      Number(req.params.id),
      req.user.id,
    ])
    return res.json({ ok: true })
  })

  router.post('/create', requirePermission(db, 'manage_users'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()
    if (!userId || !title || !body) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)`, [
      userId,
      title,
      body,
    ])
    return res.status(201).json({ ok: true })
  })

  router.post('/broadcast', requireRole('owner'), async (req, res) => {
    const title = String(req.body?.title || '').trim().slice(0, 180)
    const body = String(req.body?.body || '').trim().slice(0, 1200)
    const vibrate = req.body?.vibrate !== false
    if (!title || !body) return res.status(400).json({ error: 'INVALID_INPUT' })

    const users = await all(
      db,
      `SELECT id
       FROM users
       WHERE role = 'user'
         AND COALESCE(is_banned, 0) = 0`,
    )

    let createdCount = 0
    for (const row of users) {
      const userId = Number(row?.id || 0)
      if (!userId) continue
      await run(db, `INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)`, [
        userId,
        title,
        body,
      ])
      createdCount += 1
    }

    publishLiveUpdate({
      type: 'broadcast_notification',
      scope: 'global',
      source: 'notifications',
      key: 'owner_broadcast',
      title,
      body,
      vibrate,
    })

    return res.status(201).json({ ok: true, createdCount, vibrate })
  })

  return router
}
