import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { sendSupportTicketEmail } from '../services/email.js'

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[support-route-error]', error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Support service failed.' })
  }
}

export function createSupportRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/my', asyncRoute(async (req, res) => {
    const items = await all(
      db,
      `SELECT id, subject, message, status, created_at, updated_at, resolved_at
       FROM support_tickets
       WHERE user_id = ?
       ORDER BY id DESC
       LIMIT 50`,
      [req.user.id],
    )
    return res.json({ items })
  }))

  router.post('/create', asyncRoute(async (req, res) => {
    const subject = String(req.body?.subject || '').trim().slice(0, 160)
    const message = String(req.body?.message || '').trim().slice(0, 5000)
    if (!subject || !message) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const item = await get(
      db,
      `INSERT INTO support_tickets (user_id, subject, message)
       VALUES (?, ?, ?)
       RETURNING id, subject, message, status, created_at, updated_at, resolved_at`,
      [req.user.id, subject, message],
    )

    let deliveryStatus = 'mock'
    let deliveryError = null
    try {
      const result = await sendSupportTicketEmail({
        ticketId: Number(item.id),
        subject,
        message,
        userId: req.user.id,
        userDisplayName: req.user.display_name || '',
        userEmail: req.user.email || '',
        userPhone: req.user.phone || '',
      })
      deliveryStatus = String(result.mode || 'mock')
    } catch (error) {
      deliveryStatus = 'failed'
      deliveryError = error instanceof Error ? error.message : 'EMAIL_SEND_FAILED'
    }

    await run(
      db,
      `UPDATE support_tickets
       SET email_delivery_status = ?, email_delivery_error = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [deliveryStatus, deliveryError, item.id],
    )

    return res.status(201).json({
      ok: true,
      item: {
        ...item,
        email_delivery_status: deliveryStatus,
        email_delivery_error: deliveryError,
      },
    })
  }))

  router.get('/admin/list', requirePermission(db, 'support.manage'), asyncRoute(async (_req, res) => {
    const items = await all(
      db,
      `SELECT
         st.id, st.subject, st.message, st.status, st.created_at, st.updated_at, st.resolved_at,
         st.email_delivery_status, st.email_delivery_error,
         u.id AS user_id, u.display_name, u.email, u.phone
       FROM support_tickets st
       INNER JOIN users u ON u.id = st.user_id
       ORDER BY st.id DESC
       LIMIT 200`,
      [],
    )
    return res.json({ items })
  }))

  router.post('/admin/status', requirePermission(db, 'support.manage'), asyncRoute(async (req, res) => {
    const ticketId = Number(req.body?.ticketId)
    const status = String(req.body?.status || '').trim().toLowerCase()
    if (!Number.isFinite(ticketId) || ticketId <= 0) return res.status(400).json({ error: 'INVALID_TICKET' })
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS' })
    }

    await run(
      db,
      `UPDATE support_tickets
       SET status = ?, resolved_at = CASE WHEN ? IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE NULL END, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, status, ticketId],
    )
    return res.json({ ok: true })
  }))

  return router
}
