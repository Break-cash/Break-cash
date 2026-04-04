import webpush from 'web-push'
import { all, get, run } from '../db.js'
import {
  deactivateAllUserNativePushTokens,
  deactivateUserNativePushToken,
  getUserNativePushStatus,
  saveUserNativePushToken,
  sendNativePushToUser,
} from './native-push-notifications.js'

const VAPID_SETTINGS_KEY = 'web_push_vapid_keys'
const DEFAULT_PUSH_ICON = '/break-cash-logo-premium.png'
const DEFAULT_PUSH_URL = '/portfolio'

function normalizePushPayload(payload = {}) {
  const important = payload.important === true
  return {
    title: String(payload.title || '').trim() || 'Break Cash',
    body: String(payload.body || '').trim(),
    icon: String(payload.icon || DEFAULT_PUSH_ICON).trim() || DEFAULT_PUSH_ICON,
    badge: String(payload.badge || DEFAULT_PUSH_ICON).trim() || DEFAULT_PUSH_ICON,
    url: String(payload.url || DEFAULT_PUSH_URL).trim() || DEFAULT_PUSH_URL,
    tag: String(payload.tag || '').trim() || undefined,
    important,
    requireInteraction: payload.requireInteraction === true || important,
    renotify: payload.renotify === true || important,
    vibrate: Array.isArray(payload.vibrate)
      ? payload.vibrate.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 0).slice(0, 8)
      : important
        ? [180, 80, 180, 80, 260]
        : [120, 60, 120],
    data: payload.data && typeof payload.data === 'object' ? payload.data : {},
  }
}

async function getStoredVapidKeys(db) {
  const row = await get(db, `SELECT value FROM settings WHERE key = ? LIMIT 1`, [VAPID_SETTINGS_KEY])
  if (!row?.value) return null
  try {
    const parsed = JSON.parse(String(row.value))
    if (parsed && parsed.publicKey && parsed.privateKey) return parsed
  } catch {
    return null
  }
  return null
}

async function saveVapidKeys(db, keys) {
  await run(
    db,
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    [VAPID_SETTINGS_KEY, JSON.stringify(keys)],
  )
}

async function ensureVapidKeys(db) {
  const fromEnv =
    String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim() && String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim()
      ? {
          publicKey: String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim(),
          privateKey: String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim(),
        }
      : null
  const keys = fromEnv || (await getStoredVapidKeys(db)) || webpush.generateVAPIDKeys()
  if (!fromEnv) {
    const stored = await getStoredVapidKeys(db)
    if (!stored) await saveVapidKeys(db, keys)
  }
  const contactEmail = String(process.env.WEB_PUSH_CONTACT_EMAIL || process.env.SMTP_FROM || 'support@breakcash.cash')
    .replace(/^.*<([^>]+)>.*$/, '$1')
    .trim()
  webpush.setVapidDetails(`mailto:${contactEmail || 'support@breakcash.cash'}`, keys.publicKey, keys.privateKey)
  return keys
}

function isValidSubscriptionShape(subscription) {
  return Boolean(
    subscription &&
      typeof subscription === 'object' &&
      typeof subscription.endpoint === 'string' &&
      subscription.endpoint &&
      subscription.keys &&
      typeof subscription.keys === 'object' &&
      typeof subscription.keys.p256dh === 'string' &&
      typeof subscription.keys.auth === 'string',
  )
}

export async function getWebPushPublicKey(db) {
  const keys = await ensureVapidKeys(db)
  return keys.publicKey
}

export async function getUserPushSubscriptionStatus(db, userId) {
  const row = await get(
    db,
    `SELECT COUNT(*) AS count
     FROM user_push_subscriptions
     WHERE user_id = ? AND is_active = 1`,
    [userId],
  )
  return { subscribed: Number(row?.count || 0) > 0 }
}

export async function saveUserPushSubscription(db, userId, subscription, userAgent = '') {
  if (!isValidSubscriptionShape(subscription)) throw new Error('INVALID_PUSH_SUBSCRIPTION')
  await ensureVapidKeys(db)
  const endpoint = String(subscription.endpoint).trim()
  const payload = JSON.stringify({
    endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: String(subscription.keys.p256dh || '').trim(),
      auth: String(subscription.keys.auth || '').trim(),
    },
  })
  await run(
    db,
    `INSERT INTO user_push_subscriptions (
      user_id, endpoint, subscription_json, user_agent, is_active, failure_count, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      subscription_json = excluded.subscription_json,
      user_agent = excluded.user_agent,
      is_active = 1,
      failure_count = 0,
      updated_at = CURRENT_TIMESTAMP`,
    [userId, endpoint, payload, String(userAgent || '').slice(0, 500)],
  )
  return { ok: true }
}

export async function deactivateUserPushSubscription(db, userId, endpoint) {
  await run(
    db,
    `UPDATE user_push_subscriptions
     SET is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND endpoint = ?`,
    [userId, String(endpoint || '').trim()],
  )
  return { ok: true }
}

export async function deactivateAllUserPushSubscriptions(db, userId) {
  await run(
    db,
    `UPDATE user_push_subscriptions
     SET is_active = 0, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [userId],
  )
  return { ok: true }
}

async function markPushDeliverySuccess(db, id) {
  await run(
    db,
    `UPDATE user_push_subscriptions
     SET last_success_at = CURRENT_TIMESTAMP, failure_count = 0, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id],
  )
}

async function markPushDeliveryFailure(db, id, deactivate = false) {
  await run(
    db,
    `UPDATE user_push_subscriptions
     SET last_failure_at = CURRENT_TIMESTAMP,
         failure_count = COALESCE(failure_count, 0) + 1,
         is_active = CASE WHEN ? = 1 THEN 0 ELSE is_active END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [deactivate ? 1 : 0, id],
  )
}

export async function sendWebPushToUser(db, userId, payload) {
  if (!userId) return { sent: 0, failed: 0 }
  await ensureVapidKeys(db)
  const rows = await all(
    db,
    `SELECT id, endpoint, subscription_json
     FROM user_push_subscriptions
     WHERE user_id = ? AND is_active = 1
     ORDER BY id DESC
     LIMIT 10`,
    [userId],
  )
  if (!rows.length) return { sent: 0, failed: 0 }

  const safePayload = normalizePushPayload(payload)
  let sent = 0
  let failed = 0
  for (const row of rows) {
    try {
      const subscription = JSON.parse(String(row.subscription_json || '{}'))
      await webpush.sendNotification(subscription, JSON.stringify(safePayload), {
        TTL: safePayload.important ? 60 * 60 * 12 : 60 * 60,
        urgency: safePayload.important ? 'high' : 'normal',
        topic: String(safePayload.tag || 'breakcash-notification').slice(0, 32),
      })
      await markPushDeliverySuccess(db, Number(row.id))
      sent += 1
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0)
      const shouldDeactivate = statusCode === 404 || statusCode === 410
      await markPushDeliveryFailure(db, Number(row.id), shouldDeactivate)
      failed += 1
    }
  }
  return { sent, failed }
}

export async function sendPushToUser(db, userId, payload) {
  const [webResult, nativeResult] = await Promise.all([
    sendWebPushToUser(db, userId, payload),
    sendNativePushToUser(db, userId, payload),
  ])

  return {
    sent: Number(webResult.sent || 0) + Number(nativeResult.sent || 0),
    failed: Number(webResult.failed || 0) + Number(nativeResult.failed || 0),
    web: webResult,
    native: nativeResult,
  }
}

export {
  getUserNativePushStatus,
  saveUserNativePushToken,
  deactivateUserNativePushToken,
  deactivateAllUserNativePushTokens,
}
