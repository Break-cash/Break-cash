import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './tailwind.css'
import './index.css'
import App from './App.tsx'

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
    .then((keys) => Promise.all(keys.filter((key) => key.includes('breakcash-cache')).map((key) => caches.delete(key))))
    .catch(() => {
      // ignore cache cleanup failures
    })
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {
        // ignore service worker registration failures
      })
  })
}

// Keep app theme stable in dark mode to avoid light-theme flashes.
document.documentElement.dataset.theme = 'dark'
