import nodemailer from 'nodemailer'

let cachedTransporter = null

function getTransporter() {
  if (cachedTransporter) return cachedTransporter
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  return cachedTransporter
}

export async function sendPasswordResetEmail(toEmail, code) {
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER
  const transporter = getTransporter()

  if (!transporter || !fromAddress) {
    return { mode: 'mock', code }
  }
  const from = fromAddress.includes('<') ? fromAddress : `BREAK CASH <${fromAddress}>`

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'BREAK CASH Password Reset Code',
    text: `Your BREAK CASH password reset code is: ${code}\nThis code expires in 10 minutes.`,
  })
  return { mode: 'smtp' }
}

export async function sendSupportTicketEmail(payload) {
  const supportEmail = String(process.env.SUPPORT_EMAIL || 'support@breakcash.cash').trim()
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER
  const transporter = getTransporter()

  if (!transporter || !fromAddress || !supportEmail) {
    return { mode: 'mock' }
  }

  const from = fromAddress.includes('<') ? fromAddress : `BREAK CASH <${fromAddress}>`
  const userLabel = payload.userDisplayName || payload.userEmail || payload.userPhone || `#${payload.userId}`

  await transporter.sendMail({
    from,
    to: supportEmail,
    replyTo: payload.userEmail || undefined,
    subject: `[BreakCash Support] #${payload.ticketId} ${payload.subject}`,
    text: [
      `Ticket ID: ${payload.ticketId}`,
      `User: ${userLabel}`,
      `User ID: ${payload.userId}`,
      `Email: ${payload.userEmail || '-'}`,
      `Phone: ${payload.userPhone || '-'}`,
      '',
      payload.message,
    ].join('\n'),
  })

  return { mode: 'smtp' }
}
