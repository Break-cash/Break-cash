import { Router } from 'express'
import { createMarketFeed } from '../services/marketFeed.js'

const marketFeed = createMarketFeed()

export function createMarketRouter() {
  const router = Router()

  router.get('/quotes', async (_req, res) => {
    return res.json(marketFeed.getQuotes())
  })

  router.get('/quote', async (req, res) => {
    const symbol = String(req.query.symbol || '').toUpperCase().trim()
    if (!symbol) return res.status(400).json({ error: 'MISSING_SYMBOL' })
    const { items } = marketFeed.getQuotes()
    const cached = items.find((q) => q.symbol === symbol)
    if (cached) return res.json({ item: cached })
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`)
      if (!r.ok) return res.status(404).json({ error: 'SYMBOL_NOT_FOUND' })
      const row = await r.json()
      const item = {
        symbol: String(row?.symbol || '').toUpperCase(),
        price: Number(row?.lastPrice ?? 0) || 0,
        change24h: Number(row?.priceChangePercent ?? 0) || 0,
        volume: Number(row?.quoteVolume ?? 0) || 0,
      }
      return res.json({ item })
    } catch {
      return res.status(502).json({ error: 'UPSTREAM_UNREACHABLE' })
    }
  })

  router.get('/search', async (req, res) => {
    const items = marketFeed.search(req.query.q)
    return res.json({ items })
  })

  router.get('/overview', async (_req, res) => {
    return res.json(marketFeed.getOverview())
  })

  router.get('/pair/:symbol', async (req, res) => {
    const data = marketFeed.getPair(req.params.symbol)
    if (!data) return res.status(404).json({ error: 'SYMBOL_NOT_FOUND' })
    return res.json(data)
  })

  router.get('/candles', async (req, res) => {
    const symbol = String(req.query.symbol || 'BTCUSDT').toUpperCase().trim()
    const interval = String(req.query.interval || '1m').trim()
    const limit = Math.min(Math.max(Number(req.query.limit || 120), 20), 500)

    const allowedIntervals = new Set(['1m', '5m', '15m', '1h', '4h', '1d'])
    if (!allowedIntervals.has(interval)) {
      return res.status(400).json({ error: 'INVALID_INTERVAL' })
    }

    const endpoint =
      `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}` +
      `&interval=${encodeURIComponent(interval)}&limit=${limit}`

    try {
      const r = await fetch(endpoint)
      if (!r.ok) return res.status(502).json({ error: 'UPSTREAM_FAILED' })
      const rows = await r.json()
      const candles = rows.map((row) => ({
        time: Math.floor(Number(row[0]) / 1000),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
      }))
      return res.json({ symbol, interval, candles, refreshedAt: new Date().toISOString() })
    } catch {
      return res.status(502).json({ error: 'UPSTREAM_UNREACHABLE' })
    }
  })

  return router
}
