import { appData } from '../data'

export function Assets() {
  const { balance_info } = appData

  return (
    <div className="page space-y-4">
      <h1 className="page-title">الأصول</h1>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="elite-enter elite-hover-lift elite-panel balance-card p-4 lg:p-5">
          <div className="card-header mb-2">
            <span className="card-title text-sm text-white/75">إجمالي الأصول</span>
            <span className="card-pill elite-chip border-white/15 bg-white/6 text-white/90">{balance_info.currency}</span>
          </div>
          <div className="card-main-value text-3xl lg:text-4xl">
            {balance_info.total_assets_usdt.toFixed(2)}
          </div>
          <div className="card-footer">
            <div>
              <div className="label text-[11px] uppercase tracking-[0.08em]">أرباح اليوم</div>
              <div className="value positive">
                {balance_info.today_earnings.toFixed(2)} {balance_info.currency}
              </div>
            </div>
            <div>
              <div className="label text-[11px] uppercase tracking-[0.08em]">حساب التمويل</div>
              <div className="value">
                {balance_info.funding_account.toFixed(2)} {balance_info.currency}
              </div>
            </div>
          </div>
        </div>
        <div className="elite-enter elite-hover-lift elite-panel p-4 lg:p-5">
          <div className="text-xs uppercase tracking-[0.12em] text-app-muted">Break cash</div>
          <div className="mt-2 text-sm font-semibold text-white/95">إجمالي الأصول</div>
          <div className="mt-3 space-y-2">
            <div className="elite-subpanel flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-app-muted">الأصول</span>
              <span className="font-semibold text-white">{balance_info.currency}</span>
            </div>
            <div className="elite-subpanel flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-app-muted">أرباح اليوم</span>
              <span className="font-semibold text-positive">
                {balance_info.today_earnings.toFixed(2)}
              </span>
            </div>
            <div className="elite-subpanel flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-app-muted">حساب التمويل</span>
              <span className="font-semibold text-white/90">
                {balance_info.funding_account.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

