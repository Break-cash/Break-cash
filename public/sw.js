const CACHE_NAME = 'breakcash-cache-v3'
const CORE_ASSETS = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const fresh = await fetch(request)
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone())
    }
    return fresh
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('offline')
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)
  if (cached) return cached
  const network = await networkPromise
  if (network) return network
  throw new Error('offline')
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  const destination = event.request.destination
  const isNavigation = event.request.mode === 'navigate' || destination === 'document'
  const isCriticalAsset = destination === 'script' || destination === 'style' || destination === 'worker'

  if (isNavigation || isCriticalAsset) {
    event.respondWith(networkFirst(event.request))
    return
  }

  event.respondWith(staleWhileRevalidate(event.request))
})
