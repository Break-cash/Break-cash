import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'

export function Market() {
  const [query, setQuery] = useState('')
  const [marketData, setMarketData] = useState<
    { symbol: string; price: number; change24h: number; volume: number }[]
  >([])

  useEffect(() => {
    let active = true
    async function load() {
      const res = (await apiFetch('/api/market/quotes')) as {
        items: { symbol: string; price: number; change24h: number; volume: number }[]
      }
      if (active) setMarketData(res.items)
    }
    load().catch(() => setMarketData([]))
    const id = window.setInterval(() => {
      load().catch(() => {})
    }, 10000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return marketData
    return marketData.filter((item) => item.symbol.includes(query.toUpperCase().trim()))
  }, [query, marketData])

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

      <div className="table-card">
        <div className="table-head">
          <span>الزوج</span>
          <span>آخر سعر</span>
          <span>التغير</span>
        </div>
        {filtered.map((item) => (
          <div key={item.symbol} className="table-row">
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

