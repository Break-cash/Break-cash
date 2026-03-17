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
  created_at?: string
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
  ts?: number
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
  const body = contentType.includes('application/json') ? await res.json() : await res.text()

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
    body: JSON.stringify({ identifier, password }),
  }) as Promise<{ token: string; user: AuthUser }>
}

export async function registerAccount(identifier: string, password: string) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  }) as Promise<{ token: string; user: AuthUser }>
}

export async function registerWithInvite(
  identifier: string,
  password: string,
  inviteCode: string,
) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ identifier, password, inviteCode }),
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

export type PromoBannerItem = {
  id: string
  title: string
  subtitle: string
  ctaLabel?: string
  to?: string
  imageUrl?: string
  backgroundStyle?: string
  order?: number
  placement: 'all' | 'home' | 'profile' | 'mining'
  enabled: boolean
}

export async function getPromoBanners() {
  return apiFetch('/api/settings/promo-banners') as Promise<{ items: PromoBannerItem[]; customized?: boolean }>
}

export async function updatePromoBanners(items: PromoBannerItem[]) {
  return apiFetch('/api/settings/promo-banners', {
    method: 'POST',
    body: JSON.stringify({ items }),
  }) as Promise<{ ok: boolean; items: PromoBannerItem[] }>
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

  const res = await fetch('/api/settings/asset-image', {
    method: 'POST',
    headers,
    body: form,
  })
  const body = await res.json()
  if (!res.ok) {
    const code = resolveErrorCodeFromBody(body)
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

  const res = await fetch('/api/profile/avatar/user', {
    method: 'POST',
    headers,
    body: form,
  })
  const body = await res.json()
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
  tradingBalance?: number
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

export async function updateBalanceRules(rules: BalanceRules) {
  return apiFetch('/api/balance/rules', {
    method: 'POST',
    body: JSON.stringify({ rules }),
  }) as Promise<{ ok: boolean; rules: BalanceRules }>
}

export async function getWithdrawSummaryMy(currency = 'USDT') {
  return apiFetch(`/api/balance/withdraw-summary/my?currency=${encodeURIComponent(currency)}`) as Promise<{
    summary: WithdrawalSummary
  }>
}

export async function getWithdrawLocksMy(currency = 'USDT') {
  return apiFetch(`/api/balance/withdraw-locks/my?currency=${encodeURIComponent(currency)}`) as Promise<{
    items: PrincipalLockItem[]
    summary: WithdrawalSummary
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
  visibility_scope: 'all' | 'depositors' | 'vip' | 'vip_level'
  min_vip_level: number
  is_visible: number
  starts_at?: string | null
  ends_at?: string | null
  created_at?: string
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
  perks?: string[]
  is_active: number
}

export type UserVipTier = {
  level: number
  title: string
  min_deposit: number
  referral_percent: number
  perks: string[]
}

export type UserVipSummary = {
  currentVipLevel: number
  totalDeposit: number
  nextLevel: number | null
  nextMinDeposit: number | null
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
  totalInvitedUsers: number
  totalReferralEarnings: number
  rewardHistory: ReferralRewardHistoryItem[]
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

export async function getDailyTradeCampaigns() {
  return apiFetch('/api/owner-growth/daily-trades') as Promise<{ items: DailyTradeCampaign[] }>
}

export async function createDailyTradeCampaign(payload: {
  title: string
  symbol?: string
  side?: string
  entryPrice?: number
  takeProfit?: number
  stopLoss?: number
  successRate?: number
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

export async function getBonusRules() {
  return apiFetch('/api/owner-growth/bonus-rules') as Promise<{ items: BonusRule[] }>
}

export async function createBonusRule(payload: {
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

export async function getVipTiers() {
  return apiFetch('/api/owner-growth/vip-tiers') as Promise<{ items: VipTier[] }>
}

export async function getMyVipSummary() {
  return apiFetch('/api/rewards/vip') as Promise<UserVipSummary>
}

export async function getMyReferralSummary() {
  return apiFetch('/api/rewards/referral') as Promise<ReferralSummary>
}

export async function upsertVipTier(payload: {
  level: number
  title: string
  minDeposit: number
  minTradeVolume: number
  referralMultiplier: number
  referralPercent?: number
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
  }) as Promise<{ ok: boolean }>
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

