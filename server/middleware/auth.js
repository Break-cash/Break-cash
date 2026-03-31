import { verifyToken } from '../auth.js'
import { get, run } from '../db.js'
import { hasPermission } from '../services/permissions.js'

function parseToken(req) {
  const raw = req.headers.authorization || ''
  if (!raw.startsWith('Bearer ')) return null
  return raw.slice('Bearer '.length).trim()
}

export function requireAuth(db) {
  return async (req, res, next) => {
    try {
      const token = parseToken(req)
      if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' })
      const payload = verifyToken(token)
      const user = await get(
        db,
        `SELECT
          id, email, phone, role, is_approved, is_banned, is_frozen, banned_until, created_at,
          display_name, bio, avatar_path, verification_status, blue_badge, badge_style, vip_level, profile_color, profile_badge,
          phone_verified, identity_submitted, verification_ready_at, is_owner,
          two_factor_enabled, two_factor_for_admin_actions
         FROM users
         WHERE id = ? LIMIT 1`,
        [payload.sub],
      )
      if (!user) return res.status(401).json({ error: 'INVALID_TOKEN' })
      if (payload.sid) {
        const activeSession = await get(
          db,
          `SELECT id FROM user_sessions
           WHERE user_id = ? AND session_id = ? AND is_active = 1
           LIMIT 1`,
          [user.id, String(payload.sid)],
        )
        if (!activeSession) return res.status(401).json({ error: 'INVALID_TOKEN' })
        await run(
          db,
          `UPDATE user_sessions
           SET last_seen_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND session_id = ?`,
          [user.id, String(payload.sid)],
        )
      }
      const isTempBanned = user.banned_until && Date.now() < Date.parse(user.banned_until)
      if (Number(user.is_banned) === 1 || isTempBanned) return res.status(403).json({ error: 'USER_BANNED' })
      if (Number(user.is_frozen) === 1) return res.status(403).json({ error: 'USER_FROZEN' })
      req.user = user
      next()
    } catch (_error) {
      return res.status(401).json({ error: 'INVALID_TOKEN' })
    }
  }
}

export function requireApproved() {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' })
    if (Number(req.user.is_banned) === 1) {
      return res.status(403).json({ error: 'USER_BANNED' })
    }
    if (Number(req.user.is_frozen) === 1) {
      return res.status(403).json({ error: 'USER_FROZEN' })
    }
    // لم نعد نتحقق من is_approved؛ كل المستخدمين غير المحظورين يمكنهم الدخول
    return next()
  }
}

export function requireRole(role) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' })
    const isOwner = req.user.role === 'owner' || Number(req.user.is_owner || 0) === 1
    if (req.user.role === role) return next()
    if (role === 'owner' && isOwner) return next()
    if (role === 'admin' && isOwner) return next()
    if (role === 'moderator' && (req.user.role === 'admin' || isOwner)) {
      return next()
    }
    return res.status(403).json({ error: 'FORBIDDEN' })
  }
}

export function requirePermission(db, permission) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' })
    const allowed = await hasPermission(db, req.user.id, permission)
    if (!allowed) return res.status(403).json({ error: 'FORBIDDEN' })
    return next()
  }
}

export function requireAnyPermission(db, permissions) {
  const normalizedPermissions = Array.isArray(permissions)
    ? permissions.map((permission) => String(permission || '').trim()).filter(Boolean)
    : []
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'AUTH_REQUIRED' })
    for (const permission of normalizedPermissions) {
      if (await hasPermission(db, req.user.id, permission)) {
        return next()
      }
    }
    return res.status(403).json({ error: 'FORBIDDEN' })
  }
}
