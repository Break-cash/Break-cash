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

function isNativePushPlatform() {
  return Capacitor.isNativePlatform()
}

function bindListeners() {
  if (listenersBound || !isNativePushPlatform()) return
  listenersBound = true

  void PushNotifications.addListener('registration', (token: Token) => {
    currentToken = String(token.value || '').trim()
  })

  void PushNotifications.addListener('registrationError', () => {
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
  await PushNotifications.register()

  const startedAt = Date.now()
  while (!currentToken && Date.now() - startedAt < 10000) {
    await new Promise((resolve) => window.setTimeout(resolve, 120))
  }

  return currentToken || null
}

export function getCurrentNativePushToken() {
  return currentToken || null
}

export async function unregisterNativePush() {
  if (!isNativePushPlatform()) return
  currentToken = ''
  await PushNotifications.removeAllListeners().catch(() => {})
  listenersBound = false
  await PushNotifications.unregister().catch(() => {})
}
