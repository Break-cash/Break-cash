import { useEffect, useState } from 'react'

export const ASSET_VISIBILITY_STORAGE_KEY = 'breakcash_assets_hidden'
const ASSET_VISIBILITY_EVENT = 'breakcash:asset-visibility-changed'

function readVisibilityState() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ASSET_VISIBILITY_STORAGE_KEY) === '1'
}

export function setAssetVisibilityHidden(nextHidden: boolean) {
  if (typeof window === 'undefined') return
  if (nextHidden) window.localStorage.setItem(ASSET_VISIBILITY_STORAGE_KEY, '1')
  else window.localStorage.removeItem(ASSET_VISIBILITY_STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(ASSET_VISIBILITY_EVENT, { detail: { hidden: nextHidden } }))
}

export function useAssetVisibility() {
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    setIsHidden(readVisibilityState())

    function syncVisibility() {
      setIsHidden(readVisibilityState())
    }

    function handleCustomEvent(event: Event) {
      const nextHidden = Boolean((event as CustomEvent<{ hidden?: boolean }>).detail?.hidden)
      setIsHidden(nextHidden)
    }

    window.addEventListener('storage', syncVisibility)
    window.addEventListener(ASSET_VISIBILITY_EVENT, handleCustomEvent)
    return () => {
      window.removeEventListener('storage', syncVisibility)
      window.removeEventListener(ASSET_VISIBILITY_EVENT, handleCustomEvent)
    }
  }, [])

  return {
    isHidden,
    setHidden: setAssetVisibilityHidden,
    toggleHidden: () => setAssetVisibilityHidden(!readVisibilityState()),
  }
}
