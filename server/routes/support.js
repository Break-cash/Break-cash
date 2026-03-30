import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import { all, get, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { publishLiveUpdate } from '../services/live-updates.js'
import { sendSupportTicketEmail } from '../services/email.js'
import { persistUploadedAsset } from '../services/uploaded-assets.js'

const USER_ARCHIVE_AFTER_HOURS = 72
const MAX_SUPPORT_ATTACHMENTS = 4
const MAX_SUPPORT_ATTACHMENT_BYTES = 10 * 1024 * 1024

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res)
  } catch (error) {
    console.error('[support-route-error]', error)
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Support service failed.' })
  }
}

function normalizeTicketStatus(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (['open', 'in_progress', 'resolved', 'closed'].includes(normalized)) return normalized
  return 'open'
}

function normalizeBody(value, max = 6000) {
  return String(value || '').trim().slice(0, max)
}

function getArchiveEligibleAt(baseValue) {
  const baseMs = Date.parse(String(baseValue || ''))
  if (!Number.isFinite(baseMs)) return null
  return new Date(baseMs + USER_ARCHIVE_AFTER_HOURS * 60 * 60 * 1000).toISOString()
}

function canUserArchiveTicket(ticket) {
  const eligibleAt = getArchiveEligibleAt(ticket?.latest_message_at || ticket?.updated_at || ticket?.created_at)
  if (!eligibleAt) return false
  return Date.now() >= Date.parse(eligibleAt)
}

async function createAdminSupportNotifications(db, ticket, creator) {
  const recipients = await all(
    db,
    `SELECT DISTINCT u.id
     FROM users u
     LEFT JOIN permissions p ON p.user_id = u.id
     WHERE COALESCE(u.is_banned, 0) = 0
       AND (
         u.role = 'owner'
         OR p.permission = 'support.manage'
       )`,
  )
  const title = 'طلب مساعدة جديد'
  const body = `طلب دعم جديد #${ticket.id} من ${creator.display_name || creator.email || creator.phone || `#${creator.id}`}.`
  for (const row of recipients) {
    const userId = Number(row?.id || 0)
    if (!userId) continue
    await run(db, `INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)`, [userId, title, body])
    publishLiveUpdate({
      type: 'notification_created',
      scope: 'user',
      userId,
      source: 'support',
      key: 'support_new_request',
      title,
      body,
    })
  }
  publishLiveUpdate({ type: 'support_queue_updated', scope: 'global', source: 'support', key: 'tickets' })
}

async function createUserSupportNotification(db, userId, title, body, key) {
  await run(db, `INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)`, [userId, title, body])
  publishLiveUpdate({
    type: 'notification_created',
    scope: 'user',
    userId,
    source: 'support',
    key,
    title,
    body,
  })
}

async function createSupportMessage(db, { ticketId, senderUserId = null, senderRole, body = '' }) {
  const result = await run(
    db,
    `INSERT INTO support_messages (ticket_id, sender_user_id, sender_role, body)
     VALUES (?, ?, ?, ?)
     RETURNING id, ticket_id, sender_user_id, sender_role, body, created_at`,
    [ticketId, senderUserId, senderRole, body || null],
  )
  return result.rows?.[0] || null
}

async function createSupportAttachments(db, messageId, files) {
  const attachments = []
  for (const file of files || []) {
    const publicUrl = `/uploads/support/${path.basename(String(file.path || '')).replaceAll('\\', '/')}`
    await persistUploadedAsset(db, {
      publicUrl,
      absolutePath: file.path,
      mimeType: file.mimetype,
      originalName: file.originalname,
    }).catch(() => null)
    const result = await run(
      db,
      `INSERT INTO support_message_attachments (message_id, file_url, mime_type, original_name, byte_size)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, message_id, file_url, mime_type, original_name, byte_size, created_at`,
      [messageId, publicUrl, file.mimetype || null, file.originalname || null, Number(file.size || 0)],
    )
    attachments.push(result.rows?.[0] || null)
  }
  return attachments.filter(Boolean)
}

async function getTicketBase(db, ticketId) {
  return get(
    db,
    `SELECT st.id, st.user_id, st.subject, st.message, st.status,
            st.conversation_enabled, st.conversation_approved_at, st.conversation_approved_by, st.user_archived_at,
            st.email_delivery_status, st.email_delivery_error, st.resolved_at, st.created_at, st.updated_at,
            u.display_name, u.email, u.phone
     FROM support_tickets st
     INNER JOIN users u ON u.id = st.user_id
     WHERE st.id = ?
     LIMIT 1`,
    [ticketId],
  )
}

async function getTicketMessages(db, ticketId) {
  const messages = await all(
    db,
    `SELECT sm.id, sm.ticket_id, sm.sender_user_id, sm.sender_role, sm.body, sm.created_at,
            u.display_name AS sender_display_name
     FROM support_messages sm
     LEFT JOIN users u ON u.id = sm.sender_user_id
     WHERE sm.ticket_id = ?
     ORDER BY sm.id ASC`,
    [ticketId],
  )
  if (!messages.length) return []
  const attachments = await all(
    db,
    `SELECT id, message_id, file_url, mime_type, original_name, byte_size, created_at
     FROM support_message_attachments
     WHERE message_id IN (${messages.map(() => '?').join(', ')})
     ORDER BY id ASC`,
    messages.map((item) => item.id),
  )
  const attachmentsByMessageId = new Map()
  for (const item of attachments) {
    const key = Number(item.message_id || 0)
    const list = attachmentsByMessageId.get(key) || []
    list.push({
      id: Number(item.id || 0),
      file_url: String(item.file_url || ''),
      mime_type: item.mime_type || null,
      original_name: item.original_name || null,
      byte_size: Number(item.byte_size || 0),
      created_at: item.created_at || null,
    })
    attachmentsByMessageId.set(key, list)
  }
  return messages.map((item) => ({
    id: Number(item.id || 0),
    ticket_id: Number(item.ticket_id || 0),
    sender_user_id: item.sender_user_id == null ? null : Number(item.sender_user_id),
    sender_role: String(item.sender_role || 'user'),
    sender_display_name: item.sender_display_name || null,
    body: item.body || '',
    created_at: item.created_at || null,
    attachments: attachmentsByMessageId.get(Number(item.id || 0)) || [],
  }))
}

async function getTicketDetail(db, ticketId) {
  const ticket = await getTicketBase(db, ticketId)
  if (!ticket) return null
  const messages = await getTicketMessages(db, ticketId)
  const latestMessageAt = messages.length ? messages[messages.length - 1].created_at : ticket.updated_at || ticket.created_at
  return {
    id: Number(ticket.id || 0),
    user_id: Number(ticket.user_id || 0),
    subject: String(ticket.subject || ''),
    message: String(ticket.message || ''),
    status: normalizeTicketStatus(ticket.status),
    conversation_enabled: Number(ticket.conversation_enabled || 0) === 1,
    conversation_approved_at: ticket.conversation_approved_at || null,
    conversation_approved_by: ticket.conversation_approved_by == null ? null : Number(ticket.conversation_approved_by),
    user_archived_at: ticket.user_archived_at || null,
    email_delivery_status: ticket.email_delivery_status || null,
    email_delivery_error: ticket.email_delivery_error || null,
    resolved_at: ticket.resolved_at || null,
    created_at: ticket.created_at || null,
    updated_at: ticket.updated_at || null,
    latest_message_at: latestMessageAt,
    archive_eligible_at: getArchiveEligibleAt(latestMessageAt),
    can_user_archive: canUserArchiveTicket({ latest_message_at: latestMessageAt, updated_at: ticket.updated_at, created_at: ticket.created_at }),
    user: {
      id: Number(ticket.user_id || 0),
      display_name: ticket.display_name || null,
      email: ticket.email || null,
      phone: ticket.phone || null,
    },
    messages,
  }
}

function ensureTicketAccess(req, ticket) {
  if (!ticket) return { ok: false, status: 404, error: 'NOT_FOUND' }
  const isSupportAgent = req.user.role === 'owner' || req.user.role === 'admin'
  if (isSupportAgent) return { ok: true }
  if (Number(ticket.user_id || 0) !== Number(req.user.id || 0)) {
    return { ok: false, status: 403, error: 'FORBIDDEN' }
  }
  return { ok: true }
}

export function createSupportRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  const uploadsRoot = path.join(process.cwd(), 'server', 'uploads')
  const supportDir = path.join(uploadsRoot, 'support')
  fs.mkdirSync(supportDir, { recursive: true })
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, supportDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase()
        const safeExt = /^[.\w-]{0,12}$/.test(ext) ? ext : ''
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safeExt}`)
      },
    }),
    limits: {
      files: MAX_SUPPORT_ATTACHMENTS,
      fileSize: MAX_SUPPORT_ATTACHMENT_BYTES,
    },
  })

  router.get('/my', asyncRoute(async (req, res) => {
    const items = await all(
      db,
      `SELECT st.id, st.subject, st.message, st.status, st.conversation_enabled, st.conversation_approved_at,
              st.user_archived_at, st.created_at, st.updated_at, st.resolved_at,
              COALESCE(MAX(sm.created_at), st.updated_at, st.created_at) AS latest_message_at
       FROM support_tickets st
       LEFT JOIN support_messages sm ON sm.ticket_id = st.id
       WHERE st.user_id = ?
         AND st.user_archived_at IS NULL
       GROUP BY st.id
       ORDER BY st.id DESC
       LIMIT 50`,
      [req.user.id],
    )
    const normalized = items.map((item) => ({
      ...item,
      conversation_enabled: Number(item.conversation_enabled || 0) === 1,
      can_user_archive: canUserArchiveTicket(item),
      archive_eligible_at: getArchiveEligibleAt(item.latest_message_at || item.updated_at || item.created_at),
    }))
    return res.json({ items: normalized })
  }))

  router.get('/ticket/:id', asyncRoute(async (req, res) => {
    const detail = await getTicketDetail(db, Number(req.params.id || 0))
    if (!detail || Number(detail.user_id || 0) !== Number(req.user.id || 0)) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }
    if (detail.user_archived_at) return res.status(404).json({ error: 'NOT_FOUND' })
    return res.json({ item: detail })
  }))

  router.post('/create', upload.array('attachments', MAX_SUPPORT_ATTACHMENTS), asyncRoute(async (req, res) => {
    const subject = normalizeBody(req.body?.subject, 160)
    const message = normalizeBody(req.body?.message, 5000)
    if (!subject || !message) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const item = await get(
      db,
      `INSERT INTO support_tickets (user_id, subject, message)
       VALUES (?, ?, ?)
       RETURNING id, subject, message, status, conversation_enabled, created_at, updated_at, resolved_at`,
      [req.user.id, subject, message],
    )

    const supportMessage = await createSupportMessage(db, {
      ticketId: Number(item.id),
      senderUserId: req.user.id,
      senderRole: 'user',
      body: message,
    })
    await createSupportAttachments(db, Number(supportMessage?.id || 0), req.files || [])

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

    await createAdminSupportNotifications(db, item, req.user)
    return res.status(201).json({
      ok: true,
      item: await getTicketDetail(db, Number(item.id)),
    })
  }))

  router.post('/ticket/:id/message', upload.array('attachments', MAX_SUPPORT_ATTACHMENTS), asyncRoute(async (req, res) => {
    const ticketId = Number(req.params.id || 0)
    const ticket = await getTicketBase(db, ticketId)
    if (!ticket || Number(ticket.user_id || 0) !== Number(req.user.id || 0) || ticket.user_archived_at) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }
    if (Number(ticket.conversation_enabled || 0) !== 1) {
      return res.status(400).json({ error: 'SUPPORT_CONVERSATION_NOT_APPROVED' })
    }
    const body = normalizeBody(req.body?.message, 6000)
    const files = req.files || []
    if (!body && files.length === 0) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const messageRow = await createSupportMessage(db, {
      ticketId,
      senderUserId: req.user.id,
      senderRole: 'user',
      body,
    })
    await createSupportAttachments(db, Number(messageRow?.id || 0), files)
    await run(db, `UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [ticketId])
    publishLiveUpdate({ type: 'support_ticket_updated', scope: 'user', userId: req.user.id, source: 'support', key: `ticket:${ticketId}` })
    publishLiveUpdate({ type: 'support_queue_updated', scope: 'global', source: 'support', key: 'tickets' })
    return res.status(201).json({ ok: true, item: await getTicketDetail(db, ticketId) })
  }))

  router.post('/ticket/:id/archive', asyncRoute(async (req, res) => {
    const ticketId = Number(req.params.id || 0)
    const detail = await getTicketDetail(db, ticketId)
    if (!detail || Number(detail.user_id || 0) !== Number(req.user.id || 0) || detail.user_archived_at) {
      return res.status(404).json({ error: 'NOT_FOUND' })
    }
    if (!detail.can_user_archive) {
      return res.status(400).json({ error: 'SUPPORT_ARCHIVE_NOT_AVAILABLE_YET', archiveEligibleAt: detail.archive_eligible_at })
    }
    await run(
      db,
      `UPDATE support_tickets
       SET user_archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [ticketId, req.user.id],
    )
    return res.json({ ok: true })
  }))

  router.get('/admin/list', requirePermission(db, 'support.manage'), asyncRoute(async (_req, res) => {
    const items = await all(
      db,
      `SELECT st.id, st.subject, st.message, st.status, st.conversation_enabled, st.conversation_approved_at,
              st.user_archived_at, st.created_at, st.updated_at, st.resolved_at,
              st.email_delivery_status, st.email_delivery_error,
              u.id AS user_id, u.display_name, u.email, u.phone,
              COALESCE(MAX(sm.created_at), st.updated_at, st.created_at) AS latest_message_at,
              COUNT(sm.id) AS messages_count
       FROM support_tickets st
       INNER JOIN users u ON u.id = st.user_id
       LEFT JOIN support_messages sm ON sm.ticket_id = st.id
       GROUP BY st.id, u.id
       ORDER BY st.id DESC
       LIMIT 200`,
    )
    return res.json({
      items: items.map((item) => ({
        ...item,
        conversation_enabled: Number(item.conversation_enabled || 0) === 1,
        messages_count: Number(item.messages_count || 0),
      })),
    })
  }))

  router.get('/admin/ticket/:id', requirePermission(db, 'support.manage'), asyncRoute(async (req, res) => {
    const item = await getTicketDetail(db, Number(req.params.id || 0))
    if (!item) return res.status(404).json({ error: 'NOT_FOUND' })
    return res.json({ item })
  }))

  router.post('/admin/approve-conversation', requirePermission(db, 'support.manage'), asyncRoute(async (req, res) => {
    const ticketId = Number(req.body?.ticketId || 0)
    if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' })
    const ticket = await getTicketBase(db, ticketId)
    if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' })

    await run(
      db,
      `UPDATE support_tickets
       SET conversation_enabled = 1,
           conversation_approved_at = CURRENT_TIMESTAMP,
           conversation_approved_by = ?,
           status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, ticketId],
    )
    await createUserSupportNotification(
      db,
      Number(ticket.user_id),
      'تم فتح محادثة الدعم',
      `تمت الموافقة على متابعة طلب الدعم #${ticketId}. يمكنك الآن مراسلة فريق الدعم من داخل المحادثة.`,
      'support_conversation_approved',
    )
    publishLiveUpdate({ type: 'support_queue_updated', scope: 'global', source: 'support', key: 'tickets' })
    publishLiveUpdate({ type: 'support_ticket_updated', scope: 'user', userId: Number(ticket.user_id), source: 'support', key: `ticket:${ticketId}` })
    return res.json({ ok: true, item: await getTicketDetail(db, ticketId) })
  }))

  router.post('/admin/message', requirePermission(db, 'support.manage'), upload.array('attachments', MAX_SUPPORT_ATTACHMENTS), asyncRoute(async (req, res) => {
    const ticketId = Number(req.body?.ticketId || 0)
    const ticket = await getTicketBase(db, ticketId)
    if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' })
    if (Number(ticket.conversation_enabled || 0) !== 1) {
      return res.status(400).json({ error: 'SUPPORT_CONVERSATION_NOT_APPROVED' })
    }
    const body = normalizeBody(req.body?.message, 6000)
    const files = req.files || []
    if (!body && files.length === 0) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }

    const messageRow = await createSupportMessage(db, {
      ticketId,
      senderUserId: req.user.id,
      senderRole: 'support',
      body,
    })
    await createSupportAttachments(db, Number(messageRow?.id || 0), files)
    await run(db, `UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [ticketId])
    await createUserSupportNotification(
      db,
      Number(ticket.user_id),
      'رد جديد من الدعم',
      `يوجد رد جديد على طلب الدعم #${ticketId}.`,
      'support_new_reply',
    )
    publishLiveUpdate({ type: 'support_queue_updated', scope: 'global', source: 'support', key: 'tickets' })
    publishLiveUpdate({ type: 'support_ticket_updated', scope: 'user', userId: Number(ticket.user_id), source: 'support', key: `ticket:${ticketId}` })
    return res.status(201).json({ ok: true, item: await getTicketDetail(db, ticketId) })
  }))

  router.post('/admin/status', requirePermission(db, 'support.manage'), asyncRoute(async (req, res) => {
    const ticketId = Number(req.body?.ticketId || 0)
    const status = normalizeTicketStatus(req.body?.status)
    if (!ticketId) return res.status(400).json({ error: 'INVALID_TICKET' })
    await run(
      db,
      `UPDATE support_tickets
       SET status = ?,
           resolved_at = CASE WHEN ? IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, status, ticketId],
    )
    const ticket = await getTicketBase(db, ticketId)
    if (ticket) {
      await createUserSupportNotification(
        db,
        Number(ticket.user_id),
        'تم تحديث حالة طلب الدعم',
        `أصبحت حالة طلب الدعم #${ticketId}: ${status}.`,
        'support_status_updated',
      )
      publishLiveUpdate({ type: 'support_ticket_updated', scope: 'user', userId: Number(ticket.user_id), source: 'support', key: `ticket:${ticketId}` })
    }
    publishLiveUpdate({ type: 'support_queue_updated', scope: 'global', source: 'support', key: 'tickets' })
    return res.json({ ok: true })
  }))

  return router
}
