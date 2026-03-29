import { useEffect, useMemo } from 'react'
import { PremiumSplashIntro } from './PremiumSplashIntro'

const REFRESH_ATTEMPTS_KEY = 'breakcash_production_refresh_attempts'
const REFRESH_WINDOW_MS = 30_000
const MAX_AUTO_REFRESH_ATTEMPTS = 2

function readRefreshAttempts(): { count: number; startedAt: number } {
  try {
    const raw = sessionStorage.getItem(REFRESH_ATTEMPTS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    const count = Number(parsed?.count || 0)
    const startedAt = Number(parsed?.startedAt || 0)
    if (!Number.isFinite(count) || !Number.isFinite(startedAt)) {
      return { count: 0, startedAt: 0 }
    }
    if (!startedAt || Date.now() - startedAt > REFRESH_WINDOW_MS) {
      return { count: 0, startedAt: 0 }
    }
    return { count, startedAt }
  } catch {
    return { count: 0, startedAt: 0 }
  }
}

function writeRefreshAttempts(next: { count: number; startedAt: number }) {
  try {
    sessionStorage.setItem(REFRESH_ATTEMPTS_KEY, JSON.stringify(next))
  } catch {
    // ignore storage failures
  }
}

function buildRefreshUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('__app_refresh', String(Date.now()))
  return url.toString()
}

export function resetProductionRefreshAttempts() {
  try {
    sessionStorage.removeItem(REFRESH_ATTEMPTS_KEY)
  } catch {
    // ignore storage failures
  }
}

export function triggerProductionRefresh() {
  const current = readRefreshAttempts()
  const startedAt = current.startedAt || Date.now()
  writeRefreshAttempts({ count: current.count + 1, startedAt })
  window.location.replace(buildRefreshUrl())
}

type ProductionRefreshScreenProps = {
  allowAutoRefresh?: boolean
}

export function ProductionRefreshScreen({
  allowAutoRefresh = true,
}: ProductionRefreshScreenProps) {
  const refreshState = useMemo(() => readRefreshAttempts(), [])
  const canAutoRefresh = allowAutoRefresh && refreshState.count < MAX_AUTO_REFRESH_ATTEMPTS

  useEffect(() => {
    if (!canAutoRefresh) return
    const timer = window.setTimeout(() => {
      triggerProductionRefresh()
    }, 2600)
    return () => window.clearTimeout(timer)
  }, [canAutoRefresh])

  return (
    <div className="min-h-screen bg-[#040b1d]">
      <PremiumSplashIntro onComplete={() => {
        if (canAutoRefresh) triggerProductionRefresh()
      }} />
      <div className="fixed inset-x-0 bottom-8 z-[5] flex justify-center px-4">
        <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 text-center text-sm text-white/85 backdrop-blur-md">
          {canAutoRefresh ? 'يتم تحديث التطبيق...' : 'تم تحميل تحديث جديد. اضغط للتحديث.'}
          {!canAutoRefresh ? (
            <button
              type="button"
              className="ml-3 rounded-full bg-brand-blue px-3 py-1 text-xs font-semibold text-white"
              onClick={() => {
                resetProductionRefreshAttempts()
                triggerProductionRefresh()
              }}
            >
              تحديث الآن
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
