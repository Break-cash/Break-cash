import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'

export type MarketBoardQuote = {
  symbol: string
  price: number
  change24h: number
  volume: number
}

type MarketBoardOverview = {
  gainers: MarketBoardQuote[]
  losers: MarketBoardQuote[]
  refreshedAt?: string
}

const FALLBACK_QUOTES: MarketBoardQuote[] = [
  { symbol: 'BTCUSDT', price: 0, change24h: 0, volume: 0 },
  { symbol: 'ETHUSDT', price: 0, change24h: 0, volume: 0 },
  { symbol: 'BNBUSDT', price: 0, change24h: 0, volume: 0 },
  { symbol: 'SOLUSDT', price: 0, change24h: 0, volume: 0 },
  { symbol: 'XRPUSDT', price: 0, change24h: 0, volume: 0 },
]

export function useMarketBoard(pollMs = 5000) {
  const [quotes, setQuotes] = useState<MarketBoardQuote[]>([])
  const [overview, setOverview] = useState<MarketBoardOverview>({ gainers: [], losers: [] })
  const [loading, setLoading] = useState(true)
  const [usingFallback, setUsingFallback] = useState(false)

  const load = useCallback(async () => {
    try {
      const [quotesRes, overviewRes] = await Promise.all([
        apiFetch('/api/market/quotes') as Promise<{ items?: MarketBoardQuote[] }>,
        apiFetch('/api/market/overview') as Promise<MarketBoardOverview>,
      ])
      const normalizedQuotes = Array.isArray(quotesRes.items)
        ? quotesRes.items.map((item) => ({
            symbol: String(item.symbol || '').toUpperCase(),
            price: Number(item.price || 0),
            change24h: Number(item.change24h || 0),
            volume: Number(item.volume || 0),
          }))
        : []
      const sortedByVolume = [...normalizedQuotes].sort((a, b) => b.volume - a.volume)
      setQuotes(sortedByVolume)
      setOverview({
        gainers: Array.isArray(overviewRes?.gainers) ? overviewRes.gainers : [],
        losers: Array.isArray(overviewRes?.losers) ? overviewRes.losers : [],
        refreshedAt: overviewRes?.refreshedAt,
      })
      setUsingFallback(normalizedQuotes.length === 0)
      setLoading(false)
    } catch {
      setQuotes(FALLBACK_QUOTES)
      setOverview({ gainers: [], losers: [], refreshedAt: undefined })
      setUsingFallback(true)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load().catch(() => {})
    const id = window.setInterval(() => load().catch(() => {}), pollMs)
    const handleForegroundRefresh = () => {
      if (document.visibilityState === 'visible') {
        load().catch(() => {})
      }
    }
    window.addEventListener('focus', handleForegroundRefresh)
    document.addEventListener('visibilitychange', handleForegroundRefresh)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', handleForegroundRefresh)
      document.removeEventListener('visibilitychange', handleForegroundRefresh)
    }
  }, [load, pollMs])

  const mostTraded = useMemo(() => quotes.slice(0, 8), [quotes])

  return {
    quotes,
    mostTraded,
    gainers: overview.gainers,
    losers: overview.losers,
    refreshedAt: overview.refreshedAt,
    loading,
    usingFallback,
    reload: load,
  }
}
