import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../../i18nCore'

function formatAmount(n: number, currency = 'USDT'): string {
  return `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} ${currency}`
}

type TotalAssetsCardProps = {
  totalAssets: number
  currency?: string
  titleKey?: string
  /** If provided, card is clickable and navigates to wallet; shows hover + chevron */
  onClick?: () => void
  className?: string
}

export function TotalAssetsCard({
  totalAssets,
  currency = 'USDT',
  titleKey = 'wallet_overview_total_assets',
  onClick,
  className = '',
}: TotalAssetsCardProps) {
  const { t, direction } = useI18n()
  const isRtl = direction === 'rtl'
  const Chevron = isRtl ? ChevronLeft : ChevronRight

  const content = (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(0,230,118,0.08)_0%,transparent_60%)]" />
      <p className="relative mb-2 text-sm font-medium uppercase tracking-wider text-white/50">
        {t(titleKey)}
      </p>
      <p className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {formatAmount(totalAssets, currency)}
      </p>
      {onClick ? (
        <span className="relative mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/40">
          <span>{t('wallet_overview_link')}</span>
          <Chevron size={14} strokeWidth={2} />
        </span>
      ) : null}
    </>
  )

  const cardClassName =
    'relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 shadow-xl ' +
    (onClick
      ? 'cursor-pointer transition-all duration-200 hover:border-white/20 hover:shadow-2xl hover:shadow-emerald-500/5 active:scale-[0.99] '
      : '') +
    className

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cardClassName}
        aria-label={t(titleKey)}
      >
        {content}
      </button>
    )
  }

  return <div className={cardClassName}>{content}</div>
}
