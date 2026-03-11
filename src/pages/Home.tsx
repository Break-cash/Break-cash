import { appData } from '../data'

export function Home() {
  const { balance_info, market_data } = appData

  return (
    <div className="page home-page">
      <section className="cards-row">
        <div className="card balance-card">
          <div className="card-header">
            <span className="card-title">إجمالي الأصول</span>
            <span className="card-pill">{balance_info.currency}</span>
          </div>
          <div className="card-main-value">
            {balance_info.total_assets_usdt.toFixed(2)}
          </div>
          <div className="card-footer">
            <div>
              <div className="label">أرباح اليوم</div>
              <div className="value positive">
                {balance_info.today_earnings.toFixed(2)} {balance_info.currency}
              </div>
            </div>
            <div>
              <div className="label">أرباح الفريق</div>
              <div className="value">
                {balance_info.team_earnings.toFixed(2)} {balance_info.currency}
              </div>
            </div>
          </div>
        </div>

        <div className="card small-card">
          <div className="label">حساب التمويل</div>
          <div className="card-main-value sm">
            {balance_info.funding_account.toFixed(2)} {balance_info.currency}
          </div>
          <div className="hint">يمكنك تحويل الأصول من و إلى هذا الحساب</div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <h2>الأكثر تداولاً</h2>
        </div>

        <div className="table-card">
          <div className="table-head">
            <span>الزوج</span>
            <span>آخر سعر</span>
            <span>التغير (24h)</span>
          </div>
          {market_data.map((item) => (
            <div key={item.pair} className="table-row">
              <div className="pair">
                <div className="icon-circle">{item.pair[0]}</div>
                <div className="pair-meta">
                  <div className="pair-name">{item.pair}</div>
                  <div className="pair-sub">فوري</div>
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
      </section>
    </div>
  )
}

