import { Check } from 'lucide-react'

export type IdentityBadgeColor = 'none' | 'gold' | 'blue' | 'red' | 'green' | 'purple' | 'silver'

type UserIdentityBadgesProps = {
  badgeColor?: IdentityBadgeColor | null
  vipLevel?: number | null
  premiumBadge?: string | null
  className?: string
  mode?: 'all' | 'verified' | 'secondary'
  variant?: 'default' | 'profile-soft'
  verifiedLabel?: string | null
}

export function resolveIdentityBadgeColor(
  badgeColor?: string | null,
  blueBadge?: number | null,
): IdentityBadgeColor {
  if (
    badgeColor === 'blue' ||
    badgeColor === 'gold' ||
    badgeColor === 'red' ||
    badgeColor === 'green' ||
    badgeColor === 'purple' ||
    badgeColor === 'silver' ||
    badgeColor === 'none'
  ) {
    return badgeColor
  }
  if (Number(blueBadge || 0) === 1) return 'blue'
  return 'none'
}

export function UserIdentityBadges({
  badgeColor,
  vipLevel = 0,
  premiumBadge,
  className = '',
  mode = 'all',
  variant = 'profile-soft',
  verifiedLabel = null,
}: UserIdentityBadgesProps) {
  const resolvedBadgeColor = resolveIdentityBadgeColor(badgeColor)
  const showBadge = mode !== 'secondary' && resolvedBadgeColor !== 'none'
  const showVip = Number(vipLevel || 0) > 0
  const showSecondary = mode !== 'verified' && showVip
  const showPremiumBadge = mode !== 'secondary' && String(premiumBadge || '').trim().length > 0

  if (!showBadge && !showSecondary && !showPremiumBadge) return null

  return (
    <span className={`identity-badges-row inline-flex items-center gap-1 ${className}`.trim()}>
      {showBadge ? (
        variant === 'profile-soft' ? (
          <span
            className={`identity-badge-soft identity-badge-soft-${resolvedBadgeColor}`}
            title={`${resolvedBadgeColor} verification badge`}
          >
            <span className="identity-badge-soft-icon">
              <span className="identity-badge-soft-icon-ring">
                <Check size={10} strokeWidth={3} />
              </span>
            </span>
            <span>{verifiedLabel || 'موثق'}</span>
          </span>
        ) : (
          <span
            className={`identity-badge identity-badge-${resolvedBadgeColor}`}
            title={`${resolvedBadgeColor} verification badge`}
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
