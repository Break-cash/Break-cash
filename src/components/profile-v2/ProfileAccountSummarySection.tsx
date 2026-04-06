import type { WalletSummary } from '../../walletSummary'
import { useAssetVisibility } from '../../hooks/useAssetVisibility'
import { useI18n } from '../../i18nCore'

type ProfileAccountSummarySectionProps = {
  summary: WalletSummary
  currency: string
}

export function ProfileAccountSummarySection({
  summary,
  currency,
}: ProfileAccountSummarySectionProps) {
  const { t } = useI18n()
  const { isHidden } = useAssetVisibility()

  function formatVisible(value: number) {
    if (isHidden) return `•••••• ${currency}`
    return `${value.toFixed(2)} ${currency}`
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{t('wallet_overview_title')}</div>
      <div className="grid gap-2">
        <div className="elite-subpanel flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-sm">
          <span className="text-app-muted">{t('wallet_overview_main_balance')}</span>
          <span className="font-semibold text-white">{formatVisible(summary.mainBalance)}</span>
        </div>
        <div className="elite-subpanel flex items-center justify-between rounded-xl border border-white/10 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="text-amber-100/80">الرصيد المقفل</span>
          <span className="font-semibold text-amber-200">{formatVisible(summary.lockedBalance)}</span>
        </div>
        <div className="elite-subpanel flex items-center justify-between rounded-xl border border-white/10 bg-emerald-500/10 px-3 py-2 text-sm">
          <span className="text-emerald-100/80">المتاح للسحب</span>
          <span className="font-semibold text-emerald-200">{formatVisible(summary.withdrawableBalance)}</span>
        </div>
      </div>
    </section>
  )
}
