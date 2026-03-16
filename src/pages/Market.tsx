import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { LiveCandlesChart } from '../components/market/LiveCandlesChart'
import { useI18n } from '../i18nCore'

type Quote = { symbol: string; price: number; change24h: number; volume: number }
type Candle = { time: number; open: number; high: number; low: number; close: number }
const intervals = ['1m', '5m', '15m', '1h', '4h', '1d']

export function Market() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [marketData, setMarketData] = useState<Quote[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [selectedInterval, setSelectedInterval] = useState('5m')
  const [candles, setCandles] = useState<Candle[]>([])

  useEffect(() => {
    let active = true
    async function load() {
      const res = (await apiFetch('/api/market/quotes')) as {
        items: Quote[]
      }
      if (active) setMarketData(res.items)
    }
    load().catch(() => setMarketData([]))
    const id = window.setInterval(() => {
      load().catch(() => {})
    }, 2000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return marketData
    return marketData.filter((item) => item.symbol.includes(query.toUpperCase().trim()))
  }, [query, marketData])

  const effectiveSelectedSymbol =
    filtered.length === 0
      ? selectedSymbol
      : filtered.some((item) => item.symbol === selectedSymbol)
      ? selectedSymbol
      : filtered[0].symbol

  useEffect(() => {
    let active = true
    async function loadCandles() {
      const res = (await apiFetch(
        `/api/market/candles?symbol=${encodeURIComponent(effectiveSelectedSymbol)}&interval=${selectedInterval}&limit=120`,
      )) as { candles: Candle[] }
      if (active) setCandles(res.candles || [])
    }
    loadCandles().catch(() => setCandles([]))
    const id = window.setInterval(() => {
      loadCandles().catch(() => {})
    }, 3000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [effectiveSelectedSymbol, selectedInterval])

  return (
    <div className="page market-page">
      <h1 className="page-title">{t('nav_markets')}</h1>
      <div className="elite-panel p-3">
        <input
          className="field-input h-11"
          placeholder="Search coin/contract"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="elite-panel market-candles-card p-3">
        <div className="market-candles-head">
          <strong className="text-white/95">{effectiveSelectedSymbol}</strong>
          <div className="elite-scroll-row">
            {intervals.map((itv) => (
              <button
                key={itv}
                type="button"
                className={selectedInterval === itv ? 'market-itv-btn active elite-chip' : 'market-itv-btn elite-chip'}
                onClick={() => setSelectedInterval(itv)}
              >
                {itv}
              </button>
            ))}
          </div>
        </div>
        <LiveCandlesChart candles={candles} />
      </div>

      <div className="elite-panel overflow-hidden">
        <div className="table-head">
          <span>الزوج</span>
          <span>آخر سعر</span>
          <span>التغير</span>
        </div>
        {filtered.map((item) => (
          <div
            key={item.symbol}
            className={effectiveSelectedSymbol === item.symbol ? 'table-row market-row-active cursor-pointer' : 'table-row cursor-pointer'}
            onClick={() => setSelectedSymbol(item.symbol)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setSelectedSymbol(item.symbol)
            }}
          >
            <div className="pair">
              <div className="icon-circle">{item.symbol[0]}</div>
              <div className="pair-meta">
                <div className="pair-name">{item.symbol}</div>
                <div className="pair-sub">سوق فوري</div>
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
        ))}
      </div>
    </div>
  )
}

