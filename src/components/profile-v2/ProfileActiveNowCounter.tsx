import { useEffect, useState } from 'react'

const MIN_ACTIVE_NOW = 100
const MAX_ACTIVE_NOW = 2500
const STEP_DELTA = 120
const REFRESH_MS = 30000

function clamp(value: number) {
  return Math.min(MAX_ACTIVE_NOW, Math.max(MIN_ACTIVE_NOW, value))
}

function useActiveNowCount() {
  const [activeNow, setActiveNow] = useState(980)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveNow((prev) => {
        const delta = Math.round((Math.random() * 2 - 1) * STEP_DELTA)
        return clamp(prev + delta)
      })
    }, REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  return activeNow
}

export function ProfileActiveNowCounter() {
  const activeNow = useActiveNowCount()

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.14)]">
      <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
      <span>نشط الآن</span>
      <span className="font-semibold tabular-nums">{activeNow.toLocaleString('en-US')}</span>
    </div>
  )
}

type ProfileActiveNowCounterCompactProps = {
  className?: string
}

export function ProfileActiveNowCounterCompact({ className = '' }: ProfileActiveNowCounterCompactProps) {
  const activeNow = useActiveNowCount()

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.14)] ${className}`.trim()}
    >
      <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
      <span className="max-sm:hidden">نشط الآن</span>
      <span className="font-semibold tabular-nums">{activeNow.toLocaleString('en-US')}</span>
    </div>
  )
}

