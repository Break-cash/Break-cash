import { appData } from '../data'
import { useDailyEarningsSummary } from '../hooks/useDailyEarningsSummary'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'

export function Assets() {
  const { t } = useI18n()
  const { summary } = useWalletSummary()
  const { summary: dailyEarningsSummary } = useDailyEarningsSummary()
  const { balance_info } = appData
  const currency = balance_info.currency || 'USDT'

  return (
    <div className="page space-y-4">
      <h1 className="page-title">{t('wallet_assets')}</h1>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="elite-enter elite-hover-lift elite-panel balance-card p-4 lg:p-5">
          <div className="card-header mb-2">
            <span className="card-title text-sm text-white/75">{t('wallet_overview_total_assets')}</span>
            <span className="card-pill elite-chip border-white/15 bg-white/6 text-white/90">{currency}</span>
          </div>
          <div className="card-main-value text-3xl lg:text-4xl">
            {summary.totalAssets.toFixed(2)}
          </div>
          <div className="card-footer">
            <div>
              <div className="label text-[11px] uppercase tracking-[0.08em]">{t('home_today_earnings')}</div>
              <div className="value positive">
                {dailyEarningsSummary.totalAmount.toFixed(2)} {currency}
              </div>
              <div className="label text-[11px]">
                {dailyEarningsSummary.withdrawableAmount.toFixed(2)} قابل للسحب • {dailyEarningsSummary.lockedAmount.toFixed(2)} غير قابل للسحب
              </div>
            </div>
            <div>
              <div className="label text-[11px] uppercase tracking-[0.08em]">{t('wallet_overview_main_balance')}</div>
              <div className="value">
                {summary.mainBalance.toFixed(2)} {currency}
              </div>
            </div>
          </div>
        </div>
        <div className="elite-enter elite-hover-lift elite-panel p-4 lg:p-5">
          <div className="text-xs uppercase tracking-[0.12em] text-app-muted">Break cash</div>
          <div className="mt-2 text-sm font-semibold text-white/95">{t('wallet_overview_total_assets')}</div>
          <div className="mt-3 space-y-2">
            <div className="elite-subpanel flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-app-muted">{t('wallet_overview_total_assets')}</span>
              <span className="font-semibold text-white">{summary.totalAssets.toFixed(2)} {currency}</span>
            </div>
            <div className="elite-subpanel flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-app-muted">{t('wallet_overview_locked')}</span>
              <span className="font-semibold text-amber-300">{summary.lockedBalance.toFixed(2)} {currency}</span>
            </div>
            <div className="elite-subpanel flex items-center justify-between px-3 py-2 text-sm">
              <span className="text-app-muted">{t('wallet_overview_withdrawable')}</span>
              <span className="font-semibold text-positive">{summary.withdrawableBalance.toFixed(2)} {currency}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
