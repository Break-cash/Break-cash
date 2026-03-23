self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }
  const title = String(payload.title || 'Break Cash')
  const options = {
    body: String(payload.body || ''),
    icon: String(payload.icon || '/break-cash-logo-premium.png'),
    badge: String(payload.badge || '/break-cash-logo-premium.png'),
    tag: String(payload.tag || 'breakcash-notification'),
    requireInteraction: payload.requireInteraction === true,
    renotify: payload.renotify === true,
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : undefined,
    data: payload.data && typeof payload.data === 'object' ? payload.data : {},
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl =
    String(event.notification?.data?.url || event.notification?.data?.targetUrl || '/portfolio').trim() || '/portfolio'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(targetUrl)
    }),
  )
})
