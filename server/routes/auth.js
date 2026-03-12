import { Router } from 'express'
import { hashPassword, signToken, verifyPassword } from '../auth.js'
import { get, run } from '../db.js'
import { requireApproved, requireAuth } from '../middleware/auth.js'
import { refreshVerificationStatus } from '../services/verification.js'

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[auth-route-error]', error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Authentication service failed.' })
  }
}

export function createAuthRouter(db) {
  const router = Router()

  router.post('/register', asyncRoute(async (req, res) => {
    const identifierRaw = String(req.body?.identifier || '').trim()
    const password = String(req.body?.password || '')
    const inviteCode = String(req.body?.inviteCode || '').trim() || null

    if (!identifierRaw || password.length < 6) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const isEmail = identifierRaw.includes('@')
    const email = isEmail ? identifierRaw : null
    const phone = !isEmail ? identifierRaw : null

    const existing = await get(
      db,
      `SELECT id FROM users WHERE (email IS NOT NULL AND email=?) OR (phone IS NOT NULL AND phone=?) LIMIT 1`,
      [email, phone],
    )
    if (existing) return res.status(409).json({ error: 'ALREADY_EXISTS' })

    // الحسابات الجديدة تبدأ كـ "غير معتمد" لكن يسمح لها بالدخول
    let approved = 0
    if (inviteCode) {
      const invite = await get(
        db,
        `SELECT id, is_active, used_by, expires_at FROM invites WHERE code = ? LIMIT 1`,
        [inviteCode],
      )
      if (!invite) return res.status(400).json({ error: 'INVALID_INVITE' })
      if (Number(invite.is_active) !== 1 || invite.used_by) {
        return res.status(400).json({ error: 'INVITE_UNAVAILABLE' })
      }
      if (invite.expires_at && Date.now() > Date.parse(invite.expires_at)) {
        return res.status(400).json({ error: 'INVITE_EXPIRED' })
      }
    }

    const passwordHash = await hashPassword(password)
    const result = await run(
      db,
      `INSERT INTO users (
        email, phone, password_hash, role, is_approved, is_banned,
        verification_status, phone_verified, identity_submitted, blue_badge, vip_level
      ) VALUES (?, ?, ?, 'user', ?, 0, 'unverified', 0, 0, 0, 0)`,
      [email, phone, passwordHash, approved],
    )

    if (inviteCode) {
      await run(
        db,
        `UPDATE invites SET used_by = ?, used_at = datetime('now'), is_active = 0 WHERE code = ?`,
        [result.lastID, inviteCode],
      )
    }

    const user = await get(
      db,
      `SELECT
        id, role, email, phone, is_approved, is_banned, created_at,
        display_name, avatar_path, verification_status, blue_badge, vip_level,
        phone_verified, identity_submitted, verification_ready_at
       FROM users
       WHERE id = ? LIMIT 1`,
      [result.lastID],
    )
    const token = signToken({ sub: user.id, role: user.role })
    const isOwner = user.role === 'owner'
    const safeUser = {
      ...user,
      email: isOwner ? user.email : null,
      phone: isOwner ? user.phone : null,
    }
    return res.status(201).json({ token, user: safeUser })
  }))

  router.post('/login', asyncRoute(async (req, res) => {
    const identifierRaw = String(req.body?.identifier || '').trim()
    const password = String(req.body?.password || '')
    if (!identifierRaw || !password) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const isEmail = identifierRaw.includes('@')
    const user = await get(
      db,
      isEmail
        ? `SELECT
            id, email, phone, password_hash, role, is_approved, is_banned, created_at,
            display_name, avatar_path, verification_status, blue_badge, vip_level,
            phone_verified, identity_submitted, verification_ready_at
           FROM users WHERE email=? LIMIT 1`
        : `SELECT
            id, email, phone, password_hash, role, is_approved, is_banned, created_at,
            display_name, avatar_path, verification_status, blue_badge, vip_level,
            phone_verified, identity_submitted, verification_ready_at
           FROM users WHERE phone=? LIMIT 1`,
      [identifierRaw],
    )
    if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    if (Number(user.is_banned) === 1) return res.status(403).json({ error: 'USER_BANNED' })

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' })

    await refreshVerificationStatus(db, user.id)
    const freshUser = await get(
      db,
      `SELECT
        id, role, email, phone, is_approved, is_banned, created_at,
        display_name, avatar_path, verification_status, blue_badge, vip_level,
        phone_verified, identity_submitted, verification_ready_at
       FROM users WHERE id = ? LIMIT 1`,
      [user.id],
    )

    const token = signToken({ sub: user.id, role: user.role })
    const isOwner = freshUser.role === 'owner'
    const safeUser = {
      ...freshUser,
      email: isOwner ? freshUser.email : null,
      phone: isOwner ? freshUser.phone : null,
    }
    return res.json({
      token,
      user: safeUser,
    })
  }))

  router.get('/me', requireAuth(db), asyncRoute(async (req, res) => {
    await refreshVerificationStatus(db, req.user.id)
    const user = await get(
      db,
      `SELECT
        id, role, email, phone, is_approved, is_banned, created_at,
        display_name, avatar_path, verification_status, blue_badge, vip_level,
        phone_verified, identity_submitted, verification_ready_at
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id],
    )
    const isOwner = user.role === 'owner'
    const safeUser = {
      ...user,
      email: isOwner ? user.email : null,
      phone: isOwner ? user.phone : null,
    }
    return res.json({ user: safeUser })
  }))

  router.get('/me/approved', requireAuth(db), requireApproved(), async (req, res) => {
    return res.json({ ok: true, user: req.user })
  })

  return router
}
