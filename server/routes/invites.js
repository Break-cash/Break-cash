import { Router } from 'express'
import crypto from 'node:crypto'
import { all, get, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'

function makeInviteCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

export function createInvitesRouter(db) {
  const router = Router()

  router.post(
    '/generate',
    requireAuth(db),
    requirePermission(db, 'manage_invites'),
    async (req, res) => {
      const expiresInHours = Number(req.body?.expiresInHours || 72)
      const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      const code = makeInviteCode()
      await run(
        db,
        `INSERT INTO invites (code, created_by, expires_at, is_active) VALUES (?, ?, ?, 1)`,
        [code, req.user.id, expiresAt],
      )
      return res.status(201).json({ code, expiresAt, joinUrl: `/join/${code}` })
    },
  )

  router.get(
    '/list',
    requireAuth(db),
    requirePermission(db, 'manage_invites'),
    async (_req, res) => {
      const rows = await all(
        db,
        `SELECT id, code, created_by, used_by, used_at, expires_at, is_active, created_at
         FROM invites ORDER BY id DESC`,
      )
      return res.json({ invites: rows })
    },
  )

  router.get('/validate/:code', async (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase()
    if (!code) return res.status(400).json({ error: 'INVALID_CODE' })
    const invite = await get(
      db,
      `SELECT id, code, is_active, used_by, expires_at FROM invites WHERE code = ? LIMIT 1`,
      [code],
    )
    if (!invite) return res.status(404).json({ error: 'INVITE_NOT_FOUND' })
    const expired = invite.expires_at ? Date.now() > Date.parse(invite.expires_at) : false
    const valid = Number(invite.is_active) === 1 && !invite.used_by && !expired
    return res.json({ valid, invite: { code: invite.code, expiresAt: invite.expires_at } })
  })

  router.post('/redeem', requireAuth(db), async (req, res) => {
    const code = String(req.body?.code || '').trim().toUpperCase()
    if (!code) return res.status(400).json({ error: 'INVALID_CODE' })

    const invite = await get(
      db,
      `SELECT id, is_active, used_by, expires_at FROM invites WHERE code = ? LIMIT 1`,
      [code],
    )
    if (!invite) return res.status(404).json({ error: 'INVITE_NOT_FOUND' })
    if (Number(invite.is_active) !== 1 || invite.used_by) {
      return res.status(400).json({ error: 'INVITE_UNAVAILABLE' })
    }
    if (invite.expires_at && Date.now() > Date.parse(invite.expires_at)) {
      return res.status(400).json({ error: 'INVITE_EXPIRED' })
    }

    await run(
      db,
      `UPDATE invites SET used_by=?, used_at=datetime('now'), is_active=0 WHERE id=?`,
      [req.user.id, invite.id],
    )
    await run(db, `UPDATE users SET is_approved = 1 WHERE id = ?`, [req.user.id])
    return res.json({ ok: true })
  })

  router.post(
    '/revoke/:id',
    requireAuth(db),
    requirePermission(db, 'manage_invites'),
    async (req, res) => {
      await run(db, `UPDATE invites SET is_active = 0 WHERE id = ?`, [Number(req.params.id)])
      return res.json({ ok: true })
    },
  )

  return router
}
