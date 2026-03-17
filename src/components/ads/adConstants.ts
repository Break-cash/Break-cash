/** Shared ad validation and limits - keep in sync with server */
export const AD_PLACEMENTS = ['all', 'home', 'profile', 'mining', 'deposit'] as const
export type AdPlacement = (typeof AD_PLACEMENTS)[number]

export const AD_TITLE_MAX = 120
export const AD_DESCRIPTION_MAX = 400
export const AD_LINK_URL_MAX = 500

export function isValidPlacement(value: string): value is AdPlacement {
  return AD_PLACEMENTS.includes(value as AdPlacement)
}

export function isValidLinkUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('/')) return true
  try {
    new URL(trimmed)
    return true
  } catch {
    return false
  }
}

export function validateAdForm(data: {
  mediaUrl: string
  type: 'image' | 'video'
  title: string
  description: string
  linkUrl: string
  placement: string
}): string | null {
  const media = (data.mediaUrl || '').trim()
  if (!media) return 'ad_validation_media_required'
  if (data.type !== 'image' && data.type !== 'video') return 'ad_validation_invalid_type'
  if (!isValidPlacement(data.placement)) return 'ad_validation_invalid_placement'
  const link = (data.linkUrl || '').trim()
  if (link && !isValidLinkUrl(link)) return 'ad_validation_invalid_link'
  if ((data.title || '').length > AD_TITLE_MAX) return 'ad_validation_title_too_long'
  if ((data.description || '').length > AD_DESCRIPTION_MAX) return 'ad_validation_description_too_long'
  return null
}
