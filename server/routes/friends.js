import path from 'node:path'
import { Router } from 'express'
import { get, run, all } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { buildUserAvatarUrl } from '../services/user-avatars.js'

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[friends-route-error]', error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Friends service failed.' })
  }
}

function toFriendUserPayload(row) {
  return {
    id: row.id,
    displayName: row.display_name || `#${row.id}`,
    bio: String(row.bio || '').slice(0, 120),
    avatarUrl: buildUserAvatarUrl(row.id, row.avatar_path),
    verificationStatus: String(row.verification_status || 'unverified'),
    blueBadge: Number(row.blue_badge || 0),
    vipLevel: Number(row.vip_level || 0),
    premiumBadge: String(row.profile_badge || '').trim() || null,
    country: String(row.country || '').trim() || null,
    depositPrivacyEnabled: Number(row.deposit_privacy_enabled ?? 1) === 1,
    tradingBalance: Number(row.deposit_privacy_enabled ?? 1) === 1 ? null : Number(row.trading_balance || 0),
  }
}

export function createFriendsRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/public-profile/:userId', asyncRoute(async (req, res) => {
    const userId = Number(req.params?.userId)
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })

    const row = await get(
      db,
      `SELECT u.id, u.display_name, u.bio, u.avatar_path, u.verification_status, u.blue_badge, u.vip_level, u.profile_badge, u.country, u.deposit_privacy_enabled,
              COALESCE(bal.total_balance, 0) AS trading_balance
       FROM users u
       LEFT JOIN (
         SELECT user_id, SUM(balance_amount) AS total_balance
         FROM wallet_accounts
         WHERE account_type = 'main' AND source_type = 'system'
         GROUP BY user_id
       ) bal ON bal.user_id = u.id
       WHERE u.id = ? AND u.is_banned = 0
       LIMIT 1`,
      [userId],
    )
    if (!row) return res.status(404).json({ error: 'NOT_FOUND' })
    return res.json({ user: toFriendUserPayload(row) })
  }))

  // بحث المستخدمين بالـ ID (رقم أو بداية الرقم)
  router.get('/search', asyncRoute(async (req, res) => {
    const q = String(req.query?.q || '').trim().replace(/\D/g, '')
    if (!q) return res.json({ users: [] })

    const me = req.user.id
    const rows = await all(
      db,
      `SELECT u.id, u.display_name, u.bio, u.avatar_path, u.verification_status, u.blue_badge, u.vip_level, u.profile_badge, u.country, u.deposit_privacy_enabled,
              COALESCE(bal.total_balance, 0) AS trading_balance
       FROM users u
       LEFT JOIN (
         SELECT user_id, SUM(balance_amount) AS total_balance
         FROM wallet_accounts
         WHERE account_type = 'main' AND source_type = 'system'
         GROUP BY user_id
       ) bal ON bal.user_id = u.id
       WHERE CAST(u.id AS TEXT) LIKE ? AND u.id != ? AND u.is_banned = 0
       ORDER BY u.id ASC
       LIMIT 20`,
      [`${q}%`, me],
    )
    const users = rows.map((r) => toFriendUserPayload(r))
    return res.json({ users })
  }))

  // إرسال طلب صداقة
  router.post('/request', asyncRoute(async (req, res) => {
    const toUserId = Number(req.body?.toUserId)
    if (!toUserId || toUserId < 1) return res.status(400).json({ error: 'INVALID_INPUT' })
    const me = req.user.id
    if (toUserId === me) return res.status(400).json({ error: 'INVALID_INPUT' })

    const target = await get(db, `SELECT id, is_banned FROM users WHERE id = ? LIMIT 1`, [toUserId])
    if (!target) return res.status(404).json({ error: 'NOT_FOUND' })
    if (Number(target.is_banned) === 1) return res.status(400).json({ error: 'USER_BANNED' })

    const existing = await get(
      db,
      `SELECT id, status FROM friend_requests
       WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)
       LIMIT 1`,
      [me, toUserId, toUserId, me],
    )
    if (existing) {
      if (existing.status === 'accepted') return res.status(400).json({ error: 'ALREADY_FRIENDS' })
      return res.status(400).json({ error: 'REQUEST_EXISTS' })
    }

    await run(
      db,
      `INSERT INTO friend_requests (from_user_id, to_user_id, status) VALUES (?, ?, 'pending')`,
      [me, toUserId],
    )
    return res.json({ ok: true })
  }))

  // قائمة الأصدقاء والطلبات
  router.get('/list', asyncRoute(async (req, res) => {
    const me = req.user.id
    const limit = Math.min(300, Math.max(40, Number(req.query.limit) || 180))
    const requests = await all(
      db,
      `SELECT fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at,
              u.display_name AS from_display_name, u.avatar_path AS from_avatar_path,
              v.display_name AS to_display_name, v.avatar_path AS to_avatar_path
       FROM friend_requests fr
       LEFT JOIN users u ON u.id = fr.from_user_id
       LEFT JOIN users v ON v.id = fr.to_user_id
       WHERE fr.from_user_id = ? OR fr.to_user_id = ?
       ORDER BY fr.created_at DESC
       LIMIT ?`,
      [me, me, limit],
    )
    const friends = []
    const pendingReceived = []
    const pendingSent = []
    for (const r of requests) {
      const otherId = r.from_user_id === me ? r.to_user_id : r.from_user_id
      const displayName = r.from_user_id === me ? r.to_display_name : r.from_display_name
      const avatarPath = r.from_user_id === me ? r.to_avatar_path : r.from_avatar_path
      const item = {
        id: r.id,
        userId: otherId,
        displayName: displayName || `#${otherId}`,
        avatarUrl: buildUserAvatarUrl(otherId, avatarPath),
        status: r.status,
        createdAt: r.created_at,
      }
      if (r.status === 'accepted') friends.push(item)
      else if (r.to_user_id === me) pendingReceived.push(item)
      else pendingSent.push(item)
    }
    return res.json({ friends, pendingReceived, pendingSent })
  }))

  // قبول طلب صداقة
  router.post('/accept', asyncRoute(async (req, res) => {
    const requestId = Number(req.body?.requestId)
    if (!requestId) return res.status(400).json({ error: 'INVALID_INPUT' })
    const me = req.user.id
    const row = await get(
      db,
      `SELECT id, to_user_id, status FROM friend_requests WHERE id = ? LIMIT 1`,
      [requestId],
    )
    if (!row || row.to_user_id !== me) return res.status(404).json({ error: 'NOT_FOUND' })
    if (row.status !== 'pending') return res.status(400).json({ error: 'ALREADY_PROCESSED' })
    await run(db, `UPDATE friend_requests SET status = 'accepted' WHERE id = ?`, [requestId])
    return res.json({ ok: true })
  }))

  // إلغاء طلب أو إزالة صديق
  router.post('/remove', asyncRoute(async (req, res) => {
    const userId = Number(req.body?.userId)
    if (!userId) return res.status(400).json({ error: 'INVALID_INPUT' })
    const me = req.user.id
    const { changes } = await run(
      db,
      `DELETE FROM friend_requests
       WHERE ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))`,
      [me, userId, userId, me],
    )
    return res.json({ ok: true, removed: changes > 0 })
  }))

  return router
}
