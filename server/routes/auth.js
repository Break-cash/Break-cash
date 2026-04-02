import { Router } from 'express'
import crypto from 'node:crypto'
import * as Sentry from '@sentry/node'
import { hashPassword, signToken, verifyPassword, verifyToken } from '../auth.js'
import { get, run } from '../db.js'
import { requireApproved, requireAuth } from '../middleware/auth.js'
import { sendPasswordResetEmail } from '../services/email.js'
import { sendPasswordResetSms } from '../services/sms.js'
import { refreshVerificationStatus } from '../services/verification.js'
import { buildUserAvatarUrl } from '../services/user-avatars.js'

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[auth-route-error]', error)
    Sentry.captureException(error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Authentication service failed.' })
  }
}

function toSafeUser(user) {
  const isOwner = user.role === 'owner'
  const rawBadgeStyle = String(user.badge_style || '').trim().toLowerCase()
  const badgeColor =
    rawBadgeStyle === 'none' ||
    rawBadgeStyle === 'blue' ||
    rawBadgeStyle === 'gold' ||
    rawBadgeStyle === 'red' ||
    rawBadgeStyle === 'green' ||
    rawBadgeStyle === 'purple' ||
    rawBadgeStyle === 'silver'
      ? rawBadgeStyle
      : Number(user.blue_badge || 0) === 1
        ? 'blue'
        : 'none'
  return {
    ...user,
    is_owner: Number(user.is_owner ?? (isOwner ? 1 : 0)),
    avatar_url: buildUserAvatarUrl(user.id, user.avatar_path, user.has_avatar_blob),
    badge_color: badgeColor,
    email: isOwner ? user.email : null,
    phone: isOwner ? user.phone : null,
  }
}

function createReferralCode() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `BC${part}`
}

export async function getUniqueReferralCode(db) {
  for (let i = 0; i < 8; i += 1) {
    const code = createReferralCode()
    const exists = await get(db, `SELECT id FROM users WHERE referral_code = ? LIMIT 1`, [code])
    if (!exists) return code
  }
  return `BC${Date.now().toString(36).toUpperCase()}`
}

function createRecoveryCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let value = ''
  for (let i = 0; i < 16; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)]
    if (i === 3 || i === 7 || i === 11) value += '-'
  }
  return value
}

function normalizeRecoveryCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
}

function normalizePreferredLanguage(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'ar' || raw === 'en' || raw === 'tr') return raw
  return 'ar'
}

function normalizeRecoveryContact(value) {
  const raw = String(value || '').trim().slice(0, 120)
  if (!raw) return { value: '', channel: '' }
  const compact = raw.replace(/\s+/g, '')
  const channel = compact.includes('@') ? 'email' : 'phone'
  return {
    value: compact,
    channel,
  }
}

async function getUniqueRecoveryCode(db) {
  for (let i = 0; i < 12; i += 1) {
    const code = createRecoveryCode()
    const exists = await get(db, `SELECT id FROM user_recovery_codes WHERE recovery_code = ? LIMIT 1`, [code])
    if (!exists) return code
  }
  return `${createRecoveryCode()}-${Date.now().toString(36).toUpperCase()}`
}

async function ensureUserRecoveryCode(db, userId) {
  const existing = await get(
    db,
    `SELECT user_id, recovery_code, acknowledged_at
     FROM user_recovery_codes
     WHERE user_id = ? LIMIT 1`,
    [userId],
  )
  if (existing) return existing
  const recoveryCode = await getUniqueRecoveryCode(db)
  await run(
    db,
    `INSERT INTO user_recovery_codes (user_id, recovery_code)
     VALUES (?, ?)`,
    [userId, recoveryCode],
  )
  return get(
    db,
    `SELECT user_id, recovery_code, acknowledged_at
     FROM user_recovery_codes
     WHERE user_id = ? LIMIT 1`,
    [userId],
  )
}

function getClientMeta(req) {
  const ipAddress = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim()
  const rawForwarded = String(req.headers['x-forwarded-for'] || '')
  const userAgent = String(req.headers['user-agent'] || '').slice(0, 500)
  const hasProxyHint = rawForwarded.includes(',') || /proxy|vpn|tor|headless|curl/i.test(userAgent)
  return { ipAddress, userAgent, hasProxyHint }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function canExposeDevCode() {
  return String(process.env.ALLOW_DEV_CODE || '').trim() === '1'
}

async function logLoginAttempt(db, payload) {
  await run(
    db,
    `INSERT INTO login_attempts (identifier, user_id, ip_address, user_agent, success, failure_reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.identifier || null,
      payload.userId || null,
      payload.ipAddress || null,
      payload.userAgent || null,
      payload.success ? 1 : 0,
      payload.failureReason || null,
    ],
  )
}

async function createSecurityAlert(db, payload) {
  await run(
    db,
    `INSERT INTO security_alerts (user_id, alert_type, severity, ip_address, user_agent, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.userId || null,
      payload.alertType,
      payload.severity || 'medium',
      payload.ipAddress || null,
      payload.userAgent || null,
      JSON.stringify(payload.metadata || {}),
    ],
  )
}

export function createAuthRouter(db) {
  const router = Router()

  router.post('/register', asyncRoute(async (req, res) => {
    const regStatus = await get(db, `SELECT value FROM settings WHERE key='registration_enabled' LIMIT 1`)
    const registrationEnabled = regStatus ? String(regStatus.value) !== '0' : false
    if (!registrationEnabled) {
      return res.status(403).json({ error: 'REGISTRATION_DISABLED' })
    }

    const identifierRaw = String(req.body?.identifier || '').trim()
    const password = String(req.body?.password || '')
    const inviteCode = String(req.body?.inviteCode || '').trim() || null
    const preferredLanguage = normalizePreferredLanguage(req.body?.preferredLanguage)

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
    let invitedBy = null
    let inviteRecordCode = null
    if (inviteCode) {
      const invite = await get(
        db,
        `SELECT id, is_active, used_by, expires_at, created_by FROM invites WHERE code = ? LIMIT 1`,
        [inviteCode],
      )
      if (invite) {
        if (Number(invite.is_active) !== 1 || invite.used_by) {
          return res.status(400).json({ error: 'INVITE_UNAVAILABLE' })
        }
        if (invite.expires_at && Date.now() > Date.parse(invite.expires_at)) {
          return res.status(400).json({ error: 'INVITE_EXPIRED' })
        }
        invitedBy = invite.created_by ? Number(invite.created_by) : null
        inviteRecordCode = inviteCode
      } else {
        const refOwner = await get(
          db,
          `SELECT id FROM users WHERE referral_code = ? LIMIT 1`,
          [inviteCode],
        )
        if (!refOwner?.id) return res.status(400).json({ error: 'INVALID_INVITE' })
        invitedBy = Number(refOwner.id)
      }
    }

    const passwordHash = await hashPassword(password)
    const referralCode = await getUniqueReferralCode(db)
    const result = await run(
      db,
      `INSERT INTO users (
        email, phone, password_hash, role, is_approved, is_banned, is_frozen,
        referral_code, invited_by, referred_by, preferred_language, total_deposit, points, is_owner,
        verification_status, phone_verified, identity_submitted, blue_badge, vip_level
      ) VALUES (?, ?, ?, 'user', ?, 0, 0, ?, ?, ?, ?, 0, 0, 0, 'unverified', 0, 0, 0, 0)
      RETURNING id`,
      [email, phone, passwordHash, approved, referralCode, invitedBy, invitedBy, preferredLanguage],
    )
    const createdUserId = Number(result.rows?.[0]?.id)
    if (!createdUserId) {
      return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create user.' })
    }

    if (inviteRecordCode) {
      await run(
        db,
        `UPDATE invites SET used_by = ?, used_at = datetime('now'), is_active = 0 WHERE code = ?`,
        [createdUserId, inviteRecordCode],
      )
    }
    if (invitedBy && invitedBy !== createdUserId) {
      await run(
        db,
        `INSERT INTO referrals (referrer_user_id, referred_user_id, status)
         VALUES (?, ?, 'pending')
         ON CONFLICT(referred_user_id) DO NOTHING`,
        [invitedBy, createdUserId],
      ).catch(() => {})
    }
    await ensureUserRecoveryCode(db, createdUserId)

    const user = await get(
      db,
      `SELECT
        id, role, email, phone, is_approved, is_banned, is_frozen, banned_until, created_at,
        display_name, bio, avatar_path, verification_status, blue_badge, badge_style, vip_level, profile_color, profile_badge,
        CASE WHEN avatar_blob_base64 IS NOT NULL AND avatar_blob_base64 <> '' THEN 1 ELSE 0 END AS has_avatar_blob,
        phone_verified, identity_submitted, verification_ready_at,
        country, preferred_language, preferred_currency, deposit_privacy_enabled, referral_code, total_deposit, points,
        invited_by, referred_by, is_owner, last_login_at, last_ip, last_user_agent
       FROM users
       WHERE id = ? LIMIT 1`,
      [createdUserId],
    )
    const { ipAddress, userAgent } = getClientMeta(req)
    const sessionId = crypto.randomUUID()
    const token = signToken({ sub: user.id, role: user.role, sid: sessionId })
    await run(
      db,
      `INSERT INTO user_sessions (user_id, session_id, token_hash, ip_address, user_agent, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [user.id, sessionId, hashToken(token), ipAddress || null, userAgent || null],
    )
    const safeUser = toSafeUser(user)
    return res.status(201).json({ token, user: safeUser })
  }))

  router.post('/login', asyncRoute(async (req, res) => {
    const identifierRaw = String(req.body?.identifier || '').trim()
    const password = String(req.body?.password || '')
    const preferredLanguage = normalizePreferredLanguage(req.body?.preferredLanguage)
    const { ipAddress, userAgent, hasProxyHint } = getClientMeta(req)
    if (!identifierRaw || !password) {
      await logLoginAttempt(db, {
        identifier: identifierRaw,
        userId: null,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'INVALID_INPUT',
      })
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const isEmail = identifierRaw.includes('@')
    const user = await get(
      db,
      isEmail
        ? `SELECT
            id, email, phone, password_hash, role, is_approved, is_banned, is_frozen, banned_until, created_at,
            display_name, bio, avatar_path, verification_status, blue_badge, badge_style, vip_level, profile_color, profile_badge,
            CASE WHEN avatar_blob_base64 IS NOT NULL AND avatar_blob_base64 <> '' THEN 1 ELSE 0 END AS has_avatar_blob,
            phone_verified, identity_submitted, verification_ready_at,
            country, preferred_language, preferred_currency, deposit_privacy_enabled, referral_code, total_deposit, points,
            invited_by, referred_by, is_owner, last_login_at, last_ip, last_user_agent
           FROM users WHERE email=? LIMIT 1`
        : `SELECT
            id, email, phone, password_hash, role, is_approved, is_banned, is_frozen, banned_until, created_at,
            display_name, bio, avatar_path, verification_status, blue_badge, badge_style, vip_level, profile_color, profile_badge,
            CASE WHEN avatar_blob_base64 IS NOT NULL AND avatar_blob_base64 <> '' THEN 1 ELSE 0 END AS has_avatar_blob,
            phone_verified, identity_submitted, verification_ready_at,
            country, preferred_language, preferred_currency, deposit_privacy_enabled, referral_code, total_deposit, points,
            invited_by, referred_by, is_owner, last_login_at, last_ip, last_user_agent
           FROM users WHERE phone=? LIMIT 1`,
      [identifierRaw],
    )
    if (!user) {
      await logLoginAttempt(db, {
        identifier: identifierRaw,
        userId: null,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'INVALID_CREDENTIALS',
      })
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    }
    const isTempBanned = user.banned_until && Date.now() < Date.parse(user.banned_until)
    if (Number(user.is_banned) === 1 || isTempBanned) {
      await logLoginAttempt(db, {
        identifier: identifierRaw,
        userId: user.id,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'USER_BANNED',
      })
      return res.status(403).json({ error: 'USER_BANNED' })
    }
    if (Number(user.is_frozen) === 1) {
      await logLoginAttempt(db, {
        identifier: identifierRaw,
        userId: user.id,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'USER_FROZEN',
      })
      return res.status(403).json({ error: 'USER_FROZEN' })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      await logLoginAttempt(db, {
        identifier: identifierRaw,
        userId: user.id,
        ipAddress,
        userAgent,
        success: false,
        failureReason: 'INVALID_CREDENTIALS',
      })
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' })
    }

    await run(
      db,
      `UPDATE users
       SET last_login_at = CURRENT_TIMESTAMP,
           preferred_language = ?,
           last_ip = ?,
           last_user_agent = ?
       WHERE id = ?`,
      [preferredLanguage, ipAddress || null, userAgent || null, user.id],
    )
    await run(
      db,
      `INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, metadata)
       VALUES (?, 'login', ?, ?, ?)`,
      [user.id, ipAddress || null, userAgent || null, JSON.stringify({ identifierType: isEmail ? 'email' : 'phone' })],
    )
    await logLoginAttempt(db, {
      identifier: identifierRaw,
      userId: user.id,
      ipAddress,
      userAgent,
      success: true,
      failureReason: null,
    })

    await refreshVerificationStatus(db, user.id)
    const freshUser = await get(
      db,
      `SELECT
        id, role, email, phone, is_approved, is_banned, is_frozen, banned_until, created_at,
        display_name, bio, avatar_path, verification_status, blue_badge, badge_style, vip_level, profile_color, profile_badge,
        CASE WHEN avatar_blob_base64 IS NOT NULL AND avatar_blob_base64 <> '' THEN 1 ELSE 0 END AS has_avatar_blob,
        phone_verified, identity_submitted, verification_ready_at,
        country, preferred_language, preferred_currency, deposit_privacy_enabled, referral_code, total_deposit, points,
        invited_by, referred_by, is_owner, last_login_at, last_ip, last_user_agent
       FROM users WHERE id = ? LIMIT 1`,
      [user.id],
    )

    const sessionId = crypto.randomUUID()
    const token = signToken({ sub: user.id, role: user.role, sid: sessionId })
    await run(
      db,
      `INSERT INTO user_sessions (user_id, session_id, token_hash, ip_address, user_agent, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [user.id, sessionId, hashToken(token), ipAddress || null, userAgent || null],
    )
    if (hasProxyHint) {
      await createSecurityAlert(db, {
        userId: user.id,
        alertType: 'proxy_vpn_suspected',
        severity: 'medium',
        ipAddress,
        userAgent,
        metadata: { reason: 'x-forwarded-for-chain-or-user-agent' },
      })
    }
    if (freshUser?.last_ip && ipAddress && String(freshUser.last_ip) !== String(ipAddress)) {
      await createSecurityAlert(db, {
        userId: user.id,
        alertType: 'new_ip_login',
        severity: 'high',
        ipAddress,
        userAgent,
        metadata: { previousIp: freshUser.last_ip },
      })
    }
    const activeSessions = await get(
      db,
      `SELECT COUNT(*) AS count FROM user_sessions WHERE user_id = ? AND is_active = 1`,
      [user.id],
    )
    if (Number(activeSessions?.count || 0) > 2) {
      await createSecurityAlert(db, {
        userId: user.id,
        alertType: 'multiple_devices_detected',
        severity: 'high',
        ipAddress,
        userAgent,
        metadata: { activeSessions: Number(activeSessions?.count || 0) },
      })
    }
    const safeUser = toSafeUser(freshUser)
    return res.json({
      token,
      user: safeUser,
    })
  }))

  router.post('/logout-current', requireAuth(db), asyncRoute(async (req, res) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
    const decoded = token ? verifyToken(token) : null
    if (decoded?.sid) {
      await run(
        db,
        `UPDATE user_sessions
         SET is_active = 0, revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND session_id = ?`,
        [req.user.id, String(decoded.sid)],
      )
    }
    await run(
      db,
      `INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, metadata)
       VALUES (?, 'logout', ?, ?, ?)`,
      [req.user.id, null, null, JSON.stringify({ type: 'current_session' })],
    )
    return res.json({ ok: true })
  }))

  router.post('/logout-all', requireAuth(db), asyncRoute(async (req, res) => {
    await run(
      db,
      `UPDATE user_sessions
       SET is_active = 0, revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND is_active = 1`,
      [req.user.id],
    )
    await run(
      db,
      `INSERT INTO user_activity_logs (user_id, action, ip_address, user_agent, metadata)
       VALUES (?, 'logout_all', ?, ?, ?)`,
      [req.user.id, null, null, JSON.stringify({ initiatedBy: 'self' })],
    )
    return res.json({ ok: true })
  }))

  router.get('/me', requireAuth(db), asyncRoute(async (req, res) => {
    await refreshVerificationStatus(db, req.user.id)
    const user = await get(
      db,
      `SELECT
        id, role, email, phone, is_approved, is_banned, is_frozen, banned_until, created_at,
        display_name, bio, avatar_path, verification_status, blue_badge, badge_style, vip_level, profile_color, profile_badge,
        CASE WHEN avatar_blob_base64 IS NOT NULL AND avatar_blob_base64 <> '' THEN 1 ELSE 0 END AS has_avatar_blob,
        phone_verified, identity_submitted, verification_ready_at,
        country, preferred_language, preferred_currency, deposit_privacy_enabled, referral_code, total_deposit, points,
        invited_by, referred_by, is_owner, last_login_at, last_ip, last_user_agent
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id],
    )
    const safeUser = toSafeUser(user)
    return res.json({ user: safeUser })
  }))

  router.get('/me/recovery-code', requireAuth(db), asyncRoute(async (req, res) => {
    const row = await ensureUserRecoveryCode(db, req.user.id)
    const isApproved = Number(req.user?.is_approved || 0) === 1
    if (!isApproved) {
      return res.json({ shouldShow: false, recoveryCode: null, acknowledged: Boolean(row?.acknowledged_at) })
    }
    const acknowledged = Boolean(row?.acknowledged_at)
    return res.json({
      shouldShow: !acknowledged,
      // Keep the code retrievable after acknowledgment so users can
      // reopen/copy it later from profile settings when needed.
      recoveryCode: row?.recovery_code ? String(row.recovery_code) : null,
      acknowledged,
    })
  }))

  router.post('/me/recovery-code/ack', requireAuth(db), asyncRoute(async (req, res) => {
    await ensureUserRecoveryCode(db, req.user.id)
    await run(
      db,
      `UPDATE user_recovery_codes
       SET acknowledged_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND acknowledged_at IS NULL`,
      [req.user.id],
    )
    return res.json({ ok: true })
  }))

  router.post('/recovery-code/request-review', asyncRoute(async (req, res) => {
    const recoveryCode = normalizeRecoveryCode(req.body?.recoveryCode)
    const contact = normalizeRecoveryContact(req.body?.contactValue)
    if (!recoveryCode) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (!/^[A-Z2-9-]{16,40}$/.test(recoveryCode)) {
      return res.status(400).json({ error: 'CODE_INVALID' })
    }
    if (!contact.value) {
      return res.status(400).json({ error: 'CONTACT_REQUIRED' })
    }
    if (contact.channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.value)) {
      return res.status(400).json({ error: 'CONTACT_INVALID' })
    }
    if (contact.channel === 'phone' && !/^\+?[0-9]{6,20}$/.test(contact.value)) {
      return res.status(400).json({ error: 'CONTACT_INVALID' })
    }

    const codeRow = await get(
      db,
      `SELECT user_id
       FROM user_recovery_codes
       WHERE recovery_code = ?
       LIMIT 1`,
      [recoveryCode],
    )
    if (!codeRow?.user_id) {
      return res.status(400).json({ error: 'CODE_INVALID' })
    }

    const pending = await get(
      db,
      `SELECT id
       FROM recovery_code_review_requests
       WHERE user_id = ? AND request_status = 'pending'
       LIMIT 1`,
      [codeRow.user_id],
    )
    if (pending?.id) {
      return res.status(409).json({ error: 'RECOVERY_REQUEST_EXISTS' })
    }

    const { ipAddress, userAgent } = getClientMeta(req)
    await run(
      db,
      `INSERT INTO recovery_code_review_requests (
         user_id,
         recovery_code,
         request_status,
         contact_channel,
         contact_value,
         submitted_ip,
         submitted_user_agent
       ) VALUES (?, ?, 'pending', ?, ?, ?, ?)` ,
      [codeRow.user_id, recoveryCode, contact.channel, contact.value, ipAddress || null, userAgent || null],
    )
    return res.json({ ok: true, status: 'pending' })
  }))

  router.post('/forgot-password/send-code', asyncRoute(async (req, res) => {
    const identifier = String(req.body?.identifier || '').trim()
    if (!identifier) return res.status(400).json({ error: 'INVALID_INPUT' })

    const isEmail = identifier.includes('@')
    const user = await get(
      db,
      isEmail
        ? `SELECT id, email, phone FROM users WHERE email = ? LIMIT 1`
        : `SELECT id, email, phone FROM users WHERE phone = ? LIMIT 1`,
      [identifier],
    )

    // Do not leak whether account exists.
    if (!user) return res.json({ ok: true, mode: 'masked' })

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    const channel = isEmail ? 'email' : 'phone'

    await run(
      db,
      `INSERT INTO password_reset_codes (user_id, identifier, channel, code_hash, expires_at)
       VALUES (?, ?, ?, ?, (CURRENT_TIMESTAMP + INTERVAL '10 minutes'))`,
      [user.id, identifier, channel, codeHash],
    )

    const delivery = isEmail
      ? await sendPasswordResetEmail(identifier, code)
      : await sendPasswordResetSms(identifier, code)

    return res.json({
      ok: true,
      mode: delivery.mode,
      dev_code: canExposeDevCode() && delivery.mode === 'mock' ? code : undefined,
    })
  }))

  router.post('/forgot-password/reset', asyncRoute(async (req, res) => {
    const identifier = String(req.body?.identifier || '').trim()
    const code = String(req.body?.code || '').trim()
    const newPassword = String(req.body?.newPassword || '')
    if (!identifier || !code || newPassword.length < 6) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const isEmail = identifier.includes('@')
    const user = await get(
      db,
      isEmail
        ? `SELECT id FROM users WHERE email = ? LIMIT 1`
        : `SELECT id FROM users WHERE phone = ? LIMIT 1`,
      [identifier],
    )
    if (!user) return res.status(400).json({ error: 'CODE_INVALID' })

    const codeHash = crypto.createHash('sha256').update(code).digest('hex')
    const row = await get(
      db,
      `SELECT id
       FROM password_reset_codes
       WHERE user_id = ?
         AND identifier = ?
         AND code_hash = ?
         AND used_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY id DESC LIMIT 1`,
      [user.id, identifier, codeHash],
    )
    if (!row) return res.status(400).json({ error: 'CODE_INVALID' })

    const passwordHash = await hashPassword(newPassword)
    await run(db, `UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, user.id])
    await run(db, `UPDATE password_reset_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id])
    return res.json({ ok: true })
  }))

  router.get('/me/approved', requireAuth(db), requireApproved(), async (req, res) => {
    return res.json({ ok: true, user: req.user })
  })

  return router
}
