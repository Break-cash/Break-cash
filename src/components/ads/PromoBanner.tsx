import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { PromoBannerItem } from '../../api'
import { useI18n } from '../../i18nCore'

type PromoBannerProps = {
  items?: PromoBannerItem[]
  title?: string
  subtitle?: string
  ctaLabel?: string
  to?: string
  className?: string
}

const FALLING_COINS = [
  { id: 1, left: '18%', delay: 0, duration: 2.6, color: 'gold' },
  { id: 2, left: '31%', delay: 0.35, duration: 2.9, color: 'silver' },
  { id: 3, left: '43%', delay: 0.7, duration: 2.7, color: 'gold' },
  { id: 4, left: '56%', delay: 0.15, duration: 2.8, color: 'silver' },
  { id: 5, left: '68%', delay: 0.52, duration: 2.5, color: 'gold' },
  { id: 6, left: '80%', delay: 0.9, duration: 2.75, color: 'silver' },
]

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':')
}

export function PromoBanner({ items, title = '', subtitle = '', ctaLabel, to, className = '' }: PromoBannerProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const pauseTimeoutRef = useRef<number | null>(null)
  const swipeStartX = useRef<number | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [manualPause, setManualPause] = useState(false)
  const [expiresAt] = useState(() => Date.now() + 1000 * 60 * 60 * 12)
  const [remaining, setRemaining] = useState(() => expiresAt - Date.now())

  const hasFallback = Boolean(title && subtitle)
  const normalizedItems = useMemo(() => {
    const list = Array.isArray(items) ? items : []
    const active = list
      .filter((item) => item && item.enabled)
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    if (active.length > 0) return active
    if (!hasFallback) return []
    return [
      {
        id: 'fallback',
        title,
        subtitle,
        ctaLabel: ctaLabel || '',
        to: to || '',
        imageUrl: '',
        backgroundStyle: '',
        placement: 'all',
        enabled: true,
        order: 1,
      } as PromoBannerItem,
    ]
  }, [items, hasFallback, title, subtitle, ctaLabel, to])

  const canRotate = normalizedItems.length > 1
  const currentItem = normalizedItems[activeIndex] || null

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(expiresAt - Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt])

  useEffect(() => {
    if (!canRotate || manualPause) return
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % normalizedItems.length)
    }, 3000)
    return () => window.clearInterval(id)
  }, [canRotate, manualPause, normalizedItems.length])

  useEffect(() => {
    setActiveIndex((prev) => {
      if (normalizedItems.length === 0) return 0
      return Math.min(prev, normalizedItems.length - 1)
    })
  }, [normalizedItems.length])

  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) window.clearTimeout(pauseTimeoutRef.current)
    }
  }, [])

  const timerText = useMemo(() => formatRemaining(remaining), [remaining])

  function pauseAutoTemporarily() {
    if (!canRotate) return
    setManualPause(true)
    if (pauseTimeoutRef.current) window.clearTimeout(pauseTimeoutRef.current)
    pauseTimeoutRef.current = window.setTimeout(() => {
      setManualPause(false)
      pauseTimeoutRef.current = null
    }, 9000)
  }

  function goTo(index: number, isManual = false) {
    if (!normalizedItems.length) return
    const next = (index + normalizedItems.length) % normalizedItems.length
    setActiveIndex(next)
    if (isManual) pauseAutoTemporarily()
  }

  function goNext(isManual = false) {
    goTo(activeIndex + 1, isManual)
  }

  function goPrev(isManual = false) {
    goTo(activeIndex - 1, isManual)
  }

  function handlePointerStart(x: number) {
    swipeStartX.current = x
  }

  function handlePointerEnd(x: number) {
    if (swipeStartX.current == null || !canRotate) return
    const deltaX = x - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(deltaX) < 34) return
    if (deltaX < 0) goNext(true)
    else goPrev(true)
  }

  if (!currentItem) {
    return (
      <section
        className={`relative overflow-hidden rounded-2xl border border-[#1d2636] bg-[#06090f] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.34)] ${className}`.trim()}
      >
        <div className="rounded-xl border border-dashed border-white/20 bg-black/25 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white/85">{t('promo_empty_title')}</p>
          <p className="mt-1 text-xs text-white/65">{t('promo_empty_subtitle')}</p>
        </div>
      </section>
    )
  }

  const clickable = Boolean(currentItem.to)

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-[#1d2636] bg-[#06090f] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.34)] ${className}`.trim()}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,123,255,0.3),transparent_46%),radial-gradient(circle_at_85%_100%,rgba(0,123,255,0.17),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/8 to-transparent" />

      <div
        className={`relative overflow-hidden rounded-xl border border-[#2a3346] bg-black/30 p-3 ${clickable ? 'cursor-pointer' : ''}`}
        onTouchStart={(e) => handlePointerStart(e.touches[0]?.clientX || 0)}
        onTouchEnd={(e) => handlePointerEnd(e.changedTouches[0]?.clientX || 0)}
        onMouseDown={(e) => handlePointerStart(e.clientX)}
        onMouseUp={(e) => handlePointerEnd(e.clientX)}
        onClick={() => {
          if (currentItem.to) navigate(currentItem.to)
        }}
      >
        <div
          className="relative h-[140px] overflow-hidden rounded-xl border border-white/10"
          style={
            currentItem.backgroundStyle
              ? { background: currentItem.backgroundStyle }
              : undefined
          }
        >
          {FALLING_COINS.map((coin) => (
            <motion.span
              key={coin.id}
              className={`absolute top-[-18px] h-5 w-5 rounded-full border ${
                coin.color === 'gold'
                  ? 'border-[#f5d57b] bg-gradient-to-b from-[#fff0bf] to-[#cf9f27]'
                  : 'border-[#dce3f1] bg-gradient-to-b from-[#ffffff] to-[#9ca7ba]'
              }`}
              style={{ left: coin.left }}
              animate={{ y: [-12, 118], rotate: [0, 180, 360], opacity: [0, 1, 1, 0] }}
              transition={{
                duration: coin.duration,
                delay: coin.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}

          {currentItem.imageUrl ? (
            <img
              src={currentItem.imageUrl}
              alt={currentItem.title}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55"
              loading="lazy"
            />
          ) : null}

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.03, 1], boxShadow: ['0 0 16px rgba(0,123,255,0.25)', '0 0 22px rgba(0,123,255,0.45)', '0 0 16px rgba(0,123,255,0.25)'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="flex min-h-[78px] w-[74%] flex-col items-center justify-center rounded-2xl border border-[#2e3d57] bg-[linear-gradient(180deg,#0c1422,#070c15)] px-3 text-center"
            >
              <p className="text-sm font-bold tracking-[0.08em] text-white">BREAK CASH</p>
              <p className="mt-1 text-[11px] text-white/85">({t('promo_first_deposit_reward')})</p>
            </motion.div>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-[0.14em] text-blue-300/90">{t('promo_sponsored')}</p>
            <h3 className="mt-1 truncate text-sm font-semibold text-white">{currentItem.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-white/70">{currentItem.subtitle}</p>
          </div>

          {currentItem.ctaLabel ? (
            <button
              type="button"
              disabled={!clickable}
              onClick={(e) => {
                e.stopPropagation()
                if (currentItem.to) navigate(currentItem.to)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="icon-interactive shrink-0 rounded-xl border border-[#2f65bb] bg-[#123670] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a468f] disabled:cursor-default disabled:opacity-60"
            >
              {currentItem.ctaLabel}
            </button>
          ) : null}
        </div>

        <div className="mt-3 rounded-lg border border-[#2a3346] bg-black/35 px-3 py-1.5 text-center">
          <p className="text-[10px] uppercase tracking-[0.12em] text-white/60">{t('promo_countdown')}</p>
          <p className="font-mono text-lg font-bold tracking-[0.08em] text-white">{timerText}</p>
        </div>

        {canRotate ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              className="icon-interactive rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/85 hover:bg-white/10"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                goPrev(true)
              }}
              aria-label={t('promo_prev')}
            >
              {t('promo_prev')}
            </button>
            <div className="flex items-center gap-1.5">
              {normalizedItems.map((item, idx) => (
                <button
                  key={`${item.id}-dot`}
                  type="button"
                  className={`h-2 rounded-full transition-all ${
                    idx === activeIndex ? 'w-5 bg-brand-blue' : 'w-2 bg-white/35 hover:bg-white/50'
                  }`}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    goTo(idx, true)
                  }}
                  aria-label={`${t('promo_go_to')} ${idx + 1}`}
                />
              ))}
            </div>
            <button
              type="button"
              className="icon-interactive rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/85 hover:bg-white/10"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                goNext(true)
              }}
              aria-label={t('promo_next')}
            >
              {t('promo_next')}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
