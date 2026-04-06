import { useEffect, useRef, useState } from 'react'

type MiningVideoSectionProps = {
  isActive: boolean
  hashRate: number
  earningsUsdt: number
  remainingTime: string
  mediaUrl?: string
}

const BTC_PRICE_ESTIMATE = 68000
const BTC_STEP = 0.00000001
const SAFE_FRAME_TIME = 1.2
export function MiningVideoSection({ isActive, hashRate, earningsUsdt, remainingTime, mediaUrl }: MiningVideoSectionProps) {
  const initialBtc = earningsUsdt > 0 ? earningsUsdt / BTC_PRICE_ESTIMATE : 0
  const [currentHashRate, setCurrentHashRate] = useState(hashRate)
  const [currentBtc, setCurrentBtc] = useState(initialBtc)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    setCurrentHashRate(hashRate)
  }, [hashRate])

  useEffect(() => {
    setCurrentBtc(initialBtc)
  }, [initialBtc])

  useEffect(() => {
    if (!isActive) return

    const liveTimer = window.setInterval(() => {
      setCurrentHashRate((prev) => {
        const fluctuation = (Math.random() - 0.5) * 0.8
        const next = prev + fluctuation
        return Number(next.toFixed(1))
      })
      setCurrentBtc((prev) => Number((prev + BTC_STEP).toFixed(8)))
    }, 1000)

    return () => {
      window.clearInterval(liveTimer)
    }
  }, [isActive])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return
    let loopStartAt = 0
    let loopEndAt = 0

    const setupLoopWindow = () => {
      const duration = Number(videoElement.duration || 0)
      if (!Number.isFinite(duration) || duration <= 0) return
      loopStartAt = Math.max(0, duration - 0.8)
      loopEndAt = duration
    }

    const jumpToLoopStart = () => {
      if (!Number.isFinite(loopEndAt) || loopEndAt <= 0) return
      videoElement.currentTime = loopStartAt
      void videoElement.play().catch(() => {})
    }

    const handleTimeUpdate = () => {
      if (!Number.isFinite(loopEndAt) || loopEndAt <= 0) return
      if (videoElement.currentTime >= loopEndAt - 0.08) {
        jumpToLoopStart()
      }
    }

    videoElement.addEventListener('loadedmetadata', setupLoopWindow)
    videoElement.addEventListener('durationchange', setupLoopWindow)
    videoElement.addEventListener('timeupdate', handleTimeUpdate)
    videoElement.addEventListener('ended', jumpToLoopStart)
    setupLoopWindow()

    return () => {
      videoElement.removeEventListener('loadedmetadata', setupLoopWindow)
      videoElement.removeEventListener('durationchange', setupLoopWindow)
      videoElement.removeEventListener('timeupdate', handleTimeUpdate)
      videoElement.removeEventListener('ended', jumpToLoopStart)
    }
  }, [])

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement) return

    const seekToSafeFrame = () => {
      const duration = Number(videoElement.duration || 0)
      if (!Number.isFinite(duration) || duration <= 0) return
      const safeTime = Math.min(SAFE_FRAME_TIME, Math.max(0, duration - 0.81))
      videoElement.currentTime = safeTime
    }

    // Ensure the first shown frame is not frame 0 even before activation.
    videoElement.addEventListener('loadedmetadata', seekToSafeFrame)
    videoElement.addEventListener('loadeddata', seekToSafeFrame)

    if (isActive) {
      seekToSafeFrame()
      void videoElement.play().catch(() => {})
    } else {
      videoElement.pause()
      seekToSafeFrame()
    }

    return () => {
      videoElement.removeEventListener('loadedmetadata', seekToSafeFrame)
      videoElement.removeEventListener('loadeddata', seekToSafeFrame)
    }
  }, [isActive])

  const usdValue = currentBtc * BTC_PRICE_ESTIMATE

  return (
    <section className="mining-page-video">
      <div className={`video-wrapper ${isActive ? 'is-active' : ''}`}>
        <video id="miningVideo" ref={videoRef} muted playsInline loop={false} preload="auto">
          <source src={mediaUrl || '/mining/IMG_3056.MP4'} type="video/mp4" />
        </video>
        <div className="video-overlay">
          <div className="status-badge">{isActive ? 'FANS RUNNING' : 'FANS STOPPED'}</div>
          <h2>{isActive ? 'MINING ACTIVE' : 'MINING INACTIVE'}</h2>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-label">HASH RATE</span>
          <div className="stat-value">
            <span id="hash-rate">{currentHashRate.toFixed(1)}</span> <small className="unit">TH/s</small>
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">EARNINGS</span>
          <div className="stat-value" id="btc-value">
            {currentBtc.toFixed(8)} <small className="unit">BTC</small>
          </div>
          <div id="usd-value" className="stat-sub-value">
            ~ ${usdValue.toFixed(2)} / day
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-label">TIME LEFT</span>
          <div className="stat-value stat-time">{isActive ? remainingTime : '--'}</div>
        </div>
      </div>
    </section>
  )
}
