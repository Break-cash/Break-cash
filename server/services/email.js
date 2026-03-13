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
