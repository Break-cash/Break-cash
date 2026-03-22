import { get } from '../db.js'

const PROTECTED_OWNER_IDS = new Set([2, 4])
const PROTECTED_OWNER_EMAILS = new Set([
  'owner-temp-fcaaa4eb@breakcash.cash',
  'zeus@breakcash.cash',
])

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isProtectedOwnerIdentity(user) {
  if (!user) return false
  const id = Number(user.id || 0)
  const email = normalizeEmail(user.email)
  return PROTECTED_OWNER_IDS.has(id) || PROTECTED_OWNER_EMAILS.has(email)
}

export async function getProtectedOwnerStatus(db, userId) {
  const id = Number(userId || 0)
  if (!Number.isFinite(id) || id <= 0) return { exists: false, protected: false, user: null }
  const user = await get(db, `SELECT id, email, role, is_owner FROM users WHERE id = ? LIMIT 1`, [id])
  return {
    exists: Boolean(user),
    protected: isProtectedOwnerIdentity(user),
    user,
  }
}

export async function assertNotProtectedOwner(db, userId) {
  const status = await getProtectedOwnerStatus(db, userId)
  if (status.protected) {
    const error = new Error('PROTECTED_OWNER_ACCOUNT')
    error.code = 'PROTECTED_OWNER_ACCOUNT'
    throw error
  }
  return status
}

export async function blockProtectedOwnerAction(db, res, userId) {
  const status = await getProtectedOwnerStatus(db, userId)
  if (!status.protected) return false
  res.status(403).json({ error: 'PROTECTED_OWNER_ACCOUNT' })
  return true
}
