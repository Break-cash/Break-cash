import { Capacitor } from '@capacitor/core'
import {
  PushNotifications,
  type Channel,
  type PermissionStatus,
  type Token,
  type ActionPerformed,
  type PushNotificationSchema,
} from '@capacitor/push-notifications'

let listenersBound = false
let currentToken = ''
let lastRegistrationError = ''

function isNativePushPlatform() {
  return Capacitor.isNativePlatform()
}

function bindListeners() {
  if (listenersBound || !isNativePushPlatform()) return
  listenersBound = true

  void PushNotifications.addListener('registration', (token: Token) => {
    lastRegistrationError = ''
    currentToken = String(token.value || '').trim()
  })

  void PushNotifications.addListener('registrationError', (error: { error?: string }) => {
    const code = String(error?.error || '').trim()
    lastRegistrationError = code || 'NATIVE_REGISTRATION_FAILED'
    currentToken = ''
  })

  void PushNotifications.addListener('pushNotificationReceived', (_notification: PushNotificationSchema) => {
    // Native foreground notifications are handled by the OS and app shell.
  })

  void PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
    const targetUrl = String(action.notification?.data?.url || '/portfolio').trim() || '/portfolio'
    if (targetUrl.startsWith('/')) {
      window.location.href = targetUrl
    }
  })
}

async function ensureDefaultAndroidChannel() {
  if (!isNativePushPlatform() || Capacitor.getPlatform() !== 'android') return

  const channel: Channel = {
    id: 'breakcash-default',
    name: 'Break Cash',
    description: 'Break Cash notifications',
    importance: 4,
    visibility: 1,
    sound: 'default',
  }

  await PushNotifications.createChannel(channel).catch(() => {})
}

export function supportsNativePush() {
  return isNativePushPlatform()
}

export function getNativePushPlatform() {
  return isNativePushPlatform() ? Capacitor.getPlatform() : 'web'
}

export async function getNativePushPermission() {
  if (!isNativePushPlatform()) return 'denied' as PermissionStatus['receive']
  const permission = await PushNotifications.checkPermissions()
  return permission.receive
}

export async function requestNativePushPermission() {
  if (!isNativePushPlatform()) return 'denied' as PermissionStatus['receive']
  const permission = await PushNotifications.requestPermissions()
  return permission.receive
}

export async function registerNativePush() {
  if (!isNativePushPlatform()) return null
  bindListeners()
  await ensureDefaultAndroidChannel()

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    currentToken = ''
    lastRegistrationError = ''
    await PushNotifications.register()

    const startedAt = Date.now()
    while (!currentToken && !lastRegistrationError && Date.now() - startedAt < 20000) {
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    }

    if (currentToken) return currentToken
    if (lastRegistrationError) return null

    // Retry once or twice because some Android devices delay first FCM token mint.
    if (attempt < maxAttempts) {
      await new Promise((resolve) => window.setTimeout(resolve, 1200))
    }
  }

  lastRegistrationError = lastRegistrationError || 'NATIVE_REGISTRATION_TIMEOUT'
  return null
}

export function getCurrentNativePushToken() {
  return currentToken || null
}

export function getLastNativePushError() {
  return lastRegistrationError || null
}

export async function unregisterNativePush() {
  if (!isNativePushPlatform()) return
  currentToken = ''
  lastRegistrationError = ''
  await PushNotifications.removeAllListeners().catch(() => {})
  listenersBound = false
  await PushNotifications.unregister().catch(() => {})
}
