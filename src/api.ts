export type AuthUser = {
  id: number
  role: 'user' | 'moderator' | 'admin' | 'owner'
  email: string | null
  phone: string | null
  display_name?: string | null
  avatar_path?: string | null
  avatar_url?: string | null
  verification_status?: 'unverified' | 'pending' | 'verified'
  blue_badge?: number
  badge_color?: 'orange' | 'green' | 'blue'
  vip_level?: number
  phone_verified?: number
  identity_submitted?: number
  verification_ready_at?: string | null
  is_approved?: number
  is_banned?: number
  created_at?: string
}

const API_ERROR_MESSAGES: Record<string, string> = {
  INVALID_INPUT: 'Please check your input values and try again.',
  ALREADY_EXISTS: 'This account already exists.',
  INVALID_CREDENTIALS: 'Invalid login credentials.',
  USER_BANNED: 'This account is blocked.',
  AUTH_REQUIRED: 'Please log in first.',
  INVALID_TOKEN: 'Your session is invalid. Please log in again.',
  FORBIDDEN: 'You do not have permission for this action.',
  INVALID_INVITE: 'Invite code is invalid.',
  INVITE_UNAVAILABLE: 'Invite code is not available.',
  INVITE_EXPIRED: 'Invite code has expired.',
  FILE_REQUIRED: 'Please upload the required file.',
  FILES_REQUIRED: 'Please upload all required files.',
  INVALID_PHONE: 'Please enter a valid phone number.',
  NOT_FOUND: 'Not found.',
  ALREADY_FRIENDS: 'Already friends.',
  REQUEST_EXISTS: 'Request already sent or exists.',
  INSUFFICIENT_BALANCE: 'Insufficient balance.',
}

export function getToken() {
  return localStorage.getItem('breakcash_token')
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem('breakcash_token')
  else localStorage.setItem('breakcash_token', token)
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(path, { ...init, headers })
  const contentType = res.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const code = typeof body === 'object' && body && 'error' in body ? String(body.error) : 'REQUEST_FAILED'
    const serverMsg = typeof body === 'object' && body && 'message' in body ? String(body.message) : ''
    const msg = API_ERROR_MESSAGES[code] || serverMsg || code
    throw new Error(msg)
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

export async function getCurrentUser() {
  return apiFetch('/api/auth/me') as Promise<{ user: AuthUser }>
}

export async function getMyProfile() {
  return apiFetch('/api/profile') as Promise<{ profile: AuthUser }>
}

export async function updateMyProfile(payload: {
  email?: string | null
  phone?: string | null
  displayName?: string | null
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
  if (!res.ok) throw new Error(String(body?.error || 'REQUEST_FAILED'))
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
  if (!res.ok) throw new Error(String(body?.error || 'REQUEST_FAILED'))
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

export type FriendUser = { id: number; displayName: string; avatarUrl: string | null }
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

