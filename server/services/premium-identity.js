export const PROFILE_COLOR_VALUES = [
  'Royal Gold',
  'Emerald Prestige',
  'Sapphire Elite',
  'Crimson Reserve',
  'Black Sovereign',
]

export const PROFILE_BADGE_VALUES = [
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

const PROFILE_COLOR_SET = new Set(PROFILE_COLOR_VALUES)
const PROFILE_BADGE_SET = new Set(PROFILE_BADGE_VALUES)

export function isAllowedProfileColor(value) {
  return PROFILE_COLOR_SET.has(String(value || ''))
}

export function isAllowedProfileBadge(value) {
  return PROFILE_BADGE_SET.has(String(value || ''))
}

export function normalizeNullableEnum(value) {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw) return null
  const lowered = raw.toLowerCase()
  if (lowered === 'null' || lowered === 'none') return null
  return raw
}
