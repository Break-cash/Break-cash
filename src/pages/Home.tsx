import { useEffect, useState } from 'react'
import { getAds, subscribeToLiveUpdates, type AdItem } from '../api'
import { appData } from '../data'
import { AdBanner } from '../components/ads/AdBanner'
import { useMarketBoard } from '../hooks/useMarketBoard'
import { useDailyEarningsSummary } from '../hooks/useDailyEarningsSummary'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'

export function Home() {
  const { t } = useI18n()
  const { balance_info } = appData
  const [ads, setAds] = useState<AdItem[]>([])
  const { summary: walletSummary } = useWalletSummary()
  const { summary: dailyEarningsSummary } = useDailyEarningsSummary()
  const { mostTraded, usingFallback, loading } = useMarketBoard(5000)

  useEffect(() => {
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
    <div className="page home-page">
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
                  {walletSummary.totalAssets.toFixed(2)}
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
                  {walletSummary.mainBalance.toFixed(2)}
                </div>
              </div>
              <div className="text-xs text-app-muted leading-relaxed pt-3 border-t border-app-border">{t('home_funding_hint')}</div>
            </div>
          </div>
        </div>
      </section>

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

