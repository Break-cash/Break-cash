import * as Sentry from '@sentry/react'
import { emitApiErrorToast } from './toastBus'
import type { PremiumProfileBadge, PremiumProfileColor } from './premiumIdentity'

export type AuthUser = {
  id: number
  role: 'user' | 'moderator' | 'admin' | 'owner'
  email: string | null
  phone: string | null
  display_name?: string | null
  bio?: string | null
  avatar_path?: string | null
  avatar_url?: string | null
  verification_status?: 'unverified' | 'pending' | 'verified'
  is_frozen?: number
  blue_badge?: number
  badge_color?: 'none' | 'gold' | 'blue'
  vip_level?: number
  profile_color?: PremiumProfileColor | null
  profile_badge?: PremiumProfileBadge | null
  phone_verified?: number
  identity_submitted?: number
  verification_ready_at?: string | null
  is_approved?: number
  is_banned?: number
  total_deposit?: number
  points?: number
  referred_by?: number | null
  is_owner?: number
  preferred_language?: 'ar' | 'en' | 'tr' | string | null
  deposit_privacy_enabled?: number
  created_at?: string
}

function getPreferredLanguageForApi() {
  const raw = String(localStorage.getItem('breakcash_language') || '').trim().toLowerCase()
  if (raw === 'ar' || raw === 'en' || raw === 'tr') return raw
  const browserLang = String(navigator.language || '').toLowerCase()
  if (browserLang.startsWith('ar')) return 'ar'
  if (browserLang.startsWith('tr')) return 'tr'
  return 'en'
}

function resolveErrorCodeFromBody(body: unknown) {
  if (typeof body === 'object' && body && 'error' in body) {
    return String((body as { error?: unknown }).error || 'REQUEST_FAILED')
  }
  return 'REQUEST_FAILED'
}

function resolveErrorMessage(code: string, body: unknown) {
  const serverMsg = typeof body === 'object' && body && 'message' in body ? String((body as { message?: unknown }).message || '') : ''
  return serverMsg || code
}

function createApiError(code: string, body: unknown) {
  const message = resolveErrorMessage(code, body)
  emitApiErrorToast(code, message)
  return new Error(message)
}

export function getToken() {
  return localStorage.getItem('breakcash_token')
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem('breakcash_token')
  else localStorage.setItem('breakcash_token', token)
}

export type LiveUpdateEvent = {
  type: string
  scope?: 'global' | 'user'
  userId?: number
  source?: string
  key?: string
  title?: string
  body?: string
  vibrate?: boolean
  ts?: number
}

export type PushSubscriptionStatus = {
  subscribed: boolean
}

export function subscribeToLiveUpdates(onEvent: (event: LiveUpdateEvent) => void) {
  const token = getToken()
  if (!token || typeof window === 'undefined') return () => {}
  const streamUrl = `/api/live/stream?token=${encodeURIComponent(token)}`
  const es = new EventSource(streamUrl)
  es.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data || '{}')) as LiveUpdateEvent
      if (payload && payload.type) onEvent(payload)
    } catch {
      // ignore malformed events
    }
  }
  es.onerror = () => {
    // EventSource retries automatically.
  }
  return () => {
    es.close()
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    res = await fetch(path, { ...init, headers })
  } catch (error) {
    Sentry.captureException(error)
    emitApiErrorToast('NETWORK_ERROR', 'Network request failed.')
    throw error
  }
  const contentType = res.headers.get('content-type') || ''
  let body: unknown
  try {
    const text = await res.text()
    body = contentType.includes('application/json') ? JSON.parse(text) : text
  } catch (parseErr) {
    console.error('[apiFetch] JSON parse failed:', path, parseErr)
    Sentry.captureMessage(`apiFetch parse error at ${path}: ${res.status}`)
    body = { error: 'REQUEST_FAILED' }
  }

  if (!res.ok) {
    const code = resolveErrorCodeFromBody(body)
    const msg = resolveErrorMessage(code, body)
    if (res.status >= 500) {
      Sentry.captureMessage(`API ${res.status} at ${path}: ${msg}`)
    }
    throw createApiError(code, body)
  }

  return body
}

export async function login(identifier: string, password: string) {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, preferredLanguage: getPreferredLanguageForApi() }),
  }) as Promise<{ token: string; user: AuthUser }>
}

export async function registerAccount(identifier: string, password: string) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, preferredLanguage: getPreferredLanguageForApi() }),
  }) as Promise<{ token: string; user: AuthUser }>
}

export async function registerWithInvite(
  identifier: string,
  password: string,
  inviteCode: string,
) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, inviteCode, preferredLanguage: getPreferredLanguageForApi() }),
  }) as Promise<{ token: string; user: AuthUser }>
}

export async function sendForgotPasswordCode(identifier: string) {
  return apiFetch('/api/auth/forgot-password/send-code', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  }) as Promise<{ ok: boolean; mode: 'masked' | 'mock' | 'twilio' | 'smtp'; dev_code?: string }>
}

export async function resetForgotPassword(payload: {
  identifier: string
  code: string
  newPassword: string
}) {
  return apiFetch('/api/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export async function getCurrentUser() {
  return apiFetch('/api/auth/me') as Promise<{ user: AuthUser }>
}

export async function getPushPublicKey() {
  return apiFetch('/api/notifications/push/public-key') as Promise<{ publicKey: string }>
}

export async function getPushSubscriptionStatus() {
  return apiFetch('/api/notifications/push/status') as Promise<PushSubscriptionStatus>
}

export async function savePushSubscription(subscription: PushSubscriptionJSON) {
  return apiFetch('/api/notifications/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ subscription }),
  }) as Promise<{ ok: boolean }>
}

export async function removePushSubscription(endpoint?: string | null) {
  return apiFetch('/api/notifications/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint: endpoint || null }),
  }) as Promise<{ ok: boolean }>
}

export async function sendPushTest() {
  return apiFetch('/api/notifications/push/test', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; result: { sent: number; failed: number } }>
}

export async function getMyPermissions() {
  return apiFetch('/api/permissions/my') as Promise<{ role: string; permissions: string[] }>
}

export type RecoveryCodeStatus = {
  shouldShow: boolean
  recoveryCode: string | null
  acknowledged: boolean
}

export async function getRecoveryCodeStatus() {
  return apiFetch('/api/auth/me/recovery-code') as Promise<RecoveryCodeStatus>
}

export async function acknowledgeRecoveryCode() {
  return apiFetch('/api/auth/me/recovery-code/ack', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean }>
}

export async function submitRecoveryCodeReviewRequest(recoveryCode: string) {
  return apiFetch('/api/auth/recovery-code/request-review', {
    method: 'POST',
    body: JSON.stringify({ recoveryCode }),
  }) as Promise<{ ok: boolean; status: 'pending' }>
}

export async function getMyProfile() {
  return apiFetch('/api/profile') as Promise<{ profile: AuthUser }>
}

export async function updateMyProfile(payload: {
  email?: string | null
  phone?: string | null
  displayName?: string | null
  bio?: string | null
  preferredLanguage?: 'ar' | 'en' | 'tr'
  depositPrivacyEnabled?: boolean
}) {
  return apiFetch('/api/profile/update', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ profile: AuthUser }>
}

export async function sendPhoneVerificationCode(phone: string) {
  return apiFetch('/api/profile/send-phone-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }) as Promise<{ ok: boolean; mode: 'mock' | 'twilio'; dev_code?: string }>
}

export async function verifyPhoneCode(phone: string, code: string) {
  return apiFetch('/api/profile/verify-phone-code', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  }) as Promise<{ ok: boolean; delay_minutes?: number | null; profile: AuthUser }>
}

export async function uploadKyc(idDocument: File, selfie: File) {
  const token = getToken()
  const form = new FormData()
  form.append('idDocument', idDocument)
  form.append('selfie', selfie)

  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch('/api/profile/kyc-upload', {
    method: 'POST',
    headers,
    body: form,
  })
  const body = await res.json()
  if (!res.ok) {
    const code = resolveErrorCodeFromBody(body)
    throw createApiError(code, body)
  }
  return body as { ok: boolean; delay_minutes?: number | null; profile: AuthUser }
}

export async function uploadAvatar(file: File) {
  const token = getToken()
  const form = new FormData()
  form.append('avatar', file)

  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch('/api/profile/avatar', {
    method: 'POST',
    headers,
    body: form,
  })
  const body = await res.json()
  if (!res.ok) {
    const code = resolveErrorCodeFromBody(body)
    throw createApiError(code, body)
  }
  return body as { ok: boolean; profile: AuthUser }
}

export async function getWalletLink() {
  return apiFetch('/api/settings/wallet-link') as Promise<{ walletLink: string }>
}

export async function updateWalletLink(walletLink: string) {
  return apiFetch('/api/settings/wallet-link', {
    method: 'POST',
    body: JSON.stringify({ walletLink }),
  }) as Promise<{ ok: boolean; walletLink: string }>
}

export async function getLogoUrl() {
  return apiFetch('/api/settings/logo-url') as Promise<{ logoUrl: string }>
}

export async function updateLogoUrl(logoUrl: string) {
  return apiFetch('/api/settings/logo-url', {
    method: 'POST',
    body: JSON.stringify({ logoUrl }),
  }) as Promise<{ ok: boolean; logoUrl: string }>
}

export async function getFaviconUrl() {
  return apiFetch('/api/settings/favicon-url') as Promise<{ faviconUrl: string }>
}

export async function updateFaviconUrl(faviconUrl: string) {
  return apiFetch('/api/settings/favicon-url', {
    method: 'POST',
    body: JSON.stringify({ faviconUrl }),
  }) as Promise<{ ok: boolean; faviconUrl: string }>
}

export async function getAppleTouchIconUrl() {
  return apiFetch('/api/settings/apple-touch-icon-url') as Promise<{ appleTouchIconUrl: string }>
}

export async function updateAppleTouchIconUrl(appleTouchIconUrl: string) {
  return apiFetch('/api/settings/apple-touch-icon-url', {
    method: 'POST',
    body: JSON.stringify({ appleTouchIconUrl }),
  }) as Promise<{ ok: boolean; appleTouchIconUrl: string }>
}

export async function getThemeColor() {
  return apiFetch('/api/settings/theme-color') as Promise<{ themeColor: string }>
}

export async function updateThemeColor(themeColor: string) {
  return apiFetch('/api/settings/theme-color', {
    method: 'POST',
    body: JSON.stringify({ themeColor }),
  }) as Promise<{ ok: boolean; themeColor: string }>
}

export type PwaConfig = {
  name: string
  short_name: string
  description: string
  background_color: string
  theme_color: string
  icon_192: string
  icon_512: string
}

export async function getPwaConfig() {
  return apiFetch('/api/settings/pwa-config') as Promise<{ config: PwaConfig; customized?: boolean }>
}

export async function updatePwaConfig(config: PwaConfig) {
  return apiFetch('/api/settings/pwa-config', {
    method: 'POST',
    body: JSON.stringify({ config }),
  }) as Promise<{ ok: boolean; config: PwaConfig }>
}

export async function getLoginLogoVariant() {
  return apiFetch('/api/settings/login-logo-variant') as Promise<{ variant: 'a' | 'b' }>
}

export async function updateLoginLogoVariant(variant: 'a' | 'b') {
  return apiFetch('/api/settings/login-logo-variant', {
    method: 'POST',
    body: JSON.stringify({ variant }),
  }) as Promise<{ ok: boolean; variant: 'a' | 'b' }>
}

export type MobileNavConfigItem = {
  id: string
  to: string
  label: string
  icon: 'wallet' | 'chart' | 'pickaxe' | 'house' | 'candlestick' | 'sparkles' | 'bcmark'
  isFab: boolean
}

export async function getMobileNavConfig() {
  return apiFetch('/api/settings/mobile-nav-config') as Promise<{ items: MobileNavConfigItem[]; customized?: boolean }>
}

export async function updateMobileNavConfig(items: MobileNavConfigItem[]) {
  return apiFetch('/api/settings/mobile-nav-config', {
    method: 'POST',
    body: JSON.stringify({ items }),
  }) as Promise<{ ok: boolean; items: MobileNavConfigItem[] }>
}

export type HeaderIconConfigItem = {
  id: 'search' | 'language' | 'notifications' | 'profile'
  visible: boolean
}

export async function getHeaderIconConfig() {
  return apiFetch('/api/settings/header-icon-config') as Promise<{ items: HeaderIconConfigItem[]; customized?: boolean }>
}

export async function updateHeaderIconConfig(items: HeaderIconConfigItem[]) {
  return apiFetch('/api/settings/header-icon-config', {
    method: 'POST',
    body: JSON.stringify({ items }),
  }) as Promise<{ ok: boolean; items: HeaderIconConfigItem[] }>
}

export type AdItem = {
  id: number
  type: 'image' | 'video'
  mediaUrl: string
  title?: string
  description?: string
  linkUrl?: string
  placement: string
  sortOrder: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

const CURATED_ADS_BY_PLACEMENT: Record<string, AdItem[]> = {
  home: [
    { id: 991001, type: 'image', mediaUrl: '/ads/break-logo-promo.jpeg', title: '????? ????', description: '????? ?????? ??????', linkUrl: '/portfolio', placement: 'home', sortOrder: 0, isActive: true },
    { id: 991002, type: 'image', mediaUrl: '/ads/event-banner.jpeg', title: '?????', description: '???? ??????? ?????? ??? ????? ??????.', linkUrl: '/portfolio', placement: 'home', sortOrder: 1, isActive: true },
    { id: 991003, type: 'video', mediaUrl: '/ads/mining-feed.mp4', title: '????? ????? ???', description: '??? ??????? ??????', linkUrl: '/mining', placement: 'home', sortOrder: 2, isActive: true },
    { id: 991004, type: 'video', mediaUrl: '/ads/event-a.mp4', title: '????? ?', description: '??? ????? ????? ????? ?? ???? ??????? ?????????.', linkUrl: '/mining', placement: 'home', sortOrder: 3, isActive: true },
    { id: 991005, type: 'video', mediaUrl: '/ads/mining-power.mp4', title: '????? ????? ????', description: '??? ??????? ?????????', linkUrl: '/mining', placement: 'home', sortOrder: 4, isActive: true },
    { id: 991006, type: 'image', mediaUrl: '/ads/breakcash-best.jpeg', title: '???? ??? ?? ??????', description: '???? ?????? ???? ?????? ?????? ???? ?????? ????????.', linkUrl: '/portfolio', placement: 'home', sortOrder: 5, isActive: true },
    { id: 991007, type: 'image', mediaUrl: '/ads/mining-banner.jpeg', title: '????? ?????', description: '???? ???? ???????', linkUrl: '/mining', placement: 'home', sortOrder: 6, isActive: true },
  ],
  deposit: [
    { id: 992001, type: 'image', mediaUrl: '/ads/break-logo-promo.jpeg', title: '????? ????', description: '????? ?????? ??????', linkUrl: '/portfolio', placement: 'deposit', sortOrder: 0, isActive: true },
    { id: 992002, type: 'video', mediaUrl: '/ads/event-a.mp4', title: '????? ?', description: '??? ????? ????? ????? ?? ???? ??????? ?????????.', linkUrl: '/mining', placement: 'deposit', sortOrder: 1, isActive: true },
    { id: 992003, type: 'video', mediaUrl: '/ads/mining-feed.mp4', title: '????? ????? ???', description: '??? ??????? ??????', linkUrl: '/mining', placement: 'deposit', sortOrder: 2, isActive: true },
    { id: 992004, type: 'image', mediaUrl: '/ads/breakcash-best.jpeg', title: '???? ??? ?? ??????', description: '???? ?????? ???? ?????? ?????? ???? ?????? ????????.', linkUrl: '/portfolio', placement: 'deposit', sortOrder: 3, isActive: true },
    { id: 992005, type: 'video', mediaUrl: '/ads/mining-power.mp4', title: '????? ????? ????', description: '??? ??????? ?????????', linkUrl: '/mining', placement: 'deposit', sortOrder: 4, isActive: true },
    { id: 992006, type: 'image', mediaUrl: '/ads/event-banner.jpeg', title: '?????', description: '???? ??????? ?????? ??? ????? ??????.', linkUrl: '/portfolio', placement: 'deposit', sortOrder: 5, isActive: true },
    { id: 992007, type: 'image', mediaUrl: '/ads/mining-banner.jpeg', title: '????? ?????', description: '???? ???? ???????', linkUrl: '/mining', placement: 'deposit', sortOrder: 6, isActive: true },
  ],
  mining: [
    { id: 993001, type: 'image', mediaUrl: '/ads/break-logo-promo.jpeg', title: '????? ????', description: '????? ?????? ??????', linkUrl: '/portfolio', placement: 'mining', sortOrder: 0, isActive: true },
    { id: 993002, type: 'image', mediaUrl: '/ads/breakcash-best.jpeg', title: '???? ??? ?? ??????', description: '???? ?????? ???? ?????? ?????? ???? ?????? ????????.', linkUrl: '/portfolio', placement: 'mining', sortOrder: 1, isActive: true },
    { id: 993003, type: 'video', mediaUrl: '/ads/mining-feed.mp4', title: '????? ????? ???', description: '??? ??????? ??????', linkUrl: '/mining', placement: 'mining', sortOrder: 2, isActive: true },
    { id: 993004, type: 'image', mediaUrl: '/ads/event-banner.jpeg', title: '?????', description: '???? ??????? ?????? ??? ????? ??????.', linkUrl: '/portfolio', placement: 'mining', sortOrder: 3, isActive: true },
    { id: 993005, type: 'video', mediaUrl: '/ads/mining-power.mp4', title: '????? ????? ????', description: '??? ??????? ?????????', linkUrl: '/mining', placement: 'mining', sortOrder: 4, isActive: true },
    { id: 993006, type: 'video', mediaUrl: '/ads/event-a.mp4', title: '????? ?', description: '??? ????? ????? ????? ?? ???? ??????? ?????????.', linkUrl: '/mining', placement: 'mining', sortOrder: 5, isActive: true },
    { id: 993007, type: 'image', mediaUrl: '/ads/mining-banner.jpeg', title: '????? ?????', description: '???? ???? ???????', linkUrl: '/mining', placement: 'mining', sortOrder: 6, isActive: true },
  ],
  profile: [
    { id: 994001, type: 'image', mediaUrl: '/ads/break-logo-promo.jpeg', title: '????? ????', description: '????? ?????? ??????', linkUrl: '/portfolio', placement: 'profile', sortOrder: 0, isActive: true },
    { id: 994002, type: 'video', mediaUrl: '/ads/event-a.mp4', title: '????? ?', description: '??? ????? ????? ????? ?? ???? ??????? ?????????.', linkUrl: '/mining', placement: 'profile', sortOrder: 1, isActive: true },
    { id: 994003, type: 'video', mediaUrl: '/ads/mining-feed.mp4', title: '????? ????? ???', description: '??? ??????? ??????', linkUrl: '/mining', placement: 'profile', sortOrder: 2, isActive: true },
    { id: 994004, type: 'image', mediaUrl: '/ads/event-banner.jpeg', title: '?????', description: '???? ??????? ?????? ??? ????? ??????.', linkUrl: '/portfolio', placement: 'profile', sortOrder: 3, isActive: true },
    { id: 994005, type: 'video', mediaUrl: '/ads/mining-power.mp4', title: '????? ????? ????', description: '??? ??????? ?????????', linkUrl: '/mining', placement: 'profile', sortOrder: 4, isActive: true },
    { id: 994006, type: 'image', mediaUrl: '/ads/breakcash-best.jpeg', title: '???? ??? ?? ??????', description: '???? ?????? ???? ?????? ?????? ???? ?????? ????????.', linkUrl: '/portfolio', placement: 'profile', sortOrder: 5, isActive: true },
    { id: 994007, type: 'image', mediaUrl: '/ads/mining-banner.jpeg', title: '????? ?????', description: '???? ???? ???????', linkUrl: '/mining', placement: 'profile', sortOrder: 6, isActive: true },
  ],
}

function shouldUseCuratedAds(items: AdItem[]) {
  if (!Array.isArray(items) || items.length === 0) return true
  return items.every((item) => Number(item?.id || 0) >= 900000)
}

function normalizeAdsForPlacement(placement: string, items: AdItem[]) {
  const curated = CURATED_ADS_BY_PLACEMENT[placement]
  if (!curated) return items
  if (!shouldUseCuratedAds(items)) return items
  return curated
}

export async function getAds(placement: string) {
  const res = await apiFetch(`/api/ads?placement=${encodeURIComponent(placement)}`) as { items: AdItem[] }
  return {
    items: normalizeAdsForPlacement(String(placement || '').trim().toLowerCase(), Array.isArray(res.items) ? res.items : []),
  }
}

export async function getAdsAdmin() {
  return apiFetch('/api/ads/admin') as Promise<{ items: AdItem[] }>
}

export async function uploadAdMedia(file: File) {
  const token = getToken()
  const form = new FormData()
  form.append('media', file)
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch('/api/ads/upload', { method: 'POST', headers, body: form })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    emitApiErrorToast('NETWORK_ERROR', msg)
    throw err
  }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new Error('Invalid response')
  }
  if (!res.ok) {
    const msg = typeof body === 'object' && body && 'message' in body ? String((body as { message?: string }).message) : 'Upload failed'
    emitApiErrorToast(res.status === 400 ? 'INVALID_INPUT' : 'REQUEST_FAILED', msg)
    throw new Error(msg)
  }
  return body as { ok: boolean; url: string; type: 'image' | 'video' }
}

export async function createAd(payload: Partial<AdItem> & { mediaUrl: string; type: 'image' | 'video' }) {
  return apiFetch('/api/ads', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; ad: AdItem }>
}

export async function updateAd(id: number, payload: Partial<AdItem>) {
  return apiFetch(`/api/ads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; ad: AdItem }>
}

export async function deleteAd(id: number) {
  return apiFetch(`/api/ads/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>
}

export async function toggleAd(id: number, isActive: boolean) {
  return apiFetch(`/api/ads/${id}/toggle`, {
    method: 'PUT',
    body: JSON.stringify({ isActive }),
  }) as Promise<{ ok: boolean }>
}

export async function reorderAds(order: number[]) {
  return apiFetch('/api/ads/reorder', {
    method: 'PUT',
    body: JSON.stringify({ order }),
  }) as Promise<{ ok: boolean }>
}

export async function getAssetImages() {
  return apiFetch('/api/settings/asset-images') as Promise<{
    images: { key: string; url: string }[]
  }>
}

export async function ownerUploadSettingImage(key: string, file: File) {
  const token = getToken()
  const form = new FormData()
  form.append('key', key)
  form.append('image', file)

  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch('/api/settings/asset-image', {
      method: 'POST',
      headers,
      body: form,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Load failed'
    console.error('[ownerUploadSettingImage] fetch failed:', msg)
    Sentry.captureException(err)
    emitApiErrorToast('NETWORK_ERROR', msg)
    throw err
  }

  const contentType = res.headers.get('content-type') || ''
  let body: unknown
  try {
    const text = await res.text()
    body = contentType.includes('application/json') ? JSON.parse(text) : { error: 'REQUEST_FAILED', raw: text.slice(0, 200) }
  } catch (parseErr) {
    console.error('[ownerUploadSettingImage] response parse failed:', parseErr)
    Sentry.captureMessage(`asset-image non-JSON response: ${res.status} ${res.statusText}`)
    body = { error: 'REQUEST_FAILED' }
  }

  if (!res.ok) {
    const code = resolveErrorCodeFromBody(body)
    console.error('[ownerUploadSettingImage] error:', res.status, code, body)
    Sentry.captureMessage(`asset-image ${res.status}: ${code}`)
    throw createApiError(code, body)
  }
  return body as { ok: boolean; key: string; url: string }
}

export async function ownerUploadUserAvatar(userId: number, file: File) {
  const token = getToken()
  const form = new FormData()
  form.append('userId', String(userId))
  form.append('avatar', file)

  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch('/api/profile/avatar/user', {
      method: 'POST',
      headers,
      body: form,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Load failed'
    console.error('[ownerUploadUserAvatar] fetch failed:', msg)
    Sentry.captureException(err)
    emitApiErrorToast('NETWORK_ERROR', msg)
    throw err
  }

  const contentType = res.headers.get('content-type') || ''
  let body: unknown
  try {
    const text = await res.text()
    body = contentType.includes('application/json') ? JSON.parse(text) : { error: 'REQUEST_FAILED', raw: text.slice(0, 200) }
  } catch (parseErr) {
    console.error('[ownerUploadUserAvatar] response parse failed:', parseErr)
    Sentry.captureMessage(`avatar/user non-JSON response: ${res.status}`)
    body = { error: 'REQUEST_FAILED' }
  }

  if (!res.ok) {
    const code = resolveErrorCodeFromBody(body)
    throw createApiError(code, body)
  }
  return body as { ok: boolean; user: AuthUser }
}

export type FriendUser = {
  id: number
  displayName: string
  bio?: string | null
  avatarUrl: string | null
  verificationStatus?: 'unverified' | 'pending' | 'verified' | string
  blueBadge?: number
  vipLevel?: number
  tradingBalance?: number | null
  depositPrivacyEnabled?: boolean
}
export type FriendItem = FriendUser & { id: number; userId: number; status: string; createdAt: string }

export async function searchUsersById(q: string) {
  return apiFetch(`/api/friends/search?q=${encodeURIComponent(q)}`) as Promise<{ users: FriendUser[] }>
}

export async function sendFriendRequest(toUserId: number) {
  return apiFetch('/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ toUserId }),
  }) as Promise<{ ok: boolean }>
}

export async function getFriendsList() {
  return apiFetch('/api/friends/list') as Promise<{
    friends: FriendItem[]
    pendingReceived: FriendItem[]
    pendingSent: FriendItem[]
  }>
}

export async function acceptFriendRequest(requestId: number) {
  return apiFetch('/api/friends/accept', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  }) as Promise<{ ok: boolean }>
}

export async function removeFriend(userId: number) {
  return apiFetch('/api/friends/remove', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  }) as Promise<{ ok: boolean; removed: boolean }>
}

export async function getBalanceForUser(userId: number) {
  return apiFetch(`/api/balance/getUser?userId=${userId}`) as Promise<{
    userId: number
    balances: { currency: string; amount: number; updated_at: string }[]
  }>
}

export async function getBalanceHistory(userId?: number) {
  const q = userId != null ? `?userId=${userId}` : ''
  return apiFetch(`/api/balance/history${q}`) as Promise<{
    history: { id: number; user_id: number; admin_id: number | null; type: string; currency: string; amount: number; note: string | null; created_at: string }[]
  }>
}

export type WalletOverview = {
  total_assets: number
  by_currency: Record<string, number>
  by_source: { source_type: string; currency: string; balance: number }[]
  main_balance: number
  locked_balance: number
  withdrawable_balance: number
  withdraw_summary: WithdrawalSummary
}

export async function getWalletOverview(currency = 'USDT') {
  return apiFetch(`/api/balance/overview?currency=${encodeURIComponent(currency)}`) as Promise<WalletOverview>
}

/** Wallet transaction history (source of truth: wallet_transactions) */
export async function getWalletHistory(opts?: {
  currency?: string
  sourceType?: string
  transactionType?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}) {
  const params = new URLSearchParams()
  if (opts?.currency) params.set('currency', opts.currency)
  if (opts?.sourceType) params.set('sourceType', opts.sourceType)
  if (opts?.transactionType) params.set('transactionType', opts.transactionType)
  if (opts?.dateFrom) params.set('dateFrom', opts.dateFrom)
  if (opts?.dateTo) params.set('dateTo', opts.dateTo)
  params.set('limit', String(opts?.limit ?? 100))
  return apiFetch(`/api/balance/wallet-history?${params}`) as Promise<{
    transactions: {
      id: number
      currency: string
      transaction_type: string
      source_type: string
      reference_type: string | null
      reference_id: number | null
      amount: number
      fee_amount: number
      net_amount: number
      balance_before: number
      balance_after: number
      metadata: string | null
      created_at: string
      label_key?: string
      source_label_key?: string
    }[]
  }>
}

export type EarningEntry = {
  id: number
  source_type: string
  reference_type: string
  reference_id: number
  currency: string
  amount: number
  status: string
  payout_mode?: RewardPayoutMode
  locked_until?: string | null
  transferred_at: string | null
  transferred_wallet_txn_id: number | null
  created_at: string
  label_key?: string
  status_label_key?: string
}

export type EarningGroup = {
  source_type: string
  entries: EarningEntry[]
  total_amount: number
  transferred_count: number
  pending_count: number
  timed_locked_count?: number
  timed_locked_amount?: number
  permanent_locked_count?: number
  next_unlock_at?: string | null
}

/** Earning entries history (source of truth: earning_entries) */
export async function getEarningHistory(opts?: {
  sourceType?: string
  limit?: number
  grouped?: boolean
}) {
  const params = new URLSearchParams()
  if (opts?.sourceType) params.set('sourceType', opts.sourceType)
  params.set('limit', String(opts?.limit ?? 100))
  if (opts?.grouped) params.set('grouped', '1')
  return apiFetch(`/api/balance/earning-history?${params}`) as Promise<{
    entries: EarningEntry[]
    grouped?: EarningGroup[]
  }>
}

export async function getAdminUserWallet(userId: number, currency = 'USDT', limit = 50) {
  const params = new URLSearchParams()
  params.set('userId', String(userId))
  params.set('currency', currency)
  params.set('limit', String(limit))
  return apiFetch(`/api/balance/admin/user-wallet?${params}`) as Promise<{
    user: { id: number; email: string | null; phone: string | null; display_name: string | null } | null
    overview: {
      total_assets: number
      by_currency: Record<string, number>
      by_source: { source_type: string; currency: string; balance: number }[]
      main_balance: number
      locked_balance: number
      withdrawable_balance: number
    }
    withdraw_summary: WithdrawalSummary
    transactions: {
      id: number
      currency: string
      transaction_type: string
      source_type: string
      reference_type: string | null
      reference_id: number | null
      amount: number
      net_amount: number
      created_at: string
    }[]
    earning_entries: EarningEntry[]
  }>
}

export async function adjustBalance(payload: {
  userId: number
  currency: string
  amount: number
  type: 'add' | 'deduct'
  note?: string
}) {
  return apiFetch('/api/balance/adjust', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; balance: { userId: number; currency: string; amount: number } }>
}

export async function adjustUserProfit(payload: {
  userId: number
  currency?: string
  amount: number
  target: 'main' | 'pending'
  sourceType?: RewardPayoutSource
  note?: string
}) {
  return apiFetch('/api/users/profit-adjust', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{
    ok: boolean
    target: 'main' | 'pending'
    sourceType: RewardPayoutSource
    amount: number
    remainingMainBalance: number
    remainingPendingAmount: number
    affectedEntries: number
  }>
}

export async function setBalance(payload: { userId: number; currency: string; amount: number; note?: string }) {
  return apiFetch('/api/balance/set', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; balance: { userId: number; currency: string; amount: number } }>
}

export type BalanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed'

export type BalanceRules = {
  minDeposit: number
  minWithdrawal: number
  depositMethods: string[]
  withdrawalMethods: string[]
  manualReview: boolean
  withdrawalFeePercent: number
  minimumProfitToUnlock: number
  defaultUnlockRatio: number
  unlockRatioByLevel: Record<string, number>
  principalWithdrawalRule?: {
    enabled: boolean
    withdrawableRatio: number
    clearProfitRestriction: boolean
    applyToAllVipLevels: boolean
  }
}

export type DepositRequestItem = {
  id: number
  user_id: number
  amount: number
  currency: string
  method: string
  transfer_ref: string
  user_notes?: string | null
  proof_image_path?: string | null
  request_status: BalanceRequestStatus
  admin_note?: string | null
  reviewed_by?: number | null
  reviewed_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
  user_email?: string | null
  user_phone?: string | null
  user_display_name?: string | null
  reviewed_by_name?: string | null
}

export type WithdrawalRequestItem = {
  id: number
  user_id: number
  amount: number
  currency: string
  method: string
  account_info: string
  user_notes?: string | null
  request_status: BalanceRequestStatus
  admin_note?: string | null
  reviewed_by?: number | null
  reviewed_at?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
  user_email?: string | null
  user_phone?: string | null
  user_display_name?: string | null
  reviewed_by_name?: string | null
}

export type WithdrawalSummary = {
  currency: string
  current_balance: number
  deposited_principal: number
  locked_balance: number
  earned_profit: number
  withdrawable_balance: number
  unlock_target_profit: number
  remaining_profit_to_unlock: number
  unlock_progress_pct: number
  is_principal_unlocked: boolean
  unlock_ratio: number
  minimum_profit_to_unlock: number
  vip_level: number
  force_unlock_principal: boolean
}

export type PublicWithdrawalSummary = {
  currency: string
  current_balance: number
  locked_balance: number
  withdrawable_balance: number
  is_principal_unlocked: boolean
  withdrawal_fee_percent: number
  daily_withdrawal_limit: number
  daily_withdrawal_remaining: number
  processing_hours_min: number
  processing_hours_max: number
  status_label: 'available' | 'partially_restricted'
  status_message: string
}

export type PublicPrincipalLockItem = {
  id: number
  status_label: 'available' | 'protected'
  display_title: string
  display_message: string
  lock_status: string
  created_at: string
  updated_at: string
  unlocked_at?: string | null
}

export type PrincipalLockItem = {
  id: number
  source_type: string
  source_id: number
  principal_amount: number
  required_profit_amount: number
  consumed_profit_amount: number
  remaining_profit_to_unlock: number
  unlock_ratio: number
  lock_status: string
  progress_pct: number
  unlocked_at?: string | null
  created_at: string
  updated_at: string
}

export type UserUnlockOverride = {
  user_id: number
  force_unlock_principal: number
  custom_unlock_ratio: number | null
  custom_min_profit: number | null
  note?: string | null
}

export async function getBalanceRules() {
  return apiFetch('/api/balance/rules') as Promise<{ rules: BalanceRules }>
}

export async function updateBalanceRules(
  rules: BalanceRules,
  options?: {
    resetPrincipalUnlockOverrides?: boolean
  },
) {
  return apiFetch('/api/balance/rules', {
    method: 'POST',
    body: JSON.stringify({
      rules,
      resetPrincipalUnlockOverrides: options?.resetPrincipalUnlockOverrides === true,
    }),
  }) as Promise<{ ok: boolean; rules: BalanceRules }>
}

export type OwnerFinancialGuardConfig = {
  enabled: boolean
  watchDepositApprovals: boolean
  watchManualBalanceAdds: boolean
  watchBonusAdds: boolean
}

export type OwnerFinancialApprovalItem = {
  id: number
  actionType: 'deposit_approval' | 'manual_balance_add' | 'bonus_add'
  status: 'pending' | 'approved' | 'rejected'
  targetUserId: number
  actorUserId: number
  reviewedBy: number | null
  currency: string
  amount: number
  referenceType: string | null
  referenceId: number | null
  walletTransactionId: number | null
  note: string | null
  ownerNote: string | null
  createdAt: string | null
  updatedAt: string | null
  reviewedAt: string | null
  reversedAt: string | null
  metadata: Record<string, unknown> | null
  targetUser: {
    id: number
    displayName: string | null
    email: string | null
    phone: string | null
    referralCode: string | null
  }
  actorUser: {
    id: number
    displayName: string | null
    email: string | null
    phone: string | null
    role: string | null
  }
  reviewerUser: {
    id: number
    displayName: string | null
    email: string | null
  } | null
}

export type OwnerFinancialGuardResponse = {
  config: OwnerFinancialGuardConfig
  summary: {
    pendingCount: number
    approvedCount: number
    rejectedCount: number
    pendingAmount: number
  }
  items: OwnerFinancialApprovalItem[]
}

export async function getWithdrawSummaryMy(currency = 'USDT') {
  return apiFetch(`/api/balance/withdraw-summary/my?currency=${encodeURIComponent(currency)}`) as Promise<{
    summary: PublicWithdrawalSummary
  }>
}

export async function getWithdrawLocksMy(currency = 'USDT') {
  return apiFetch(`/api/balance/withdraw-locks/my?currency=${encodeURIComponent(currency)}`) as Promise<{
    items: PublicPrincipalLockItem[]
    summary: PublicWithdrawalSummary
  }>
}

export async function getAdminUnlockOverride(userId: number) {
  return apiFetch(`/api/balance/admin/unlock-override?userId=${encodeURIComponent(String(userId))}`) as Promise<{
    override: UserUnlockOverride
    summary: WithdrawalSummary
  }>
}

export async function upsertAdminUnlockOverride(payload: {
  userId: number
  forceUnlockPrincipal: boolean
  customUnlockRatio?: number | null
  customMinProfit?: number | null
  note?: string
}) {
  return apiFetch('/api/balance/admin/unlock-override', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{
    ok: boolean
    override: UserUnlockOverride
    summary: WithdrawalSummary
  }>
}

export async function createDepositRequest(formData: FormData) {
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api/balance/deposit-requests', {
    method: 'POST',
    headers,
    body: formData,
  })
  const body = await res.json()
  if (!res.ok) {
    const code = resolveErrorCodeFromBody(body)
    throw createApiError(code, body)
  }
  return body as { ok: boolean; requestId: number; status: BalanceRequestStatus }
}

export async function createWithdrawalRequest(payload: {
  amount: number
  currency?: string
  method: string
  accountInfo: string
  notes?: string
  idempotencyKey?: string
}) {
  return apiFetch('/api/balance/withdrawal-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; requestId: number; status: BalanceRequestStatus }>
}

export async function getMyBalanceRequests(status?: BalanceRequestStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch(`/api/balance/requests/my${query}`) as Promise<{
    deposits: DepositRequestItem[]
    withdrawals: WithdrawalRequestItem[]
  }>
}

export async function getAdminDepositRequests(status?: BalanceRequestStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch(`/api/balance/admin/deposit-requests${query}`) as Promise<{ items: DepositRequestItem[] }>
}

export async function getAdminWithdrawalRequests(status?: BalanceRequestStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch(`/api/balance/admin/withdrawal-requests${query}`) as Promise<{ items: WithdrawalRequestItem[] }>
}

export async function reviewAdminDepositRequest(payload: {
  requestId: number
  action: 'approve' | 'reject'
  adminNote?: string
}) {
  return apiFetch(`/api/balance/admin/deposit-requests/${payload.requestId}/review`, {
    method: 'POST',
    body: JSON.stringify({ action: payload.action, adminNote: payload.adminNote || '' }),
  }) as Promise<{ ok: boolean; status: BalanceRequestStatus }>
}

export async function reviewAdminWithdrawalRequest(payload: {
  requestId: number
  action: 'approve' | 'reject'
  adminNote?: string
}) {
  return apiFetch(`/api/balance/admin/withdrawal-requests/${payload.requestId}/review`, {
    method: 'POST',
    body: JSON.stringify({ action: payload.action, adminNote: payload.adminNote || '' }),
  }) as Promise<{ ok: boolean; status: BalanceRequestStatus }>
}

export async function completeAdminWithdrawalRequest(requestId: number, adminNote = '') {
  return apiFetch(`/api/balance/admin/withdrawal-requests/${requestId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ adminNote }),
  }) as Promise<{ ok: boolean; status: BalanceRequestStatus }>
}

export async function getRegistrationStatus() {
  return apiFetch('/api/settings/registration-status') as Promise<{ enabled: boolean }>
}

export async function updateRegistrationStatus(enabled: boolean) {
  return apiFetch('/api/settings/registration-status', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  }) as Promise<{ ok: boolean; enabled: boolean }>
}

export type StrategyTradeDisplayConfig = {
  preview_notice: string
  active_notice: string
  settled_notice: string
}

export async function getStrategyTradeDisplayConfig() {
  return apiFetch('/api/settings/strategy-trade-display') as Promise<{ config: StrategyTradeDisplayConfig }>
}

export async function updateStrategyTradeDisplayConfig(config: StrategyTradeDisplayConfig) {
  return apiFetch('/api/settings/strategy-trade-display', {
    method: 'POST',
    body: JSON.stringify(config),
  }) as Promise<{ ok: boolean; config: StrategyTradeDisplayConfig }>
}

export async function updateUserBan(userId: number, isBanned: boolean) {
  return apiFetch('/api/users/ban', {
    method: 'POST',
    body: JSON.stringify({ userId, isBanned: isBanned ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function updateUserFreeze(userId: number, isFrozen: boolean) {
  return apiFetch('/api/users/freeze', {
    method: 'POST',
    body: JSON.stringify({ userId, isFrozen: isFrozen ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function updateUserBadgeStyle(userId: number, style: 'none' | 'gold' | 'blue') {
  return apiFetch('/api/profile/badge/style', {
    method: 'POST',
    body: JSON.stringify({ userId, style }),
  }) as Promise<{ ok: boolean; user: AuthUser }>
}

export async function updateUserVipLevel(userId: number, vipLevel: number) {
  return apiFetch('/api/profile/vip-level', {
    method: 'POST',
    body: JSON.stringify({ userId, vipLevel }),
  }) as Promise<{ ok: boolean; user: AuthUser }>
}

export type PremiumIdentityOptions = {
  profileColors: PremiumProfileColor[]
  profileBadges: PremiumProfileBadge[]
}

export async function getPremiumIdentityOptions() {
  return apiFetch('/api/profile/premium-identity/options') as Promise<PremiumIdentityOptions>
}

export async function updateUserPremiumIdentity(payload: {
  userId: number
  profileColor?: PremiumProfileColor | null
  profileBadge?: PremiumProfileBadge | null
}) {
  return apiFetch('/api/profile/premium-identity', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; user: AuthUser }>
}

export type AdminUserRow = {
  id: number
  email: string | null
  phone: string | null
  role: string
  is_approved: number
  is_banned: number
  is_frozen: number
  banned_until?: string | null
  created_at?: string
  display_name?: string | null
  verification_status?: 'unverified' | 'pending' | 'verified'
  blue_badge?: number
  vip_level?: number
  profile_color?: PremiumProfileColor | null
  profile_badge?: PremiumProfileBadge | null
  country?: string | null
  preferred_language?: string | null
  preferred_currency?: string | null
  referral_code?: string | null
  invited_by?: number | null
  referred_by?: number | null
  total_deposit?: number
  points?: number
  is_owner?: number
  last_login_at?: string | null
  last_ip?: string | null
  last_user_agent?: string | null
  wallet_balance?: number
  deposits_total?: number
  withdrawals_total?: number
  referrals_count?: number
  referrals_earnings?: number
  pending_withdrawals?: number
}

export type AdminUserProfilePayload = {
  user: AdminUserRow
  activity: Array<{
    id: number
    action: string
    ip_address: string | null
    user_agent: string | null
    metadata: string | null
    created_at: string
  }>
  notes: Array<{
    id: number
    note: string
    admin_id: number | null
    created_at: string
  }>
}

export async function getAdminUsersList(params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    query.set(k, String(v))
  })
  return apiFetch(`/api/users/list?${query.toString()}`) as Promise<{ users: AdminUserRow[] }>
}

export async function getAdminUserProfile(userId: number) {
  return apiFetch(`/api/users/${userId}/profile`) as Promise<AdminUserProfilePayload>
}

export async function updateUserApproval(userId: number, isApproved: boolean) {
  return apiFetch('/api/users/approve', {
    method: 'POST',
    body: JSON.stringify({ userId, isApproved: isApproved ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function banUserTemporary(userId: number, days: number) {
  return apiFetch('/api/users/ban-temporary', {
    method: 'POST',
    body: JSON.stringify({ userId, days }),
  }) as Promise<{ ok: boolean }>
}

export async function resetUserPasswordByOwner(userId: number, newPassword: string) {
  return apiFetch('/api/users/reset-password', {
    method: 'POST',
    body: JSON.stringify({ userId, newPassword }),
  }) as Promise<{ ok: boolean }>
}

export async function applyUserBonus(payload: {
  userId: number
  currency: string
  amount: number
  type: 'add' | 'deduct'
}) {
  return apiFetch('/api/users/bonus', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; balance: { userId: number; currency: string; amount: number } }>
}

export async function sendPrivateNotification(payload: { userId: number; title: string; body: string }) {
  return apiFetch('/api/users/notify', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export async function addInternalUserNote(payload: { userId: number; note: string }) {
  return apiFetch('/api/users/note', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export type IconAttractionKey = 'hot' | 'new' | 'most_requested'
export type IconAttractionTarget =
  | 'assets'
  | 'markets'
  | 'tasks'
  | 'mining'
  | 'home'
  | 'quick_buy'
  | 'rewards_center'
  | 'referrals'
  | 'more'
export type IconAttractionAssignments = Partial<Record<IconAttractionTarget, IconAttractionKey>>

export async function getIconAttractionKeys() {
  return apiFetch('/api/settings/icon-attraction-keys') as Promise<{
    keys: IconAttractionKey[]
    targets: IconAttractionTarget[]
    assignments: IconAttractionAssignments
  }>
}

export async function updateIconAttractionKeys(
  keys: IconAttractionKey[],
  targets: IconAttractionTarget[] = [],
  assignments: IconAttractionAssignments = {},
) {
  return apiFetch('/api/settings/icon-attraction-keys', {
    method: 'POST',
    body: JSON.stringify({ keys, targets, assignments }),
  }) as Promise<{
    ok: boolean
    keys: IconAttractionKey[]
    targets: IconAttractionTarget[]
    assignments: IconAttractionAssignments
  }>
}

export type DailyTradeCampaign = {
  id: number
  title: string
  symbol?: string | null
  side?: string | null
  entry_price?: number | null
  take_profit?: number | null
  stop_loss?: number | null
  success_rate?: number
  reward_amount?: number
  reward_currency?: string
  visibility_scope: 'all' | 'depositors' | 'vip' | 'vip_level'
  min_vip_level: number
  is_visible: number
  claims_count?: number
  starts_at?: string | null
  ends_at?: string | null
  created_at?: string
}

export async function reviewUserVerification(userId: number, decision: 'approve' | 'reject') {
  return apiFetch('/api/users/verification-review', {
    method: 'POST',
    body: JSON.stringify({ userId, decision }),
  }) as Promise<{ ok: boolean }>
}

export type SupportTicketItem = {
  id: number
  subject: string
  message: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | string
  created_at: string
  updated_at?: string | null
  resolved_at?: string | null
  email_delivery_status?: string | null
  email_delivery_error?: string | null
}

export async function getMySupportTickets() {
  return apiFetch('/api/support/my') as Promise<{ items: SupportTicketItem[] }>
}

export async function createSupportTicket(payload: { subject: string; message: string }) {
  return apiFetch('/api/support/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; item: SupportTicketItem }>
}

export type UserDailyTradeReward = {
  id: number
  title: string
  symbol?: string | null
  side?: string | null
  entry_price?: number | null
  take_profit?: number | null
  stop_loss?: number | null
  success_rate?: number
  reward_amount: number
  reward_currency: string
  visibility_scope: 'all' | 'depositors' | 'vip' | 'vip_level'
  min_vip_level: number
  starts_at?: string | null
  ends_at?: string | null
  claimed: boolean
  claim_status?: string | null
  claimed_at?: string | null
}

export type BonusRule = {
  id: number
  rule_type: 'deposit' | 'first_deposit' | 'referral' | 'seasonal'
  title: string
  conditions?: Record<string, unknown> | null
  reward?: Record<string, unknown> | null
  is_active: number
  starts_at?: string | null
  ends_at?: string | null
}

export type VipTier = {
  id: number
  level: number
  title: string
  min_deposit: number
  min_trade_volume: number
  referral_multiplier: number
  referral_percent?: number
  daily_mining_percent?: number
  mining_speed_percent?: number
  daily_withdrawal_limit?: number
  processing_hours_min?: number
  processing_hours_max?: number
  withdrawal_fee_percent?: number
  active_extra_fee_percent?: number
  level2_referral_percent?: number
  level3_referral_percent?: number
  profit_multiplier?: number
  auto_reinvest?: number
  daily_bonus?: number
  perks?: string[]
  is_active: number
}

export type RewardPayoutConfig = {
  defaultMode: 'withdrawable' | 'bonus_locked'
  overridesCount: number
}

export type RewardPayoutMode = 'withdrawable' | 'bonus_locked'
export type RewardPayoutSource = 'all' | 'mining' | 'tasks' | 'referrals' | 'deposits'

export type RewardPayoutOverrideItem = {
  overrideKey: string
  id: number
  legacy: boolean
  userId: number
  sourceType: RewardPayoutSource
  payoutMode: RewardPayoutMode
  lockHours?: number | null
  note?: string | null
  updatedBy?: number | null
  updatedAt?: string | null
  pendingCount: number
  pendingAmount: number
  user: {
    displayName?: string | null
    email?: string | null
    phone?: string | null
  }
}

export type RewardPayoutRulesResponse = {
  defaultMode: RewardPayoutMode
  sourceModes: Partial<Record<Exclude<RewardPayoutSource, 'all'>, RewardPayoutMode>>
  defaultLockHours: number
  sourceLockHours: Partial<Record<Exclude<RewardPayoutSource, 'all'>, number>>
  overridesCount: number
  overrides: RewardPayoutOverrideItem[]
}

export type RewardPayoutApplyResult = {
  processedEntries: number
  lockedEntries: number
  lockedAmount: number
  bonusLockedEntries: number
  bonusLockedAmount: number
  releasedEntries: number
  releasedAmount: number
}

export type UserVipTier = {
  level: number
  title: string
  min_deposit: number
  min_team_volume?: number
  min_referrals?: number
  referral_percent: number
  daily_mining_percent?: number
  mining_speed_percent?: number
  daily_withdrawal_limit?: number
  processing_hours_min?: number
  processing_hours_max?: number
  withdrawal_fee_percent?: number
  active_extra_fee_percent?: number
  level2_referral_percent?: number
  level3_referral_percent?: number
  profit_multiplier?: number
  auto_reinvest?: number
  daily_bonus?: number
  perks: string[]
}

export type UserVipSummary = {
  currentVipLevel: number
  totalDeposit: number
  currentDirectReferrals?: number
  currentTeamVolume?: number
  nextLevel: number | null
  nextMinDeposit: number | null
  nextMinReferrals?: number | null
  nextMinTeamVolume?: number | null
  progressPct: number
  tiers: UserVipTier[]
}

export type ReferralRewardHistoryItem = {
  id: number
  referred_user_id: number
  referred_display_name: string | null
  status: 'pending' | 'active' | 'reward_released'
  deposit_request_id: number | null
  source_amount: number
  reward_percent: number
  reward_amount: number
  created_at: string
  qualified_at: string | null
  reward_released_at: string | null
}

export type ReferralSummary = {
  referralCode: string
  referralLink: string
  referralPercent: number
  referralRule?: {
    id: number
    title: string
    conditions?: Record<string, unknown>
    reward?: Record<string, unknown>
  } | null
  totalInvitedUsers: number
  totalReferralEarnings: number
  rewardHistory: ReferralRewardHistoryItem[]
}

export type PromotionRule = {
  id: number
  rule_type: 'first_deposit' | 'referral' | string
  title: string
  conditions?: Record<string, unknown>
  reward?: Record<string, unknown>
  is_active: number
}

export type PartnerProfile = {
  id: number
  user_id: number
  display_name?: string | null
  email?: string | null
  phone?: string | null
  commission_rate: number
  status: string
  notes?: string | null
  referrals_count?: number
}

export type ContentCampaign = {
  id: number
  campaign_type: 'notification' | 'popup' | 'banner' | 'news'
  title: string
  body?: string | null
  targetFilters?: Record<string, unknown>
  schedule_at?: string | null
  expires_at?: string | null
  is_active: number
}

export async function getOwnerGrowthSummary() {
  return apiFetch('/api/owner-growth/dashboard-summary') as Promise<{
    activeDailyTrades: number
    activeBonusRules: number
    activePartners: number
    activeContent: number
  }>
}

export async function getOwnerFinancialGuard() {
  return apiFetch('/api/owner-growth/financial-guard') as Promise<OwnerFinancialGuardResponse>
}

export async function updateOwnerFinancialGuardConfig(config: Partial<OwnerFinancialGuardConfig>) {
  return apiFetch('/api/owner-growth/financial-guard/config', {
    method: 'POST',
    body: JSON.stringify(config),
  }) as Promise<{ ok: boolean; config: OwnerFinancialGuardConfig }>
}

export async function reviewOwnerFinancialGuardReport(payload: {
  reportId: number
  decision: 'approve' | 'reject'
  ownerNote?: string
}) {
  return apiFetch('/api/owner-growth/financial-guard/review', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; result: { decision: 'approved' | 'rejected'; reversed: boolean } }>
}

export async function getDailyTradeCampaigns() {
  return apiFetch('/api/owner-growth/daily-trades') as Promise<{ items: DailyTradeCampaign[] }>
}

export async function createDailyTradeCampaign(payload: {
  id?: number
  title: string
  symbol?: string
  side?: string
  entryPrice?: number
  takeProfit?: number
  stopLoss?: number
  successRate?: number
  rewardAmount?: number
  rewardCurrency?: string
  visibilityScope: 'all' | 'depositors' | 'vip' | 'vip_level'
  minVipLevel?: number
  isVisible?: boolean
  startsAt?: string
  endsAt?: string
}) {
  return apiFetch('/api/owner-growth/daily-trades', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export async function toggleDailyTradeCampaign(id: number, isVisible: boolean) {
  return apiFetch('/api/owner-growth/daily-trades/toggle', {
    method: 'POST',
    body: JSON.stringify({ id, isVisible: isVisible ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function deleteDailyTradeCampaign(id: number) {
  return apiFetch(`/api/owner-growth/daily-trades/${id}`, {
    method: 'DELETE',
  }) as Promise<{ ok: boolean }>
}

export async function getMyDailyTradeRewards() {
  return apiFetch('/api/rewards/daily-trades') as Promise<{ items: UserDailyTradeReward[] }>
}

export async function claimDailyTradeReward(id: number) {
  return apiFetch(`/api/rewards/daily-trades/${id}/claim`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{
    ok: boolean
    claimId: number
    rewardAmount: number
    rewardCurrency: string
    walletTxnId: number | null
    balanceAfter: number | null
  }>
}

export async function getBonusRules() {
  return apiFetch('/api/owner-growth/bonus-rules') as Promise<{ items: BonusRule[] }>
}

export async function createBonusRule(payload: {
  id?: number
  ruleType: 'deposit' | 'first_deposit' | 'referral' | 'seasonal'
  title: string
  conditions?: Record<string, unknown>
  reward?: Record<string, unknown>
  isActive?: boolean
  startsAt?: string
  endsAt?: string
}) {
  return apiFetch('/api/owner-growth/bonus-rules', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export async function toggleBonusRule(id: number, isActive: boolean) {
  return apiFetch('/api/owner-growth/bonus-rules/toggle', {
    method: 'POST',
    body: JSON.stringify({ id, isActive: isActive ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function deleteBonusRule(id: number) {
  return apiFetch(`/api/owner-growth/bonus-rules/${id}`, {
    method: 'DELETE',
  }) as Promise<{ ok: boolean }>
}

export async function getVipTiers() {
  return apiFetch('/api/owner-growth/vip-tiers') as Promise<{ items: VipTier[] }>
}

export async function getRewardPayoutConfigOwner() {
  return apiFetch('/api/owner-growth/reward-payout-config') as Promise<RewardPayoutConfig>
}

export async function updateRewardPayoutConfigOwner(defaultMode: 'withdrawable' | 'bonus_locked') {
  return apiFetch('/api/owner-growth/reward-payout-config', {
    method: 'POST',
    body: JSON.stringify({ defaultMode }),
  }) as Promise<{ ok: boolean; defaultMode: 'withdrawable' | 'bonus_locked' }>
}

export async function getRewardPayoutRulesOwner() {
  return apiFetch('/api/owner-growth/reward-payout-rules') as Promise<RewardPayoutRulesResponse>
}

export async function updateRewardPayoutRulesOwner(payload: {
  defaultMode: RewardPayoutMode
  sourceModes: Partial<Record<Exclude<RewardPayoutSource, 'all'>, RewardPayoutMode>>
  defaultLockHours: number
  sourceLockHours: Partial<Record<Exclude<RewardPayoutSource, 'all'>, number>>
  applyPending?: boolean
}) {
  return apiFetch('/api/owner-growth/reward-payout-rules/global', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{
    ok: boolean
    defaultMode: RewardPayoutMode
    sourceModes: Partial<Record<Exclude<RewardPayoutSource, 'all'>, RewardPayoutMode>>
    defaultLockHours: number
    sourceLockHours: Partial<Record<Exclude<RewardPayoutSource, 'all'>, number>>
    applyPendingResult: RewardPayoutApplyResult
  }>
}

export async function upsertRewardPayoutOverridesOwner(payload: {
  userIds?: number[]
  userIdsText?: string
  sourceType: RewardPayoutSource
  payoutMode: RewardPayoutMode
  lockHours?: number
  note?: string
  applyPending?: boolean
}) {
  return apiFetch('/api/owner-growth/reward-payout-rules/overrides', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{
    ok: boolean
    affectedUsers: number
    lockHours: number
    applyPendingResult: RewardPayoutApplyResult
  }>
}

export async function deleteRewardPayoutOverrideOwner(overrideKey: string) {
  return apiFetch('/api/owner-growth/reward-payout-rules/overrides/delete', {
    method: 'POST',
    body: JSON.stringify({ overrideKey }),
  }) as Promise<{ ok: boolean }>
}

export async function getMyVipSummary() {
  return apiFetch('/api/rewards/vip') as Promise<UserVipSummary>
}

export async function getMyReferralSummary() {
  return apiFetch('/api/rewards/referral') as Promise<ReferralSummary>
}

export async function getActivePromotions() {
  return apiFetch('/api/rewards/promotions') as Promise<{
    firstDeposit: PromotionRule[]
    referral: PromotionRule[]
  }>
}

export async function upsertVipTier(payload: {
  level: number
  title: string
  minDeposit: number
  minTradeVolume: number
  referralMultiplier: number
  referralPercent?: number
  dailyMiningPercent?: number
  miningSpeedPercent?: number
  dailyWithdrawalLimit?: number
  processingHoursMin?: number
  processingHoursMax?: number
  withdrawalFeePercent?: number
  activeExtraFeePercent?: number
  level2ReferralPercent?: number
  level3ReferralPercent?: number
  profitMultiplier?: number
  autoReinvest?: boolean
  dailyBonus?: boolean
  perks: string[]
  isActive?: boolean
}) {
  return apiFetch('/api/owner-growth/vip-tiers', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export async function getPartnerProfiles() {
  return apiFetch('/api/owner-growth/partners') as Promise<{ items: PartnerProfile[] }>
}

export async function upsertPartnerProfile(payload: {
  userId: number
  commissionRate: number
  status: string
  notes?: string
}) {
  return apiFetch('/api/owner-growth/partners', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export async function getReferralSummary() {
  return apiFetch('/api/owner-growth/referrals') as Promise<{ summary: Array<Record<string, unknown>> }>
}

export async function getReferralStats() {
  return apiFetch('/api/owner-growth/referrals/stats') as Promise<{
    pendingCount: number
    qualifiedCount: number
    rewardReleasedCount: number
    totalRewardsValue: number
  }>
}

export async function getReferralDetails(userId: number) {
  return apiFetch(`/api/owner-growth/referrals?userId=${userId}`) as Promise<{ referrals: Array<Record<string, unknown>> }>
}

export async function getContentCampaigns() {
  return apiFetch('/api/owner-growth/content-campaigns') as Promise<{ items: ContentCampaign[] }>
}

export async function createContentCampaign(payload: {
  campaignType: 'notification' | 'popup' | 'banner' | 'news'
  title: string
  body?: string
  targetFilters?: Record<string, unknown>
  scheduleAt?: string
  expiresAt?: string
  isActive?: boolean
}) {
  return apiFetch('/api/owner-growth/content-campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export type SecurityOverview = {
  suspiciousIps: Array<{ ip_address: string; failed_count: number }>
  multiDeviceUsers: Array<{ user_id: number; display_name?: string | null; email?: string | null; phone?: string | null; active_sessions: number }>
  proxyAlerts: Array<{ id: number; user_id?: number | null; alert_type: string; severity: string; ip_address?: string | null; user_agent?: string | null; metadata?: string | null; created_at: string }>
  unusualActivity: Array<{ id: number; user_id?: number | null; alert_type: string; severity: string; ip_address?: string | null; user_agent?: string | null; metadata?: string | null; created_at: string }>
  recentLoginLogs: Array<{ id: number; identifier?: string | null; user_id?: number | null; display_name?: string | null; ip_address?: string | null; user_agent?: string | null; success: number; failure_reason?: string | null; created_at: string }>
  recentAuditLogs: Array<{ id: number; actor_user_id: number; actor_name?: string | null; target_user_id?: number | null; target_name?: string | null; section: string; action: string; metadata?: string | null; created_at: string }>
}

export type UserSessionItem = {
  id: number
  user_id: number
  session_id: string
  ip_address?: string | null
  user_agent?: string | null
  is_active: number
  created_at: string
  last_seen_at: string
  revoked_at?: string | null
}

export type AdminStaffItem = {
  id: number
  display_name?: string | null
  email?: string | null
  phone?: string | null
  role: string
  is_banned: number
  is_frozen: number
  created_at?: string
  admin_role: 'super_admin' | 'admin' | 'finance' | 'support' | 'moderator'
  is_active: number
  can_view_sensitive: number
  permissions_count: number
}

export type AdminAccountHealthIssue = {
  kind: string
  severity: 'warning' | 'error' | string
  user_id?: number | null
  display_name?: string | null
  email?: string | null
  phone?: string | null
  title: string
  details: string
}

export type AdminRestrictedAccount = {
  user_id: number
  display_name?: string | null
  email?: string | null
  phone?: string | null
  states: string[]
  banned_until?: string | null
}

export type AdminAccountHealthScan = {
  ok: boolean
  summary: {
    scanned_users: number
    target_user_id?: number | null
    restricted_users: number
    banned_users: number
    frozen_users: number
    unapproved_users: number
    temp_banned_users: number
    active_blocked_session_issues: number
    staff_permission_issues: number
    wallet_integrity_issues: number
    linkage_issues: number
    earning_transfer_issues: number
    zero_balance_issues: number
    issues_total: number
    scanned_at: string
  }
  restricted_accounts: AdminRestrictedAccount[]
  issues: AdminAccountHealthIssue[]
}

export type KycSubmissionRow = {
  id: number
  user_id: number
  id_document_path: string
  selfie_path: string
  review_status: string
  rejection_reason?: string | null
  full_name_match_score?: number | null
  face_match_score?: number | null
  aml_risk_level?: 'low' | 'medium' | 'high'
  auto_review_at?: string | null
  reviewed_note?: string | null
  reviewed_by?: number | null
  reviewed_at?: string | null
  created_at: string
  display_name?: string | null
  email?: string | null
  phone?: string | null
  verification_status?: string
  is_approved?: number
}

export type KycWatchlistItem = {
  id: number
  user_id?: number | null
  note: string
  source?: string | null
  is_active: number
  created_by?: number | null
  created_at: string
}

export type RecoveryCodeReviewRequestItem = {
  id: number
  user_id: number
  recovery_code: string
  request_status: 'pending' | 'approved' | 'rejected' | string
  request_note?: string | null
  contact_channel?: string | null
  contact_value?: string | null
  submitted_ip?: string | null
  submitted_user_agent?: string | null
  reviewed_by?: number | null
  reviewed_at?: string | null
  created_at: string
  updated_at?: string | null
  display_name?: string | null
  email?: string | null
  phone?: string | null
}

export type OwnerMonthlyFinanceReport = {
  month: string
  mining: {
    subscriberCount: number
    subscriptionCount: number
    totalOriginalSubscriptions: number
    items: Array<{
      user_id: number
      display_name?: string | null
      email?: string | null
      phone?: string | null
      subscription_count: number
      original_subscription_total: number
      first_subscription_at?: string | null
      last_subscription_at?: string | null
    }>
  }
  deposits: {
    depositorCount: number
    depositsCount: number
    totalDeposits: number
    items: Array<{
      user_id: number
      display_name?: string | null
      email?: string | null
      phone?: string | null
      deposits_count: number
      total_deposits: number
      first_deposit_at?: string | null
      last_deposit_at?: string | null
    }>
  }
}

export async function getSecurityOverview() {
  return apiFetch('/api/owner-growth/security/overview') as Promise<SecurityOverview>
}

export async function getSecuritySessions(userId?: number) {
  const query = userId ? `?userId=${encodeURIComponent(String(userId))}` : ''
  return apiFetch(`/api/owner-growth/security/sessions${query}`) as Promise<{ items: UserSessionItem[] }>
}

export async function revokeAllUserSessions(userId: number) {
  return apiFetch('/api/owner-growth/security/revoke-all-sessions', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  }) as Promise<{ ok: boolean }>
}

export async function updateUserTwoFactor(userId: number, enabled: boolean, forAdminActions = false) {
  return apiFetch('/api/owner-growth/security/two-factor', {
    method: 'POST',
    body: JSON.stringify({ userId, enabled: enabled ? 1 : 0, forAdminActions: forAdminActions ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function runUnusualActivityDetection() {
  return apiFetch('/api/owner-growth/security/detect-unusual', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; alertsCreated: number }>
}

export async function getAdminStaffList() {
  return apiFetch('/api/owner-growth/staff/list') as Promise<{ items: AdminStaffItem[] }>
}

export async function createAdminStaff(payload: {
  identifier: string
  password: string
  adminRole: 'super_admin' | 'admin' | 'finance' | 'support' | 'moderator'
  accessPreset: 'read_only' | 'finance' | 'kyc' | 'trading' | 'marketing' | 'support' | 'full_admin'
  displayName?: string
}) {
  return apiFetch('/api/owner-growth/staff/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; userId: number }>
}

export async function updateAdminStaffRole(userId: number, adminRole: 'super_admin' | 'admin' | 'finance' | 'support' | 'moderator', enabled = true) {
  return apiFetch('/api/owner-growth/staff/role', {
    method: 'POST',
    body: JSON.stringify({ userId, adminRole, enabled: enabled ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function replaceAdminStaffPermissions(userId: number, permissions: string[]) {
  return apiFetch('/api/owner-growth/staff/permissions/set', {
    method: 'POST',
    body: JSON.stringify({ userId, permissions }),
  }) as Promise<{ ok: boolean }>
}

export async function setAdminSensitiveAccess(userId: number, canViewSensitive: boolean) {
  return apiFetch('/api/owner-growth/staff/sensitive-access', {
    method: 'POST',
    body: JSON.stringify({ userId, canViewSensitive: canViewSensitive ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function runAdminAccountHealthScan(payload?: { userId?: number }) {
  return apiFetch('/api/owner-growth/staff/account-health-scan', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  }) as Promise<AdminAccountHealthScan>
}

export async function getOwnerKycSubmissions(params: { status?: string; q?: string } = {}) {
  const query = new URLSearchParams()
  if (params.status) query.set('status', params.status)
  if (params.q) query.set('q', params.q)
  return apiFetch(`/api/owner-growth/kyc/submissions${query.toString() ? `?${query.toString()}` : ''}`) as Promise<{ items: KycSubmissionRow[] }>
}

export async function reviewOwnerKycSubmission(payload: {
  submissionId: number
  decision: 'approve' | 'reject' | 'auto'
  rejectionReason?: string
  reviewedNote?: string
  fullNameMatchScore?: number
  faceMatchScore?: number
  amlRiskLevel?: 'low' | 'medium' | 'high'
}) {
  return apiFetch('/api/owner-growth/kyc/review', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; autoReviewAt?: string; delayMinutes?: number }>
}

export async function processAutoKycReviews() {
  return apiFetch('/api/owner-growth/kyc/process-auto', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; approvedCount: number }>
}

export async function getKycWatchlist() {
  return apiFetch('/api/owner-growth/kyc/watchlist') as Promise<{ items: KycWatchlistItem[] }>
}

export async function addKycWatchlistEntry(payload: { userId?: number; note: string; source?: string }) {
  return apiFetch('/api/owner-growth/kyc/watchlist', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean }>
}

export async function toggleKycWatchlistEntry(id: number, isActive: boolean) {
  return apiFetch('/api/owner-growth/kyc/watchlist/toggle', {
    method: 'POST',
    body: JSON.stringify({ id, isActive: isActive ? 1 : 0 }),
  }) as Promise<{ ok: boolean }>
}

export async function getRecoveryCodeReviewRequests(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch(`/api/owner-growth/recovery-code-requests${query}`) as Promise<{ items: RecoveryCodeReviewRequestItem[] }>
}

export async function reviewRecoveryCodeRequest(payload: { id: number; decision: 'approve' | 'reject'; note?: string }) {
  return apiFetch('/api/owner-growth/recovery-code-requests/review', {
    method: 'POST',
    body: JSON.stringify({
      requestId: payload.id,
      decision: payload.decision,
      requestNote: payload.note,
    }),
  }) as Promise<{ ok: boolean }>
}

export async function getOwnerMonthlyFinanceReport(month?: string) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  return apiFetch(`/api/owner-growth/reports/monthly-finance${query}`) as Promise<OwnerMonthlyFinanceReport>
}

export type RewardTierRule = {
  minBalance: number
  maxBalance: number | null
  percent: number
}

export type TaskRewardCodeItem = {
  id: number
  code: string
  title: string
  description?: string
  basePercent: number
  tiers: RewardTierRule[]
  maxRewardAmount: number
  isActive: boolean
  alreadyUsed?: boolean
  createdAt?: string
  updatedAt?: string
}

export type StrategyCodeFeatureType = 'trial_trade' | 'promo_bonus'
export type StrategyCodeRewardMode = 'percent' | 'fixed'

export type StrategyCodeItem = {
  id: number
  code: string
  title: string
  description?: string
  expertName?: string
  featureType: StrategyCodeFeatureType
  rewardMode: StrategyCodeRewardMode
  rewardValue: number
  assetSymbol: string
  tradeReturnPercent: number
  expiresAt?: string | null
  isActive: boolean
  alreadyUsed?: boolean
  usage?: StrategyCodeUsage | null
  createdAt?: string
  updatedAt?: string
}

export type StrategyCodeUsage = {
  id: number
  status: string
  selectedSymbol: string
  balanceSnapshot: number
  stakeAmount: number
  entryPrice?: number | null
  exitPrice?: number | null
  rewardValue: number
  tradeReturnPercent: number
  confirmedAt?: string | null
  settledAt?: string | null
  usedAt?: string | null
  strategyCode?: string
  expertName?: string
  autoSettleAt?: string | null
  settleDelayMs?: number | null
}

export type StrategyCodeAdminItem = StrategyCodeItem & {
  createdBy?: number | null
  createdByName?: string | null
  usageCount: number
  consumedCount: number
}

export type StrategyCodeUsageAdminItem = {
  id: number
  codeId: number
  userId: number
  userDisplayName?: string | null
  userEmail?: string | null
  userPhone?: string | null
  status: string
  selectedSymbol: string
  balanceSnapshot: number
  stakeAmount: number
  rewardValue: number
  tradeReturnPercent: number
  expertName?: string
  entryPrice?: number | null
  exitPrice?: number | null
  confirmedAt?: string | null
  settledAt?: string | null
  usedAt?: string | null
}

export async function getTaskCodesMy() {
  return apiFetch('/api/tasks/codes/my') as Promise<{ items: TaskRewardCodeItem[] }>
}

export async function redeemTaskCode(code: string) {
  return apiFetch('/api/tasks/codes/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }) as Promise<{ ok: boolean; rewardAmount: number; rewardPercent: number; balanceSnapshot: number }>
}

export async function getTaskCodesAdmin() {
  return apiFetch('/api/tasks/admin/codes') as Promise<{ items: TaskRewardCodeItem[] }>
}

export async function upsertTaskCodeAdmin(payload: {
  id?: number
  code: string
  title: string
  description?: string
  basePercent: number
  tiers: RewardTierRule[]
  maxRewardAmount?: number
  isActive: boolean
}) {
  return apiFetch('/api/tasks/admin/codes', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; id: number }>
}

export async function toggleTaskCodeAdmin(id: number, isActive: boolean) {
  return apiFetch(`/api/tasks/admin/codes/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ isActive }),
  }) as Promise<{ ok: boolean }>
}

export async function deleteTaskCodeAdmin(id: number) {
  return apiFetch(`/api/tasks/admin/codes/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>
}

export async function getMyStrategyCodes() {
  return apiFetch('/api/tasks/strategy-codes/my') as Promise<{ items: StrategyCodeItem[] }>
}

export async function previewStrategyCode(code: string, symbol?: string) {
  return apiFetch('/api/tasks/strategy-codes/preview', {
    method: 'POST',
    body: JSON.stringify({ code, symbol }),
  }) as Promise<{
    ok: boolean
    codeId: number
    title: string
    description?: string
    expertName?: string
    featureType: StrategyCodeFeatureType
    assetSymbol: string
    currentPrice: number
    requiresConfirmation: boolean
    preview: {
      action: 'trial_trade' | 'promo_bonus'
      stakeAmount?: number
      tradeReturnPercent?: number
      rewardMode?: StrategyCodeRewardMode
      rewardValue?: number
      rewardAmount?: number
      balanceSnapshot: number
      confirmationMessage: string
    }
  }>
}

export async function redeemStrategyCode(payload: { code: string; symbol?: string; confirmed: boolean }) {
  return apiFetch('/api/tasks/strategy-codes/redeem', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{
    ok: boolean
    codeId: number
    usageId: number
    featureType: StrategyCodeFeatureType
    status: string
    assetSymbol?: string
    stakeAmount?: number
    tradeReturnPercent?: number
    entryPrice?: number
    strategyCode?: string
    expertName?: string
    autoSettleAt?: string | null
    settleDelayMs?: number | null
    rewardAmount?: number
    balanceAfter: number
  }>
}

export async function settleStrategyTrade(usageId: number) {
  return apiFetch(`/api/tasks/strategy-codes/${usageId}/settle`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{
    ok: boolean
    usageId: number
    status: string
    exitPrice: number
    payoutAmount: number
    profitAmount: number
    balanceAfter: number
    availableAt?: string | null
  }>
}

export async function getStrategyCodesAdmin() {
  return apiFetch('/api/tasks/admin/strategy-codes') as Promise<{
    items: StrategyCodeAdminItem[]
    usages: StrategyCodeUsageAdminItem[]
  }>
}

export async function upsertStrategyCodeAdmin(payload: {
  id?: number
  code: string
  title: string
  description?: string
  expertName?: string
  featureType: StrategyCodeFeatureType
  rewardMode: StrategyCodeRewardMode
  rewardValue: number
  assetSymbol: string
  tradeReturnPercent: number
  expiresAt?: string | null
  isActive: boolean
}) {
  return apiFetch('/api/tasks/admin/strategy-codes', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<{ ok: boolean; id: number }>
}

export async function toggleStrategyCodeAdmin(id: number, isActive: boolean) {
  return apiFetch(`/api/tasks/admin/strategy-codes/${id}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ isActive }),
  }) as Promise<{ ok: boolean }>
}

export async function deleteStrategyCodeAdmin(id: number) {
  return apiFetch(`/api/tasks/admin/strategy-codes/${id}`, { method: 'DELETE' }) as Promise<{ ok: boolean }>
}

export type MiningMediaItem = {
  id: string
  type: 'image' | 'video'
  url: string
  title?: string
  enabled: boolean
  order: number
}

export type MiningConfig = {
  minSubscription: number
  planOptions: number[]
  emergencyFeePercent: number
  dailyTiers: RewardTierRule[]
  monthlyTiers: RewardTierRule[]
  mediaItems: MiningMediaItem[]
}

export type MiningProfile = {
  id: number
  user_id: number
  status: 'inactive' | 'active' | 'cancelled_pending_release'
  currency: string
  principal_amount: number
  daily_percent: number
  monthly_percent: number
  emergency_fee_percent: number
  started_at?: string | null
  monthly_lock_until?: string | null
  last_daily_claim_at?: string | null
  daily_profit_claimed_total: number
  monthly_profit_accrued_total: number
  cancel_requested_at?: string | null
  principal_release_at?: string | null
  principal_released_at?: string | null
  emergency_withdrawn_at?: string | null
  daily_claimable: number
  monthly_accrued_live: number
  can_release_principal: boolean
  personal_balance: number
}

export async function getMiningMy() {
  return apiFetch('/api/mining/my') as Promise<{ config: MiningConfig; mediaItems: MiningMediaItem[]; profile: MiningProfile | null }>
}

export async function subscribeMining(amount: number) {
  return apiFetch('/api/mining/subscribe', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }) as Promise<{ ok: boolean; action?: 'subscribe' | 'increase'; principalAmount?: number }>
}

export async function claimMiningDaily() {
  return apiFetch('/api/mining/claim-daily', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; claimedAmount: number }>
}

export async function cancelMining() {
  return apiFetch('/api/mining/cancel', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; releaseAt: string }>
}

export async function releaseMiningPrincipal() {
  return apiFetch('/api/mining/release-principal', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; releasedAmount: number }>
}

export async function emergencyWithdrawMining() {
  return apiFetch('/api/mining/emergency-withdraw', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ok: boolean; netAmount: number; feeAmount: number; feePercent: number }>
}

export async function getMiningAdminConfig() {
  return apiFetch('/api/mining/admin/config') as Promise<{ config: MiningConfig }>
}

export async function updateMiningAdminConfig(config: MiningConfig) {
  return apiFetch('/api/mining/admin/config', {
    method: 'POST',
    body: JSON.stringify({ config }),
  }) as Promise<{ ok: boolean; config: MiningConfig }>
}

export async function uploadMiningMediaAdmin(file: File) {
  const token = getToken()
  const form = new FormData()
  form.append('media', file)
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch('/api/mining/admin/media-upload', { method: 'POST', headers, body: form })
  const body = await res.json()
  if (!res.ok) {
    const code = resolveErrorCodeFromBody(body)
    throw createApiError(code, body)
  }
  return body as { ok: boolean; url: string; type: 'image' | 'video' }
}

