export type FeedbackSoundKind =
  | 'depositApproved'
  | 'withdrawalApproved'
  | 'miningSubscription'
  | 'strategyCode'

type ToneStep = {
  frequency: number
  durationMs: number
  gain: number
}

let audioContext: AudioContext | null = null
let unlockBound = false

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  if (!audioContext) audioContext = new AudioCtx()
  return audioContext
}

async function resumeAudioContext() {
  const ctx = getAudioContext()
  if (!ctx) return null
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      return null
    }
  }
  return ctx
}

function getPattern(kind: FeedbackSoundKind): ToneStep[] {
  if (kind === 'depositApproved') {
    return [
      { frequency: 720, durationMs: 120, gain: 0.045 },
      { frequency: 960, durationMs: 170, gain: 0.05 },
    ]
  }
  if (kind === 'withdrawalApproved') {
    return [
      { frequency: 520, durationMs: 130, gain: 0.04 },
      { frequency: 760, durationMs: 190, gain: 0.048 },
    ]
  }
  if (kind === 'miningSubscription') {
    return [
      { frequency: 480, durationMs: 110, gain: 0.045 },
      { frequency: 660, durationMs: 120, gain: 0.05 },
      { frequency: 920, durationMs: 180, gain: 0.055 },
    ]
  }
  return [
    { frequency: 610, durationMs: 90, gain: 0.04 },
    { frequency: 820, durationMs: 110, gain: 0.045 },
    { frequency: 1080, durationMs: 150, gain: 0.05 },
  ]
}

function bindUnlockHandlers() {
  if (typeof window === 'undefined' || unlockBound) return
  unlockBound = true
  const unlock = () => {
    resumeAudioContext().catch(() => {})
  }
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock, { passive: true })
}

export function primeAppFeedback() {
  bindUnlockHandlers()
  resumeAudioContext().catch(() => {})
}

export async function playFeedbackSound(kind: FeedbackSoundKind) {
  bindUnlockHandlers()
  const ctx = await resumeAudioContext()
  if (!ctx) return

  const masterGain = ctx.createGain()
  masterGain.connect(ctx.destination)
  masterGain.gain.value = 0.9

  let offsetSec = 0
  for (const step of getPattern(kind)) {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = kind === 'withdrawalApproved' ? 'triangle' : 'sine'
    oscillator.frequency.setValueAtTime(step.frequency, ctx.currentTime + offsetSec)
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime + offsetSec)
    gainNode.gain.exponentialRampToValueAtTime(step.gain, ctx.currentTime + offsetSec + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offsetSec + step.durationMs / 1000)
    oscillator.connect(gainNode)
    gainNode.connect(masterGain)
    oscillator.start(ctx.currentTime + offsetSec)
    oscillator.stop(ctx.currentTime + offsetSec + step.durationMs / 1000 + 0.03)
    offsetSec += step.durationMs / 1000 + 0.03
  }
}

export function vibrateFeedback(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(pattern)
}
