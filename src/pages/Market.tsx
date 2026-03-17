import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [customQuote, setCustomQuote] = useState<Quote | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  const [selectedInterval, setSelectedInterval] = useState('5m')
  const [candles, setCandles] = useState<Candle[]>([])
  const [candlesLoading, setCandlesLoading] = useState(false)
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [quotesError, setQuotesError] = useState<string | null>(null)
  const [candlesError, setCandlesError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  const loadQuotes = useCallback(async () => {
    setQuotesError(null)
    setQuotesLoading(true)
    try {
      const res = (await apiFetch('/api/market/quotes')) as { items: Quote[] }
      setMarketData(res.items || [])
      setQuotesError(null)
    } catch {
      setMarketData([])
      setQuotesError(t('market_quotes_error'))
    } finally {
      setQuotesLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadQuotes().catch(() => setQuotesLoading(false))
    const id = window.setInterval(() => loadQuotes().catch(() => {}), 3000)
    return () => window.clearInterval(id)
  }, [loadQuotes])

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return marketData
    const fromList = marketData.filter((item) => item.symbol.includes(q))
    if (customQuote && (customQuote.symbol.includes(q) || q.includes(customQuote.symbol.replace(/USDT$/i, '')))) {
      const exists = fromList.some((x) => x.symbol === customQuote.symbol)
      if (!exists) return [customQuote, ...fromList]
    }
    return fromList
  }, [query, marketData, customQuote])

  async function searchCustomSymbol() {
    const q = query.trim().toUpperCase()
    if (!q) return
    const symbol = q.endsWith('USDT') ? q : `${q}USDT`
    setCustomQuote(null)
    setSearchError(null)
    try {
      const res = (await apiFetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`)) as { item: Quote }
      if (res.item) {
        setCustomQuote(res.item)
        setSelectedSymbol(res.item.symbol)
        setSearchError(null)
      } else {
        setSearchError(t('market_symbol_not_found'))
      }
    } catch {
      setCustomQuote(null)
      setSearchError(t('market_symbol_not_found'))
    }
  }

  const effectiveSelectedSymbol =
    filtered.length === 0
      ? selectedSymbol
      : filtered.some((item) => item.symbol === selectedSymbol)
      ? selectedSymbol
      : filtered[0].symbol

  const loadCandles = useCallback(async () => {
    setCandlesError(null)
    setCandlesLoading(true)
    try {
      const res = (await apiFetch(
        `/api/market/candles?symbol=${encodeURIComponent(effectiveSelectedSymbol)}&interval=${selectedInterval}&limit=120`,
      )) as { candles: Candle[] }
      setCandles(res.candles || [])
      setCandlesError(null)
    } catch {
      setCandles([])
      setCandlesError(t('market_candles_error'))
    } finally {
      setCandlesLoading(false)
    }
  }, [effectiveSelectedSymbol, selectedInterval, t])

  useEffect(() => {
    loadCandles().catch(() => setCandlesLoading(false))
    const id = window.setInterval(() => loadCandles().catch(() => {}), 5000)
    return () => window.clearInterval(id)
  }, [loadCandles])

  return (
    <div className="page market-page">
      <h1 className="page-title">{t('nav_markets')}</h1>
      <div className="elite-panel p-3">
        <div className="flex gap-2">
          <input
            className="field-input h-11 flex-1"
            placeholder={t('market_search_placeholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!e.target.value.trim()) {
                setCustomQuote(null)
                setSearchError(null)
              }
            }}
            onKeyDown={(e) => e.key === 'Enter' && searchCustomSymbol()}
          />
          <button
            type="button"
            className="elite-chip rounded-lg border border-brand-blue/40 bg-brand-blue/20 px-4 text-sm font-medium text-white"
            onClick={searchCustomSymbol}
          >
            {t('common_search')}
          </button>
        </div>
        {searchError ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <span>{searchError}</span>
            <button
              type="button"
              className="text-xs font-medium text-red-300 underline"
              onClick={() => setSearchError(null)}
            >
              {t('common_cancel')}
            </button>
          </div>
        ) : null}
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
        {candlesError ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-app-muted">
            <p className="text-sm text-red-400">{candlesError}</p>
            <button
              type="button"
              className="rounded-lg border border-brand-blue/40 bg-brand-blue/20 px-4 py-2 text-sm font-medium text-white"
              onClick={() => loadCandles()}
            >
              {t('common_retry')}
            </button>
          </div>
        ) : candlesLoading && candles.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-app-muted">{t('common_loading')}</div>
        ) : candles.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-app-muted">{t('market_candles_empty')}</div>
        ) : (
          <LiveCandlesChart candles={candles} />
        )}
      </div>

      <div className="elite-panel overflow-hidden">
        <div className="table-head">
          <span>{t('home_pair')}</span>
          <span>{t('home_last_price')}</span>
          <span>{t('home_change_24h')}</span>
        </div>
        {quotesError ? (
          <div className="flex flex-col gap-2 border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-sm text-red-400">{quotesError}</p>
            <button
              type="button"
              className="w-fit rounded-lg border border-brand-blue/40 bg-brand-blue/20 px-4 py-2 text-sm font-medium text-white"
              onClick={() => loadQuotes()}
            >
              {t('common_retry')}
            </button>
          </div>
        ) : quotesLoading && marketData.length === 0 ? (
          <div className="table-row">{t('common_loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="table-row text-app-muted">{t('market_no_results')}</div>
        ) : (
          filtered.map((item) => (
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
                <div className="pair-sub">{t('home_spot')}</div>
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
        ))
        )}
      </div>
    </div>
  )
}

