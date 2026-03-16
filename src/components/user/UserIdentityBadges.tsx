import { Check } from 'lucide-react'

type UserIdentityBadgesProps = {
  badgeColor?: 'none' | 'gold' | 'blue' | null
  vipLevel?: number | null
  premiumBadge?: string | null
  className?: string
  mode?: 'all' | 'verified' | 'secondary'
}

export function UserIdentityBadges({
  badgeColor,
  vipLevel = 0,
  premiumBadge,
  className = '',
  mode = 'all',
}: UserIdentityBadgesProps) {
  const showGold = badgeColor === 'gold'
  const showBlue = badgeColor === 'blue'
  const showVip = Number(vipLevel || 0) > 0
  const showVerified = mode !== 'secondary' && (showGold || showBlue)
  const showSecondary = mode !== 'verified' && showVip
  const showPremiumBadge = mode !== 'secondary' && String(premiumBadge || '').trim().length > 0

  if (!showVerified && !showSecondary && !showPremiumBadge) return null

  return (
    <span className={`inline-flex items-center gap-1 ${className}`.trim()}>
      {showVerified ? (
        <span
          className={`identity-badge ${showBlue ? 'identity-badge-blue' : 'identity-badge-gold'}`}
          title={showBlue ? 'Blue verified' : 'Gold verified'}
        >
          <Check size={11} strokeWidth={3} />
        </span>
      ) : null}
      {showSecondary ? (
        <span className="identity-vip-badge">VIP {Math.max(1, Math.min(5, Number(vipLevel || 1)))}</span>
      ) : null}
      {showPremiumBadge ? <span className="identity-premium-badge">{premiumBadge}</span> : null}
    </span>
  )
}
