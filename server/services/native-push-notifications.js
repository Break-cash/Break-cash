import { getApps, cert, initializeApp } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'
import { all, get, run } from '../db.js'

let firebaseApp = null

function readFirebaseServiceAccount() {
  const inlineJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim()
  if (inlineJson) {
    try {
      return JSON.parse(inlineJson)
    } catch {
      return null
    }
  }

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim()
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim()
  const privateKey = String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim()
  if (!projectId || !clientEmail || !privateKey) return null

  return {
    projectId,
    clientEmail,
    privateKey,
  }
}

function getFirebaseMessaging() {
  const serviceAccount = readFirebaseServiceAccount()
  if (!serviceAccount) return null

  if (!firebaseApp) {
    firebaseApp = getApps()[0] || initializeApp({
      credential: cert(serviceAccount),
    })
  }

  return getMessaging(firebaseApp)
}

function isValidNativeToken(token) {
  const normalized = String(token || '').trim()
  return normalized.length >= 32 && normalized.length <= 4096
}

export async function getUserNativePushStatus(db, userId) {
  const row = await get(
    db,
    `SELECT COUNT(*) AS count
     FROM user_native_push_tokens
     WHERE user_id = ? AND is_active = 1`,
    [userId],
  )
  return { subscribed: Number(row?.count || 0) > 0 }
}

export async function saveUserNativePushToken(db, userId, token, platform = 'android', userAgent = '') {
  const normalizedToken = String(token || '').trim()
  if (!isValidNativeToken(normalizedToken)) throw new Error('INVALID_NATIVE_PUSH_TOKEN')

  await run(
    db,
    `INSERT INTO user_native_push_tokens (
      user_id, device_token, platform, user_agent, is_active, failure_count, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(device_token) DO UPDATE SET
      user_id = excluded.user_id,
      platform = excluded.platform,
      user_agent = excluded.user_agent,
      is_active = 1,
      failure_count = 0,
      updated_at = CURRENT_TIMESTAMP`,
    [userId, normalizedToken, String(platform || 'android').slice(0, 40), String(userAgent || '').slice(0, 500)],
  )

  return { ok: true }
}

export async function deactivateUserNativePushToken(db, userId, token) {
  await run(
    db,
    `UPDATE user_native_push_tokens
     SET is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND device_token = ?`,
    [userId, String(token || '').trim()],
  )
  return { ok: true }
}

export async function deactivateAllUserNativePushTokens(db, userId) {
  await run(
    db,
    `UPDATE user_native_push_tokens
     SET is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [userId],
  )
  return { ok: true }
}

async function markNativeDeliverySuccess(db, id) {
  await run(
    db,
    `UPDATE user_native_push_tokens
     SET last_success_at = CURRENT_TIMESTAMP, failure_count = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id],
  )
}

async function markNativeDeliveryFailure(db, id, deactivate = false) {
  await run(
    db,
    `UPDATE user_native_push_tokens
     SET last_failure_at = CURRENT_TIMESTAMP,
         failure_count = COALESCE(failure_count, 0) + 1,
         is_active = CASE WHEN ? = 1 THEN 0 ELSE is_active END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [deactivate ? 1 : 0, id],
  )
}

function buildNativePayload(payload = {}) {
  return {
    notification: {
      title: String(payload.title || '').trim() || 'Break Cash',
      body: String(payload.body || '').trim(),
    },
    data: Object.entries(payload.data && typeof payload.data === 'object' ? payload.data : {}).reduce((acc, [key, value]) => {
      acc[String(key)] = String(value ?? '')
      return acc
    }, {
      url: String(payload.url || '/portfolio'),
      tag: String(payload.tag || 'breakcash-native'),
      important: payload.important === true ? '1' : '0',
    }),
    android: {
      priority: payload.important === true ? 'high' : 'normal',
      notification: {
        channelId: 'breakcash-default',
        clickAction: 'FCM_PLUGIN_ACTIVITY',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
    },
  }
}

export async function sendNativePushToUser(db, userId, payload) {
  if (!userId) return { sent: 0, failed: 0, skipped: true }

  const messaging = getFirebaseMessaging()
  if (!messaging) return { sent: 0, failed: 0, skipped: true }

  const rows = await all(
    db,
    `SELECT id, device_token
     FROM user_native_push_tokens
     WHERE user_id = ? AND is_active = 1
     ORDER BY id DESC
     LIMIT 10`,
    [userId],
  )
  if (!rows.length) return { sent: 0, failed: 0, skipped: false }

  let sent = 0
  let failed = 0

  for (const row of rows) {
    try {
      await messaging.send({
        token: String(row.device_token || '').trim(),
        ...buildNativePayload(payload),
      })
      await markNativeDeliverySuccess(db, Number(row.id))
      sent += 1
    } catch (error) {
      const code = String(error?.errorInfo?.code || error?.code || '')
      const deactivate =
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token')
      await markNativeDeliveryFailure(db, Number(row.id), deactivate)
      failed += 1
    }
  }

  return { sent, failed, skipped: false }
}
