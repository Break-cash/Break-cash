import twilio from 'twilio'

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  return twilio(sid, token)
}

export async function sendPhoneCodeSms(toPhone, code) {
  const from = process.env.TWILIO_FROM_NUMBER
  const client = getTwilioClient()

  if (!client || !from) {
    // وضع تطوير: بدون إرسال فعلي
    return { mode: 'mock', code }
  }

  await client.messages.create({
    body: `BREAK CASH verification code: ${code}`,
    from,
    to: toPhone,
  })
  return { mode: 'twilio' }
}

export async function sendPasswordResetSms(toPhone, code) {
  const from = process.env.TWILIO_FROM_NUMBER
  const client = getTwilioClient()

  if (!client || !from) {
    // Development fallback when Twilio is not configured.
    return { mode: 'mock', code }
  }

  await client.messages.create({
    body: `BREAK CASH password reset code: ${code}`,
    from,
    to: toPhone,
  })
  return { mode: 'twilio' }
}

