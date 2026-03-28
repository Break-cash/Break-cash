import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, Crown, Gift, MessageCircle, UserPlus, Users, type LucideIcon } from 'lucide-react'
import {
  apiFetch,
  getMyProfile,
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
} from '../api'
import { AdBanner } from '../components/ads/AdBanner'
import { LeaderboardSection, defaultHomeLeaderboardConfig } from '../components/home/LeaderboardSection'
import { UserIdentityBadges } from '../components/user/UserIdentityBadges'
import { useDailyEarningsSummary } from '../hooks/useDailyEarningsSummary'
import { WalletSummaryPanel } from '../components/wallet/WalletSummaryPanel'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'
import { getPremiumProfileColorClass } from '../premiumIdentity'
import { appData } from '../data'
import { walletDashboardMock } from '../ui/mobileMock'

export function Profile() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [holdings, setHoldings] = useState<{ id: number; symbol: string; quantity: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [liveQuotes, setLiveQuotes] = useState<Record<string, { price: number; change24h: number }>>({})
  const [profileAds, setProfileAds] = useState<AdItem[]>([])
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
      await Promise.allSettled([loadCoreDashboardData(), loadAdsData(), loadQuotes()])
    } finally {
      if (withSpinner) setIsPullRefreshing(false)
    }
  }, [loadCoreDashboardData, loadAdsData, loadQuotes])

  useEffect(() => {
    loadCoreDashboardData()
      .catch(() => {})
      .finally(() => setLoading(false))
    loadAdsData().catch(() => {})
    loadQuotes().catch(() => {})
    getHomeLeaderboardConfig()
      .then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig))
      .catch(() => setLeaderboardConfig(defaultHomeLeaderboardConfig))
  }, [loadCoreDashboardData, loadAdsData, loadQuotes])

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
  const quickActions: Array<{
    key: string
    label: string
    to: string
    icon: LucideIcon
    external?: boolean
  }> = [
    { key: 'vip', label: t('home_action_vip_benefits'), to: '/vip', icon: Crown },
    { key: 'invite', label: t('home_action_invite_earn'), to: '/referral', icon: UserPlus },
    { key: 'rewards', label: t('home_action_rewards_center'), to: '/deposit', icon: Gift },
    { key: 'partners', label: t('home_action_partners'), to: '/friends', icon: Users },
  ]

  quickActions.push({
    key: 'support',
    label: t('home_action_support_message'),
    to: '/support',
    icon: MessageCircle,
  })

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
    <div
      className="space-y-4 pb-6"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="pointer-events-none overflow-hidden transition-[max-height,opacity] duration-200"
        style={{ maxHeight: pullDistance > 0 || isPullRefreshing ? 40 : 0, opacity: pullDistance > 0 || isPullRefreshing ? 1 : 0 }}
      >
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#1e2430]/85 px-3 py-1 text-[11px] text-white/85">
          <span>{isPullRefreshing ? t('common_loading') : t('home_pull_to_refresh')}</span>
        </div>
      </div>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className={`elite-enter w-full max-w-full space-y-4 ${premiumProfileColorClass}`}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <WalletSummaryPanel
            summary={walletSummary}
            currency="USDT"
            isLoading={walletSummaryLoading}
            cardVariant="hero"
            onCardClick={() => navigate('/wallet')}
            actionsSlot={(
              <div className="grid min-w-0 grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/deposit')}
                  className="action-button action-button-deposit icon-interactive flex min-h-[54px] min-w-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98]"
                >
                  <ArrowDownLeft size={20} strokeWidth={2} className="shrink-0" />
                  <span className="truncate">{t('deposit')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/withdraw')}
                  className="action-button action-button-withdraw icon-interactive flex min-h-[54px] min-w-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98]"
                >
                  <ArrowUpRight size={20} strokeWidth={2} className="shrink-0" />
                  <span className="truncate">{t('withdraw')}</span>
                </button>
              </div>
            )}
          />
        </div>
        <div className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('home_today_earnings')}</p>
            <p className={`text-sm font-semibold ${dailyEarningsSummary.totalAmount >= 0 ? 'text-positive' : 'text-negative'}`}>
              {dailyEarningsSummary.totalAmount.toFixed(2)} {earningsCurrency}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {dailyEarningsSummary.withdrawableAmount.toFixed(2)} قابل للسحب • {dailyEarningsSummary.lockedAmount.toFixed(2)} غير قابل للسحب
            </p>
          </div>
          {profile ? (
            <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-xs font-medium text-[var(--text-primary)]">{profile.display_name || `#${profile.id}`}</span>
              <UserIdentityBadges
                badgeColor={profile.badge_color || 'none'}
                vipLevel={profile.vip_level || 0}
                premiumBadge={profile.profile_badge}
                mode="verified"
              />
            </div>
          ) : null}
        </div>
      </motion.section>
      <LeaderboardSection config={leaderboardConfig} />
      <section className="glass-panel elite-enter rounded-3xl p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{t('home_announcement_board')}</p>
        </div>
        <AdBanner items={profileAds} placement="profile" className="my-0 opacity-95" />
      </section>

      <section className="glass-panel elite-enter rounded-3xl p-3">
        <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">الإشعارات الخارجية</div>
        <div className="space-y-3">
          <div className="text-sm text-[var(--text-secondary)]">
            {pushPermission === 'denied'
              ? 'الإشعارات محظورة من المتصفح أو النظام.'
              : pushSubscribed
                ? 'الإشعارات الخارجية مفعّلة لهذا الجهاز.'
                : 'فعّل الإشعارات ليصلك تنبيه حتى عند الخروج من التطبيق.'}
          </div>
          <div className="flex flex-wrap gap-2">
            {pushSupported ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (pushSubscribed) disablePushNotifications().catch(() => {})
                    else enablePushNotifications(true).catch(() => {})
                  }}
                  className="wallet-action-btn owner-set-btn"
                  disabled={pushBusy}
                >
                  {pushBusy ? '...' : pushSubscribed ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sendPushPreview().catch(() => {})
                  }}
                  className="wallet-action-btn wallet-action-deposit"
                  disabled={pushBusy || (!pushSubscribed && pushPermission === 'denied')}
                >
                  {pushBusy ? '...' : 'إرسال إشعار تجريبي'}
                </button>
              </>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">هذا المتصفح أو الجهاز لا يدعم Web Push.</div>
            )}
          </div>
        </div>
      </section>

      <section className="glass-panel elite-enter rounded-3xl p-3">
        <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t('home_quick_actions_title')}</div>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.external) {
                    window.location.href = item.to
                    return
                  }
                  navigate(item.to)
                }}
                className="icon-interactive elite-hover-lift glass-panel-soft flex items-center gap-3 rounded-xl px-4 py-3 text-start"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--bg-elevated)]">
                  <Icon size={20} className="text-[var(--accent-blue-soft)]" />
                </span>
                <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.33, ease: 'easeOut', delay: 0.08 }}
        className="glass-panel elite-enter rounded-2xl p-3"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{t('home_most_traded')}</p>
          <button
            type="button"
            onClick={() => navigate('/market')}
            className="glass-pill icon-interactive rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
          >
            {t('nav_markets')}
          </button>
        </div>
        {loading ? (
          <div className="py-4 text-sm text-app-muted">{t('common_loading')}</div>
        ) : tabAssets.length === 0 ? (
          <div className="py-4 text-sm text-app-muted">{t('wallet_empty_assets')}</div>
        ) : (
          <div className="space-y-2">
            {tabAssets.map((asset) => (
              <motion.div
                key={asset.symbol}
                layout
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                className="elite-hover-lift glass-panel-soft flex items-center justify-between rounded-xl px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{asset.symbol}</p>
                  <p className="text-xs text-app-muted">${asset.price_usd.toLocaleString()}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{asset.balance.toFixed(4)}</p>
                  <p className={`text-xs ${asset.change_24h_percent >= 0 ? 'text-positive' : 'text-negative'}`}>
                    {asset.change_24h_percent >= 0 ? '+' : ''}
                    {asset.change_24h_percent.toFixed(2)}%
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </div>
  )
}

