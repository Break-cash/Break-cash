import { useEffect, useState } from 'react'

function detectNativeAppShell() {
  if (typeof window === 'undefined') return false

  const win = window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean
    }
    webkit?: {
      messageHandlers?: Record<string, unknown>
    }
  }

  try {
    if (typeof win.Capacitor?.isNativePlatform === 'function' && win.Capacitor.isNativePlatform()) {
      return true
    }
  } catch {
    // ignore bridge inspection failures
  }

  if (Boolean(win.Capacitor)) return true
  if (Boolean(win.webkit?.messageHandlers?.bridge)) return true

  const ua = String(navigator.userAgent || '').toLowerCase()
  if (ua.includes('wv')) return true
  if (ua.includes('capacitor')) return true

  return false
}

export function useInNativeApp() {
  const [inNativeApp, setInNativeApp] = useState(false)

  useEffect(() => {
    setInNativeApp(detectNativeAppShell())
  }, [])

  return inNativeApp
}
