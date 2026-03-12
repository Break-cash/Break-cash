import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { get, run } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
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

function toPublicPath(absPath) {
  const rel = path.relative(path.join(process.cwd(), 'server'), absPath).replaceAll('\\', '/')
  return `/uploads/${rel.replace(/^uploads\//, '')}`
}

function normalizeProfile(row) {
  if (!row) return null
  return {
    ...row,
    avatar_url: row.avatar_path ? toPublicPath(row.avatar_path) : null,
    badge_color: Number(row.blue_badge) === 1 ? 'blue' : row.verification_status === 'verified' ? 'green' : 'orange',
  }
}

async function fetchProfile(db, userId) {
  await refreshVerificationStatus(db, userId)
  const row = await get(
    db,
    `SELECT
      id, email, phone, role, is_approved, is_banned, created_at,
      display_name, avatar_path, verification_status, blue_badge, vip_level,
      phone_verified, identity_submitted, verification_ready_at
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

    const email = hasEmail ? (String(req.body?.email || '').trim() || null) : current.email
    const phone = hasPhone ? (String(req.body?.phone || '').trim() || null) : current.phone
    const displayName = hasDisplayName
      ? String(req.body?.displayName || '').trim() || null
      : current.display_name || null

    await run(
      db,
      `UPDATE users SET email = ?, phone = ?, display_name = ? WHERE id = ?`,
      [email, phone, displayName, req.user.id],
    )
    const profile = await fetchProfile(db, req.user.id)
    return res.json({ profile })
  }))

  router.post('/avatar', upload.single('avatar'), asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' })
    await run(db, `UPDATE users SET avatar_path = ? WHERE id = ?`, [req.file.path, req.user.id])
    const profile = await fetchProfile(db, req.user.id)
    return res.json({ ok: true, profile })
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
        `INSERT INTO kyc_submissions (user_id, id_document_path, selfie_path, status)
         VALUES (?, ?, ?, 'pending')`,
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
    return res.json({ ok: true, mode: smsResult.mode, dev_code: smsResult.mode === 'mock' ? smsResult.code : undefined })
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

  // صلاحية خاصة: المالك فقط يمنح/يسحب الشارة الزرقاء
  router.post('/badge/blue', requireRole('owner'), asyncRoute(async (req, res) => {
    const userId = Number(req.body?.userId)
    const enabled = Number(req.body?.enabled) ? 1 : 0
    if (!Number.isFinite(userId) || userId <= 0) return res.status(400).json({ error: 'INVALID_USER' })

    await run(db, `UPDATE users SET blue_badge = ? WHERE id = ?`, [enabled, userId])
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

  return router
}
