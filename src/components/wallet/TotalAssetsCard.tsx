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
  /** 'hero' = larger, near full-width hero on homepage; default = compact */
  variant?: 'default' | 'hero'
  isLoading?: boolean
}

export function TotalAssetsCard({
  totalAssets,
  currency = 'USDT',
  titleKey = 'wallet_overview_total_assets',
  onClick,
  className = '',
  variant = 'default',
  isLoading = false,
}: TotalAssetsCardProps) {
  const { t, direction } = useI18n()
  const isRtl = direction === 'rtl'
  const Chevron = isRtl ? ChevronLeft : ChevronRight
  const isHero = variant === 'hero'

  const content = (
    <>
      <div
        className={
          isHero
            ? 'absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_30%)]'
            : 'absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_32%)]'
        }
      />
      <p
        className={
          isHero
            ? 'relative mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)] sm:mb-5 sm:text-base'
            : 'relative mb-2 text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]'
        }
      >
        {t(titleKey)}
      </p>
      <p
        className={
          isHero
            ? 'relative text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl md:text-6xl'
            : 'relative text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl'
        }
      >
        {isLoading ? '...' : formatAmount(totalAssets, currency)}
      </p>
      {onClick ? (
        <span
          className={
            isHero
              ? 'relative mt-4 inline-flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] sm:mt-5 sm:text-sm'
              : 'relative mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)]'
          }
        >
          <span>{t('wallet_overview_link')}</span>
          <Chevron size={isHero ? 16 : 14} strokeWidth={2} />
        </span>
      ) : null}
    </>
  )

  const cardClassName =
    'wallet-hero-card relative w-full min-w-0 overflow-hidden rounded-2xl shadow-xl ' +
    (isHero
      ? 'p-8 shadow-[0_8px_32px_rgba(0,0,0,0.24)] sm:p-10 md:rounded-3xl ' +
        'min-h-[140px] sm:min-h-[160px] '
      : 'p-6 ') +
    (onClick
      ? 'cursor-pointer transition-all duration-200 hover:border-[var(--border-glass)] hover:shadow-[var(--shadow-card),var(--glow-blue)] active:scale-[0.99] '
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
