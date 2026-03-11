import { appData } from '../data'

export function Market() {
  const { market_data } = appData

  return (
    <div className="page">
      <h1 className="page-title">الأسعار السوقية</h1>

      <div className="table-card">
        <div className="table-head">
          <span>الزوج</span>
          <span>آخر سعر</span>
          <span>التغير</span>
        </div>
        {market_data.map((item) => (
          <div key={item.pair} className="table-row">
            <div className="pair">
              <div className="icon-circle">{item.pair[0]}</div>
              <div className="pair-meta">
                <div className="pair-name">{item.pair}</div>
                <div className="pair-sub">سوق فوري</div>
              </div>
            </div>
            <div className="price">{item.last_price.toLocaleString()}</div>
            <div
              className={
                item.change_percentage >= 0 ? 'change positive' : 'change negative'
              }
            >
              {item.change_percentage.toFixed(2)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

