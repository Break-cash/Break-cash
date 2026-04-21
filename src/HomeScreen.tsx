import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpDown,
  Clock3,
  Crown,
  Eye,
  EyeOff,
  Flame,
  Gem,
  Rocket,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { type Language, useI18n } from './i18nCore'
import './HomeScreen.css'

export type HomeScreenOffer = {
  id: number
  title: string
  description: string
  badge: string
  tone: 'gold' | 'purple' | 'cyan'
  onClick: () => void
}

export type HomeScreenArenaOffer = {
  title: string
  description: string
  badge: string
  onClick: () => void
}

export type HomeScreenActiveOfferSummary = {
  label: string
  value: string
  title: string
  teaserText: string
  headline: string
  urgencyText: string
  minimumDeposit: number
  rewardPercentage: number
  onClick: () => void
}

export type HomeScreenPromoSlide = {
  id: number
  title: string
  description: string
  badge: string
  ctaText: string
  imageUrl?: string
  onClick: () => void
}

type HomeScreenProps = {
  currentBalance: number
  currency?: string
  dailyEarnings: number
  lockedBalance: number
  withdrawableBalance: number
  levelLabel: string
  levelProgress: number
  nextRewardText: string
  startedTodayCount: number
  activeUsersCount: number
  promoSlides?: HomeScreenPromoSlide[]
  offers?: HomeScreenOffer[]
  arenaOffer?: HomeScreenArenaOffer
  activeOfferSummary?: HomeScreenActiveOfferSummary | null
  onDeposit: () => void
  onPrimaryCta: () => void
  onOpenEarningsDetails: () => void
  onOpenReferral: () => void
  onOpenVip: () => void
  onOpenDepositOffers: () => void
  onOpenArena: () => void
  onOpenWallet: () => void
  onOpenWithdraw: () => void
}

function formatAmount(value: number, currency: string, locale: string) {
  return `${Number(value || 0).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`
}

function buildCountdown(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now())
  const totalSeconds = Math.floor(diff / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function getLocale(language: Language) {
  return language === 'ar' ? 'ar' : language === 'tr' ? 'tr-TR' : 'en-US'
}

function getHomeCopy(language: Language) {
  if (language === 'en') {
    return {
      currentBalance: 'Current balance',
      balanceDelta: '+12.5% vs yesterday',
      dailyEarnings: 'Expected earnings today',
      capitalDetails: 'Capital details',
      earningsDetails: 'Earnings details',
      deposit: 'Deposit',
      addBalance: 'Add funds',
      startNow: 'Start earning now',
      startNowSub: 'Activate mining and begin collecting rewards',
      level: 'Level',
      progress: 'Your progress',
      nextReward: 'Next level reward',
      startedToday: 'Started today',
      activeNow: 'Active now',
      activeDepositOffer: 'Active deposit offer',
      openOfferNow: 'Open the current deposit offer now',
      offerTeaser: 'Activate the current offer directly from the deposit page.',
      offerUrgency: 'This offer is time-bound and may expire soon.',
      minimum: 'Minimum deposit',
      reward: 'Reward',
      expiresIn: 'Ends in',
      depositNow: 'Deposit now',
      close: 'Close',
      showBalance: 'Show balance',
      hideBalance: 'Hide balance',
      promoIndicators: 'Banner indicators',
      promoSlide: 'Offer',
      todayProfit: 'Today profit',
      offersBoard: 'Offers board',
      viewAll: 'View all',
      viewDetails: 'View details',
      boostTitle: 'Boost your earnings',
      referral: 'Invite friends',
      referralDesc: 'Earn 10% + 1%',
      vip: 'VIP',
      vipDesc: '+25% daily rewards',
      depositDesc: 'Multiply your earnings now',
      accountSummary: 'Account summary',
      running: 'Running capital',
      withdrawable: 'Available to withdraw',
      promoFallbackBadge: 'No devices needed',
      promoFallbackTitle: 'Start mining now and earn every day',
      promoFallbackDesc: 'Daily returns, fast withdrawals, and a calmer premium experience.',
      promoFallbackCta: 'Start in 30 seconds',
      offerFallback1Badge: 'Top pick',
      offerFallback1Title: 'Instant mining activation',
      offerFallback1Desc: 'Start earning within minutes',
      offerFallback2Title: 'Higher daily yield',
      offerFallback2Desc: 'Exclusive benefits for higher tiers',
      offerFallback3Badge: 'Deposit',
      offerFallback3Title: 'Profit boost offers',
      offerFallback3Desc: 'Increase your working capital',
      arenaBadge: 'Prediction Arena',
      arenaTitle: 'Live rounds on real assets',
      arenaDesc: 'Predict the direction and enter active rounds immediately',
    }
  }

  if (language === 'tr') {
    return {
      currentBalance: 'Mevcut bakiye',
      balanceDelta: 'D\u00fcne g\u00f6re +12.5%',
      dailyEarnings: 'Bug\u00fcn\u00fcn beklenen kazanc\u0131',
      capitalDetails: 'Sermaye detaylar\u0131',
      earningsDetails: 'Kazan\u00e7 detaylar\u0131',
      deposit: 'Yat\u0131r',
      addBalance: 'Bakiye ekle',
      startNow: '\u015eimdi kazanmaya ba\u015fla',
      startNowSub: 'Madencili\u011fi etkinle\u015ftir ve \u00f6d\u00fcl toplamaya ba\u015fla',
      level: 'Seviye',
      progress: '\u0130lerlemen',
      nextReward: 'Sonraki seviye \u00f6d\u00fcl\u00fc',
      startedToday: 'Bug\u00fcn ba\u015flad\u0131',
      activeNow: '\u015eimdi aktif',
      activeDepositOffer: 'Aktif yat\u0131r\u0131m teklifi',
      openOfferNow: 'Mevcut yat\u0131r\u0131m teklifini \u015fimdi a\u00e7',
      offerTeaser: 'Teklifi do\u011frudan yat\u0131r\u0131m sayfas\u0131ndan etkinle\u015ftir.',
      offerUrgency: 'Bu teklif s\u00fcreyle s\u0131n\u0131rl\u0131d\u0131r ve yak\u0131nda bitebilir.',
      minimum: 'Minimum yat\u0131r\u0131m',
      reward: '\u00d6d\u00fcl',
      expiresIn: 'Biti\u015f',
      depositNow: '\u015eimdi yat\u0131r',
      close: 'Kapat',
      showBalance: 'Bakiyeyi g\u00f6ster',
      hideBalance: 'Bakiyeyi gizle',
      promoIndicators: 'Banner g\u00f6stergeleri',
      promoSlide: 'Teklif',
      todayProfit: 'Bug\u00fcn kazan\u00e7',
      offersBoard: 'Teklif panosu',
      viewAll: 'T\u00fcm\u00fcn\u00fc g\u00f6r',
      viewDetails: 'Detaylar\u0131 g\u00f6r',
      boostTitle: 'Kazanc\u0131n\u0131 art\u0131r',
      referral: 'Arkada\u015f davet et',
      referralDesc: '%10 + %1 kazan',
      vip: 'VIP',
      vipDesc: '+%25 g\u00fcnl\u00fck kazan\u00e7',
      depositDesc: 'Kazanc\u0131n\u0131 \u015fimdi art\u0131r',
      accountSummary: 'Hesap \u00f6zeti',
      running: '\u00c7al\u0131\u015fan sermaye',
      withdrawable: '\u00c7ekilebilir bakiye',
      promoFallbackBadge: 'Cihaz gerekmez',
      promoFallbackTitle: 'Madencili\u011fe \u015fimdi ba\u015fla ve her g\u00fcn kazan',
      promoFallbackDesc: 'G\u00fcnl\u00fck getiri, h\u0131zl\u0131 \u00e7ekim ve daha sakin premium deneyim.',
      promoFallbackCta: '30 saniyede ba\u015fla',
      offerFallback1Badge: '\u00d6ne \u00e7\u0131kan',
      offerFallback1Title: 'An\u0131nda madencilik aktivasyonu',
      offerFallback1Desc: 'Dakikalar i\u00e7inde kazanmaya ba\u015fla',
      offerFallback2Title: 'Daha y\u00fcksek g\u00fcnl\u00fck getiri',
      offerFallback2Desc: '\u00dcst seviyeler i\u00e7in \u00f6zel ayr\u0131cal\u0131klar',
      offerFallback3Badge: 'Yat\u0131r',
      offerFallback3Title: 'Kazan\u00e7 art\u0131ran teklifler',
      offerFallback3Desc: '\u00c7al\u0131\u015fan sermayeni b\u00fcy\u00fct',
      arenaBadge: 'Tahmin Arenas\u0131',
      arenaTitle: 'Canl\u0131 varl\u0131klarda anl\u0131k turlar',
      arenaDesc: 'Y\u00f6n\u00fc tahmin et ve aktif turlara hemen gir',
    }
  }

  return {
    currentBalance: '\u0631\u0635\u064a\u062f\u0643 \u0627\u0644\u062d\u0627\u0644\u064a',
    balanceDelta: '+12.5% \u0639\u0646 \u0623\u0645\u0633',
    dailyEarnings: '\u0623\u0631\u0628\u0627\u062d \u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0645\u062a\u0648\u0642\u0639\u0629',
    capitalDetails: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644',
    earningsDetails: '\u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0623\u0631\u0628\u0627\u062d',
    deposit: '\u0625\u064a\u062f\u0627\u0639',
    addBalance: '\u0623\u0636\u0641 \u0631\u0635\u064a\u062f\u0643',
    startNow: '\u0627\u0628\u062f\u0623 \u0627\u0644\u0631\u0628\u062d \u0627\u0644\u0622\u0646',
    startNowSub: '\u0634\u063a\u0651\u0644 \u0627\u0644\u062a\u0639\u062f\u064a\u0646 \u0648\u0627\u0628\u062f\u0623 \u0643\u0633\u0628 \u0627\u0644\u0623\u0631\u0628\u0627\u062d',
    level: '\u0627\u0644\u0645\u0633\u062a\u0648\u0649',
    progress: '\u062a\u0642\u062f\u0651\u0645\u0643',
    nextReward: '\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u0645\u0633\u062a\u0648\u0649 \u0627\u0644\u062a\u0627\u0644\u064a',
    startedToday: '\u0628\u062f\u0623\u0648\u0627 \u0627\u0644\u064a\u0648\u0645',
    activeNow: '\u0646\u0634\u0637 \u0627\u0644\u0622\u0646',
    activeDepositOffer: '\u0639\u0631\u0636 \u0625\u064a\u062f\u0627\u0639 \u0646\u0634\u0637',
    openOfferNow: '\u0627\u0641\u062a\u062d \u0639\u0631\u0636 \u0627\u0644\u0625\u064a\u062f\u0627\u0639 \u0627\u0644\u062d\u0627\u0644\u064a \u0627\u0644\u0622\u0646',
    offerTeaser: '\u0641\u0639\u0651\u0644 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u062d\u0627\u0644\u064a \u0645\u0646 \u0635\u0641\u062d\u0629 \u0627\u0644\u0625\u064a\u062f\u0627\u0639 \u0645\u0628\u0627\u0634\u0631\u0629',
    offerUrgency: '\u0647\u0630\u0627 \u0627\u0644\u0639\u0631\u0636 \u0645\u062d\u062f\u0648\u062f \u0628\u0627\u0644\u0648\u0642\u062a \u0648\u0642\u062f \u064a\u0646\u062a\u0647\u064a \u0642\u0631\u064a\u0628\u064b\u0627.',
    minimum: '\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649',
    reward: '\u0627\u0644\u0645\u0643\u0627\u0641\u0623\u0629',
    expiresIn: '\u064a\u0646\u062a\u0647\u064a \u062e\u0644\u0627\u0644',
    depositNow: '\u0625\u064a\u062f\u0627\u0639 \u0627\u0644\u0622\u0646',
    close: '\u0625\u063a\u0644\u0627\u0642',
    showBalance: '\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0631\u0635\u064a\u062f',
    hideBalance: '\u0625\u062e\u0641\u0627\u0621 \u0627\u0644\u0631\u0635\u064a\u062f',
    promoIndicators: '\u0645\u0624\u0634\u0631\u0627\u062a \u0627\u0644\u0628\u0627\u0646\u0631',
    promoSlide: '\u0639\u0631\u0636',
    todayProfit: '\u0623\u0631\u0628\u0627\u062d \u0627\u0644\u064a\u0648\u0645',
    offersBoard: '\u0644\u0648\u062d\u0629 \u0627\u0644\u0639\u0631\u0648\u0636',
    viewAll: '\u0639\u0631\u0636 \u0627\u0644\u0643\u0644',
    viewDetails: '\u0639\u0631\u0636 \u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644',
    boostTitle: '\u0639\u0632\u0651\u0632 \u0623\u0631\u0628\u0627\u062d\u0643',
    referral: '\u062f\u0639\u0648\u0629 \u0627\u0644\u0623\u0635\u062f\u0642\u0627\u0621',
    referralDesc: '\u0627\u0631\u0628\u062d 10% + 1%',
    vip: 'VIP',
    vipDesc: '+25% \u0623\u0631\u0628\u0627\u062d \u064a\u0648\u0645\u064a\u0629',
    depositDesc: '\u0636\u0627\u0639\u0641 \u0623\u0631\u0628\u0627\u062d\u0643 \u0627\u0644\u0622\u0646',
    accountSummary: '\u0645\u0644\u062e\u0635 \u0627\u0644\u062d\u0633\u0627\u0628',
    running: '\u0642\u064a\u062f \u0627\u0644\u062a\u0634\u063a\u064a\u0644',
    withdrawable: '\u0627\u0644\u0645\u062a\u0627\u062d \u0644\u0644\u0633\u062d\u0628',
    promoFallbackBadge: '\u0628\u062f\u0648\u0646 \u0623\u062c\u0647\u0632\u0629!',
    promoFallbackTitle: '\u0627\u0628\u062f\u0623 \u0627\u0644\u062a\u0639\u062f\u064a\u0646 \u0627\u0644\u0622\u0646 \u0648\u0627\u0631\u0628\u062d \u0643\u0644 \u064a\u0648\u0645',
    promoFallbackDesc: '\u0623\u0631\u0628\u0627\u062d \u064a\u0648\u0645\u064a\u0629 \u0645\u0628\u0627\u0634\u0631\u0629\u060c \u0633\u062d\u0628 \u0641\u0648\u0631\u064a\u060c \u0648\u062a\u062c\u0631\u0628\u0629 \u0641\u0627\u062e\u0631\u0629 \u0623\u0643\u062b\u0631 \u0647\u062f\u0648\u0621\u064b\u0627.',
    promoFallbackCta: '\u0627\u0628\u062f\u0623 \u062e\u0644\u0627\u0644 30 \u062b\u0627\u0646\u064a\u0629',
    offerFallback1Badge: '\u0627\u0644\u0623\u0642\u0648\u0649 \u0627\u0644\u0622\u0646',
    offerFallback1Title: '\u062a\u0634\u063a\u064a\u0644 \u0627\u0644\u062a\u0639\u062f\u064a\u0646 \u0627\u0644\u0641\u0648\u0631\u064a',
    offerFallback1Desc: '\u0627\u0628\u062f\u0623 \u0627\u0644\u0631\u0628\u062d \u062e\u0644\u0627\u0644 \u062f\u0642\u0627\u0626\u0642',
    offerFallback2Title: '\u0639\u0627\u0626\u062f \u064a\u0648\u0645\u064a \u0623\u0639\u0644\u0649',
    offerFallback2Desc: '\u0645\u0632\u0627\u064a\u0627 \u062d\u0635\u0631\u064a\u0629 \u0644\u0644\u0645\u0633\u062a\u0648\u064a\u0627\u062a \u0627\u0644\u0623\u0639\u0644\u0649',
    offerFallback3Badge: '\u0625\u064a\u062f\u0627\u0639',
    offerFallback3Title: '\u0639\u0631\u0648\u0636 \u062a\u0639\u0632\u064a\u0632 \u0627\u0644\u0623\u0631\u0628\u0627\u062d',
    offerFallback3Desc: '\u0636\u0627\u0639\u0641 \u0631\u0623\u0633 \u0627\u0644\u0645\u0627\u0644 \u0627\u0644\u062a\u0634\u063a\u064a\u0644\u064a',
    arenaBadge: '\u0633\u0627\u062d\u0629 \u0627\u0644\u062a\u0648\u0642\u0639\u0627\u062a',
    arenaTitle: '\u062c\u0648\u0644\u0627\u062a \u0645\u0628\u0627\u0634\u0631\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u062d\u064a\u0629',
    arenaDesc: '\u062a\u0648\u0642\u0639 \u0627\u0644\u0627\u062a\u062c\u0627\u0647 \u0648\u0627\u062f\u062e\u0644 \u0628\u0633\u0631\u0639\u0629 \u0625\u0644\u0649 \u0627\u0644\u062c\u0648\u0644\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629',
  }
}

export function HomeScreen({
  currentBalance,
  currency = 'USDT',
  dailyEarnings,
  lockedBalance,
  withdrawableBalance,
  levelLabel,
  levelProgress,
  nextRewardText,
  startedTodayCount,
  activeUsersCount,
  promoSlides = [],
  offers = [],
  arenaOffer,
  activeOfferSummary,
  onDeposit,
  onPrimaryCta,
  onOpenEarningsDetails,
  onOpenReferral,
  onOpenVip,
  onOpenDepositOffers,
  onOpenArena,
  onOpenWallet,
  onOpenWithdraw,
}: HomeScreenProps) {
  const { language } = useI18n()
  const locale = getLocale(language)
  const copy = getHomeCopy(language)
  const [balanceHidden, setBalanceHidden] = useState(false)
  const [coinBoosted, setCoinBoosted] = useState(false)
  const [activePromoIndex, setActivePromoIndex] = useState(0)
  const [activeOfferModalOpen, setActiveOfferModalOpen] = useState(false)
  const previousBalanceRef = useRef<number | null>(null)
  const previousDailyRef = useRef<number | null>(null)
  const countdownTarget = useMemo(() => {
    const target = new Date()
    target.setHours(target.getHours() + 2, target.getMinutes() + 15, target.getSeconds() + 30, 0)
    return target
  }, [])
  const [countdown, setCountdown] = useState(() => buildCountdown(countdownTarget))
  const normalizedBalance = Number(currentBalance || 0)
  const normalizedDailyEarnings = Number(dailyEarnings || 0)

  useEffect(() => {
    if (activeOfferSummary) return
    const intervalId = window.setInterval(() => {
      setCountdown(buildCountdown(countdownTarget))
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [activeOfferSummary, countdownTarget])

  useEffect(() => {
    if (promoSlides.length <= 1) {
      setActivePromoIndex(0)
      return
    }
    const intervalId = window.setInterval(() => {
      setActivePromoIndex((current) => (current + 1) % promoSlides.length)
    }, 4800)
    return () => window.clearInterval(intervalId)
  }, [promoSlides])

  useEffect(() => {
    const previousBalance = previousBalanceRef.current
    const previousDaily = previousDailyRef.current

    if (Number.isFinite(normalizedBalance)) previousBalanceRef.current = normalizedBalance
    if (Number.isFinite(normalizedDailyEarnings)) previousDailyRef.current = normalizedDailyEarnings

    const balanceIncreased = previousBalance != null && Number.isFinite(normalizedBalance) && normalizedBalance > previousBalance
    const dailyIncreased = previousDaily != null && Number.isFinite(normalizedDailyEarnings) && normalizedDailyEarnings > previousDaily

    if (!balanceIncreased && !dailyIncreased) return

    setCoinBoosted(true)
    const timeoutId = window.setTimeout(() => setCoinBoosted(false), 2000)
    return () => window.clearTimeout(timeoutId)
  }, [normalizedBalance, normalizedDailyEarnings])

  const maskedAmount = balanceHidden ? '' : Number(currentBalance || 0).toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  const maskedDaily = balanceHidden ? '' : Number(dailyEarnings || 0).toFixed(2)

  const renderedOffers =
    offers.length > 0
      ? offers.slice(0, 3)
      : [
          {
            id: 1,
            badge: copy.offerFallback1Badge,
            title: copy.offerFallback1Title,
            description: copy.offerFallback1Desc,
            tone: 'gold' as const,
            onClick: onPrimaryCta,
          },
          {
            id: 2,
            badge: copy.vip,
            title: copy.offerFallback2Title,
            description: copy.offerFallback2Desc,
            tone: 'purple' as const,
            onClick: onOpenVip,
          },
          {
            id: 3,
            badge: copy.offerFallback3Badge,
            title: copy.offerFallback3Title,
            description: copy.offerFallback3Desc,
            tone: 'cyan' as const,
            onClick: onOpenDepositOffers,
          },
        ]

  const renderedArenaOffer = arenaOffer || {
    badge: copy.arenaBadge,
    title: copy.arenaTitle,
    description: copy.arenaDesc,
    onClick: onOpenArena,
  }

  const renderedPromoSlides =
    promoSlides.length > 0
      ? promoSlides
      : [
          {
            id: 1,
            badge: copy.promoFallbackBadge,
            title: copy.promoFallbackTitle,
            description: copy.promoFallbackDesc,
            ctaText: copy.promoFallbackCta,
            onClick: onPrimaryCta,
          },
        ]

  const activePromo = renderedPromoSlides[Math.min(activePromoIndex, renderedPromoSlides.length - 1)]
  const statsOffer = activeOfferSummary || {
    label: copy.expiresIn,
    value: countdown,
    title: copy.activeDepositOffer,
    teaserText: copy.offerTeaser,
    headline: copy.openOfferNow,
    urgencyText: copy.offerUrgency,
    minimumDeposit: 500,
    rewardPercentage: 10,
    onClick: onOpenDepositOffers,
  }

  return (
    <div className="app-home" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="app-home__frame">
        <section className="app-home__hero">
          <div className="app-home__hero-top">
            <div className="app-home__hero-side app-home__hero-side--balance">
              <div className="app-home__balance-head">
                <div className="app-home__eyebrow">{copy.currentBalance}</div>
                <button
                  type="button"
                  className="app-home__vision-toggle"
                  aria-label={balanceHidden ? copy.showBalance : copy.hideBalance}
                  onClick={() => setBalanceHidden((current) => !current)}
                >
                  {balanceHidden ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
              <div className="app-home__balance-row">
                <strong className="app-home__balance-number">{maskedAmount}</strong>
                <span className="app-home__balance-currency">{currency}</span>
              </div>
              <div className="app-home__hero-meta">{copy.balanceDelta}</div>
            </div>

            <div className="app-home__hero-center">
              <div className="app-home__hero-orbit" aria-hidden="true" />
              <div className="app-home__hero-orbit app-home__hero-orbit--reverse" aria-hidden="true" />
              <div className={`app-home__hero-coin ${coinBoosted ? 'is-boosted' : ''}`} aria-hidden="true">
                <span className="app-home__hero-coin-rim" />
                <span className="app-home__hero-coin-face" />
                <span className="app-home__hero-coin-reflection" />
                <span className="app-home__hero-coin-core">
                  <span className="app-home__hero-coin-logo">
                    <span className="app-home__hero-coin-logo-top" />
                    <span className="app-home__hero-coin-logo-stem" />
                    <span className="app-home__hero-coin-logo-tip" />
                  </span>
                </span>
              </div>
            </div>

            <div className="app-home__hero-side app-home__hero-side--earnings">
              <div className="app-home__eyebrow">{copy.dailyEarnings}</div>
              <strong className="app-home__earnings-value">
                +{maskedDaily} {currency}
              </strong>
              <div className="app-home__hero-meta">{copy.capitalDetails}</div>
              <button type="button" className="app-home__earnings-button" onClick={onOpenEarningsDetails}>
                {copy.earningsDetails}
              </button>
            </div>
          </div>

          <div className="app-home__hero-actions">
            <button type="button" className="app-home__ghost-button" onClick={onDeposit}>
              <span className="app-home__ghost-number">2</span>
              <span className="app-home__ghost-title">{copy.deposit}</span>
              <span className="app-home__ghost-subtitle">{copy.addBalance}</span>
            </button>

            <button type="button" className="app-home__primary-button" onClick={onPrimaryCta}>
              <span className="app-home__primary-title">{copy.startNow}</span>
              <span className="app-home__primary-subtitle">{copy.startNowSub}</span>
            </button>
          </div>
        </section>

        <section className="app-home__progress-card">
          <div className="app-home__progress-top">
            <div className="app-home__progress-side">
              <div className="app-home__progress-label">{copy.level}</div>
              <div className="app-home__progress-main app-home__progress-main--badge">
                <Sparkles size={13} />
                <span>{levelLabel}</span>
              </div>
            </div>

            <div className="app-home__progress-center">
              <div className="app-home__progress-label">{copy.progress}</div>
              <div className="app-home__progress-percent">{Math.round(levelProgress)}%</div>
            </div>

            <div className="app-home__progress-side app-home__progress-side--reward">
              <div className="app-home__progress-label">{copy.nextReward}</div>
              <div className="app-home__progress-reward">{nextRewardText}</div>
            </div>
          </div>
          <div className="app-home__progress-track">
            <div className="app-home__progress-fill" style={{ width: `${Math.max(0, Math.min(100, levelProgress))}%` }} />
          </div>
        </section>

        <section className="app-home__stats-bar">
          <button type="button" className="app-home__stat-cell app-home__stat-cell--action" onClick={() => setActiveOfferModalOpen(true)}>
            <span className="app-home__stat-icon app-home__stat-icon--danger">
              <Clock3 size={12} />
            </span>
            <div className="app-home__stat-label">{statsOffer.label}</div>
            <div className="app-home__stat-value app-home__stat-value--danger">{statsOffer.value}</div>
          </button>
          <div className="app-home__stat-cell">
            <span className="app-home__stat-icon">
              <Users size={12} />
            </span>
            <div className="app-home__stat-label">{copy.startedToday}</div>
            <div className="app-home__stat-value">{startedTodayCount.toLocaleString(locale)}</div>
          </div>
          <div className="app-home__stat-cell">
            <span className="app-home__stat-icon app-home__stat-icon--warm">
              <Flame size={12} />
            </span>
            <div className="app-home__stat-label">{copy.activeNow}</div>
            <div className="app-home__stat-value app-home__stat-value--warm">{activeUsersCount.toLocaleString(locale)}</div>
          </div>
        </section>

        {activeOfferModalOpen ? (
          <div className="app-home__offer-modal-backdrop" role="presentation" onClick={() => setActiveOfferModalOpen(false)}>
            <div className="app-home__offer-modal" role="dialog" aria-modal="true" aria-label={statsOffer.title} onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="app-home__offer-modal-close"
                aria-label={copy.close}
                onClick={() => setActiveOfferModalOpen(false)}
              >
                
              </button>
              <span className="app-home__offer-modal-chip">{copy.activeDepositOffer}</span>
              <h3>{statsOffer.headline}</h3>
              <p className="app-home__offer-modal-teaser">{statsOffer.teaserText}</p>
              <p className="app-home__offer-modal-urgency">{statsOffer.urgencyText}</p>
              <div className="app-home__offer-modal-metrics">
                <div className="app-home__offer-modal-metric">
                  <span>{copy.minimum}</span>
                  <strong>{statsOffer.minimumDeposit.toLocaleString(locale)} USD</strong>
                </div>
                <div className="app-home__offer-modal-metric">
                  <span>{copy.reward}</span>
                  <strong>{statsOffer.rewardPercentage}%</strong>
                </div>
                <div className="app-home__offer-modal-metric">
                  <span>{copy.expiresIn}</span>
                  <strong>{statsOffer.value}</strong>
                </div>
              </div>
              <button
                type="button"
                className="app-home__offer-modal-cta"
                onClick={() => {
                  setActiveOfferModalOpen(false)
                  statsOffer.onClick()
                }}
              >
                {copy.depositNow}
              </button>
            </div>
          </div>
        ) : null}

        <section
          className="app-home__promo-card"
          role="button"
          tabIndex={0}
          onClick={activePromo.onClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              activePromo.onClick()
            }
          }}
        >
          <div className="app-home__promo-copy">
            <span className="app-home__promo-chip">{activePromo.badge}</span>
            <h2>{activePromo.title}</h2>
            <p>{activePromo.description}</p>
            <button
              type="button"
              className="app-home__promo-button"
              onClick={(event) => {
                event.stopPropagation()
                activePromo.onClick()
              }}
            >
              {activePromo.ctaText}
            </button>
            {renderedPromoSlides.length > 1 ? (
              <div className="app-home__promo-dots" aria-label={copy.promoIndicators}>
                {renderedPromoSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={`app-home__promo-dot ${index === activePromoIndex ? 'is-active' : ''}`}
                    aria-label={`${copy.promoSlide} ${index + 1}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      setActivePromoIndex(index)
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <div className="app-home__promo-visual" style={activePromo.imageUrl ? { backgroundImage: `url(${activePromo.imageUrl})` } : undefined}>
            <div className="app-home__promo-pill">
              <span>
                +{maskedDaily} {currency}
              </span>
              <small>{copy.todayProfit}</small>
            </div>
            {!activePromo.imageUrl ? <div className="app-home__promo-coin"></div> : null}
          </div>
        </section>

        <section className="app-home__offers-board">
          <div className="app-home__offers-board-head">
            <span className="app-home__offers-kicker">{copy.offersBoard}</span>
            <button type="button" className="app-home__section-link" onClick={onOpenDepositOffers}>
              {copy.viewAll}
            </button>
          </div>
          <div className="app-home__offers-grid">
            {renderedOffers.map((offer) => (
              <button key={offer.id} type="button" className={`app-home__offer-tile app-home__offer-tile--${offer.tone}`} onClick={offer.onClick}>
                <span className="app-home__offer-badge">{offer.badge}</span>
                <strong>{offer.title}</strong>
                <small>{offer.description}</small>
              </button>
            ))}
          </div>
          <button type="button" className="app-home__arena-tile" onClick={renderedArenaOffer.onClick}>
            <span className="app-home__arena-icon">
              <ArrowUpDown size={16} />
            </span>
            <div className="app-home__arena-copy">
              <span className="app-home__arena-kicker">{renderedArenaOffer.badge}</span>
              <strong>{renderedArenaOffer.title}</strong>
              <small>{renderedArenaOffer.description}</small>
            </div>
          </button>
        </section>

        <div className="app-home__section-head">
          <button type="button" className="app-home__section-link" onClick={onOpenWallet}>
            {copy.viewDetails}
          </button>
          <div className="app-home__section-title">{copy.boostTitle}</div>
        </div>

        <section className="app-home__booster-grid">
          <button type="button" className="app-home__booster-card app-home__booster-card--referral" onClick={onOpenReferral}>
            <UserPlus size={16} />
            <strong>{copy.referral}</strong>
            <span>{copy.referralDesc}</span>
          </button>
          <button type="button" className="app-home__booster-card app-home__booster-card--vip" onClick={onOpenVip}>
            <Crown size={16} />
            <strong>{copy.vip}</strong>
            <span>{copy.vipDesc}</span>
          </button>
          <button type="button" className="app-home__booster-card app-home__booster-card--deposit" onClick={onOpenDepositOffers}>
            <Wallet size={16} />
            <strong>{copy.deposit}</strong>
            <span>{copy.depositDesc}</span>
          </button>
        </section>

        <section className="app-home__summary-card">
          <div className="app-home__summary-head">
            <button type="button" onClick={onOpenWallet}>
              {copy.viewDetails}
            </button>
            <h2>{copy.accountSummary}</h2>
          </div>

          <div className="app-home__summary-grid">
            <button type="button" className="app-home__summary-box" onClick={onOpenWallet}>
              <span className="app-home__summary-icon">
                <Rocket size={14} />
              </span>
              <span>{copy.running}</span>
              <strong>{formatAmount(lockedBalance, currency, locale)}</strong>
            </button>
            <button type="button" className="app-home__summary-box app-home__summary-box--teal" onClick={onOpenWithdraw}>
              <span className="app-home__summary-icon app-home__summary-icon--teal">
                <Gem size={14} />
              </span>
              <span>{copy.withdrawable}</span>
              <strong>{formatAmount(withdrawableBalance, currency, locale)}</strong>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
