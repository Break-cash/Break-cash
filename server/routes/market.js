import { Router } from 'express'
import { fetchBestQuote, sharedMarketFeed as marketFeed } from '../services/marketFeed.js'

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'BreakCash/1.0 (Market Data)' },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`UPSTREAM_${response.status}`)
  return response.json()
}

function normalizeBybitInterval(interval) {
  const map = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '1h': '60',
    '4h': '240',
    '1d': 'D',
  }
  return map[interval] || null
}

function toBinanceCandles(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  }))
}

function toBybitCandles(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
    }))
    .reverse()
}

async function fetchBestCandles(symbol, interval, limit) {
  const providers = [
    async () => {
      const endpoint =
        `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}` +
        `&interval=${encodeURIComponent(interval)}&limit=${limit}`
      const rows = await fetchJson(endpoint)
      return toBinanceCandles(rows)
    },
    async () => {
      const bybitInterval = normalizeBybitInterval(interval)
      if (!bybitInterval) return []
      const endpoint =
        `https://api.bybit.com/v5/market/kline?category=spot&symbol=${encodeURIComponent(symbol)}` +
        `&interval=${encodeURIComponent(bybitInterval)}&limit=${limit}`
      const rows = await fetchJson(endpoint)
      return toBybitCandles(rows?.result?.list)
    },
    async () => {
      const endpoint =
        `https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}` +
        `&interval=${encodeURIComponent(interval)}&limit=${limit}`
      const rows = await fetchJson(endpoint)
      return toBinanceCandles(rows)
    },
  ]

  for (const provider of providers) {
    try {
      const candles = await provider()
      if (candles.length > 0) return candles
    } catch {
      // try next provider
    }
  }
  throw new Error('CANDLES_UNAVAILABLE')
}

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
      const item = await fetchBestQuote(symbol)
      return res.json({ item })
    } catch {
      return res.status(404).json({ error: 'SYMBOL_NOT_FOUND' })
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

    try {
      const candles = await fetchBestCandles(symbol, interval, limit)
      return res.json({ symbol, interval, candles, refreshedAt: new Date().toISOString() })
    } catch {
      const fallback = { symbol, interval, candles: [], refreshedAt: new Date().toISOString(), upstreamFailed: true }
      return res.status(200).json(fallback)
    }
  })

  return router
}
