import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { LiveCandlesChart } from '../components/market/LiveCandlesChart'

type Quote = { symbol: string; price: number; change24h: number; volume: number }
type Candle = { time: number; open: number; high: number; low: number; close: number }
const intervals = ['1m', '5m', '15m', '1h', '4h', '1d']

export function Market() {
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

  useEffect(() => {
    let active = true
    async function loadCandles() {
      const res = (await apiFetch(
        `/api/market/candles?symbol=${encodeURIComponent(selectedSymbol)}&interval=${selectedInterval}&limit=120`,
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
  }, [selectedSymbol, selectedInterval])

  const filtered = useMemo(() => {
    if (!query.trim()) return marketData
    return marketData.filter((item) => item.symbol.includes(query.toUpperCase().trim()))
  }, [query, marketData])

  useEffect(() => {
    if (filtered.length === 0) return
    if (!filtered.some((item) => item.symbol === selectedSymbol)) {
      setSelectedSymbol(filtered[0].symbol)
    }
  }, [filtered, selectedSymbol])

  return (
    <div className="page">
      <h1 className="page-title">الأسعار السوقية</h1>
      <div className="card">
        <input
          className="field-input"
          placeholder="Search coin/contract"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card market-candles-card">
        <div className="market-candles-head">
          <strong>{selectedSymbol}</strong>
          <div className="market-candles-intervals">
            {intervals.map((itv) => (
              <button
                key={itv}
                type="button"
                className={selectedInterval === itv ? 'market-itv-btn active' : 'market-itv-btn'}
                onClick={() => setSelectedInterval(itv)}
              >
                {itv}
              </button>
            ))}
          </div>
        </div>
        <LiveCandlesChart candles={candles} />
      </div>

      <div className="table-card">
        <div className="table-head">
          <span>الزوج</span>
          <span>آخر سعر</span>
          <span>التغير</span>
        </div>
        {filtered.map((item) => (
          <div
            key={item.symbol}
            className={selectedSymbol === item.symbol ? 'table-row market-row-active' : 'table-row'}
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

