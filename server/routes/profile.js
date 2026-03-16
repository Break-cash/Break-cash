import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { get, run } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  PROFILE_BADGE_VALUES,
  PROFILE_COLOR_VALUES,
  isAllowedProfileBadge,
  isAllowedProfileColor,
  normalizeNullableEnum,
} from '../services/premium-identity.js'
import { sendPhoneCodeSms } from '../services/sms.js'
import { refreshVerificationStatus, scheduleVerificationIfEligible } from '../services/verification.js'

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[profile-route-error]', error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Profile service failed.' })
  }
}

const uploadsRoot = path.join(process.cwd(), 'server', 'uploads')
const avatarsDir = path.join(uploadsRoot, 'avatars')
const kycDir = path.join(uploadsRoot, 'kyc')

fs.mkdirSync(avatarsDir, { recursive: true })
fs.mkdirSync(kycDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === 'avatar') cb(null, avatarsDir)
    else cb(null, kycDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg'
    cb(null, `${req.user.id}_${Date.now()}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
})

async function handleSingleUpload(req, res, fieldName) {
  await new Promise((resolve, reject) => {
    upload.single(fieldName)(req, res, (error) => {
      if (error) return reject(error)
      return resolve(null)
    })
  }).catch((error) => {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'FILE_TOO_LARGE' })
      }
    }
    return res.status(400).json({ error: 'UPLOAD_FAILED' })
  })
}

function toPublicPath(absPath) {
  const rel = path.relative(path.join(process.cwd(), 'server'), absPath).replaceAll('\\', '/')
  return `/uploads/${rel.replace(/^uploads\//, '')}`
}

function normalizeProfile(row) {
  if (!row) return null
  return {
    ...row,
    avatar_url: row.avatar_path ? toPublicPath(row.avatar_path) : null,
    badge_color: Number(row.blue_badge) === 1 ? 'blue' : row.verification_status === 'verified' ? 'gold' : 'none',
  }
}

function canExposeDevCode() {
  return String(process.env.ALLOW_DEV_CODE || '').trim() === '1'
}

async function fetchProfile(db, userId) {
  await refreshVerificationStatus(db, userId)
  const row = await get(
    db,
    `SELECT
      id, email, phone, role, is_approved, is_banned, is_frozen, created_at,
      display_name, bio, avatar_path, verification_status, blue_badge, vip_level, profile_color, profile_badge,
      phone_verified, identity_submitted, verification_ready_at,
      referral_code, invited_by, referred_by, total_deposit, points, is_owner
     FROM users WHERE id = ? LIMIT 1`,
    [userId],
  )
  return normalizeProfile(row)
}

export function createProfileRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/', asyncRoute(async (req, res) => {
    const profile = await fetchProfile(db, req.user.id)
    if (req.user.role !== 'owner') {
      profile.email = null
      profile.phone = null
    }
    return res.json({ profile })
  }))

  router.post('/update', asyncRoute(async (req, res) => {
    const current = await fetchProfile(db, req.user.id)

    const hasEmail = Object.prototype.hasOwnProperty.call(req.body || {}, 'email')
    const hasPhone = Object.prototype.hasOwnProperty.call(req.body || {}, 'phone')
    const hasDisplayName = Object.prototype.hasOwnProperty.call(req.body || {}, 'displayName')
    const hasBio = Object.prototype.hasOwnProperty.call(req.body || {}, 'bio')

    const email = hasEmail ? (String(req.body?.email || '').trim() || null) : current.email
    const phone = hasPhone ? (String(req.body?.phone || '').trim() || null) : current.phone
    const displayName = hasDisplayName
      ? String(req.body?.displayName || '').trim() || null
      : current.display_name || null
    const bio = hasBio
      ? String(req.body?.bio || '').trim().slice(0, 120) || null
      : current.bio || null

    await run(
      db,
      `UPDATE users SET email = ?, phone = ?, display_name = ?, bio = ? WHERE id = ?`,
      [email, phone, displayName, bio, req.user.id],
    )
    const profile = await fetchProfile(db, req.user.id)
    return res.json({ profile })
  }))

  router.post('/avatar', asyncRoute(async (req, res) => {
    await handleSingleUpload(req, res, 'avatar')
    if (res.headersSent) return
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' })
    const mime = String(req.file.mimetype || '').toLowerCase()
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'INVALID_FILE_TYPE' })
    }
    await run(db, `UPDATE users SET avatar_path = ? WHERE id = ?`, [req.file.path, req.user.id])
    const profile = await fetchProfile(db, req.user.id)
    return res.json({ ok: true, profile })
  }))

  router.post('/avatar/user', requireRole('owner'), asyncRoute(async (req, res) => {
    await handleSingleUpload(req, res, 'avatar')
    if (res.headersSent) return
    const userId = Number(req.body?.userId)
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' })
    const mime = String(req.file.mimetype || '').toLowerCase()
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'INVALID_FILE_TYPE' })
    }

    await run(db, `UPDATE users SET avatar_path = ? WHERE id = ?`, [req.file.path, userId])
    const user = await fetchProfile(db, userId)
    if (!user) return res.status(404).json({ error: 'NOT_FOUND' })
    return res.json({ ok: true, user })
  }))

  router.post(
    '/kyc-upload',
    upload.fields([
      { name: 'idDocument', maxCount: 1 },
      { name: 'selfie', maxCount: 1 },
    ]),
    asyncRoute(async (req, res) => {
      const files = req.files || {}
      const idDoc = files.idDocument?.[0]
      const selfie = files.selfie?.[0]
      if (!idDoc || !selfie) return res.status(400).json({ error: 'FILES_REQUIRED' })

      await run(
        db,
        `INSERT INTO kyc_submissions (user_id, id_document_path, selfie_path, review_status, auto_review_at)
         VALUES (?, ?, ?, 'pending', NULL)`,
        [req.user.id, idDoc.path, selfie.path],
      )
      await run(
        db,
        `UPDATE users
         SET identity_submitted = 1,
             verification_status = CASE
               WHEN verification_status = 'verified' THEN 'verified'
               ELSE 'pending'
             END
         WHERE id = ?`,
        [req.user.id],
      )
      const delay = await scheduleVerificationIfEligible(db, req.user.id)
      const profile = await fetchProfile(db, req.user.id)
      return res.json({ ok: true, delay_minutes: delay, profile })
    }),
  )

  router.post('/send-phone-code', asyncRoute(async (req, res) => {
    const phone = String(req.body?.phone || '').trim()
    if (!phone) return res.status(400).json({ error: 'INVALID_PHONE' })

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await run(
      db,
      `INSERT INTO phone_verification_codes (user_id, phone, code, expires_at)
       VALUES (?, ?, ?, datetime('now', '+10 minutes'))`,
      [req.user.id, phone, code],
    )

    const smsResult = await sendPhoneCodeSms(phone, code)
    return res.json({
      ok: true,
      mode: smsResult.mode,
      dev_code: canExposeDevCode() && smsResult.mode === 'mock' ? smsResult.code : undefined,
    })
  }))

  router.post('/verify-phone-code', asyncRoute(async (req, res) => {
    const phone = String(req.body?.phone || '').trim()
    const code = String(req.body?.code || '').trim()
    if (!phone || !code) return res.status(400).json({ error: 'INVALID_INPUT' })

    const row = await get(
      db,
      `SELECT id, code, expires_at, used_at
       FROM phone_verification_codes
       WHERE user_id = ? AND phone = ?
       ORDER BY id DESC LIMIT 1`,
      [req.user.id, phone],
    )
    if (!row) return res.status(400).json({ error: 'CODE_NOT_FOUND' })
    if (row.used_at) return res.status(400).json({ error: 'CODE_ALREADY_USED' })
    if (Date.now() > Date.parse(row.expires_at)) return res.status(400).json({ error: 'CODE_EXPIRED' })
    if (String(row.code) !== code) return res.status(400).json({ error: 'CODE_INVALID' })

    await run(
      db,
      `UPDATE phone_verification_codes SET used_at = datetime('now') WHERE id = ?`,
      [row.id],
    )
    await run(
      db,
      `UPDATE users
       SET phone = ?, phone_verified = 1
       WHERE id = ?`,
      [phone, req.user.id],
    )

    const delay = await scheduleVerificationIfEligible(db, req.user.id)
    const profile = await fetchProfile(db, req.user.id)
    return res.json({ ok: true, delay_minutes: delay, profile })
  }))

  // صلاحية خاصة: المالك فقط يمنح/يسحب الشارات الاحترافية (زرقاء/ذهبية)
  router.post('/badge/blue', requireRole('owner'), asyncRoute(async (req, res) => {
    const userId = Number(req.body?.userId)
    const enabled = Number(req.body?.enabled) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_USER' })

    await run(db, `UPDATE users SET blue_badge = ? WHERE id = ?`, [enabled, userId])
    const row = await fetchProfile(db, userId)
    return res.json({ ok: true, user: row })
  }))

  router.post('/badge/style', requireRole('owner'), asyncRoute(async (req, res) => {
    const userId = Number(req.body?.userId)
    const style = String(req.body?.style || 'none').trim().toLowerCase()
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_USER' })
    if (!['none', 'blue', 'gold'].includes(style)) return res.status(400).json({ error: 'INVALID_INPUT' })

    if (style === 'blue') {
      await run(db, `UPDATE users SET blue_badge = 1, verification_status = 'verified' WHERE id = ?`, [userId])
    } else if (style === 'gold') {
      await run(db, `UPDATE users SET blue_badge = 0, verification_status = 'verified' WHERE id = ?`, [userId])
    } else {
      await run(db, `UPDATE users SET blue_badge = 0, verification_status = 'unverified' WHERE id = ?`, [userId])
    }

    const row = await fetchProfile(db, userId)
    return res.json({ ok: true, user: row })
  }))

  router.post('/vip-level', requireRole('owner'), asyncRoute(async (req, res) => {
    const userId = Number(req.body?.userId)
    const vipLevel = Number(req.body?.vipLevel)
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_USER' })
    if (!Number.isInteger(vipLevel) || vipLevel < 0 || vipLevel > 5) {
      return res.status(400).json({ error: 'INVALID_VIP_LEVEL' })
    }

    await run(db, `UPDATE users SET vip_level = ? WHERE id = ?`, [vipLevel, userId])
    const row = await fetchProfile(db, userId)
    return res.json({ ok: true, user: row })
  }))

  router.get('/premium-identity/options', requireRole('owner'), asyncRoute(async (_req, res) => {
    return res.json({
      profileColors: PROFILE_COLOR_VALUES,
      profileBadges: PROFILE_BADGE_VALUES,
    })
  }))

  router.post('/premium-identity', requireRole('owner'), asyncRoute(async (req, res) => {
    const userId = Number(req.body?.userId)
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'INVALID_USER' })
    }
    const hasProfileColor = Object.prototype.hasOwnProperty.call(req.body || {}, 'profileColor')
    const hasProfileBadge = Object.prototype.hasOwnProperty.call(req.body || {}, 'profileBadge')
    if (!hasProfileColor && !hasProfileBadge) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const currentUser = await get(
      db,
      `SELECT id, profile_color, profile_badge FROM users WHERE id = ? LIMIT 1`,
      [userId],
    )
    if (!currentUser) return res.status(404).json({ error: 'NOT_FOUND' })

    let nextProfileColor = currentUser.profile_color
    let nextProfileBadge = currentUser.profile_badge

    if (hasProfileColor) {
      nextProfileColor = normalizeNullableEnum(req.body?.profileColor)
      if (nextProfileColor !== null && !isAllowedProfileColor(nextProfileColor)) {
        return res.status(400).json({ error: 'INVALID_PROFILE_COLOR' })
      }
    }
    if (hasProfileBadge) {
      nextProfileBadge = normalizeNullableEnum(req.body?.profileBadge)
      if (nextProfileBadge !== null && !isAllowedProfileBadge(nextProfileBadge)) {
        return res.status(400).json({ error: 'INVALID_PROFILE_BADGE' })
      }
    }

    await run(
      db,
      `UPDATE users SET profile_color = ?, profile_badge = ? WHERE id = ?`,
      [nextProfileColor, nextProfileBadge, userId],
    )

    const row = await fetchProfile(db, userId)
    return res.json({ ok: true, user: row })
  }))

  return router
}
