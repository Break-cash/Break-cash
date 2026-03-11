import { appData } from '../data'

export function Assets() {
  const { balance_info } = appData

  return (
    <div className="page">
      <h1 className="page-title">الأصول</h1>

      <div className="cards-row">
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
              <div className="label">حساب التمويل</div>
              <div className="value">
                {balance_info.funding_account.toFixed(2)} {balance_info.currency}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

