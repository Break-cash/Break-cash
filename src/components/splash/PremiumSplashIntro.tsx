import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { getLogoUrl } from '../../api'

type PremiumSplashIntroProps = {
  onComplete: () => void
}

export function PremiumSplashIntro({ onComplete }: PremiumSplashIntroProps) {
  const prefersReducedMotion = useReducedMotion()
  const [logoUrl, setLogoUrl] = useState('/break-cash-logo-premium.png')
  const [logoBroken, setLogoBroken] = useState(false)
  const splashVideoUrl = '/ads/break-logo-motion.mp4'
  const totalMs = prefersReducedMotion ? 3000 : 3600
  const title = 'تجربة تداول احترافية'
  const subtitle = 'واجهة دخول سينمائية أكثر توازنًا، بطابع بصري فاخر وألوان منسجمة مع هوية التطبيق.'

  useEffect(() => {
    let mounted = true
    getLogoUrl()
      .then((res) => {
        if (!mounted) return
        const value = String(res.logoUrl || '').trim()
        if (value) setLogoUrl(value)
      })
      .catch(() => {
        // Keep fallback logo path.
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => onComplete(), totalMs)
    return () => window.clearTimeout(timer)
  }, [onComplete, totalMs])

  const sweepDuration = prefersReducedMotion ? 0 : 0.95
  const pulseDuration = prefersReducedMotion ? 0 : 0.9

  return (
    <motion.div
      className="premium-splash"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {!prefersReducedMotion ? (
        <motion.video
          className="premium-splash-video"
          src={splashVideoUrl}
          autoPlay
          muted
          playsInline
          preload="auto"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 0.8, scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      ) : null}
      <motion.div
        className="premium-splash-glow"
        initial={{ opacity: 0 }}
        animate={{ opacity: prefersReducedMotion ? 0.84 : 0.78 }}
        transition={{ duration: prefersReducedMotion ? 0.2 : 0.7, delay: prefersReducedMotion ? 0 : 0.2 }}
      />
      <motion.div
        className="premium-splash-texture"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: prefersReducedMotion ? 0.2 : 0.8, delay: prefersReducedMotion ? 0 : 0.35 }}
      />

      <div className="premium-splash-center">
        <motion.div
          className="premium-splash-copy"
          dir="rtl"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.2 : 0.75, delay: prefersReducedMotion ? 0 : 0.42 }}
        >
          <span className="premium-splash-kicker" dir="ltr">
            BREAK CASH
          </span>
          <h1 className="premium-splash-title">{title}</h1>
          <p className="premium-splash-subtitle">{subtitle}</p>
        </motion.div>

        <motion.div
          className="premium-splash-logo-shell"
          initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0.2 : 0.9, delay: prefersReducedMotion ? 0 : 0.75 }}
        >
          <div className="premium-splash-logo-stage">
            <img
              className="premium-splash-logo"
              src={logoBroken ? '/break-cash-logo-premium.png' : logoUrl}
              alt="BREAK CASH"
              decoding="async"
              loading="eager"
              onError={() => setLogoBroken(true)}
            />
            {!prefersReducedMotion ? (
              <>
                <motion.span
                  className="premium-splash-metal-sweep"
                  initial={{ x: '-130%' }}
                  animate={{ x: '140%' }}
                  transition={{ duration: sweepDuration, delay: 1.45, ease: 'easeInOut' }}
                />
                <motion.span
                  className="premium-splash-energy-pulse"
                  initial={{ opacity: 0, x: '-110%' }}
                  animate={{ opacity: [0, 0.9, 0], x: '110%' }}
                  transition={{ duration: pulseDuration, delay: 1.85, ease: 'easeInOut' }}
                />
              </>
            ) : null}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
