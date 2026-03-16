import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

type WatchItem = {
  id: number
  symbol: string
  market_type: string
}

export function WatchlistPage() {
  const [symbol, setSymbol] = useState('')
  const [items, setItems] = useState<WatchItem[]>([])

  async function loadWatchlist() {
    const res = await apiFetch('/api/portfolio/watchlist')
    setItems((res as { watchlist: WatchItem[] }).watchlist)
  }

  useEffect(() => {
    apiFetch('/api/portfolio/watchlist')
      .then((res) => setItems((res as { watchlist: WatchItem[] }).watchlist))
      .catch(() => setItems([]))
  }, [])

  async function addSymbol() {
    if (!symbol.trim()) return
    await apiFetch('/api/portfolio/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol: symbol.trim(), marketType: 'crypto' }),
    })
    setSymbol('')
    await loadWatchlist()
  }

  async function remove(id: number) {
    await apiFetch(`/api/portfolio/watchlist/${id}`, { method: 'DELETE' })
    await loadWatchlist()
  }

  return (
    <div className="page">
      <h1 className="page-title">Watchlist</h1>
      <div className="card">
        <div className="captcha-row">
          <input
            className="field-input"
            placeholder="BTCUSDT"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
          <button className="invite-copy-btn" type="button" onClick={addSymbol}>
            Add
          </button>
        </div>
      </div>
      <div className="table-card">
        {items.length === 0 ? (
          <div className="table-row">No watchlist items yet.</div>
        ) : (
          items.map((item) => (
            <div className="table-row" key={item.id}>
              <span>{item.symbol}</span>
              <span>{item.market_type}</span>
              <button className="link-btn" onClick={() => remove(item.id)} type="button">
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
