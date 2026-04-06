import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  claimMiningDaily,
  emergencyWithdrawMining,
  getAds,
  getMiningMy,
  subscribeMining,
  subscribeToLiveUpdates,
  type AdItem,
  type MiningConfig,
  type MiningProfile,
} from '../api'
import { playFeedbackSound, vibrateFeedback } from '../appFeedback'
import { AdBanner } from '../components/ads/AdBanner'
import { MiningVideoSection } from '../components/mining/MiningVideoSection'
import { AppModalPortal } from '../components/ui/AppModalPortal'
import { useI18n, type Language } from '../i18nCore'
import { emitToast } from '../toastBus'

type ConfirmAction = 'subscribe' | 'increase' | 'claim' | 'emergency' | null
type MiningActivationPhase = 'idle' | 'press' | 'wallet' | 'starting' | 'success' | 'failure'

type ActivationSnapshot = {
  action: 'subscribe' | 'increase'
  amount: number
  baselinePrincipal: number
  baselineDaily: number
}

type DisplayValues = {
  principal: number
  increase: number
  total: number
  daily: number
}

type BeamGeometry = {
  startX: number
  startY: number
  endX: number
  endY: number
  length: number
  angle: number
}

type ActivationCopy = {
  activating: string
  linking: string
  starting: string
  success: string
  active: string
}

const MINING_NAV_PULSE_EVENT = 'breakcash:mining-nav-pulse'
const DEMO_MINING_BALANCE = 10000

function createDemoMiningConfig(): MiningConfig {
  return {
    minSubscription: 500,
    planOptions: [500, 1000, 3000],
    emergencyFeePercent: 18,
    dailyTiers: [],
    monthlyTiers: [],
    mediaItems: [],
  }
}

function createDemoMiningProfile(): MiningProfile {
  return {
    id: -1,
    user_id: -1,
    status: 'inactive',
    currency: 'USDT',
    principal_amount: 0,
    daily_percent: 0.28,
    monthly_percent: 8.4,
    emergency_fee_percent: 18,
    started_at: null,
    monthly_lock_until: null,
    last_daily_claim_at: null,
    daily_profit_claimed_total: 0,
    monthly_profit_accrued_total: 0,
    cancel_requested_at: null,
    principal_release_at: null,
    principal_released_at: null,
    emergency_withdrawn_at: null,
    daily_claimable: 0,
    monthly_accrued_live: 0,
    can_release_principal: false,
    personal_balance: DEMO_MINING_BALANCE,
  }
}

function getActivationCopy(language: Language): ActivationCopy {
  if (language === 'tr') {
    return {
      activating: 'Abonelik etkinlestiriliyor...',
      linking: 'Cuzdan baglaniyor...',
      starting: 'Madencilik baslatiliyor...',
      success: 'Madencilik basariyla baslatildi',
      active: 'Madencilik artik aktif',
    }
  }
  if (language === 'en') {
    return {
      activating: 'Activating subscription...',
      linking: 'Connecting wallet...',
      starting: 'Starting mining...',
      success: 'Mining started successfully',
      active: 'Mining is now active',
    }
  }
  return {
    activating: 'Activating subscription...',
    linking: 'Connecting wallet...',
    starting: 'Starting mining...',
    success: 'Mining started successfully',
    active: 'Mining is now active',
  }
}
function easeOutQuart(value: number) {
  return 1 - (1 - value) ** 4
}

function buildBeamGeometry(
  buttonEl: HTMLButtonElement | null,
  walletEl: HTMLElement | null,
): BeamGeometry | null {
  if (!buttonEl || !walletEl) return null
  const buttonRect = buttonEl.getBoundingClientRect()
  const walletRect = walletEl.getBoundingClientRect()
  const startX = buttonRect.left + buttonRect.width / 2
  const startY = buttonRect.top + buttonRect.height / 2
  const endX = walletRect.left + walletRect.width * 0.75
  const endY = walletRect.top + 34
  const dx = endX - startX
  const dy = endY - startY
  return {
    startX,
    startY,
    endX,
    endY,
    length: Math.hypot(dx, dy),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  }
}

function formatRemainingTime(iso?: string | null) {
  if (!iso) return '--'
  const targetMs = Date.parse(iso)
  if (!Number.isFinite(targetMs)) return '--'
  const diffMs = targetMs - Date.now()
  if (diffMs <= 0) return '0d : 0h : 0m'
  const totalMinutes = Math.floor(diffMs / 60000)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  return `${days}d : ${hours}h : ${minutes}m`
}

export function MiningPage() {
  const { t, language } = useI18n()
  const activationCopy = useMemo(() => getActivationCopy(language), [language])

  const [config, setConfig] = useState<MiningConfig | null>(null)
  const [profile, setProfile] = useState<MiningProfile | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [miningAds, setMiningAds] = useState<AdItem[]>([])
  const [activationPhase, setActivationPhase] = useState<MiningActivationPhase>('idle')
  const [activationSnapshot, setActivationSnapshot] = useState<ActivationSnapshot | null>(null)
  const [ctaPhaseText, setCtaPhaseText] = useState('')
  const [displayValues, setDisplayValues] = useState<DisplayValues>({
    principal: 0,
    increase: 0,
    total: 0,
    daily: 0,
  })
  const [beamGeometry, setBeamGeometry] = useState<BeamGeometry | null>(null)
  const [successBadgeVisible, setSuccessBadgeVisible] = useState(false)
  const [walletVisualActive, setWalletVisualActive] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const subscribeSectionRef = useRef<HTMLElement | null>(null)
  const ctaButtonRef = useRef<HTMLButtonElement | null>(null)
  const walletCardRef = useRef<HTMLElement | null>(null)
  const phaseTimersRef = useRef<number[]>([])
  const cleanupTimersRef = useRef<number[]>([])
  const numberAnimationRef = useRef<number | null>(null)
  const activationRunRef = useRef(0)

  useEffect(() => {
    getAds('mining')
      .then((res) => setMiningAds(res.items || []))
      .catch(() => setMiningAds([]))
  }, [])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (event.type === 'home_content_updated') {
        getAds('mining').then((res) => setMiningAds(res.items || [])).catch(() => {})
      }
    })
    return unsub
  }, [])

  async function loadMining() {
    try {
      const res = await getMiningMy()
      setIsDemoMode(false)
      setConfig(res.config)
      setProfile(res.profile)
      return res
    } catch {
      setIsDemoMode(true)
      setConfig(createDemoMiningConfig())
      setProfile(createDemoMiningProfile())
      return null
    }
  }

  useEffect(() => {
    loadMining().catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      phaseTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      cleanupTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      if (numberAnimationRef.current) window.cancelAnimationFrame(numberAnimationRef.current)
    }
  }, [])

  const amountToUse = useMemo(() => {
    if (selectedAmount && selectedAmount > 0) return selectedAmount
    const typed = Number(customAmount || 0)
    return Number.isFinite(typed) ? typed : 0
  }, [selectedAmount, customAmount])

  const hasActiveSubscription = Boolean(profile && profile.status === 'active')
  const miningUiActive = hasActiveSubscription || walletVisualActive || activationPhase === 'success'
  const miningUiRemainingTime = miningUiActive ? formatRemainingTime(profile?.monthly_lock_until) : '--'
  const activeMiningVideoUrl = useMemo(() => {
    const videoItem = (config?.mediaItems || []).find(
      (item) => item.enabled && String(item.type || '').toLowerCase() === 'video' && String(item.url || '').trim(),
    )
    return String(videoItem?.url || '/mining/IMG_3056.MP4')
  }, [config?.mediaItems])

  const minimumTopUpAmount = useMemo(() => {
    const principal = Number(profile?.principal_amount || 0)
    if (!hasActiveSubscription || principal <= 0) return 0
    return Math.max(0.01, Number((principal * 0.01).toFixed(2)))
  }, [hasActiveSubscription, profile?.principal_amount])

  const effectiveMinimumAmount = hasActiveSubscription ? minimumTopUpAmount : Number(config?.minSubscription || 500)
  const availableTopUpBalance = Number(profile?.personal_balance || 0)
  const minimumTopUpLabel = `${minimumTopUpAmount.toFixed(2)} USDT (1%)`
  const activationBusy =
    submitting ||
    activationPhase === 'press' ||
    activationPhase === 'wallet' ||
    activationPhase === 'starting' ||
    activationPhase === 'success'

  useEffect(() => {
    if (activationPhase !== 'idle' && activationPhase !== 'failure') return
    const principal = Number(profile?.principal_amount || 0)
    const daily = Number(profile?.daily_claimable || 0)
    const showIncreaseBlock = hasActiveSubscription
    setDisplayValues({
      principal,
      increase: showIncreaseBlock ? Math.max(0, amountToUse) : 0,
      total: showIncreaseBlock ? Number((principal + Math.max(0, amountToUse)).toFixed(2)) : principal,
      daily,
    })
  }, [activationPhase, amountToUse, hasActiveSubscription, profile?.daily_claimable, profile?.principal_amount])

  function clearPhaseTimers() {
    phaseTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    phaseTimersRef.current = []
  }

  function clearCleanupTimers() {
    cleanupTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    cleanupTimersRef.current = []
  }

  function stopNumberAnimation() {
    if (numberAnimationRef.current) {
      window.cancelAnimationFrame(numberAnimationRef.current)
      numberAnimationRef.current = null
    }
  }

  function animateDisplayValues(target: DisplayValues, durationMs: number, from: DisplayValues) {
    stopNumberAnimation()
    const startedAt = performance.now()
    const nextTarget = {
      principal: Number(target.principal.toFixed(2)),
      increase: Number(target.increase.toFixed(2)),
      total: Number(target.total.toFixed(2)),
      daily: Number(target.daily.toFixed(4)),
    }

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs)
      const eased = easeOutQuart(progress)
      setDisplayValues({
        principal: Number((from.principal + (nextTarget.principal - from.principal) * eased).toFixed(2)),
        increase: Number((from.increase + (nextTarget.increase - from.increase) * eased).toFixed(2)),
        total: Number((from.total + (nextTarget.total - from.total) * eased).toFixed(2)),
        daily: Number((from.daily + (nextTarget.daily - from.daily) * eased).toFixed(4)),
      })
      if (progress < 1) {
        numberAnimationRef.current = window.requestAnimationFrame(step)
      } else {
        numberAnimationRef.current = null
        setDisplayValues(nextTarget)
      }
    }

    numberAnimationRef.current = window.requestAnimationFrame(step)
  }

  function dispatchMiningNavPulse() {
    window.dispatchEvent(new CustomEvent(MINING_NAV_PULSE_EVENT, { detail: { at: Date.now() } }))
  }

  function startActivationProcessing() {
    clearPhaseTimers()
    setActivationPhase('press')
    setCtaPhaseText(activationCopy.activating)
    phaseTimersRef.current.push(
      window.setTimeout(() => {
        setActivationPhase('wallet')
        setCtaPhaseText(activationCopy.linking)
      }, 420),
    )
    phaseTimersRef.current.push(
      window.setTimeout(() => {
        setActivationPhase('starting')
        setCtaPhaseText(activationCopy.starting)
      }, 980),
    )
  }

  function openConfirm(action: ConfirmAction) {
    setConfirmAction(action)
  }

  function handlePrimaryMiningAction() {
    if (amountToUse < effectiveMinimumAmount) {
      if (hasActiveSubscription) {
        setSelectedAmount(null)
        setCustomAmount(String(minimumTopUpAmount))
      } else {
        setSelectedAmount(effectiveMinimumAmount)
        setCustomAmount('')
      }
      const text = hasActiveSubscription
        ? t('mining_min_topup_error').replace('{amount}', minimumTopUpAmount.toFixed(2))
        : t('mining_min_subscription_error')
      setMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'INVALID_AMOUNT', message: text })
      subscribeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (hasActiveSubscription && availableTopUpBalance + 1e-8 < amountToUse) {
      const text = `${t('toast_error_insufficient_balance')}: ${availableTopUpBalance.toFixed(2)} USDT`
      setMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'INSUFFICIENT_BALANCE', message: text })
      subscribeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    openConfirm(hasActiveSubscription ? 'increase' : 'subscribe')
  }

  async function handleSubscriptionActivation(action: 'subscribe' | 'increase') {
    const runId = Date.now()
    activationRunRef.current = runId
    clearCleanupTimers()
    const snapshot: ActivationSnapshot = {
      action,
      amount: amountToUse,
      baselinePrincipal: Number(profile?.principal_amount || 0),
      baselineDaily: Number(profile?.daily_claimable || 0),
    }
    setActivationSnapshot(snapshot)
    setConfirmAction(null)
    setMessage(null)
    setBeamGeometry(null)
    setSuccessBadgeVisible(false)
    startActivationProcessing()
    setSubmitting(true)

    try {
      const res = isDemoMode ? { action } : await subscribeMining(snapshot.amount)
      let nextProfile: MiningProfile | null | undefined
      if (isDemoMode) {
        setProfile((current) => {
          const base = current ?? createDemoMiningProfile()
          const nextPrincipal = Number((Number(base.principal_amount || 0) + snapshot.amount).toFixed(2))
          const dailyPercent = Number(base.daily_percent || 0.28)
          const nextDaily = Number(((nextPrincipal * dailyPercent) / 100).toFixed(4))
          const nextProfileValue: MiningProfile = {
            ...base,
            status: 'active',
            principal_amount: nextPrincipal,
            daily_claimable: nextDaily,
            monthly_accrued_live: Number((Number(base.monthly_accrued_live || 0) + nextDaily).toFixed(4)),
            personal_balance: Number((Number(base.personal_balance || 0) - snapshot.amount).toFixed(2)),
          }
          nextProfile = nextProfileValue
          return nextProfileValue
        })
      } else {
        const latest = await loadMining()
        nextProfile = latest?.profile
      }
      const successText =
        action === 'increase' || res.action === 'increase'
          ? t('mining_increase_success')
          : t('mining_subscribe_success')

      clearPhaseTimers()
      setActivationPhase('success')
      setCtaPhaseText(activationCopy.success)
      setWalletVisualActive(true)
      setSuccessBadgeVisible(true)
      setBeamGeometry(buildBeamGeometry(ctaButtonRef.current, walletCardRef.current))

      const targetPrincipal = Number(nextProfile?.principal_amount || snapshot.baselinePrincipal + snapshot.amount)
      const targetDaily = Number(nextProfile?.daily_claimable || 0)
      animateDisplayValues(
        {
          principal: targetPrincipal,
          increase: snapshot.amount,
          total: targetPrincipal,
          daily: targetDaily,
        },
        1380,
        {
          principal: snapshot.baselinePrincipal,
          increase: 0,
          total: snapshot.baselinePrincipal,
          daily: snapshot.baselineDaily,
        },
      )

      setMessage({ type: 'success', text: successText })
      emitToast({ kind: 'success', message: successText, durationMs: 3600 })
      playFeedbackSound('miningSubscription').catch(() => {})
      vibrateFeedback([24, 48, 24])
      dispatchMiningNavPulse()
      setSelectedAmount(null)
      setCustomAmount('')

      cleanupTimersRef.current.push(
        window.setTimeout(() => {
          if (activationRunRef.current !== runId) return
          setBeamGeometry(null)
        }, 1500),
      )
      cleanupTimersRef.current.push(
        window.setTimeout(() => {
          if (activationRunRef.current !== runId) return
          setSuccessBadgeVisible(false)
          setCtaPhaseText(activationCopy.active)
        }, 2100),
      )
      cleanupTimersRef.current.push(
        window.setTimeout(() => {
          if (activationRunRef.current !== runId) return
          setActivationPhase('idle')
          setActivationSnapshot(null)
          setCtaPhaseText('')
        }, 3000),
      )
      cleanupTimersRef.current.push(
        window.setTimeout(() => {
          if (activationRunRef.current !== runId) return
          setWalletVisualActive(false)
        }, 5400),
      )
    } catch (error) {
      clearPhaseTimers()
      setBeamGeometry(null)
      setActivationPhase('failure')
      setWalletVisualActive(false)
      stopNumberAnimation()
      const raw = error instanceof Error ? String(error.message || '').trim() : ''
      const text =
        raw === 'INSUFFICIENT_BALANCE'
          ? `${t('toast_error_insufficient_balance')}: ${availableTopUpBalance.toFixed(2)} USDT`
          : raw === 'MIN_TOP_UP_PERCENT'
            ? t('mining_min_topup_error').replace('{amount}', minimumTopUpAmount.toFixed(2))
            : raw === 'MIN_SUBSCRIPTION'
              ? t('mining_min_subscription_error')
              : raw || t('toast_error_transaction_failed')
      setMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: raw || 'REQUEST_FAILED', message: text })
      subscribeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      cleanupTimersRef.current.push(
        window.setTimeout(() => {
          if (activationRunRef.current !== runId) return
          setActivationPhase('idle')
          setActivationSnapshot(null)
          setCtaPhaseText('')
        }, 620),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function performConfirmedAction() {
    if (!confirmAction) return

    if (confirmAction === 'subscribe' || confirmAction === 'increase') {
      await handleSubscriptionActivation(confirmAction)
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      if (confirmAction === 'claim') {
        if (isDemoMode) {
          setProfile((current) => {
            if (!current) return current
            const claimable = Number(current.daily_claimable || 0)
            const nextProfile: MiningProfile = {
              ...current,
              daily_profit_claimed_total: Number((Number(current.daily_profit_claimed_total || 0) + claimable).toFixed(4)),
              daily_claimable: 0,
              personal_balance: Number((Number(current.personal_balance || 0) + claimable).toFixed(2)),
            }
            return nextProfile
          })
        } else {
          await claimMiningDaily()
        }
        const text = t('mining_claim_success')
        setMessage({ type: 'success', text })
        emitToast({ kind: 'success', message: text, durationMs: 3200 })
      } else if (confirmAction === 'emergency') {
        if (isDemoMode) {
          setProfile((current) => {
            if (!current) return current
            const principal = Number(current.principal_amount || 0)
            const feePercent = Number(current.emergency_fee_percent || 18)
            const fee = Number(((principal * feePercent) / 100).toFixed(2))
            const net = Number((principal - fee).toFixed(2))
            const nextProfile: MiningProfile = {
              ...current,
              status: 'inactive',
              principal_amount: 0,
              daily_claimable: 0,
              personal_balance: Number((Number(current.personal_balance || 0) + net).toFixed(2)),
            }
            return nextProfile
          })
        } else {
          await emergencyWithdrawMining()
        }
        const text = t('mining_emergency_success')
        setMessage({ type: 'success', text })
        emitToast({ kind: 'success', message: text, durationMs: 4200 })
      }
      setConfirmAction(null)
      if (!isDemoMode) await loadMining()
    } catch (error) {
      const raw = error instanceof Error ? String(error.message || '').trim() : ''
      const text = raw || t('toast_error_transaction_failed')
      setMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: raw || 'REQUEST_FAILED', message: text })
    } finally {
      setSubmitting(false)
    }
  }

  const showIncreaseSummary =
    hasActiveSubscription ||
    activationSnapshot?.action === 'increase' ||
    (activationSnapshot?.action === 'subscribe' && Boolean(profile))

  const primaryButtonText =
    activationBusy && ctaPhaseText
      ? ctaPhaseText
      : hasActiveSubscription
        ? t('mining_increase_subscription')
        : t('mining_subscribe_button')

  return (
    <div className="page space-y-3">
      <AnimatePresence>
        {beamGeometry ? (
          <motion.div
            key={`${beamGeometry.startX}-${beamGeometry.endX}`}
            className="pointer-events-none fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.span
              className="mining-activation-ripple"
              style={{ left: beamGeometry.startX - 72, top: beamGeometry.startY - 72 }}
              initial={{ scale: 0.3, opacity: 0.65 }}
              animate={{ scale: 1.45, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
            <motion.span
              className="mining-activation-beam"
              style={{
                left: beamGeometry.startX,
                top: beamGeometry.startY,
                width: beamGeometry.length,
                transform: `translateY(-50%) rotate(${beamGeometry.angle}deg)`,
              }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ scaleX: 0.3, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
            {[0.14, 0.32, 0.55, 0.78].map((position, index) => (
              <motion.span
                key={position}
                className="mining-activation-particle"
                style={{
                  left: beamGeometry.startX + (beamGeometry.endX - beamGeometry.startX) * position,
                  top: beamGeometry.startY + (beamGeometry.endY - beamGeometry.startY) * position,
                }}
                initial={{ opacity: 0, scale: 0.4, y: 6 }}
                animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 0.8], y: [6, -8 - index * 2, -16 - index * 3] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.85, delay: index * 0.08, ease: 'easeOut' }}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <h1 className="page-title">{t('mining_title')}</h1>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <h2 className="mb-2 text-sm font-semibold text-white">{t('home_announcement_board')}</h2>
        <AdBanner items={miningAds} placement="mining" className="my-0" />
      </section>

      <motion.section
        id="subscribe"
        ref={subscribeSectionRef}
        className={`mining-subscribe-card relative overflow-hidden rounded-2xl border border-app-border bg-app-card p-3 ${
          activationBusy ? 'mining-subscribe-card--energized' : ''
        }`}
        animate={
          activationPhase === 'success'
            ? {
                boxShadow: [
                  '0 0 0 rgba(37,99,235,0)',
                  '0 0 0 1px rgba(96,165,250,0.24), 0 0 38px rgba(59,130,246,0.28)',
                  '0 0 0 1px rgba(96,165,250,0.18), 0 0 20px rgba(59,130,246,0.16)',
                ],
              }
            : activationBusy
              ? {
                  boxShadow: [
                    '0 0 0 1px rgba(59,130,246,0.08), 0 0 0 rgba(14,165,233,0)',
                    '0 0 0 1px rgba(59,130,246,0.16), 0 0 18px rgba(14,165,233,0.12)',
                  ],
                }
              : { boxShadow: '0 0 0 rgba(0,0,0,0)' }
        }
        transition={{ duration: activationPhase === 'success' ? 1.2 : 0.45, ease: 'easeOut' }}
      >
        <motion.div
          className="mining-subscribe-sheen"
          initial={false}
          animate={
            activationPhase === 'success'
              ? { opacity: [0, 0.85, 0], x: ['-20%', '110%', '130%'] }
              : activationBusy
                ? { opacity: [0.12, 0.35, 0.12], x: ['-15%', '25%', '55%'] }
                : { opacity: 0, x: '-20%' }
          }
          transition={{
            duration: activationPhase === 'success' ? 1.3 : 1.8,
            repeat: activationBusy && activationPhase !== 'success' ? Number.POSITIVE_INFINITY : 0,
            ease: 'easeInOut',
          }}
        />

        <h2 className="text-sm font-semibold text-white">
          {hasActiveSubscription ? t('mining_increase_title') : t('mining_subscribe_title')}
        </h2>
        <p className="mt-1 text-xs text-app-muted">
          {hasActiveSubscription
            ? `${t('mining_increase_hint')} ${minimumTopUpLabel}`
            : `${t('mining_subscribe_hint')} ${config?.minSubscription || 500}$`}
        </p>

        {showIncreaseSummary ? (
          <motion.div
            className={`mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3 text-sm ${
              activationPhase === 'success' ? 'mining-summary-live' : ''
            }`}
            animate={activationPhase === 'success' ? { scale: [1, 1.012, 1] } : { scale: 1 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-app-muted">Available top-up balance</span>
              <span className="font-semibold text-white">{availableTopUpBalance.toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-muted">Current mining principal</span>
              <span className="font-semibold text-white">{displayValues.principal.toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-muted">New top-up amount</span>
              <span className="font-semibold text-positive">{displayValues.increase.toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-muted">Total after top-up</span>
              <span className="font-semibold text-brand-blue">{displayValues.total.toFixed(2)} USDT</span>
            </div>
          </motion.div>
        ) : null}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {(config?.planOptions || [500, 1000, 3000]).map((value) => (
            <button
              key={value}
              type="button"
              className={`wallet-action-btn ${selectedAmount === value ? 'wallet-action-deposit' : 'owner-set-btn'} ${
                activationBusy ? 'opacity-60' : ''
              }`}
              disabled={activationBusy}
              onClick={() => {
                setSelectedAmount(value)
                setCustomAmount('')
              }}
            >
              {value}$
            </button>
          ))}
        </div>

        <div className="mt-2">
          <input
            type="number"
            min={effectiveMinimumAmount}
            step="0.01"
            className="field-input"
            placeholder={t('mining_custom_amount')}
            value={customAmount}
            disabled={activationBusy}
            onChange={(e) => {
              setCustomAmount(e.target.value)
              setSelectedAmount(null)
            }}
          />
        </div>

        <motion.button
          ref={ctaButtonRef}
          type="button"
          className={`relative mt-3 w-full overflow-hidden rounded-xl border border-brand-blue/40 bg-brand-blue px-4 py-2 text-sm font-semibold text-white ${
            activationPhase === 'failure' ? 'mining-cta-error' : ''
          }`}
          onClick={handlePrimaryMiningAction}
          disabled={activationBusy}
          animate={
            activationPhase === 'failure'
              ? { x: [0, -8, 8, -6, 6, 0], scale: 1 }
              : activationBusy
                ? { scale: [1, 0.972, 1] }
                : { x: 0, scale: 1 }
          }
          transition={{
            duration: activationPhase === 'failure' ? 0.42 : 0.52,
            ease: activationPhase === 'failure' ? 'easeInOut' : 'easeOut',
          }}
        >
          <span
            className={`absolute inset-0 ${
              activationBusy ? 'mining-cta-live-overlay' : 'opacity-0'
            }`}
            aria-hidden="true"
          />
          <span className="relative z-[1] inline-flex items-center justify-center gap-2">
            {activationBusy ? <span className="mining-cta-spinner" aria-hidden="true" /> : null}
            <span>{primaryButtonText}</span>
          </span>
        </motion.button>
      </motion.section>

      <motion.section
        ref={walletCardRef}
        className={`mining-wallet-card relative overflow-hidden rounded-2xl border border-app-border bg-app-card p-3 ${
          walletVisualActive || profile?.status === 'active' ? 'mining-wallet-card--active' : ''
        }`}
        animate={
          activationPhase === 'success'
            ? {
                scale: [1, 1.015, 1],
                boxShadow: [
                  '0 0 0 rgba(14,165,233,0)',
                  '0 0 0 1px rgba(45,212,191,0.18), 0 18px 42px rgba(14,165,233,0.18)',
                  '0 0 0 1px rgba(45,212,191,0.12), 0 10px 26px rgba(14,165,233,0.1)',
                ],
              }
            : { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' }
        }
        transition={{ duration: 1.05, ease: 'easeOut' }}
      >
        <AnimatePresence>
          {successBadgeVisible ? (
            <motion.span
              className="mining-wallet-badge"
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {activationCopy.success}
            </motion.span>
          ) : null}
        </AnimatePresence>

        <MiningVideoSection
          isActive={miningUiActive}
          hashRate={miningUiActive ? 245.7 : 0}
          earningsUsdt={Number(displayValues.daily || 0)}
          remainingTime={miningUiRemainingTime}
          mediaUrl={activeMiningVideoUrl}
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="wallet-action-btn wallet-action-deposit"
            onClick={() => openConfirm('claim')}
            disabled={activationBusy || Number(profile?.daily_claimable || 0) <= 0}
          >
            {t('mining_claim_daily')}
          </button>
          <button
            type="button"
            className="wallet-action-btn wallet-action-withdraw"
            onClick={() => openConfirm('emergency')}
            disabled={activationBusy || profile?.status === 'inactive' || !profile}
          >
            {t('mining_emergency_withdraw')}
          </button>
        </div>
      </motion.section>

      {message ? (
        <div className={`rounded-xl px-3 py-2 text-sm ${message.type === 'success' ? 'owner-message-success' : 'owner-message-error'}`}>
          {message.text}
        </div>
      ) : null}

      {confirmAction ? (
        <AppModalPortal>
          <div className="liquid-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
            <div className="liquid-modal-card w-full max-w-sm rounded-2xl border border-app-border bg-app-card p-4">
              <h3 className="text-base font-semibold text-white">{t('mining_confirm_title')}</h3>
              <p className="mt-2 text-sm text-app-muted">
                {confirmAction === 'subscribe'
                  ? `${t('mining_confirm_subscribe')} ${amountToUse.toFixed(2)} USDT`
                  : confirmAction === 'increase'
                    ? `${t('mining_confirm_increase')} ${amountToUse.toFixed(2)} USDT`
                    : confirmAction === 'claim'
                      ? t('mining_confirm_claim')
                      : t('mining_confirm_emergency')}
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-app-border bg-app-elevated px-3 py-2 text-sm text-white/80"
                  onClick={() => setConfirmAction(null)}
                  disabled={submitting}
                >
                  {t('common_cancel')}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white"
                  onClick={performConfirmedAction}
                  disabled={submitting}
                >
                  {submitting ? '...' : t('common_confirm')}
                </button>
              </div>
            </div>
          </div>
        </AppModalPortal>
      ) : null}
    </div>
  )
}
