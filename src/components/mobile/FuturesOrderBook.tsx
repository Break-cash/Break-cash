import type { OrderBookLevel } from '../../ui/mobileMock'
import { useI18n } from '../../i18nCore'

type FuturesOrderBookProps = {
  asks: OrderBookLevel[]
  bids: OrderBookLevel[]
}

export function FuturesOrderBook({ asks, bids }: FuturesOrderBookProps) {
  const { t } = useI18n()
  return (
    <section className="ku-orderbook">
      <div className="ku-orderbook-title">{t('futures_order_book')}</div>
      <div className="ku-orderbook-list">
        {asks.map((row) => (
          <div key={`ask-${row.price}`} className="ku-orderbook-row ask">
            <span>{row.price.toLocaleString()}</span>
            <span>{row.quantity.toFixed(4)}</span>
          </div>
        ))}
        <div className="ku-mid-price">{bids[0]?.price.toLocaleString() || '--'}</div>
        {bids.map((row) => (
          <div key={`bid-${row.price}`} className="ku-orderbook-row bid">
            <span>{row.price.toLocaleString()}</span>
            <span>{row.quantity.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
