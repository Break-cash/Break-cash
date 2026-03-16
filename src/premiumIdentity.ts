export type PremiumProfileColor =
  | 'Royal Gold'
  | 'Emerald Prestige'
  | 'Sapphire Elite'
  | 'Crimson Reserve'
  | 'Black Sovereign'

export type PremiumProfileBadge =
  | 'BREAK CASH Royal'
  | 'Diamond Member'
  | 'Black Elite'
  | 'Strategic Partner'
  | 'VIP Prestige'
  | 'Founding Member'
  | 'Prime Investor'
  | 'Elite Referrer'
  | 'Verified Leader'
  | 'Inner Circle'

export const PREMIUM_PROFILE_COLORS: PremiumProfileColor[] = [
  'Royal Gold',
  'Emerald Prestige',
  'Sapphire Elite',
  'Crimson Reserve',
  'Black Sovereign',
]

export const PREMIUM_PROFILE_BADGES: PremiumProfileBadge[] = [
  'BREAK CASH Royal',
  'Diamond Member',
  'Black Elite',
  'Strategic Partner',
  'VIP Prestige',
  'Founding Member',
  'Prime Investor',
  'Elite Referrer',
  'Verified Leader',
  'Inner Circle',
]

export function getPremiumProfileColorClass(profileColor?: string | null) {
  if (profileColor === 'Royal Gold') return 'premium-profile-royal-gold'
  if (profileColor === 'Emerald Prestige') return 'premium-profile-emerald-prestige'
  if (profileColor === 'Sapphire Elite') return 'premium-profile-sapphire-elite'
  if (profileColor === 'Crimson Reserve') return 'premium-profile-crimson-reserve'
  if (profileColor === 'Black Sovereign') return 'premium-profile-black-sovereign'
  return ''
}
