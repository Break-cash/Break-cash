import { Router } from 'express'

const marketRows = [
  { symbol: 'BTCUSDC', price: 69969.87, change24h: -1.91, volume: 124567890 },
  { symbol: 'ETHUSDC', price: 2033.45, change24h: -2.22, volume: 89456712 },
  { symbol: 'ADAUSDC', price: 0.260409, change24h: -4.09, volume: 15678234 },
  { symbol: 'SOLUSDC', price: 137.22, change24h: 5.22, volume: 34456789 },
  { symbol: 'XRPUSDC', price: 0.56, change24h: 2.43, volume: 44567891 },
]

export function createMarketRouter() {
  const router = Router()

  router.get('/quotes', async (_req, res) => {
    return res.json({ items: marketRows, refreshedAt: new Date().toISOString() })
  })

  router.get('/search', async (req, res) => {
    const q = String(req.query.q || '').toUpperCase().trim()
    const items = q ? marketRows.filter((row) => row.symbol.includes(q)) : marketRows
    return res.json({ items })
  })

  router.get('/overview', async (_req, res) => {
    const gainers = [...marketRows].sort((a, b) => b.change24h - a.change24h).slice(0, 3)
    const losers = [...marketRows].sort((a, b) => a.change24h - b.change24h).slice(0, 3)
    return res.json({ gainers, losers, refreshedAt: new Date().toISOString() })
  })

  router.get('/pair/:symbol', async (req, res) => {
    const symbol = String(req.params.symbol || '').toUpperCase()
    const pair = marketRows.find((row) => row.symbol === symbol)
    if (!pair) return res.status(404).json({ error: 'SYMBOL_NOT_FOUND' })
    return res.json({
      pair,
      candles: [
        { t: '1', o: pair.price * 0.99, h: pair.price * 1.01, l: pair.price * 0.98, c: pair.price },
        { t: '2', o: pair.price, h: pair.price * 1.02, l: pair.price * 0.99, c: pair.price * 1.01 },
      ],
    })
  })

  return router
}
