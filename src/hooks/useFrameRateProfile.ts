import { useEffect, useMemo, useState } from 'react'

type FrameRateProfile = {
  fps: number
  frameMs: number
  motionScale: number
}

const DEFAULT_FPS = 60
const MAX_FPS = 120
const MIN_FPS = 30
const SAMPLE_FRAMES = 24

let cachedProfile: FrameRateProfile | null = null

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function buildProfile(rawFps: number): FrameRateProfile {
  const fps = clamp(Math.round(rawFps), MIN_FPS, MAX_FPS)
  const frameMs = 1000 / fps
  const motionScale = clamp(DEFAULT_FPS / fps, 0.72, 1.12)
  return { fps, frameMs, motionScale }
}

function readRefreshRate() {
  return new Promise<FrameRateProfile>((resolve) => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      resolve(buildProfile(DEFAULT_FPS))
      return
    }

    const samples: number[] = []
    let lastTs: number | null = null

    const tick = (ts: number) => {
      if (lastTs !== null) {
        samples.push(ts - lastTs)
      }
      lastTs = ts

      if (samples.length >= SAMPLE_FRAMES) {
        const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length
        const fps = avg > 0 ? 1000 / avg : DEFAULT_FPS
        resolve(buildProfile(fps))
        return
      }

      window.requestAnimationFrame(tick)
    }

    window.requestAnimationFrame(tick)
  })
}

export function useFrameRateProfile() {
  const [profile, setProfile] = useState<FrameRateProfile>(cachedProfile ?? buildProfile(DEFAULT_FPS))

  useEffect(() => {
    let active = true
    if (cachedProfile) {
      setProfile(cachedProfile)
      return
    }

    readRefreshRate().then((nextProfile) => {
      cachedProfile = nextProfile
      if (active) {
        setProfile(nextProfile)
      }
    })

    return () => {
      active = false
    }
  }, [])

  return useMemo(
    () => ({
      ...profile,
      scaleDuration(baseSeconds: number) {
        return Number((baseSeconds * profile.motionScale).toFixed(3))
      },
    }),
    [profile],
  )
}
