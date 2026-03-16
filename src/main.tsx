import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './tailwind.css'
import './index.css'
import App from './App.tsx'

const ACTIVE_SW_CACHE = 'breakcash-cache-v3'

const sentryDsn = (import.meta.env.VITE_SENTRY_DSN || '').trim()
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Sentry.ErrorBoundary fallback={<div>Unexpected error occurred.</div>}>
        <App />
      </Sentry.ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)

if ('caches' in window) {
  caches
    .keys()
    .then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.includes('cache') && key !== ACTIVE_SW_CACHE)
          .map((key) => caches.delete(key)),
      ),
    )
    .catch(() => {
      // ignore cache cleanup failures
    })
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem('breakcash_sw_reload_done') === '1') return
    sessionStorage.setItem('breakcash_sw_reload_done', '1')
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        registration.addEventListener('updatefound', () => {
          const nextWorker = registration.installing
          if (!nextWorker) return
          nextWorker.addEventListener('statechange', () => {
            if (nextWorker.state === 'installed' && navigator.serviceWorker.controller) {
              nextWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
      .catch(() => {
        // ignore pwa registration failures in development
      })
  })
}

// Keep app theme stable in dark mode to avoid light-theme flashes.
document.documentElement.dataset.theme = 'dark'
