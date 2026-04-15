import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  Radio,
  ShieldCheck,
  Wallet2,
} from 'lucide-react'
import {
  getAds,
  subscribeToLiveUpdates,
  type AdItem,
} from '../api'
import { appData } from '../data'
import { AdBanner } from '../components/ads/AdBanner'
import { ProfilePullToRefreshIndicator } from '../components/profile-v2/ProfilePullToRefreshIndicator'
import { useMarketBoard } from '../hooks/useMarketBoard'
import { useDailyEarningsSummary } from '../hooks/useDailyEarningsSummary'
import { useAssetVisibility } from '../hooks/useAssetVisibility'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7YcfVEVccPWi28j22U'
const HOME_PULL_REFRESH_THRESHOLD = 72
const HOME_PULL_REFRESH_MAX_DISTANCE = 112

function formatHomeBalanceValue(value: number, language: string, isHidden: boolean) {
  if (isHidden) return '••••••'
  return Number(value || 0).toLocaleString(language === 'ar' ? 'ar' : language === 'tr' ? 'tr-TR' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function Home() {
  const { t, language } = useI18n()
  const { balance_info } = appData
  const [ads, setAds] = useState<AdItem[]>([])
  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const pageRef = useRef<HTMLDivElement | null>(null)
  const pullStartYRef = useRef(0)
  const pullDistanceRef = useRef(0)
  const pullActiveRef = useRef(false)
  const { summary: walletSummary, refresh: refreshWalletSummary } = useWalletSummary()
  const { summary: dailyEarningsSummary, refresh: refreshDailyEarnings } = useDailyEarningsSummary()
  const { isHidden } = useAssetVisibility()
  const { mostTraded, usingFallback, loading, reload: reloadMarketBoard } = useMarketBoard(5000)

  const headerCopy = useMemo(() => {
    if (language === 'ar') {
      return {
        status: 'التشغيل الرسمي',
        title: 'لوحة التحكم الرئيسية',
        subtitle: 'نظرة مباشرة على الأصول، الأرباح اليومية، وإيقاع السوق ضمن واجهة موحدة وواضحة.',
        whatsappTitle: 'القناة الرسمية',
        whatsappBody: 'تابع القناة الرسمية للحصول على التحديثات والإعلانات المعتمدة.',
        whatsappCta: 'واتساب',
        fundingLabel: 'الحساب التمويلي',
        operationsLabel: 'مركز العمليات',
        operationsBody: 'مراقبة فورية لحركة الأصول، التحديثات، وأداء السوق اليومي.',
        liveState: usingFallback ? 'بيانات احتياطية' : 'بث مباشر',
        marketNote: usingFallback
          ? 'تعذر جلب السوق الحي الآن، ويتم عرض بيانات احتياطية واضحة لحين عودة المصدر المباشر.'
          : 'البيانات تتجدد باستمرار لتقديم صورة لحظية عن السوق.',
        withdrawable: 'قابل للسحب',
        locked: 'غير قابل للسحب',
        statProtection: 'حماية الهوية',
        statProtectionValue: 'مفعلة',
        statSync: 'تحديث السوق',
        statSyncValue: usingFallback ? 'احتياطي' : 'مباشر',
        statWallet: 'حالة المحفظة',
        statWalletValue: walletSummary.totalAssets > 0 ? 'نشطة' : 'جاهزة',
      }
    }
    if (language === 'tr') {
      return {
        status: 'Resmi calisma',
        title: 'Ana kontrol paneli',
        subtitle: 'Varliklar, gunluk kazanc ve piyasa ritmini tek bir net yuzeyde izleyin.',
        whatsappTitle: 'Resmi kanal',
        whatsappBody: 'Guncellemeler ve resmi duyurular icin kanali takip edin.',
        whatsappCta: 'WhatsApp',
        fundingLabel: 'Fon hesabi',
        operationsLabel: 'Operasyon merkezi',
        operationsBody: 'Varlik hareketleri, guncellemeler ve gunluk piyasa performansi tek ekranda.',
        liveState: usingFallback ? 'Yedek veri' : 'Canli akis',
        marketNote: usingFallback
          ? 'Canli piyasa verisi su an alinamiyor; kaynak donene kadar acik yedek veri gosteriliyor.'
          : 'Veriler piyasanin anlik gorunumu icin surekli yenileniyor.',
        withdrawable: 'Cekilebilir',
        locked: 'Kilitli',
        statProtection: 'Kimlik korumasi',
        statProtectionValue: 'Acik',
        statSync: 'Piyasa senkronu',
        statSyncValue: usingFallback ? 'Yedek' : 'Canli',
        statWallet: 'Cuzdan durumu',
        statWalletValue: walletSummary.totalAssets > 0 ? 'Aktif' : 'Hazir',
      }
    }
    return {
      status: 'Official operations',
      title: 'Main control center',
      subtitle: 'Track assets, daily earnings, and market rhythm from one clear operational surface.',
      whatsappTitle: 'Official channel',
      whatsappBody: 'Follow the official channel for trusted updates and announcements.',
      whatsappCta: 'WhatsApp',
      fundingLabel: 'Funding account',
      operationsLabel: 'Operations center',
      operationsBody: 'Live visibility into assets, updates, and daily market performance.',
      liveState: usingFallback ? 'Fallback data' : 'Live feed',
      marketNote: usingFallback
        ? 'Live market data is temporarily unavailable, so a clear fallback feed is being shown.'
        : 'Data refreshes continuously to keep the market picture current.',
      withdrawable: 'Withdrawable',
      locked: 'Locked',
      statProtection: 'Identity shield',
      statProtectionValue: 'Enabled',
      statSync: 'Market sync',
      statSyncValue: usingFallback ? 'Fallback' : 'Live',
      statWallet: 'Wallet state',
      statWalletValue: walletSummary.totalAssets > 0 ? 'Active' : 'Ready',
    }
  }, [language, usingFallback, walletSummary.totalAssets])

  function formatVisibleAmount(value: number) {
    return isHidden ? '••••••' : value.toFixed(2)
  }

  const resolveScrollContainer = useCallback(() => {
    let node = pageRef.current?.parentElement ?? pageRef.current

    while (node) {
      const style = window.getComputedStyle(node)
      const overflowY = style.overflowY
      const canScroll = (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && node.scrollHeight > node.clientHeight
      if (canScroll) return node
      node = node.parentElement
    }

    return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null
  }, [])

  const getCurrentScrollTop = useCallback(() => {
    const scrollContainer = resolveScrollContainer()
    if (scrollContainer) return scrollContainer.scrollTop
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  }, [resolveScrollContainer])

  const refreshHomeContent = useCallback(async () => {
    await Promise.allSettled([
      refreshWalletSummary(),
      refreshDailyEarnings(),
      reloadMarketBoard(),
      getAds('home')
        .then((res) => setAds(res.items || []))
        .catch(() => setAds([])),
    ])
  }, [refreshDailyEarnings, refreshWalletSummary, reloadMarketBoard])

  const finishPullGesture = useCallback(async () => {
    if (!pullActiveRef.current) return

    pullActiveRef.current = false
    const shouldRefresh = pullDistanceRef.current >= HOME_PULL_REFRESH_THRESHOLD
    pullDistanceRef.current = 0
    setPullDistance(0)

    if (!shouldRefresh || isPullRefreshing) return

    setIsPullRefreshing(true)
    try {
      await refreshHomeContent()
    } finally {
      setIsPullRefreshing(false)
    }
  }, [isPullRefreshing, refreshHomeContent])

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (isPullRefreshing || getCurrentScrollTop() > 0) return
    pullActiveRef.current = true
    pullStartYRef.current = event.touches[0]?.clientY || 0
    pullDistanceRef.current = 0
  }, [getCurrentScrollTop, isPullRefreshing])

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (!pullActiveRef.current || isPullRefreshing) return

    if (getCurrentScrollTop() > 0) {
      pullActiveRef.current = false
      pullDistanceRef.current = 0
      setPullDistance(0)
      return
    }

    const currentY = event.touches[0]?.clientY || 0
    const delta = currentY - pullStartYRef.current

    if (delta <= 0) {
      pullDistanceRef.current = 0
      setPullDistance(0)
      return
    }

    const easedDistance = Math.min(HOME_PULL_REFRESH_MAX_DISTANCE, delta * 0.4)
    pullDistanceRef.current = easedDistance
    setPullDistance(easedDistance)

    if (event.cancelable) {
      event.preventDefault()
    }
  }, [getCurrentScrollTop, isPullRefreshing])

  useEffect(() => {
    void formatVisibleAmount
    getAds('home')
      .then((res) => setAds(res.items || []))
      .catch(() => setAds([]))
  }, [])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (event.type === 'home_content_updated') {
        getAds('home').then((res) => setAds(res.items || [])).catch(() => {})
      }
    })
    return unsub
  }, [])

  return (
    <div
      ref={pageRef}
      className="page home-page"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        finishPullGesture().catch(() => {})
      }}
      onTouchCancel={() => {
        finishPullGesture().catch(() => {})
      }}
    >
      <ProfilePullToRefreshIndicator
        pullDistance={pullDistance}
        isPullRefreshing={isPullRefreshing}
        loadingText={t('common_loading')}
        pullText={t('home_pull_to_refresh')}
      />
      <section className="home-overview mb-6">
        <div className="home-overview-grid grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <div className="home-hero card overflow-hidden rounded-[28px] border border-brand-blue/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_28%),linear-gradient(135deg,rgba(6,13,24,0.96),rgba(10,18,32,0.92))] p-0 shadow-[0_22px_52px_rgba(2,8,20,0.38)]">
            <div className="home-hero-grid grid gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:p-6">
              <div className="home-hero-copy space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                  <BadgeCheck size={14} />
                  <span>{headerCopy.status}</span>
                </div>
                <div className="home-hero-headline space-y-3">
                  <h1 className="home-hero-title text-3xl font-black leading-tight text-white lg:text-5xl">{headerCopy.title}</h1>
                  <p className="home-hero-subtitle max-w-2xl text-sm leading-7 text-slate-300 lg:text-[15px]">{headerCopy.subtitle}</p>
                </div>
                <div className="home-hero-stats grid gap-3 sm:grid-cols-3">
                  <div className="home-hero-stat rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      <ShieldCheck size={14} />
                      <span>{headerCopy.statProtection}</span>
                    </div>
                    <div className="mt-3 text-lg font-bold text-white">{headerCopy.statProtectionValue}</div>
                  </div>
                  <div className="home-hero-stat rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      <Radio size={14} />
                      <span>{headerCopy.statSync}</span>
                    </div>
                    <div className="mt-3 text-lg font-bold text-white">{headerCopy.statSyncValue}</div>
                  </div>
                  <div className="home-hero-stat rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      <Wallet2 size={14} />
                      <span>{headerCopy.statWallet}</span>
                    </div>
                    <div className="mt-3 text-lg font-bold text-white">{headerCopy.statWalletValue}</div>
                  </div>
                </div>
              </div>

              <div className="home-balance-panel space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="rounded-[20px] border border-white/8 bg-black/10 px-3.5 py-3 sm:px-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {t('home_total_assets')}
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(2rem,8vw,2.8rem)] font-black leading-none tracking-[-0.03em] text-white [font-variant-numeric:tabular-nums]">
                        {formatHomeBalanceValue(walletSummary.totalAssets, language, isHidden)}
                      </div>
                    </div>
                    <span className="mb-0.5 shrink-0 rounded-full border border-brand-blue/20 bg-brand-blue/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-blue/80 sm:text-[11px]">
                      {balance_info.currency}
                    </span>
                  </div>
                </div>

                <div className="home-balance-grid grid gap-3 sm:grid-cols-2">
                  <div className="home-balance-tile rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-emerald-200">{t('home_today_earnings')}</div>
                    <div className="mt-2 text-2xl font-bold text-white">+{dailyEarningsSummary.totalAmount.toFixed(2)}</div>
                    <div className="mt-2 text-[11px] leading-5 text-emerald-100/80">
                      {dailyEarningsSummary.withdrawableAmount.toFixed(2)} {balance_info.currency} {headerCopy.withdrawable}
                      {' • '}
                      {dailyEarningsSummary.lockedAmount.toFixed(2)} {balance_info.currency} {headerCopy.locked}
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-emerald-100/80">
                      {language === 'ar'
                        ? `صفقات الاستراتيجية ${dailyEarningsSummary.sourceTotals.tasks.toFixed(2)} - الإحالات ${dailyEarningsSummary.sourceTotals.referrals.toFixed(2)}`
                        : language === 'tr'
                          ? `Stratejik islemler ${dailyEarningsSummary.sourceTotals.tasks.toFixed(2)} - Referanslar ${dailyEarningsSummary.sourceTotals.referrals.toFixed(2)}`
                          : `Strategy trades ${dailyEarningsSummary.sourceTotals.tasks.toFixed(2)} - Referrals ${dailyEarningsSummary.sourceTotals.referrals.toFixed(2)}`}
                    </div>
                  </div>
                  <div className="home-balance-tile rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-amber-200">{headerCopy.fundingLabel}</div>
                    <div className="mt-2 text-2xl font-bold leading-none text-white [font-variant-numeric:tabular-nums]">
                      {formatHomeBalanceValue(walletSummary.mainBalance, language, isHidden)}
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-amber-100/80">{t('home_funding_hint')}</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="home-side-stack space-y-4">
            <div className="home-channel-card rounded-[28px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/12 via-app-card to-app-card p-4 shadow-[0_18px_42px_rgba(16,185,129,0.12)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    <BellRing size={14} />
                    <span>{headerCopy.whatsappTitle}</span>
                  </div>
                  <div className="mt-2 text-sm font-medium leading-6 text-white">{headerCopy.whatsappBody}</div>
                </div>
                <a
                  href={WHATSAPP_CHANNEL_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={headerCopy.whatsappCta}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.28)] transition-all duration-300 hover:scale-[1.02] hover:bg-emerald-400"
                >
                  <span>{headerCopy.whatsappCta}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="home-lower-grid grid gap-6 lg:grid-cols-3">
        <section className="home-market-table lg:col-span-2 space-y-4">
          <div className="home-section-head flex items-center justify-between">
            <h2 className="home-section-title text-xl font-bold text-white lg:text-2xl">{t('home_most_traded')}</h2>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-app-muted">
              {usingFallback ? 'Fallback data' : '24h • Live'}
            </div>
          </div>

          <div className="home-market-surface card overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-0">
            <div className="table-card">
              <div className="table-head sticky top-0 z-10 bg-app-elevated">
                <span className="text-xs uppercase tracking-wider">{t('home_pair')}</span>
                <span className="text-right text-xs uppercase tracking-wider">{t('home_last_price')}</span>
                <span className="text-right text-xs uppercase tracking-wider">{t('home_change_24h')}</span>
              </div>

              <div className="divide-y divide-app-border">
                {loading && mostTraded.length === 0 ? (
                  <div className="table-row justify-center py-8">
                    <span className="text-app-muted">{t('common_loading')}</span>
                  </div>
                ) : (
                  mostTraded.map((item) => {
                    const pair = item.symbol.replace(/USDT$/i, '/USDT')
                    const isPositive = item.change24h >= 0
                    return (
                      <div
                        key={item.symbol}
                        className="table-row py-4 transition-colors duration-200 hover:bg-app-elevated/50"
                      >
                        <div className="pair space-x-3">
                          <div className="icon-circle bg-gradient-to-br from-brand-blue/30 to-brand-blue/10 font-bold text-brand-blue">
                            {item.symbol[0]}
                          </div>
                          <div className="pair-meta">
                            <div className="pair-name font-semibold">{pair}</div>
                            <div className="pair-sub text-xs">{t('home_spot')}</div>
                          </div>
                        </div>
                        <div className="price text-right font-semibold">
                          ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className={`text-right font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          <span className="inline-flex items-center gap-1">
                            {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            {Math.abs(item.change24h).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="home-ad-column space-y-3 lg:col-span-1">
          <AdBanner items={ads} placement="home" className="my-0 lg:sticky lg:top-[110px]" />
        </div>
      </div>
    </div>
  )
}
