import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useI18n } from '../../i18nCore'

const ASSET_VISIBILITY_STORAGE_KEY = 'breakcash_assets_hidden'

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
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsHidden(window.localStorage.getItem(ASSET_VISIBILITY_STORAGE_KEY) === '1')
  }, [])

  function toggleHidden(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    const next = !isHidden
    setIsHidden(next)
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(ASSET_VISIBILITY_STORAGE_KEY, '1')
      else window.localStorage.removeItem(ASSET_VISIBILITY_STORAGE_KEY)
    }
  }

  const content = (
    <>
      <div
        className={
          isHero
            ? 'absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_35%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_30%)]'
            : 'absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.1),transparent_32%)]'
        }
      />
      <div className="relative mb-2 flex items-center justify-between gap-3 sm:mb-3">
        <p
          className={
            isHero
              ? 'text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)] sm:text-base'
              : 'text-sm font-medium uppercase tracking-wider text-[var(--text-secondary)]'
          }
        >
          {t(titleKey)}
        </p>
        <button
          type="button"
          onClick={toggleHidden}
          className="icon-interactive flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--text-secondary)] hover:border-brand-blue/35 hover:text-brand-blue"
          aria-label={isHidden ? t('owner_action_show') : t('owner_action_hide')}
        >
          {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>
      <p
        className={
          isHero
            ? 'relative text-4xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl md:text-6xl'
            : 'relative text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl'
        }
      >
        {isLoading ? '...' : isHidden ? '••••••' : formatAmount(totalAssets, currency)}
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
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
          }
        }}
        className={cardClassName}
        aria-label={t(titleKey)}
      >
        {content}
      </div>
    )
  }

  return <div className={cardClassName}>{content}</div>
}
