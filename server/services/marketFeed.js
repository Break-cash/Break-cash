import WebSocket from 'ws'

const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT',
  'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT',
  'TRXUSDT', 'ETCUSDT', 'APTUSDT', 'ARBUSDT', 'OPUSDT', 'INJUSDT',
]
const REST_ENDPOINT = 'https://api.binance.com/api/v3/ticker/24hr'

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

export function createMarketFeed(symbols = DEFAULT_SYMBOLS) {
  const trackedSymbols = symbols.map((s) => s.toUpperCase())
  const quotes = new Map()
  let refreshedAt = new Date().toISOString()
  let ws = null

  async function refreshFromRest() {
    const query = encodeURIComponent(JSON.stringify(trackedSymbols))
    const res = await fetch(`${REST_ENDPOINT}?symbols=${query}`)
    if (!res.ok) throw new Error(`REST_${res.status}`)
    const rows = await res.json()
    for (const row of rows) {
      const q = toQuote(row)
      if (q.symbol) quotes.set(q.symbol, q)
    }
    refreshedAt = new Date().toISOString()
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
      // noop: fallback is periodic REST refresh
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
