import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { AdItem } from '../../api'
import { useI18n } from '../../i18nCore'

const ROTATE_INTERVAL_MS = 4000
const MANUAL_PAUSE_MS = 8000
const SWIPE_THRESHOLD_PX = 42

type AdBannerProps = {
  items: AdItem[]
  placement: string
  className?: string
}

export function AdBanner({ items, placement, className = '' }: AdBannerProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [manualPause, setManualPause] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const pointerStartXRef = useRef<number | null>(null)
  const pointerDeltaXRef = useRef(0)
  const pointerDraggingRef = useRef(false)
  const suppressClickRef = useRef(false)

  const filtered = items.filter((x) => x && x.isActive)
  const canRotate = filtered.length > 1
  const current = filtered[activeIndex] || null
  const currentIsVideo = current?.type === 'video'

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => setIsVisible(entry?.isIntersecting ?? true),
      { threshold: 0.1, rootMargin: '50px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!canRotate || manualPause || !isVisible || filtered.length <= 1 || currentIsVideo) return
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % filtered.length)
    }, ROTATE_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [canRotate, manualPause, isVisible, filtered.length, currentIsVideo])

  useEffect(() => {
    setActiveIndex((prev) => (filtered.length ? Math.min(prev, filtered.length - 1) : 0))
  }, [filtered.length])

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current)
    }
  }, [])

  function clearManualPause() {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current)
      pauseTimeoutRef.current = null
    }
    setManualPause(false)
  }

  function pauseAutoTemporarily() {
    if (!canRotate) return
    setManualPause(true)
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current)
    pauseTimeoutRef.current = setTimeout(() => {
      setManualPause(false)
      pauseTimeoutRef.current = null
    }, MANUAL_PAUSE_MS)
  }

  function goTo(index: number, isManual = false) {
    if (!filtered.length) return
    const next = (index + filtered.length) % filtered.length
    setActiveIndex(next)
    if (isManual) pauseAutoTemporarily()
  }

  function resetPointerGesture() {
    pointerStartXRef.current = null
    pointerDeltaXRef.current = 0
    pointerDraggingRef.current = false
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!canRotate) return
    suppressClickRef.current = false
    pointerStartXRef.current = event.clientX
    pointerDeltaXRef.current = 0
    pointerDraggingRef.current = false
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (pointerStartXRef.current == null) return
    pointerDeltaXRef.current = event.clientX - pointerStartXRef.current
    if (Math.abs(pointerDeltaXRef.current) >= 8) {
      pointerDraggingRef.current = true
    }
  }

  function handlePointerEnd() {
    const deltaX = pointerDeltaXRef.current
    resetPointerGesture()
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return
    suppressClickRef.current = true
    if (deltaX < 0) {
      goTo(activeIndex + 1, true)
      return
    }
    goTo(activeIndex - 1, true)
  }

  if (!current) {
    return (
      <section
        ref={containerRef}
        className={`relative overflow-hidden rounded-2xl border border-[#1d2636] bg-[#06090f] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.34)] ${className}`.trim()}
        data-placement={placement}
      >
        <div className="rounded-xl border border-dashed border-white/20 bg-black/25 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white/85">{t('ads_empty_title')}</p>
          <p className="mt-1 text-xs text-white/65">{t('ads_empty_subtitle')}</p>
        </div>
      </section>
    )
  }

  const clickable = Boolean(current.linkUrl)

  return (
    <section
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl border border-[#1d2636] bg-[#06090f] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.34)] ${className}`.trim()}
      data-placement={placement}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,123,255,0.12),transparent_46%)]" />
      <div
        className={`relative overflow-hidden rounded-xl border border-[#2a3346] bg-black/30 ${clickable ? 'cursor-pointer' : ''}`}
        style={{ touchAction: canRotate ? 'pan-y' : 'auto' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={resetPointerGesture}
        onPointerLeave={() => {
          if (pointerStartXRef.current != null) handlePointerEnd()
        }}
        onClick={() => {
          if (suppressClickRef.current || pointerDraggingRef.current) {
            suppressClickRef.current = false
            return
          }
          if (current.linkUrl) navigate(current.linkUrl)
        }}
      >
        <div className="relative aspect-[2.2/1] min-h-[120px] overflow-hidden rounded-xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              {current.type === 'video' ? (
                <AdVideo
                  src={current.mediaUrl}
                  isVisible={isVisible}
                  loop={!canRotate}
                  onEnded={() => {
                    if (!canRotate) return
                    clearManualPause()
                    goTo(activeIndex + 1, false)
                  }}
                />
              ) : (
                <img
                  src={current.mediaUrl}
                  alt={current.title || ''}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {canRotate && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <div className="flex items-center gap-1.5">
              {filtered.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className={`h-2 rounded-full transition-all ${
                    idx === activeIndex ? 'w-5 bg-brand-blue' : 'w-2 bg-white/35 hover:bg-white/50'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    goTo(idx, true)
                  }}
                  aria-label={`${t('ads_go_to')} ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function AdVideo({
  src,
  isVisible,
  loop,
  onEnded,
}: {
  src: string
  isVisible: boolean
  loop: boolean
  onEnded?: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !isVisible) return
    el.currentTime = 0
    const p = el.play()
    if (p?.catch) p.catch(() => {})
  }, [src, isVisible])

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      playsInline
      loop={loop}
      preload="metadata"
      className="h-full w-full object-cover"
      style={{ pointerEvents: 'none' }}
      disablePictureInPicture
      disableRemotePlayback
      controls={false}
      controlsList="nodownload nofullscreen noremoteplayback"
      onEnded={onEnded}
    />
  )
}
