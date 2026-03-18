import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, Crown, Gift, UserPlus, Users } from 'lucide-react'
import {
  apiFetch,
  getMyProfile,
  getAds,
  getWalletOverview,
  subscribeToLiveUpdates,
  type AuthUser,
  type AdItem,
} from '../api'
import { AdBanner } from '../components/ads/AdBanner'
import { UserIdentityBadges } from '../components/user/UserIdentityBadges'
import { TotalAssetsCard } from '../components/wallet/TotalAssetsCard'
import { useI18n } from '../i18nCore'
import { getPremiumProfileColorClass } from '../premiumIdentity'
import { appData } from '../data'
import { walletDashboardMock } from '../ui/mobileMock'

export function Profile() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [realBalance, setRealBalance] = useState<number | null>(null)
  const [totalAssets, setTotalAssets] = useState<number | null>(null)
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [holdings, setHoldings] = useState<{ id: number; symbol: string; quantity: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [liveQuotes, setLiveQuotes] = useState<Record<string, { price: number; change24h: number }>>({})
  const [profileAds, setProfileAds] = useState<AdItem[]>([])
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const pullStartYRef = useRef(0)
  const pullActiveRef = useRef(false)
  const liveRefreshTimerRef = useRef<number | null>(null)
  const dailyEarnings = Number(appData.balance_info.today_earnings || 0)
  const earningsCurrency = appData.balance_info.currency || 'USDT'

  const loadCoreDashboardData = useCallback(async () => {
    const results = await Promise.allSettled([
      getMyProfile(),
      apiFetch('/api/balance/my'),
      apiFetch('/api/portfolio/holdings'),
      getWalletOverview('USDT'),
    ])
    const [profileRes, balanceRes, holdingsRes, overviewRes] = results
    if (profileRes.status === 'fulfilled') setProfile(profileRes.value.profile)
    if (balanceRes.status === 'fulfilled') {
      const balances = (balanceRes.value as { balances: { amount: number }[] }).balances
      const sum = balances.reduce((acc, row) => acc + Number(row.amount || 0), 0)
      setRealBalance(sum)
    }
    if (holdingsRes.status === 'fulfilled') {
      setHoldings(
        (holdingsRes.value as { holdings: { id: number; symbol: string; quantity: number }[] }).holdings,
      )
    }
    if (overviewRes.status === 'fulfilled' && overviewRes.value != null) {
      setTotalAssets(Number((overviewRes.value as { total_assets: number }).total_assets ?? 0))
    }
  }, [])

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
  }, [loadCoreDashboardData, loadAdsData, loadQuotes])

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

  const dashboardBalance = totalAssets ?? realBalance ?? walletDashboardMock.total_balance_usd
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
  const ownerTools = useMemo(
    () =>
      profile?.role === 'owner'
        ? [
            { label: t('nav_owner'), to: '/owner' },
            { label: t('owner_premium_dashboard'), to: '/owner/premium' },
            { label: t('owner_quick_operations'), to: '/owner/operations' },
            { label: t('nav_admin'), to: '/admin/dashboard' },
            { label: t('admin_users'), to: '/admin/users' },
            { label: t('admin_balances'), to: '/admin/balances' },
          ]
        : [],
    [profile?.role, t],
  )
  const premiumProfileColorClass = getPremiumProfileColorClass(profile?.profile_color)
  const quickActions = [
    { key: 'vip', label: t('home_action_vip_benefits'), to: '/vip', icon: Crown },
    { key: 'invite', label: t('home_action_invite_earn'), to: '/referral', icon: UserPlus },
    { key: 'rewards', label: t('home_action_rewards_center'), to: '/deposit', icon: Gift },
    { key: 'partners', label: t('home_action_partners'), to: '/friends', icon: Users },
  ] as const

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
      {ownerTools.length > 0 ? (
        <section className="elite-enter overflow-x-auto rounded-2xl border border-white/10 bg-[#1e2430]/70 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <div className="flex min-w-max items-center gap-2">
            {ownerTools.map((tool) => (
              <button
                key={tool.to}
                type="button"
                onClick={() => navigate(tool.to)}
                className="icon-interactive rounded-full border border-white/10 bg-[#252d3a] px-3 py-1.5 text-xs font-medium text-white/85 hover:border-brand-blue/35 hover:bg-[#2b3443]"
              >
                {tool.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className={`elite-enter w-full max-w-full space-y-4 ${premiumProfileColorClass}`}
      >
        <div className="flex min-w-0 flex-col gap-3">
          <TotalAssetsCard
            totalAssets={dashboardBalance}
            currency="USDT"
            titleKey="wallet_overview_total_assets"
            onClick={() => navigate('/assets')}
            variant="hero"
          />
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => navigate('/deposit')}
              className="icon-interactive flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 transition hover:border-emerald-500/50 hover:bg-emerald-500/15 active:scale-[0.98]"
            >
              <ArrowDownLeft size={20} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{t('deposit')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/withdraw')}
              className="icon-interactive flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-3 text-sm font-semibold text-brand-blue transition hover:border-brand-blue/50 hover:bg-brand-blue/15 active:scale-[0.98]"
            >
              <ArrowUpRight size={20} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{t('withdraw')}</span>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <div>
            <p className="text-[11px] text-white/50">{t('home_today_earnings')}</p>
            <p className={`text-sm font-semibold ${dailyEarnings >= 0 ? 'text-positive' : 'text-negative'}`}>
              {dailyEarnings.toFixed(2)} {earningsCurrency}
            </p>
          </div>
          {profile ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1">
              <span className="text-xs font-medium text-white/90">{profile.display_name || `#${profile.id}`}</span>
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
      <section className="elite-enter rounded-3xl border border-white/10 bg-[linear-gradient(165deg,#252b36,#202632)] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.24)]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">{t('home_announcement_board')}</p>
        </div>
        <AdBanner items={profileAds} placement="profile" className="my-0 opacity-95" />
      </section>

      <section className="elite-enter rounded-3xl border border-white/10 bg-[linear-gradient(165deg,#252b36,#202632)] p-3 shadow-[0_10px_34px_rgba(0,0,0,0.24)]">
        <div className="mb-3 text-sm font-semibold text-white">{t('home_quick_actions_title')}</div>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.to)}
                className="icon-interactive elite-hover-lift flex items-center gap-3 rounded-xl border border-app-border bg-app-card px-4 py-3 text-start"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-elevated">
                  <Icon size={20} className="text-brand-blue" />
                </span>
                <span className="text-sm font-medium text-white/90">{item.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.33, ease: 'easeOut', delay: 0.08 }}
        className="elite-enter rounded-2xl border border-app-border bg-app-card p-3"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">{t('home_most_traded')}</p>
          <button
            type="button"
            onClick={() => navigate('/market')}
            className="icon-interactive rounded-full border border-app-border bg-app-elevated px-2.5 py-1 text-[11px] text-white/80"
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
                className="elite-hover-lift flex items-center justify-between rounded-xl border border-app-border bg-app-elevated px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold">{asset.symbol}</p>
                  <p className="text-xs text-app-muted">${asset.price_usd.toLocaleString()}</p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-semibold">{asset.balance.toFixed(4)}</p>
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

