import { get } from '../db.js'

export const AVAILABLE_PERMISSIONS = [
  'dashboard.overview.view',
  'users.manage',
  'wallets.manage',
  'deposits.manage',
  'withdrawals.manage',
  'trades.manage',
  'assets.manage',
  'vip.manage',
  'referrals.manage',
  'bonuses.manage',
  'kyc.manage',
  'notifications.manage',
  'marketing.manage',
  'support.manage',
  'security.manage',
  'reports.view',
  'settings.manage',
  'staff_permissions.manage',
  'manage_balances',
  'manage_users',
  'manage_invites',
  'view_reports',
  'manage_permissions',
  'انشاء مهام',
  'تعدين',
  'إدارة الصفحة الرئيسية',
]

export async function hasPermission(db, userId, permission) {
  const user = await get(db, `SELECT role FROM users WHERE id = ? LIMIT 1`, [userId])
  if (!user) return false
  if (user.role === 'owner') return true

  const granted = await get(
    db,
    `SELECT id FROM permissions WHERE user_id = ? AND permission = ? LIMIT 1`,
    [userId, permission],
  )
  return !!granted
}
