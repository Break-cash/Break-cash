export type IdentityBadgeColor = 'none' | 'gold' | 'blue' | 'red' | 'green' | 'purple' | 'silver'

type UserIdentityBadgesProps = {
  badgeColor?: IdentityBadgeColor | null
  vipLevel?: number | null
  premiumBadge?: string | null
  className?: string
  mode?: 'all' | 'verified' | 'secondary'
}

export function resolveIdentityBadgeColor(
  badgeColor?: string | null,
  blueBadge?: number | null,
  verificationStatus?: string | null,
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
  if (String(verificationStatus || '').trim().toLowerCase() === 'verified') return 'gold'
  return 'none'
}

export function UserIdentityBadges({
  vipLevel = 0,
  premiumBadge,
  className = '',
  mode = 'all',
}: UserIdentityBadgesProps) {
  const showVip = Number(vipLevel || 0) > 0
  const showSecondary = mode !== 'verified' && showVip
  const showPremiumBadge = mode !== 'secondary' && String(premiumBadge || '').trim().length > 0

  if (!showSecondary && !showPremiumBadge) return null

  return (
    <span className={`identity-badges-row inline-flex items-center gap-1 ${className}`.trim()}>
      {showSecondary ? (
        <span className="identity-vip-badge">VIP {Math.max(1, Math.min(5, Number(vipLevel || 1)))}</span>
      ) : null}
      {showPremiumBadge ? <span className="identity-premium-badge">{premiumBadge}</span> : null}
    </span>
  )
}
