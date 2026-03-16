import { useEffect, useMemo, useState } from 'react'
import { apiFetch, redeemTaskCode } from '../api'
import { LiveCandlesChart } from '../components/market/LiveCandlesChart'
import { useI18n } from '../i18nCore'

type Quote = { symbol: string; price: number; change24h: number; volume24h: number }
type Candle = { time: number; open: number; high: number; low: number; close: number }
const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

export function FuturesPage() {
  const { t } = useI18n()
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [selected, setSelected] = useState('BTCUSDT')
  const [selectedInterval, setSelectedInterval] = useState<(typeof intervals)[number]>('5m')
  const [candles, setCandles] = useState<Candle[]>([])
  const [taskCode, setTaskCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let active = true
    async function loadQuotes() {
      try {
        const res = (await apiFetch('/api/market/quotes')) as {
          items: Array<{ symbol: string; price: number; change24h: number; volume?: number }>
        }
        if (!active) return
        const rows = (res.items || []).slice(0, 12).map((item) => ({
          symbol: String(item.symbol || '').toUpperCase(),
          price: Number(item.price || 0),
          change24h: Number(item.change24h || 0),
          volume24h: Number(item.volume || 0),
        }))
        setQuotes(rows)
        if (rows.length > 0 && !rows.find((x) => x.symbol === selected)) {
          setSelected(rows[0].symbol)
        }
      } catch {
        if (active) setQuotes([])
      }
    }
    loadQuotes().catch(() => {})
    const id = window.setInterval(() => loadQuotes().catch(() => {}), 3000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [selected])

  useEffect(() => {
    let active = true
    async function loadCandles() {
      const res = (await apiFetch(
        `/api/market/candles?symbol=${encodeURIComponent(selected)}&interval=${selectedInterval}&limit=120`,
      )) as { candles: Candle[] }
      if (!active) return
      setCandles(Array.isArray(res.candles) ? res.candles : [])
    }
    loadCandles().catch(() => setCandles([]))
    const id = window.setInterval(() => {
      loadCandles().catch(() => {})
    }, 5000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [selected, selectedInterval])

  const current = useMemo(() => quotes.find((item) => item.symbol === selected) || quotes[0], [quotes, selected])

  async function handleRedeemCode() {
    const code = taskCode.trim()
    if (!code) {
      setMessage({ type: 'error', text: t('tasks_code_enter') })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await redeemTaskCode(code)
      setMessage({
        type: 'success',
        text: `${t('tasks_code_success')} +${Number(res.rewardAmount || 0).toFixed(2)} USDT (${Number(
          res.rewardPercent || 0,
        ).toFixed(2)}%)`,
      })
      setTaskCode('')
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : t('tasks_code_failed') })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page futures-page ku-mobile-page space-y-3">
      <h1 className="page-title">{t('tasks_market_board_title')}</h1>

      <section className="elite-panel rounded-2xl border border-app-border bg-app-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{t('tasks_market_live')}</span>
          <span className="text-xs text-app-muted">{t('tasks_market_auto_refresh')}</span>
        </div>
        <div className="futures-chart rounded-xl border border-app-border bg-app-elevated p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-app-muted">{selected}</span>
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
          <LiveCandlesChart candles={candles} />
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl border border-app-border bg-app-elevated px-3 py-2">
          <span className="text-xs text-app-muted">{current?.symbol || '--'}</span>
          <span className="text-sm font-semibold text-white">{Number(current?.price || 0).toLocaleString()}</span>
          <span className={`text-xs font-semibold ${Number(current?.change24h || 0) >= 0 ? 'text-positive' : 'text-negative'}`}>
            {Number(current?.change24h || 0).toFixed(2)}%
          </span>
        </div>
      </section>

      <section className="table-card overflow-hidden rounded-2xl border border-app-border">
        <div className="table-head">
          <span>{t('tasks_market_symbol')}</span>
          <span>{t('tasks_market_price')}</span>
          <span>{t('tasks_market_change')}</span>
        </div>
        {quotes.length === 0 ? (
          <div className="table-row">{t('common_loading')}</div>
        ) : (
          quotes.map((item, idx) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => setSelected(item.symbol)}
              className={`table-row w-full text-start ${selected === item.symbol ? 'market-row-active' : ''}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white">{item.symbol}</span>
                <span className="text-[10px] text-app-muted">{[5, 10, 20, 50][idx % 4]}x</span>
              </span>
              <span>{Number(item.price).toLocaleString()}</span>
              <span className={item.change24h >= 0 ? 'text-positive' : 'text-negative'}>
                {item.change24h >= 0 ? '+' : ''}
                {Number(item.change24h).toFixed(2)}%
              </span>
            </button>
          ))
        )}
      </section>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <h2 className="text-sm font-semibold text-white">{t('tasks_code_title')}</h2>
        <p className="mt-1 text-xs text-app-muted">{t('tasks_code_hint')}</p>
        <div className="mt-3 flex gap-2">
          <input
            className="field-input"
            value={taskCode}
            onChange={(e) => setTaskCode(e.target.value)}
            placeholder={t('tasks_code_placeholder')}
          />
          <button
            type="button"
            className="wallet-action-btn wallet-action-deposit"
            onClick={handleRedeemCode}
            disabled={submitting}
          >
            {submitting ? '...' : t('tasks_code_apply')}
          </button>
        </div>
        {message ? (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${message.type === 'success' ? 'owner-message-success' : 'owner-message-error'}`}>
            {message.text}
          </div>
        ) : null}
      </section>
    </div>
  )
}
