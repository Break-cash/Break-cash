import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAnyPermission, requireApproved, requireAuth, requirePermission } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'
import {
  deactivateAllUserPushSubscriptions,
  deactivateUserPushSubscription,
  getUserPushSubscriptionStatus,
  getWebPushPublicKey,
  saveUserPushSubscription,
  sendPushToUser,
} from '../services/push-notifications.js'

function getNotificationKey(row) {
  return `${String(row?.title || '').trim()}|${String(row?.body || '').trim()}`
}

function parseNotificationTime(value) {
  const ts = Date.parse(String(value || ''))
  return Number.isFinite(ts) ? ts : 0
}

function mergeNotificationRows(rows) {
  const byKey = new Map()
  for (const row of rows || []) {
    const key = getNotificationKey(row)
    const normalized = {
      id: Number(row?.id || 0),
      title: String(row?.title || ''),
      body: String(row?.body || ''),
      is_read: Number(row?.is_read || 0),
      created_at: row?.created_at || null,
    }
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, normalized)
      continue
    }
    const nextRead = Number(existing.is_read || 0) === 1 || Number(normalized.is_read || 0) === 1 ? 1 : 0
    const nextCreatedAt =
      parseNotificationTime(normalized.created_at) >= parseNotificationTime(existing.created_at)
        ? normalized.created_at
        : existing.created_at
    const nextId = Math.max(Number(existing.id || 0), Number(normalized.id || 0))
    byKey.set(key, {
      id: nextId,
      title: existing.title,
      body: existing.body,
      is_read: nextRead,
      created_at: nextCreatedAt,
    })
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const timeDiff = parseNotificationTime(b.created_at) - parseNotificationTime(a.created_at)
    if (timeDiff !== 0) return timeDiff
    return Number(b.id || 0) - Number(a.id || 0)
  })
}

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
    return res.json({ notifications: mergeNotificationRows(rows) })
  })

  router.get('/unreadCount', async (req, res) => {
    const row = await get(
      db,
      `SELECT COUNT(*) AS count
       FROM (
         SELECT n.title, n.body
         FROM notifications n
         WHERE n.user_id = ?
           AND n.is_read = 0
           AND NOT EXISTS (
             SELECT 1
             FROM notifications r
             WHERE r.user_id = n.user_id
               AND COALESCE(r.title, '') = COALESCE(n.title, '')
               AND COALESCE(r.body, '') = COALESCE(n.body, '')
               AND r.is_read = 1
           )
         GROUP BY n.title, n.body
       ) unread_keys`,
      [req.user.id],
    )
    return res.json({ unreadCount: Number(row?.count || 0) })
  })

  router.get('/push/public-key', async (_req, res) => {
    const publicKey = await getWebPushPublicKey(db)
    return res.json({ publicKey })
  })

  router.get('/push/status', async (req, res) => {
    const status = await getUserPushSubscriptionStatus(db, req.user.id)
    return res.json(status)
  })

  router.post('/push/subscribe', async (req, res) => {
    const subscription = req.body?.subscription
    if (!subscription) return res.status(400).json({ error: 'INVALID_PUSH_SUBSCRIPTION' })
    await saveUserPushSubscription(db, req.user.id, subscription, req.get('user-agent') || '')
    return res.json({ ok: true })
  })

  router.post('/push/unsubscribe', async (req, res) => {
    const endpoint = String(req.body?.endpoint || '').trim()
    if (endpoint) {
      await deactivateUserPushSubscription(db, req.user.id, endpoint)
    } else {
      await deactivateAllUserPushSubscriptions(db, req.user.id)
    }
    return res.json({ ok: true })
  })

  router.post('/push/test', async (req, res) => {
    const result = await sendPushToUser(db, req.user.id, {
      title: 'Break Cash',
      body: 'تم تفعيل الإشعارات الخارجية بنجاح.',
      tag: 'push_test',
      url: '/portfolio',
      data: { key: 'push_test' },
    })
    return res.json({ ok: true, result })
  })

  router.post('/markAsRead', async (req, res) => {
    const id = Number(req.body?.id)
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()
    if (title || body) {
      await run(
        db,
        `UPDATE notifications
         SET is_read = 1
         WHERE user_id = ?
           AND COALESCE(title, '') = ?
           AND COALESCE(body, '') = ?`,
        [req.user.id, title, body],
      )
    } else {
      await run(db, `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [
        id,
        req.user.id,
      ])
    }
    return res.json({ ok: true })
  })

  router.delete('/:id', async (req, res) => {
    await run(db, `DELETE FROM notifications WHERE id = ? AND user_id = ?`, [
      Number(req.params.id),
      req.user.id,
    ])
    return res.json({ ok: true })
  })

  router.post('/create', requireAnyPermission(db, ['manage_users', 'notifications.manage']), async (req, res) => {
    const userId = Number(req.body?.userId)
    const title = String(req.body?.title || '').trim()
    const body = String(req.body?.body || '').trim()
    if (!userId || !title || !body) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)`, [
      userId,
      title,
      body,
    ])
    await sendPushToUser(db, userId, { title, body, tag: 'admin_notification', url: '/portfolio', data: { title, body } }).catch(() => {})
    return res.status(201).json({ ok: true })
  })

  router.post('/broadcast', requireAnyPermission(db, ['notifications.manage']), async (req, res) => {
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
      await sendPushToUser(db, userId, { title, body, tag: 'owner_broadcast', url: '/portfolio', data: { title, body } }).catch(() => {})
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
