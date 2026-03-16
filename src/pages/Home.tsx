import { useEffect, useMemo, useState } from 'react'
import { apiFetch, getPromoBanners, type PromoBannerItem } from '../api'
import { appData } from '../data'
import { PromoBanner } from '../components/ads/PromoBanner'
import { useI18n } from '../i18nCore'

type MarketQuote = { symbol: string; price: number; change24h: number }

export function Home() {
  const { t } = useI18n()
  const { balance_info } = appData
  const [promoBanners, setPromoBanners] = useState<PromoBannerItem[]>([])
  const [marketData, setMarketData] = useState<MarketQuote[]>([])
  const mainMiningAd: PromoBannerItem = useMemo(
    () => ({
      id: 'local-mining-main-ad',
      title: t('nav_mining'),
      subtitle: t('mining_media_hint'),
      ctaLabel: t('nav_mining'),
      to: '/mining',
      imageUrl: '/ads/mining-main-banner.jpg',
      placement: 'all',
      enabled: true,
      order: -100,
    }),
    [t],
  )

  useEffect(() => {
    getPromoBanners()
      .then((res) => setPromoBanners(res.items || []))
      .catch(() => setPromoBanners([]))
  }, [])

  useEffect(() => {
    let active = true
    async function loadQuotes() {
      try {
        const res = (await apiFetch('/api/market/quotes')) as {
          items: Array<{ symbol: string; price: number; change24h: number }>
        }
        if (!active) return
        const rows = (res.items || []).map((item) => ({
          symbol: String(item.symbol || '').toUpperCase(),
          price: Number(item.price || 0),
          change24h: Number(item.change24h || 0),
        }))
        setMarketData(rows)
      } catch {
        if (active) setMarketData([])
      }
    }
    loadQuotes().catch(() => {})
    const id = window.setInterval(() => loadQuotes().catch(() => {}), 5000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  const homeBanners = useMemo(
    () => {
      const filtered = promoBanners.filter((x) => x.enabled && (x.placement === 'home' || x.placement === 'all'))
      const hasMainMiningAd = filtered.some(
        (item) => item.id === mainMiningAd.id || String(item.imageUrl || '').includes('/ads/mining-main-banner.jpg'),
      )
      return hasMainMiningAd ? filtered : [mainMiningAd, ...filtered]
    },
    [mainMiningAd, promoBanners],
  )

  return (
    <div className="page home-page space-y-4 lg:space-y-5">
      <section className="cards-row grid gap-3 lg:grid-cols-3">
        <div className="card balance-card lg:col-span-2">
          <div className="card-header">
            <span className="card-title">{t('home_total_assets')}</span>
            <span className="card-pill">{balance_info.currency}</span>
          </div>
          <div className="card-main-value">
            {balance_info.total_assets_usdt.toFixed(2)}
          </div>
          <div className="card-footer">
            <div>
              <div className="label">{t('home_today_earnings')}</div>
              <div className="value positive">
                {balance_info.today_earnings.toFixed(2)} {balance_info.currency}
              </div>
            </div>
            <div>
              <div className="label">{t('home_team_earnings')}</div>
              <div className="value">
                {balance_info.team_earnings.toFixed(2)} {balance_info.currency}
              </div>
            </div>
          </div>
        </div>

        <div className="card small-card lg:h-full">
          <div className="label">{t('home_funding_account')}</div>
          <div className="card-main-value sm">
            {balance_info.funding_account.toFixed(2)} {balance_info.currency}
          </div>
          <div className="hint">{t('home_funding_hint')}</div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="section lg:col-span-2">
          <div className="section-header">
            <h2>{t('home_most_traded')}</h2>
          </div>

          <div className="table-card">
            <div className="table-head">
              <span>{t('home_pair')}</span>
              <span>{t('home_last_price')}</span>
              <span>{t('home_change_24h')}</span>
            </div>
            {marketData.length === 0 ? (
              <div className="table-row">{t('common_loading')}</div>
            ) : (
              marketData.map((item) => {
                const pair = item.symbol.replace(/USDT$/i, '/USDT')
                return (
                  <div key={item.symbol} className="table-row">
                    <div className="pair">
                      <div className="icon-circle">{item.symbol[0]}</div>
                      <div className="pair-meta">
                        <div className="pair-name">{pair}</div>
                        <div className="pair-sub">{t('home_spot')}</div>
                      </div>
                    </div>
                    <div className="price">{item.price.toLocaleString()}</div>
                    <div
                      className={
                        item.change24h >= 0 ? 'change positive' : 'change negative'
                      }
                    >
                      {item.change24h.toFixed(2)}%
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
        <div className="space-y-3 lg:col-span-1">
          <PromoBanner
            className="my-0 lg:sticky lg:top-[110px]"
            items={homeBanners}
          />
        </div>
      </div>
    </div>
  )
}

