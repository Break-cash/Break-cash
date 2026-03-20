import WebSocket from 'ws'

const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT',
  'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT',
  'TRXUSDT', 'ETCUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT',
]
const REST_ENDPOINT = 'https://api.binance.com/api/v3/ticker/24hr'
const BYBIT_ENDPOINT = 'https://api.bybit.com/v5/market/tickers?category=spot'
const MEXC_ENDPOINT = 'https://api.mexc.com/api/v3/ticker/24hr'

function toQuote(row) {
  const price = Number(row?.lastPrice ?? row?.price ?? 0)
  const open = Number(row?.openPrice ?? row?.open ?? 0)
  const change24h = open > 0 ? ((price - open) / open) * 100 : Number(row?.priceChangePercent ?? 0)
  const volume = Number(row?.quoteVolume ?? row?.volume ?? 0)
  return {
    symbol: String(row?.symbol || '').toUpperCase(),
    price: Number.isFinite(price) ? price : 0,
    change24h: Number.isFinite(change24h) ? change24h : 0,
    volume: Number.isFinite(volume) ? volume : 0,
  }
}

function toMiniTickerQuote(mini) {
  const close = Number(mini?.c ?? 0)
  const open = Number(mini?.o ?? 0)
  const change24h = open > 0 ? ((close - open) / open) * 100 : 0
  return {
    symbol: String(mini?.s || '').toUpperCase(),
    price: Number.isFinite(close) ? close : 0,
    change24h: Number.isFinite(change24h) ? change24h : 0,
    volume: Number(mini?.q ?? 0) || 0,
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'BreakCash/1.0 (Market Data)' },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`UPSTREAM_${response.status}`)
  return response.json()
}

async function fetchFromBinance(symbol) {
  const row = await fetchJson(`${REST_ENDPOINT}?symbol=${encodeURIComponent(symbol)}`)
  return toQuote(row)
}

async function fetchFromBybit(symbol) {
  const row = await fetchJson(`${BYBIT_ENDPOINT}&symbol=${encodeURIComponent(symbol)}`)
  const item = row?.result?.list?.[0]
  return {
    symbol: String(item?.symbol || symbol).toUpperCase(),
    price: Number(item?.lastPrice ?? 0) || 0,
    change24h: Number(item?.price24hPcnt ?? 0) * 100 || 0,
    volume: Number(item?.turnover24h ?? 0) || 0,
  }
}

async function fetchFromMexc(symbol) {
  const row = await fetchJson(`${MEXC_ENDPOINT}?symbol=${encodeURIComponent(symbol)}`)
  return {
    symbol: String(row?.symbol || symbol).toUpperCase(),
    price: Number(row?.lastPrice ?? 0) || 0,
    change24h: Number(row?.priceChangePercent ?? 0) || 0,
    volume: Number(row?.quoteVolume ?? 0) || 0,
  }
}

export async function fetchBestQuote(symbol) {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase()
  const providers = [fetchFromBinance, fetchFromBybit, fetchFromMexc]
  for (const provider of providers) {
    try {
      const quote = await provider(normalizedSymbol)
      if (quote?.symbol && Number.isFinite(quote.price) && quote.price > 0) return quote
    } catch {
      // try next provider
    }
  }
  throw new Error('QUOTE_UNAVAILABLE')
}

export function createMarketFeed(symbols = DEFAULT_SYMBOLS) {
  const trackedSymbols = symbols.map((s) => s.toUpperCase())
  const quotes = new Map()
  let refreshedAt = new Date().toISOString()
  let ws = null

  async function refreshFromRest() {
    try {
      const query = encodeURIComponent(JSON.stringify(trackedSymbols))
      const rows = await fetchJson(`${REST_ENDPOINT}?symbols=${query}`)
      for (const row of rows) {
        const q = toQuote(row)
        if (q.symbol) quotes.set(q.symbol, q)
      }
      refreshedAt = new Date().toISOString()
      return
    } catch {
      const rows = await Promise.all(
        trackedSymbols.map(async (symbol) => {
          try {
            return await fetchBestQuote(symbol)
          } catch {
            return null
          }
        }),
      )
      for (const row of rows.filter(Boolean)) {
        quotes.set(row.symbol, row)
      }
      refreshedAt = new Date().toISOString()
    }
  }

  function connectWebSocket() {
    const streams = trackedSymbols.map((s) => `${s.toLowerCase()}@miniTicker`).join('/')
    ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(String(raw))
        const data = parsed?.data
        if (!data?.s) return
        const q = toMiniTickerQuote(data)
        quotes.set(q.symbol, q)
        refreshedAt = new Date().toISOString()
      } catch {
        // ignore malformed messages from upstream
      }
    })

    ws.on('error', () => {
      // fallback is periodic REST refresh
    })

    ws.on('close', () => {
      setTimeout(() => connectWebSocket(), 4000)
    })
  }

  refreshFromRest().catch(() => {})
  setInterval(() => {
    refreshFromRest().catch(() => {})
  }, 15000)
  connectWebSocket()

  return {
    getQuotes() {
      const items = trackedSymbols
        .map((symbol) => quotes.get(symbol))
        .filter(Boolean)
      return { items, refreshedAt }
    },
    search(q) {
      const query = String(q || '').toUpperCase().trim()
      const { items } = this.getQuotes()
      if (!query) return items
      return items.filter((row) => row.symbol.includes(query))
    },
    getOverview() {
      const { items } = this.getQuotes()
      const gainers = [...items].sort((a, b) => b.change24h - a.change24h).slice(0, 3)
      const losers = [...items].sort((a, b) => a.change24h - b.change24h).slice(0, 3)
      return { gainers, losers, refreshedAt }
    },
    getPair(symbol) {
      const sym = String(symbol || '').toUpperCase()
      const pair = quotes.get(sym)
      if (!pair) return null
      const p = pair.price
      return {
        pair,
        candles: [
          { t: '1', o: p * 0.995, h: p * 1.004, l: p * 0.992, c: p * 0.998 },
          { t: '2', o: p * 0.998, h: p * 1.006, l: p * 0.996, c: p },
        ],
      }
    },
  }
}

export const sharedMarketFeed = createMarketFeed()
