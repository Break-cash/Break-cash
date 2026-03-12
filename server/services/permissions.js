import { get } from '../db.js'

export const AVAILABLE_PERMISSIONS = [
  'manage_balances',
  'manage_users',
  'manage_invites',
  'view_reports',
  'manage_permissions',
]

export async function hasPermission(db, userId, permission) {
  const user = await get(db, `SELECT role FROM users WHERE id = ? LIMIT 1`, [userId])
  if (!user) return false
  if (user.role === 'admin' || user.role === 'owner') return true

  const granted = await get(
    db,
    `SELECT id FROM permissions WHERE user_id = ? AND permission = ? LIMIT 1`,
    [userId, permission],
  )
  return !!granted
}
