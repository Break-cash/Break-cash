import { type ReactNode } from 'react'
import { useI18n } from '../../i18nCore'
import { type WalletSummary } from '../../walletSummary'
import { TotalAssetsCard } from './TotalAssetsCard'
import { useAssetVisibility } from '../../hooks/useAssetVisibility'

type WalletSummaryPanelProps = {
  summary: WalletSummary
  currency?: string
  isLoading?: boolean
  cardVariant?: 'default' | 'hero'
  onCardClick?: () => void
  className?: string
  actionsSlot?: ReactNode
}

function formatAmount(value: number, currency = 'USDT'): string {
  return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} ${currency}`
}

export function WalletSummaryPanel({
  summary,
  currency = 'USDT',
  isLoading = false,
  cardVariant = 'default',
  onCardClick,
  className = '',
  actionsSlot,
}: WalletSummaryPanelProps) {
  const { t } = useI18n()
  const { isHidden } = useAssetVisibility()

  function formatVisibleAmount(value: number) {
    if (isLoading) return '...'
    if (isHidden) return '••••••'
    return formatAmount(value, currency)
  }

  return (
    <section className={`space-y-3 ${className}`}>
      <TotalAssetsCard
        totalAssets={summary.totalAssets}
        currency={currency}
        titleKey="wallet_overview_total_assets"
        onClick={onCardClick}
        variant={cardVariant}
        isLoading={isLoading}
      />
      {actionsSlot}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="wallet-stat-card">
          <p className="wallet-stat-label">{t('wallet_overview_main_balance')}</p>
          <p className="wallet-stat-value">{formatVisibleAmount(summary.mainBalance)}</p>
        </article>
        <article className="wallet-stat-card wallet-stat-card-amber">
          <p className="wallet-stat-label text-amber-300/90">{t('wallet_overview_locked')}</p>
          <p className="wallet-stat-value text-amber-300">{formatVisibleAmount(summary.lockedBalance)}</p>
        </article>
        <article className="wallet-stat-card wallet-stat-card-emerald">
          <p className="wallet-stat-label text-emerald-300/90">{t('wallet_overview_withdrawable')}</p>
          <p className="wallet-stat-value text-emerald-300">{formatVisibleAmount(summary.withdrawableBalance)}</p>
        </article>
      </div>
    </section>
  )
}
