import { useEffect, useState } from 'react'

type NavigatorWithInstalledApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<Array<{ id?: string; platform?: string; url?: string }>>
}

const APP_PACKAGE_ID = 'com.breakcash.app'

export function useNativeAppInstalled() {
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    let active = true

    async function checkInstalledState() {
      const nav = window.navigator as NavigatorWithInstalledApps
      if (typeof nav.getInstalledRelatedApps !== 'function') {
        if (active) setIsInstalled(false)
        return
      }
      try {
        const relatedApps = await nav.getInstalledRelatedApps()
        const hasNativeApp = relatedApps.some((app) => app.platform === 'play' && app.id === APP_PACKAGE_ID)
        if (active) {
          setIsInstalled(hasNativeApp)
        }
      } catch {
        if (active) {
          setIsInstalled(false)
        }
      }
    }

    void checkInstalledState()
    window.addEventListener('focus', checkInstalledState)
    document.addEventListener('visibilitychange', checkInstalledState)

    return () => {
      active = false
      window.removeEventListener('focus', checkInstalledState)
      document.removeEventListener('visibilitychange', checkInstalledState)
    }
  }, [])

  return isInstalled
}
