export type FeedbackSoundKind =
  | 'depositApproved'
  | 'withdrawalApproved'
  | 'miningSubscription'
  | 'strategyCode'
  | 'strategicApproval'

type ToneStep = {
  frequency: number
  durationMs: number
  gain: number
}

type SoundEnvelope = {
  attackSec: number
  decaySec: number
  type: OscillatorType
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
  if (kind === 'strategicApproval') {
    return [
      { frequency: 329.63, durationMs: 115, gain: 0.022 },
      { frequency: 493.88, durationMs: 170, gain: 0.03 },
      { frequency: 659.25, durationMs: 145, gain: 0.016 },
    ]
  }
  return [
    { frequency: 610, durationMs: 90, gain: 0.04 },
    { frequency: 820, durationMs: 110, gain: 0.045 },
    { frequency: 1080, durationMs: 150, gain: 0.05 },
  ]
}

function getEnvelope(kind: FeedbackSoundKind): SoundEnvelope {
  if (kind === 'withdrawalApproved') {
    return { attackSec: 0.02, decaySec: 0.16, type: 'triangle' }
  }
  if (kind === 'strategicApproval') {
    return { attackSec: 0.006, decaySec: 0.14, type: 'triangle' }
  }
  return { attackSec: 0.02, decaySec: 0.16, type: 'sine' }
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number) {
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec))
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = (Math.random() * 2 - 1) * (1 - index / frameCount)
  }
  return buffer
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
  masterGain.gain.value = kind === 'strategicApproval' ? 0.72 : 0.9

  if (kind === 'strategicApproval') {
    const clickSource = ctx.createBufferSource()
    const clickFilter = ctx.createBiquadFilter()
    const clickGain = ctx.createGain()
    clickSource.buffer = createNoiseBuffer(ctx, 0.02)
    clickFilter.type = 'bandpass'
    clickFilter.frequency.setValueAtTime(1900, ctx.currentTime)
    clickFilter.Q.setValueAtTime(1.9, ctx.currentTime)
    clickGain.gain.setValueAtTime(0.0001, ctx.currentTime)
    clickGain.gain.exponentialRampToValueAtTime(0.042, ctx.currentTime + 0.002)
    clickGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.018)
    clickSource.connect(clickFilter)
    clickFilter.connect(clickGain)
    clickGain.connect(masterGain)
    clickSource.start(ctx.currentTime)
    clickSource.stop(ctx.currentTime + 0.022)
  }

  const envelope = getEnvelope(kind)
  let offsetSec = kind === 'strategicApproval' ? 0.05 : 0
  for (const step of getPattern(kind)) {
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()
    oscillator.type = envelope.type
    oscillator.frequency.setValueAtTime(step.frequency, ctx.currentTime + offsetSec)
    if (kind === 'strategicApproval') {
      oscillator.frequency.exponentialRampToValueAtTime(step.frequency * 1.01, ctx.currentTime + offsetSec + 0.024)
    }
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime + offsetSec)
    gainNode.gain.exponentialRampToValueAtTime(step.gain, ctx.currentTime + offsetSec + envelope.attackSec)
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      ctx.currentTime + offsetSec + Math.max(step.durationMs / 1000, envelope.decaySec),
    )
    oscillator.connect(gainNode)
    gainNode.connect(masterGain)
    oscillator.start(ctx.currentTime + offsetSec)
    oscillator.stop(ctx.currentTime + offsetSec + step.durationMs / 1000 + 0.03)
    offsetSec += kind === 'strategicApproval' ? step.durationMs / 1000 + 0.008 : step.durationMs / 1000 + 0.03
  }

  if (kind === 'strategicApproval') {
    const shimmer = ctx.createOscillator()
    const shimmerGain = ctx.createGain()
    const shimmerFilter = ctx.createBiquadFilter()
    shimmer.type = 'sine'
    shimmer.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.12)
    shimmerFilter.type = 'highpass'
    shimmerFilter.frequency.setValueAtTime(1200, ctx.currentTime)
    shimmerGain.gain.setValueAtTime(0.0001, ctx.currentTime + 0.12)
    shimmerGain.gain.exponentialRampToValueAtTime(0.008, ctx.currentTime + 0.145)
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24)
    shimmer.connect(shimmerFilter)
    shimmerFilter.connect(shimmerGain)
    shimmerGain.connect(masterGain)
    shimmer.start(ctx.currentTime + 0.12)
    shimmer.stop(ctx.currentTime + 0.27)
  }
}

export function vibrateFeedback(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  navigator.vibrate(pattern)
}
