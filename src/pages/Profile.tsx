import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAds,
  getDepositOffers,
  getMyProfile,
  getMyVipSummary,
  subscribeToLiveUpdates,
  type AdItem,
  type AuthUser,
  type DepositOffer,
  type UserVipSummary,
} from '../api'
import {
  HomeScreen,
  type HomeScreenActiveOfferSummary,
  type HomeScreenArenaOffer,
  type HomeScreenOffer,
  type HomeScreenPromoSlide,
} from '../HomeScreen'
import { ProfilePullToRefreshIndicator } from '../components/profile-v2/ProfilePullToRefreshIndicator'
import { useDailyEarningsSummary } from '../hooks/useDailyEarningsSummary'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'

function buildDefaultOffers(primaryCtaTarget: string, navigate: ReturnType<typeof useNavigate>): HomeScreenOffer[] {
  return [
    {
      id: 100001,
      badge: 'الأقوى الآن',
      title: 'تشغيل التعدين الفوري',
      description: 'ابدأ الربح خلال دقائق',
      tone: 'gold',
      onClick: () => navigate(primaryCtaTarget),
    },
    {
      id: 100002,
      badge: 'VIP',
      title: 'عائد يومي أعلى',
      description: 'مزايا حصرية للمستويات الأعلى',
      tone: 'purple',
      onClick: () => navigate('/vip'),
    },
    {
      id: 100003,
      badge: 'إيداع',
      title: 'عروض تعزيز الأرباح',
      description: 'ضاعف رأس المال التشغيلي',
      tone: 'cyan',
      onClick: () => navigate('/deposit'),
    },
  ]
}

export function Profile() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [profileAds, setProfileAds] = useState<AdItem[]>([])
  const [depositOffers, setDepositOffers] = useState<DepositOffer[]>([])
  const [vipSummary, setVipSummary] = useState<UserVipSummary | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [nowTs, setNowTs] = useState(() => Date.now())
  const { summary: walletSummary, refresh: refreshWalletSummary } = useWalletSummary({ subscribeLive: false })
  const { summary: dailyEarningsSummary, refresh: refreshDailyEarnings } = useDailyEarningsSummary()

  const loadData = useCallback(async () => {
    const [profileRes, adsRes, offersRes, vipRes] = await Promise.allSettled([
      getMyProfile(),
      getAds('profile'),
      getDepositOffers(),
      getMyVipSummary(),
    ])

    if (profileRes.status === 'fulfilled') setProfile(profileRes.value.profile)
    if (adsRes.status === 'fulfilled') setProfileAds(adsRes.value.items || [])
    if (offersRes.status === 'fulfilled') setDepositOffers(offersRes.value.items || [])
    if (vipRes.status === 'fulfilled') setVipSummary(vipRes.value)
  }, [])

  const refreshDashboard = useCallback(async () => {
    await Promise.allSettled([loadData(), refreshWalletSummary(), refreshDailyEarnings()])
  }, [loadData, refreshDailyEarnings, refreshWalletSummary])

  useEffect(() => {
    refreshDashboard().catch(() => {})
  }, [refreshDashboard])

  useEffect(() => {
    return subscribeToLiveUpdates((event) => {
      if (
        event.type === 'balance_updated' ||
        event.type === 'home_content_updated' ||
        event.type === 'announcement_updated'
      ) {
        refreshDashboard().catch(() => {})
      }
    })
  }, [refreshDashboard])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowTs(Date.now())
    }, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    let startY = 0
    let active = false

    function onTouchStart(event: TouchEvent) {
      if (window.scrollY > 0 || isPullRefreshing) return
      startY = event.touches[0]?.clientY || 0
      active = true
    }

    function onTouchMove(event: TouchEvent) {
      if (!active || window.scrollY > 0 || isPullRefreshing) return
      const currentY = event.touches[0]?.clientY || 0
      const delta = Math.max(0, currentY - startY)
      const eased = Math.min(110, delta * 0.38)
      if (eased > 0) setPullDistance(eased)
    }

    async function onTouchEnd() {
      if (!active) return
      active = false
      const shouldRefresh = pullDistance >= 68
      setPullDistance(0)
      if (!shouldRefresh) return
      setIsPullRefreshing(true)
      try {
        await refreshDashboard()
      } finally {
        setIsPullRefreshing(false)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [isPullRefreshing, pullDistance, refreshDashboard])

  const vipCurrentLevel = Math.max(0, Math.min(5, Number(vipSummary?.currentVipLevel || profile?.vip_level || 0)))
  const vipProgressPct = Math.max(0, Math.min(100, Number(vipSummary?.progressPct || 0)))
  const vipNextLevel =
    vipSummary?.nextLevel != null && vipSummary.nextLevel >= 1 && vipSummary.nextLevel <= 5
      ? vipSummary.nextLevel
      : null

  const activeOfferSummary = useMemo<HomeScreenActiveOfferSummary | null>(() => {
    const nearestOffer = depositOffers.find((offer) => offer.state === 'active' || offer.state === 'claimed')
    if (!nearestOffer) return null

    const remainingSeconds =
      typeof nearestOffer.remainingSeconds === 'number'
        ? nearestOffer.remainingSeconds
        : nearestOffer.endsAt
          ? Math.max(0, Math.floor((new Date(nearestOffer.endsAt).getTime() - nowTs) / 1000))
          : 0

    const safeSeconds = Math.max(0, remainingSeconds)
    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0')
    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0')
    const seconds = String(safeSeconds % 60).padStart(2, '0')

    return {
      label: '\u064a\u0646\u062a\u0647\u064a \u0639\u0631\u0636 \u0627\u0644\u064a\u0648\u0645 \u062e\u0644\u0627\u0644',
      value: `${hours}:${minutes}:${seconds}`,
      title: nearestOffer.title,
      teaserText: nearestOffer.teaserText,
      headline: nearestOffer.headline,
      urgencyText: nearestOffer.urgencyText,
      minimumDeposit: nearestOffer.minimumDeposit,
      rewardPercentage: nearestOffer.rewardPercentage,
      onClick: () => navigate('/deposit'),
    }
  }, [depositOffers, navigate, nowTs])
  const primaryPromo = useMemo(
    () => profileAds.find((item) => item.type === 'image') || profileAds[0] || null,
    [profileAds],
  )

  const primaryCtaTarget =
    Number.isFinite(walletSummary.totalAssets) && walletSummary.totalAssets > 0 ? '/futures' : '/deposit'

  const openAdTarget = useCallback(
    (linkUrl: string | undefined, fallback: () => void) => {
      if (!linkUrl) {
        fallback()
        return
      }

      const target = String(linkUrl).trim()
      if (!target) {
        fallback()
        return
      }

      if (/^https?:\/\//i.test(target)) {
        window.open(target, '_blank', 'noopener,noreferrer')
        return
      }

      navigate(target)
    },
    [navigate],
  )

  const offerCards = useMemo<HomeScreenOffer[]>(() => {
    const defaults = buildDefaultOffers(primaryCtaTarget, navigate)
    const sourceItems = profileAds.filter((item) => item.id !== primaryPromo?.id).slice(0, 3)
    if (sourceItems.length === 0) return defaults

    const mapped = sourceItems.map((item, index) => {
      const title = String(item.title || '').trim()
      const description = String(item.description || '').trim()
      const route = String(item.linkUrl || '').toLowerCase()
      const searchableText = `${title} ${description} ${route}`

      let tone: HomeScreenOffer['tone'] = 'cyan'
      let badge = 'عرض'
      let fallback = () => navigate('/deposit')

      if (/vip/.test(searchableText)) {
        tone = 'purple'
        badge = 'VIP'
        fallback = () => navigate('/vip')
      } else if (/referral|friends|invite|دعوة|إحالة/.test(searchableText)) {
        tone = 'cyan'
        badge = 'دعوة'
        fallback = () => navigate('/referral')
      } else if (/mining|futures|earn|mine|تعدين|ربح/.test(searchableText)) {
        tone = 'gold'
        badge = 'الأقوى الآن'
        fallback = () => navigate(primaryCtaTarget)
      } else if (/deposit|إيداع/.test(searchableText)) {
        tone = 'cyan'
        badge = 'إيداع'
        fallback = () => navigate('/deposit')
      }

      return {
        id: item.id,
        title: title || defaults[index]?.title || 'عرض مميز',
        description: description || defaults[index]?.description || 'استكشف تفاصيل العرض الآن',
        badge,
        tone,
        onClick: () => openAdTarget(item.linkUrl, fallback),
      }
    })

    return [...mapped, ...defaults.slice(mapped.length)].slice(0, 3)
  }, [navigate, openAdTarget, primaryCtaTarget, primaryPromo?.id, profileAds])

  const arenaOffer = useMemo<HomeScreenArenaOffer>(() => {
    const arenaAd = profileAds.find((item) => {
      const title = String(item.title || '').toLowerCase()
      const description = String(item.description || '').toLowerCase()
      const route = String(item.linkUrl || '').toLowerCase()
      return /arena|prediction|predict|توقع|التوقعات|ساحة/.test(`${title} ${description} ${route}`)
    })

    if (!arenaAd) {
      return {
        badge: 'ساحة التوقعات',
        title: 'جولات مباشرة على الأصول الحية',
        description: 'توقع الاتجاه وادخل بسرعة إلى الجولات النشطة',
        onClick: () => navigate('/arena'),
      }
    }

    return {
      badge: String(arenaAd.title || '').trim() ? 'عرض الساحة' : 'ساحة التوقعات',
      title: String(arenaAd.title || '').trim() || 'جولات مباشرة على الأصول الحية',
      description: String(arenaAd.description || '').trim() || 'توقع الاتجاه وادخل بسرعة إلى الجولات النشطة',
      onClick: () => openAdTarget(arenaAd.linkUrl, () => navigate('/arena')),
    }
  }, [navigate, openAdTarget, profileAds])

  const promoSlides = useMemo<HomeScreenPromoSlide[]>(() => {
    const arenaSlide: HomeScreenPromoSlide = {
      id: 990100,
      badge: 'ساحة التوقعات',
      title: 'ساحة التوقعات',
      description: 'توقع الاتجاه واربح المكافآت في جولات سريعة على الأصول الحية',
      ctaText: 'ادخل إلى الساحة',
      imageUrl: '/arena-main-banner.jpeg',
      onClick: () => navigate('/arena'),
    }

    const remainingSlides = profileAds
      .filter((item) => item.id !== primaryPromo?.id)
      .filter((item) => item.type === 'image' || item.type === 'video')
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        badge: String(item.title || '').trim() ? 'عرض مميز' : 'عرض',
        title: String(item.title || '').trim() || 'عرض مميز',
        description: String(item.description || '').trim() || 'استكشف تفاصيل العرض الآن داخل التطبيق',
        ctaText: 'اعرف المزيد',
        imageUrl: item.mediaUrl,
        onClick: () => openAdTarget(item.linkUrl, () => navigate('/deposit')),
      }))

    return [arenaSlide, ...remainingSlides]
  }, [navigate, openAdTarget, primaryPromo?.id, profileAds])

  return (
    <div className="portfolio-screen-host">
      <ProfilePullToRefreshIndicator
        pullDistance={pullDistance}
        isPullRefreshing={isPullRefreshing}
        loadingText={t('common_loading')}
        pullText={t('home_pull_to_refresh')}
      />
      <HomeScreen
        currentBalance={walletSummary.mainBalance}
        currency={dailyEarningsSummary.currency || 'USDT'}
        dailyEarnings={dailyEarningsSummary.totalAmount}
        lockedBalance={walletSummary.lockedBalance}
        withdrawableBalance={walletSummary.withdrawableBalance}
        levelLabel={vipCurrentLevel > 0 ? `المستوى ${vipCurrentLevel}` : 'المستوى 0'}
        levelProgress={vipProgressPct}
        nextRewardText={vipNextLevel ? `+${Math.max(10, vipNextLevel * 5)}% أرباح يومية` : 'مزايا إضافية قريبًا'}
        startedTodayCount={dailyEarningsSummary.entriesCount || 87}
        activeUsersCount={Math.max(532, dailyEarningsSummary.entriesCount * 17)}
        promoSlides={promoSlides}
        offers={offerCards}
        arenaOffer={arenaOffer}
        activeOfferSummary={activeOfferSummary}
        onDeposit={() => navigate('/deposit')}
        onPrimaryCta={() => navigate(primaryCtaTarget)}
        onOpenEarningsDetails={() => navigate('/wallet')}
        onOpenReferral={() => navigate('/referral')}
        onOpenVip={() => navigate('/vip')}
        onOpenDepositOffers={() => navigate('/deposit')}
        onOpenArena={() => navigate('/arena')}
        onOpenWallet={() => navigate('/wallet')}
        onOpenWithdraw={() => navigate('/withdraw')}
      />
    </div>
  )
}
