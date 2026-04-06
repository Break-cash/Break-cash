import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown, Gift, Headset, UserPlus, Users, type LucideIcon } from 'lucide-react'
import {
  apiFetch,
  getMyProfile,
  getMyVipSummary,
  getAds,
  getHomeLeaderboardConfig,
  getPushPublicKey,
  getPushSubscriptionStatus,
  removePushSubscription,
  savePushSubscription,
  sendPushTest,
  subscribeToLiveUpdates,
  type AuthUser,
  type AdItem,
  type HomeLeaderboardConfig,
  type UserVipSummary,
} from '../api'
import { defaultHomeLeaderboardConfig } from '../components/home/LeaderboardSection'
import { useDailyEarningsSummary } from '../hooks/useDailyEarningsSummary'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'
import { getPremiumProfileColorClass } from '../premiumIdentity'
import { appData } from '../data'
import { walletDashboardMock } from '../ui/mobileMock'
import { ProfileV2Shell } from '../components/profile-v2/ProfileV2Shell'
import { ProfilePullToRefreshIndicator } from '../components/profile-v2/ProfilePullToRefreshIndicator'
import { ProfileHeroWalletSection } from '../components/profile-v2/ProfileHeroWalletSection'
import { ProfileAdsSection } from '../components/profile-v2/ProfileAdsSection'
import { ProfileQuickActionsGrid } from '../components/profile-v2/ProfileQuickActionsGrid'
import { ProfileTopControlsBar } from '../components/profile-v2/ProfileTopControlsBar'
import { ProfileVipCard } from '../components/profile-v2/ProfileVipCard'
import { ProfileLowerOverviewSection } from '../components/profile-v2/ProfileLowerOverviewSection'

export function Profile() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [holdings, setHoldings] = useState<{ id: number; symbol: string; quantity: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [liveQuotes, setLiveQuotes] = useState<Record<string, { price: number; change24h: number }>>({})
  const [profileAds, setProfileAds] = useState<AdItem[]>([])
  const [vipSummary, setVipSummary] = useState<UserVipSummary | null>(null)
  const [vipLoading, setVipLoading] = useState(true)
  const [leaderboardConfig, setLeaderboardConfig] = useState<HomeLeaderboardConfig>(defaultHomeLeaderboardConfig)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<'default' | 'denied' | 'granted'>('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const pullStartYRef = useRef(0)
  const pullActiveRef = useRef(false)
  const liveRefreshTimerRef = useRef<number | null>(null)
  const { summary: walletSummary, loading: walletSummaryLoading, refresh: refreshWalletSummary } =
    useWalletSummary({ subscribeLive: false })
  const { summary: dailyEarningsSummary } = useDailyEarningsSummary()
  const earningsCurrency = dailyEarningsSummary.currency || appData.balance_info.currency || 'USDT'

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  const loadCoreDashboardData = useCallback(async () => {
    const results = await Promise.allSettled([
      getMyProfile(),
      apiFetch('/api/portfolio/holdings'),
      refreshWalletSummary(),
    ])
    const [profileRes, holdingsRes] = results
    if (profileRes?.status === 'fulfilled') setProfile(profileRes.value.profile)
    if (holdingsRes?.status === 'fulfilled') {
      setHoldings(
        (holdingsRes.value as { holdings: { id: number; symbol: string; quantity: number }[] }).holdings,
      )
    }
  }, [refreshWalletSummary])

  const loadAdsData = useCallback(async () => {
    getAds('profile')
      .then((res) => setProfileAds(res.items || []))
      .catch(() => setProfileAds([]))
  }, [])

  const loadVipSummary = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setVipLoading(true)
    try {
      const res = await getMyVipSummary()
      setVipSummary(res)
    } catch {
      setVipSummary(null)
    } finally {
      setVipLoading(false)
    }
  }, [])

  const loadQuotes = useCallback(async () => {
    try {
      const res = (await apiFetch('/api/market/quotes')) as {
        items: { symbol: string; price: number; change24h: number }[]
      }
      const next: Record<string, { price: number; change24h: number }> = {}
      for (const item of res.items) {
        const base = item.symbol.replace(/USDT$/i, '')
        next[base] = { price: Number(item.price || 0), change24h: Number(item.change24h || 0) }
      }
      setLiveQuotes(next)
    } catch {
      return
    }
  }, [])

  const refreshDashboard = useCallback(async (withSpinner = false) => {
    if (withSpinner) setIsPullRefreshing(true)
    try {
      await Promise.allSettled([
        loadCoreDashboardData(),
        loadAdsData(),
        loadQuotes(),
        loadVipSummary({ silent: true }),
      ])
    } finally {
      if (withSpinner) setIsPullRefreshing(false)
    }
  }, [loadCoreDashboardData, loadAdsData, loadQuotes, loadVipSummary])

  useEffect(() => {
    loadCoreDashboardData()
      .catch(() => {})
      .finally(() => setLoading(false))
    loadAdsData().catch(() => {})
    loadQuotes().catch(() => {})
    loadVipSummary().catch(() => {})
    getHomeLeaderboardConfig()
      .then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig))
      .catch(() => setLeaderboardConfig(defaultHomeLeaderboardConfig))
  }, [loadCoreDashboardData, loadAdsData, loadQuotes, loadVipSummary])

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    setPushSupported(supported)
    if (!supported) return
    setPushPermission(Notification.permission)
    getPushSubscriptionStatus()
      .then((res) => setPushSubscribed(Boolean(res.subscribed)))
      .catch(() => setPushSubscribed(false))
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      loadQuotes()
    }, 15000)
    return () => {
      window.clearInterval(id)
    }
  }, [loadQuotes])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (liveRefreshTimerRef.current) {
        window.clearTimeout(liveRefreshTimerRef.current)
      }
      liveRefreshTimerRef.current = window.setTimeout(() => {
        if (event.type === 'home_content_updated' || event.type === 'announcement_updated') {
          loadAdsData().catch(() => {})
          if (event.key === 'home_leaderboard' || event.type === 'home_content_updated') {
            getHomeLeaderboardConfig()
              .then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig))
              .catch(() => {})
          }
          return
        }
        if (event.type === 'settings_updated' && event.key === 'home_leaderboard') {
          getHomeLeaderboardConfig()
            .then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig))
            .catch(() => {})
          return
        }
        if (event.type === 'balance_updated') {
          loadCoreDashboardData().catch(() => {})
          return
        }
        refreshDashboard(false).catch(() => {})
      }, 180)
    })
    return () => {
      if (liveRefreshTimerRef.current) {
        window.clearTimeout(liveRefreshTimerRef.current)
      }
      unsub()
    }
  }, [loadCoreDashboardData, loadAdsData, refreshDashboard])

  async function enablePushNotifications(forcePrompt = true) {
    if (pushBusy || !pushSupported) return
    setPushBusy(true)
    try {
      let permission: NotificationPermission = Notification.permission
      if (permission !== 'granted' && forcePrompt) permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') return
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        const { publicKey } = await getPushPublicKey()
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }
      await savePushSubscription(subscription.toJSON())
      setPushSubscribed(true)
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePushNotifications() {
    if (pushBusy || !pushSupported) return
    setPushBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      const endpoint = subscription?.endpoint || null
      if (subscription) await subscription.unsubscribe().catch(() => {})
      await removePushSubscription(endpoint).catch(() => {})
      setPushSubscribed(false)
    } finally {
      setPushBusy(false)
    }
  }

  async function sendPushPreview() {
    if (pushBusy) return
    setPushBusy(true)
    try {
      await enablePushNotifications(false)
      await sendPushTest()
    } finally {
      setPushBusy(false)
    }
  }

  const assetsToRender = useMemo(() => {
    return walletDashboardMock.my_assets.map((item) => {
      const found = holdings.find((holding) => holding.symbol === item.symbol)
      const quote = liveQuotes[item.symbol]
      return {
        ...item,
        price_usd: quote?.price ?? item.price_usd,
        change_24h_percent: quote?.change24h ?? item.change_24h_percent,
        balance: holdings.length === 0 ? item.balance : found?.quantity || 0,
      }
    })
  }, [holdings, liveQuotes])

  const tabAssets = useMemo(() => assetsToRender.slice(0, 5), [assetsToRender])
  const premiumProfileColorClass = getPremiumProfileColorClass(profile?.profile_color)
  const vipCurrentLevel = Math.max(0, Math.min(5, Number(vipSummary?.currentVipLevel || profile?.vip_level || 0)))
  const vipProgressPct = Math.max(0, Math.min(100, Number(vipSummary?.progressPct || 0)))
  const vipNextLevel =
    vipSummary?.nextLevel != null && vipSummary.nextLevel >= 1 && vipSummary.nextLevel <= 5
      ? vipSummary.nextLevel
      : null
  const vipNextPerk = useMemo(() => {
    const levels = (vipSummary?.tiers || []).filter((tier) => tier.level >= 1 && tier.level <= 5)
    if (!vipNextLevel) return null
    const nextTier = levels.find((tier) => tier.level === vipNextLevel)
    if (!nextTier || !Array.isArray(nextTier.perks) || nextTier.perks.length === 0) return null
    return String(nextTier.perks[0] || '').trim() || null
  }, [vipNextLevel, vipSummary?.tiers])
  const primaryCtaTarget = walletSummaryLoading
    ? '/deposit'
    : Number.isFinite(walletSummary.totalAssets) && walletSummary.totalAssets > 0
      ? '/futures'
      : '/deposit'

  const quickActions: Array<{
    key: string
    label: string
    to: string
    icon: LucideIcon
    external?: boolean
  }> = [
    { key: 'vip', label: t('home_action_vip_benefits'), to: '/vip', icon: Crown },
    { key: 'invite', label: t('home_action_invite_earn'), to: '/referral', icon: UserPlus },
    { key: 'support', label: t('support_page_title'), to: '/support', icon: Headset },
    { key: 'rewards', label: t('home_action_rewards_center'), to: '/deposit', icon: Gift },
    { key: 'partners', label: t('home_action_partners'), to: '/friends', icon: Users },
  ]

  function handleQuickActionClick(item: {
    key: string
    label: string
    to: string
    icon: LucideIcon
    external?: boolean
  }) {
    if (item.external) {
      window.location.href = item.to
      return
    }
    navigate(item.to)
  }

  function handleTogglePush() {
    if (pushSubscribed) disablePushNotifications().catch(() => {})
    else enablePushNotifications(true).catch(() => {})
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (window.scrollY > 0 || isPullRefreshing) return
    pullStartYRef.current = event.touches[0]?.clientY || 0
    pullActiveRef.current = true
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!pullActiveRef.current || window.scrollY > 0 || isPullRefreshing) return
    const currentY = event.touches[0]?.clientY || 0
    const delta = Math.max(0, currentY - pullStartYRef.current)
    const eased = Math.min(110, delta * 0.38)
    if (eased > 0) setPullDistance(eased)
  }

  function handleTouchEnd() {
    if (!pullActiveRef.current) return
    pullActiveRef.current = false
    const shouldRefresh = pullDistance >= 68
    setPullDistance(0)
    if (shouldRefresh) {
      refreshDashboard(true).catch(() => {})
    }
  }

  return (
    <ProfileV2Shell
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <ProfilePullToRefreshIndicator
        pullDistance={pullDistance}
        isPullRefreshing={isPullRefreshing}
        loadingText={t('common_loading')}
        pullText={t('home_pull_to_refresh')}
      />
      <ProfileTopControlsBar
        title={profile?.display_name || t('nav_home')}
        subtitle={t('home_announcement_board')}
      />
      <ProfileHeroWalletSection
        summary={walletSummary}
        isSummaryLoading={walletSummaryLoading}
        premiumProfileColorClass={premiumProfileColorClass}
        depositText={t('deposit')}
        withdrawText={t('withdraw')}
        dailyEarningsSummary={dailyEarningsSummary}
        earningsCurrency={earningsCurrency}
        profile={profile}
        primaryCtaText="ابدأ الربح الآن"
        secondaryCtaText="ابدأ خلال 30 ثانية"
        onOpenWallet={() => navigate('/wallet')}
        onOpenDeposit={() => navigate('/deposit')}
        onOpenWithdraw={() => navigate('/withdraw')}
        onPrimaryCtaClick={() => navigate(primaryCtaTarget)}
        onSecondaryCtaClick={() => navigate('/mining')}
      />
      <ProfileVipCard
        loading={vipLoading}
        currentLevel={vipCurrentLevel}
        nextLevel={vipNextLevel}
        progressPct={vipProgressPct}
        nextPerk={vipNextPerk}
      />
      <ProfileAdsSection title={t('home_announcement_board')} items={profileAds} />
      <ProfileQuickActionsGrid
        title={t('home_quick_actions_title')}
        actions={quickActions}
        onActionClick={handleQuickActionClick}
      />
      <ProfileLowerOverviewSection
        pushSupported={pushSupported}
        pushPermission={pushPermission}
        pushSubscribed={pushSubscribed}
        pushBusy={pushBusy}
        onTogglePush={handleTogglePush}
        onSendPushPreview={() => {
          sendPushPreview().catch(() => {})
        }}
        loading={loading}
        assets={tabAssets}
        marketTitle={t('home_most_traded')}
        marketButtonText={t('nav_markets')}
        loadingText={t('common_loading')}
        emptyText={t('wallet_empty_assets')}
        onOpenMarket={() => navigate('/market')}
        leaderboardConfig={leaderboardConfig}
      />
    </ProfileV2Shell>
  )
}
