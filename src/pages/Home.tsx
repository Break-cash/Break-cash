import { useEffect, useState } from 'react'
import { getAds, getHomeLeaderboardConfig, subscribeToLiveUpdates, type AdItem, type HomeLeaderboardConfig } from '../api'
import { appData } from '../data'
import { AdBanner } from '../components/ads/AdBanner'
import { LeaderboardSection, defaultHomeLeaderboardConfig } from '../components/home/LeaderboardSection'
import { useMarketBoard } from '../hooks/useMarketBoard'
import { useDailyEarningsSummary } from '../hooks/useDailyEarningsSummary'
import { useAssetVisibility } from '../hooks/useAssetVisibility'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7YcfVEVccPWi28j22U'

export function Home() {
  const { t } = useI18n()
  const { balance_info } = appData
  const [ads, setAds] = useState<AdItem[]>([])
  const [leaderboardConfig, setLeaderboardConfig] = useState<HomeLeaderboardConfig>(defaultHomeLeaderboardConfig)
  const { summary: walletSummary } = useWalletSummary()
  const { summary: dailyEarningsSummary } = useDailyEarningsSummary()
  const { isHidden } = useAssetVisibility()
  const { mostTraded, usingFallback, loading } = useMarketBoard(5000)

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
        getHomeLeaderboardConfig().then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig)).catch(() => {})
      }
    })
    return unsub
  }, [])

  return (
    <div className="page home-page">
      <section className="mb-4">
        <div className="flex items-center justify-between gap-3 rounded-3xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/12 via-app-card to-app-card px-4 py-3 shadow-[0_12px_32px_rgba(16,185,129,0.08)]">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">WhatsApp Channel</div>
            <div className="mt-1 text-sm font-medium text-white">تابع القناة الرسمية للحصول على التحديثات والإعلانات</div>
          </div>
          <a
            href={WHATSAPP_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="واتساب"
            className="flex shrink-0 items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,185,129,0.28)] transition-all duration-300 hover:scale-[1.02] hover:bg-emerald-400"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2C6.61 2 2.2 6.41 2.2 11.83c0 1.74.45 3.43 1.3 4.92L2 22l5.4-1.42a9.8 9.8 0 0 0 4.63 1.18h.01c5.42 0 9.83-4.41 9.83-9.83a9.77 9.77 0 0 0-2.82-7.02Zm-7.02 15.19h-.01a8.15 8.15 0 0 1-4.15-1.13l-.3-.18-3.2.84.86-3.12-.2-.32a8.15 8.15 0 0 1-1.26-4.36c0-4.5 3.66-8.16 8.17-8.16a8.1 8.1 0 0 1 5.78 2.4 8.1 8.1 0 0 1 2.38 5.77c0 4.5-3.66 8.16-8.17 8.16Zm4.48-6.1c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.42-1.34-1.66-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.68 2.56 4.07 3.59.57.25 1.02.4 1.37.51.58.18 1.1.15 1.52.09.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28Z" />
            </svg>
            <span>واتساب</span>
          </a>
        </div>
      </section>
      {/* Hero Section - Main Assets */}
      <section className="mb-6 lg:mb-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Main Balance Card */}
          <div className="card balance-card lg:col-span-2 bg-gradient-to-br from-brand-blue/10 via-app-card to-app-card border border-brand-blue/20 hover:border-brand-blue/40 transition-all duration-300">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-app-muted uppercase tracking-wider">{t('home_total_assets')}</span>
                  <span className="card-pill bg-brand-blue/10 text-brand-blue px-3 py-1 rounded-full text-xs font-semibold">{balance_info.currency}</span>
                </div>
              </div>
              
              <div>
                <div className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-brand-blue to-brand-blue/70 bg-clip-text text-transparent">
                  {formatVisibleAmount(walletSummary.totalAssets)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-app-border">
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-app-muted uppercase tracking-wide">{t('home_today_earnings')}</div>
                  <div className="text-2xl font-bold text-green-400">
                    +{dailyEarningsSummary.totalAmount.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-app-muted">
                    {dailyEarningsSummary.withdrawableAmount.toFixed(2)} {balance_info.currency} قابل للسحب • {dailyEarningsSummary.lockedAmount.toFixed(2)} {balance_info.currency} غير قابل للسحب
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-app-muted uppercase tracking-wide">{t('home_team_earnings')}</div>
                  <div className="text-2xl font-bold text-brand-blue">
                    {balance_info.team_earnings.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Funding Account Card */}
          <div className="card small-card lg:h-full bg-gradient-to-br from-amber-500/10 via-app-card to-app-card border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300">
            <div className="space-y-3 h-full flex flex-col justify-between">
              <div>
                <div className="text-xs font-medium text-app-muted uppercase tracking-wide mb-3">{t('home_funding_account')}</div>
                <div className="text-3xl font-bold text-amber-400">
                  {formatVisibleAmount(walletSummary.mainBalance)}
                </div>
              </div>
              <div className="text-xs text-app-muted leading-relaxed pt-3 border-t border-app-border">{t('home_funding_hint')}</div>
            </div>
          </div>
        </div>
      </section>

      <LeaderboardSection config={leaderboardConfig} />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Market Data Section */}
        <section className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl lg:text-2xl font-bold text-white">{t('home_most_traded')}</h2>
            <div className="text-xs text-app-muted">{usingFallback ? 'Fallback data' : '24h • Live'}</div>
          </div>

          <div className="card overflow-hidden">
            <div className="table-card">
              <div className="table-head bg-app-elevated sticky top-0 z-10">
                <span className="text-xs uppercase tracking-wider">{t('home_pair')}</span>
                <span className="text-xs uppercase tracking-wider text-right">{t('home_last_price')}</span>
                <span className="text-xs uppercase tracking-wider text-right">{t('home_change_24h')}</span>
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
                        className="table-row hover:bg-app-elevated/50 transition-colors duration-200 py-4"
                      >
                        <div className="pair space-x-3">
                          <div className="icon-circle bg-gradient-to-br from-brand-blue/30 to-brand-blue/10 text-brand-blue font-bold">
                            {item.symbol[0]}
                          </div>
                          <div className="pair-meta">
                            <div className="pair-name font-semibold">{pair}</div>
                            <div className="pair-sub text-xs">{t('home_spot')}</div>
                          </div>
                        </div>
                        <div className="price font-semibold text-right">
                          ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div
                          className={`font-bold text-right ${
                            isPositive ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                            {isPositive ? '▲' : '▼'}
                          </span>
                          {' '}{Math.abs(item.change24h).toFixed(2)}%
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
          {usingFallback ? (
            <p className="text-xs text-amber-300/85">
              تعذر جلب السوق الحي الآن، ويتم عرض بيانات احتياطية واضحة لحين عودة المصدر المباشر.
            </p>
          ) : null}
        </section>
        <div className="space-y-3 lg:col-span-1">
          <AdBanner
            items={ads}
            placement="home"
            className="my-0 lg:sticky lg:top-[110px]"
          />
        </div>
      </div>
    </div>
  )
}

