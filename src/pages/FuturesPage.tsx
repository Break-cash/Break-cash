import { useState } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FuturesOrderBook } from '../components/mobile/FuturesOrderBook'
import { useI18n } from '../i18nCore'
import { futuresTradingMock } from '../ui/mobileMock'

type Quote = { symbol: string; price: number; change24h: number; volume: number }

export function FuturesPage() {
  const { t } = useI18n()
  const [quotes] = useState<Quote[]>([
    {
      symbol: futuresTradingMock.pair,
      price: futuresTradingMock.current_price,
      change24h: futuresTradingMock.price_change_percent,
      volume: 0,
    },
  ])
  const selected = futuresTradingMock.pair
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState(futuresTradingMock.trading_form.selected_type)
  const [leverage, setLeverage] = useState(futuresTradingMock.selected_leverage)
  const [qty, setQty] = useState(0.1)
  const [timeframe, setTimeframe] = useState('15m')
  const [reduceOnly, setReduceOnly] = useState(false)
  const [marginMode, setMarginMode] = useState<'Cross' | 'Isolated'>(futuresTradingMock.margin_mode)

  const current = quotes.find((item) => item.symbol === selected)
  const isDown = (current?.change24h || 0) < 0
  const chartData = Array.from({ length: 20 }).map((_, index) => {
    const base = current?.price || 100
    const drift = Math.sin(index / 3) * base * 0.012
    const noise = (index % 4) * base * 0.001
    return {
      name: `${index + 1}`,
      price: Number((base + drift + noise).toFixed(2)),
      volume: Number((base * 120 + drift * 50).toFixed(2)),
    }
  })

  return (
    <div className="page futures-page ku-mobile-page">
      <div className="ku-top-tabs">
        <button className="ku-top-tab active">Futures</button>
        <button className="ku-top-tab">Copy Trading</button>
        <button className="ku-top-tab">Bot</button>
        <button className="ku-top-tab">Options</button>
      </div>

      <h1 className="page-title">{t('futures_title')}</h1>
      <div className="card futures-hero-card">
        <div className="card-header">
          <span className="card-title">
            {selected} {futuresTradingMock.contract_type}
          </span>
          <span className={`card-pill ${isDown ? 'change negative' : 'change positive'}`}>
            {current?.change24h.toFixed(2)}%
          </span>
        </div>
        <div className="wallet-chip-row futures-timeframes">
          {['Line', '1m', '5m', '15m', '30m', '60m', '2h', '4h', '8h', '1d'].map((value) => (
            <button
              key={value}
              className={timeframe === value ? 'wallet-chip' : 'ku-timeframe-btn'}
              type="button"
              onClick={() => setTimeframe(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="futures-chart">
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip />
              <Area type="monotone" dataKey="price" stroke="#00e676" fill="#00e67622" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="table-row futures-price-strip">
          <span>{t('futures_price')}</span>
          <span>{current?.price.toLocaleString() || '--'}</span>
          <span>USDC</span>
        </div>
        <div className="text-muted">
          Timeframe: {timeframe} | Funding: 0.010% | Next funding: 02:15:11
        </div>
      </div>

      <div className="cards-row futures-grid">
        <FuturesOrderBook
          asks={futuresTradingMock.order_book.asks}
          bids={futuresTradingMock.order_book.bids}
        />

        <div className="card futures-orderform-card">
          <div className="section-header">
            <h2>{t('futures_order_form')}</h2>
          </div>
          <div className="login-form">
            <select
              className="field-input"
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
            >
              {futuresTradingMock.trading_form.order_types.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={leverage}
              onChange={(e) => setLeverage(e.target.value)}
            >
              {futuresTradingMock.leverage_options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <select
              className="field-input"
              value={marginMode}
              onChange={(e) => setMarginMode(e.target.value as 'Cross' | 'Isolated')}
            >
              <option value="Cross">Cross Margin</option>
              <option value="Isolated">Isolated Margin</option>
            </select>
            <input
              className="field-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0.01}
              value={qty}
              onChange={(e) => setQty(Math.max(0.01, Number(e.target.value) || 0.01))}
            />
            <div className="futures-qty-presets">
              {[0.25, 0.5, 0.75, 1].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  className="wallet-chip"
                  onClick={() => setQty(Number((5 * ratio).toFixed(2)))}
                >
                  {Math.round(ratio * 100)}%
                </button>
              ))}
            </div>
            <input
              className="futures-slider"
              type="range"
              min={0.01}
              max={5}
              step={0.01}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
            />
            <label className="futures-check-row">
              <input
                type="checkbox"
                checked={reduceOnly}
                onChange={(e) => setReduceOnly(e.target.checked)}
              />
              <span>{t('futures_reduce_only')}</span>
            </label>
            <div className="wallet-actions">
              <button
                className="wallet-action-btn wallet-action-deposit"
                type="button"
                onClick={() => setSide('buy')}
              >
                {t('futures_buy')}
              </button>
              <button
                className="wallet-action-btn wallet-action-withdraw"
                type="button"
                onClick={() => setSide('sell')}
              >
                {t('futures_sell')}
              </button>
            </div>
            <div className="text-muted">
              Mode: {marginMode} | Side: {side} | Lev: {leverage} | Qty: {qty} | Reduce
              Only: {reduceOnly ? 'On' : 'Off'}
            </div>
            <div className="text-muted">
              {t('futures_avail')}: {futuresTradingMock.trading_form.available_balance.toFixed(2)}{' '}
              {futuresTradingMock.trading_form.currency}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
