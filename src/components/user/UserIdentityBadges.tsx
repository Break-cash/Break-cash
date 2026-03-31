import { Check } from 'lucide-react'

type UserIdentityBadgesProps = {
  badgeColor?: 'none' | 'gold' | 'blue' | 'red' | 'green' | 'purple' | 'silver' | null
  vipLevel?: number | null
  premiumBadge?: string | null
  className?: string
  mode?: 'all' | 'verified' | 'secondary'
  variant?: 'default' | 'profile-soft'
  verifiedLabel?: string | null
}

export function UserIdentityBadges({
  badgeColor,
  vipLevel = 0,
  premiumBadge,
  className = '',
  mode = 'all',
  variant = 'default',
  verifiedLabel = null,
}: UserIdentityBadgesProps) {
  const resolvedBadgeColor =
    badgeColor === 'blue' ||
    badgeColor === 'gold' ||
    badgeColor === 'red' ||
    badgeColor === 'green' ||
    badgeColor === 'purple' ||
    badgeColor === 'silver'
      ? badgeColor
      : 'none'
  const showVip = Number(vipLevel || 0) > 0
  const showVerified = mode !== 'secondary' && resolvedBadgeColor !== 'none'
  const showSecondary = mode !== 'verified' && showVip
  const showPremiumBadge = mode !== 'secondary' && String(premiumBadge || '').trim().length > 0

  if (!showVerified && !showSecondary && !showPremiumBadge) return null

  return (
    <span className={`identity-badges-row inline-flex items-center gap-1 ${className}`.trim()}>
      {showVerified ? (
        variant === 'profile-soft' ? (
          <span
            className={`identity-badge-soft identity-badge-soft-${resolvedBadgeColor}`}
            title={`${resolvedBadgeColor} verified`}
          >
            <span className="identity-badge-soft-icon">
              <span className="identity-badge-soft-icon-ring">
                <Check size={10} strokeWidth={3} />
              </span>
            </span>
            <span>{verifiedLabel || 'Verified'}</span>
          </span>
        ) : (
          <span
            className={`identity-badge identity-badge-${resolvedBadgeColor}`}
            title={`${resolvedBadgeColor} verified`}
          >
            <Check size={11} strokeWidth={3} />
          </span>
        )
      ) : null}
      {showSecondary ? (
        <span className="identity-vip-badge">VIP {Math.max(1, Math.min(5, Number(vipLevel || 1)))}</span>
      ) : null}
      {showPremiumBadge ? <span className="identity-premium-badge">{premiumBadge}</span> : null}
    </span>
  )
}
