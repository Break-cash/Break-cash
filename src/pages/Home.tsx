import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
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
  getHomeLeaderboardConfig,
  subscribeToLiveUpdates,
  type AdItem,
  type HomeLeaderboardConfig,
} from '../api'
import { appData } from '../data'
import { AdBanner } from '../components/ads/AdBanner'
import { LeaderboardSection, defaultHomeLeaderboardConfig } from '../components/home/LeaderboardSection'
import { useMarketBoard } from '../hooks/useMarketBoard'
import { useDailyEarningsSummary } from '../hooks/useDailyEarningsSummary'
import { useAssetVisibility } from '../hooks/useAssetVisibility'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7YcfVEVccPWi28j22U'
const APK_DOWNLOAD_URL = '/downloads/Break-Cash-Android-Release-v1.apk'

export function Home() {
  const { t, language } = useI18n()
  const { balance_info } = appData
  const [ads, setAds] = useState<AdItem[]>([])
  const [leaderboardConfig, setLeaderboardConfig] = useState<HomeLeaderboardConfig>(defaultHomeLeaderboardConfig)
  const { summary: walletSummary } = useWalletSummary()
  const { summary: dailyEarningsSummary } = useDailyEarningsSummary()
  const { isHidden } = useAssetVisibility()
  const { mostTraded, usingFallback, loading } = useMarketBoard(5000)

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
        downloadApp: 'تحميل التطبيق',
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
        downloadApp: 'Uygulamayi indir',
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
      downloadApp: 'Download app',
    }
  }, [language, usingFallback, walletSummary.totalAssets])

  function formatVisibleAmount(value: number) {
    return isHidden ? '••••••' : value.toFixed(2)
  }

  useEffect(() => {
    getAds('home')
      .then((res) => setAds(res.items || []))
      .catch(() => setAds([]))
  }, [])

  useEffect(() => {
    getHomeLeaderboardConfig()
      .then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig))
      .catch(() => setLeaderboardConfig(defaultHomeLeaderboardConfig))
  }, [])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (event.type === 'home_content_updated') {
        getAds('home').then((res) => setAds(res.items || [])).catch(() => {})
      }
      if (
        (event.type === 'settings_updated' || event.type === 'home_content_updated') &&
        event.key === 'home_leaderboard'
      ) {
        getHomeLeaderboardConfig()
          .then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig))
          .catch(() => {})
      }
    })
    return unsub
  }, [])

  const marketSentiment = mostTraded.length
    ? mostTraded.filter((item) => item.change24h >= 0).length / mostTraded.length
    : 0

  return (
    <div className="page home-page">
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
                <a
                  href={APK_DOWNLOAD_URL}
                  download
                  className="inline-flex items-center justify-center rounded-2xl bg-brand-blue px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(59,130,246,0.28)] transition-transform duration-200 hover:scale-[1.01]"
                >
                  {headerCopy.downloadApp}
                </a>
              </div>

              <div className="home-balance-panel space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {t('home_total_assets')}
                    </div>
                    <div className="mt-2 text-4xl font-black text-white lg:text-[2.8rem]">
                      {formatVisibleAmount(walletSummary.totalAssets)}
                    </div>
                  </div>
                  <span className="rounded-full border border-brand-blue/25 bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue">
                    {balance_info.currency}
                  </span>
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
                    <div className="mt-2 text-2xl font-bold text-white">{formatVisibleAmount(walletSummary.mainBalance)}</div>
                    <div className="mt-2 text-[11px] leading-5 text-amber-100/80">{t('home_funding_hint')}</div>
                  </div>
                </div>

                <div className="home-operations-bar rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{t('home_team_earnings')}</div>
                      <div className="mt-2 text-2xl font-bold text-white">{balance_info.team_earnings.toFixed(2)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{headerCopy.operationsLabel}</div>
                      <div className="mt-1 text-xs text-slate-200">{headerCopy.operationsBody}</div>
                    </div>
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

            <div className="home-market-card rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{t('home_most_traded')}</div>
                  <div className="mt-1 text-lg font-bold text-white">{headerCopy.liveState}</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  {Math.round(marketSentiment * 100)}%
                </div>
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-300">{headerCopy.marketNote}</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Activity size={14} />
                    <span>24h</span>
                  </div>
                  <div className="mt-2 text-lg font-bold text-white">{mostTraded.length || 0}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Radio size={14} />
                    <span>{usingFallback ? 'Mode' : 'Feed'}</span>
                  </div>
                  <div className="mt-2 text-lg font-bold text-white">{usingFallback ? 'Backup' : 'Live'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LeaderboardSection config={leaderboardConfig} />

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
