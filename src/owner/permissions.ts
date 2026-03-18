export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_EDIT: 'users.edit',
  USERS_FREEZE: 'users.freeze',
  USERS_ACTIVATE: 'users.activate',
  USERS_ADJUST_VIP: 'users.adjustVip',
  USERS_ASSIGN_BADGE: 'users.assignBadge',
  USERS_ASSIGN_PROFILE_COLOR: 'users.assignProfileColor',
  WALLET_VIEW: 'wallet.view',
  WALLET_ADJUST_BALANCE: 'wallet.adjustBalance',
  WALLET_VIEW_TRANSACTIONS: 'wallet.viewTransactions',
  DEPOSITS_VIEW: 'deposits.view',
  DEPOSITS_APPROVE: 'deposits.approve',
  DEPOSITS_REJECT: 'deposits.reject',
  WITHDRAWALS_VIEW: 'withdrawals.view',
  WITHDRAWALS_APPROVE: 'withdrawals.approve',
  WITHDRAWALS_REJECT: 'withdrawals.reject',
  REFERRALS_VIEW: 'referrals.view',
  REFERRALS_EDIT_RULES: 'referrals.editRules',
  VIP_VIEW: 'vip.view',
  VIP_EDIT_RULES: 'vip.editRules',
  MINING_VIEW: 'mining.view',
  MINING_EDIT: 'mining.edit',
  TASKS_VIEW: 'tasks.view',
  TASKS_CREATE: 'tasks.create',
  TASKS_EDIT: 'tasks.edit',
  PROMOS_VIEW: 'promos.view',
  PROMOS_EDIT: 'promos.edit',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  ROLES_VIEW: 'roles.view',
  ROLES_EDIT: 'roles.edit',
  AUDIT_VIEW: 'audit.view',
  NOTIFICATIONS_SEND: 'notifications.send',
  ADMIN_USERS_VIEW: 'adminUsers.view',
  ADMIN_USERS_CREATE: 'adminUsers.create',
  ADMIN_USERS_EDIT: 'adminUsers.edit',
  ADMIN_USERS_DISABLE: 'adminUsers.disable',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export type AdminRole =
  | 'owner'
  | 'super_admin'
  | 'finance_admin'
  | 'support_admin'
  | 'operations_admin'
  | 'moderator'
  | 'analyst_read_only'

const ROLE_PERMISSION_PRESETS: Record<AdminRole, PermissionKey[]> = {
  owner: Object.values(PERMISSIONS),
  super_admin: Object.values(PERMISSIONS),
  finance_admin: [
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.WALLET_ADJUST_BALANCE,
    PERMISSIONS.WALLET_VIEW_TRANSACTIONS,
    PERMISSIONS.DEPOSITS_VIEW,
    PERMISSIONS.DEPOSITS_APPROVE,
    PERMISSIONS.DEPOSITS_REJECT,
    PERMISSIONS.WITHDRAWALS_VIEW,
    PERMISSIONS.WITHDRAWALS_APPROVE,
    PERMISSIONS.WITHDRAWALS_REJECT,
    PERMISSIONS.AUDIT_VIEW,
  ],
  support_admin: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_EDIT,
    PERMISSIONS.USERS_FREEZE,
    PERMISSIONS.USERS_ACTIVATE,
    PERMISSIONS.REFERRALS_VIEW,
    PERMISSIONS.VIP_VIEW,
    PERMISSIONS.MINING_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.PROMOS_VIEW,
  ],
  operations_admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.DEPOSITS_VIEW,
    PERMISSIONS.WITHDRAWALS_VIEW,
    PERMISSIONS.REFERRALS_VIEW,
    PERMISSIONS.VIP_VIEW,
    PERMISSIONS.MINING_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.PROMOS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  moderator: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_FREEZE,
    PERMISSIONS.USERS_ACTIVATE,
  ],
  analyst_read_only: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.DEPOSITS_VIEW,
    PERMISSIONS.WITHDRAWALS_VIEW,
    PERMISSIONS.REFERRALS_VIEW,
    PERMISSIONS.VIP_VIEW,
    PERMISSIONS.MINING_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.PROMOS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],
}

export type AdminPermissionContext = {
  role: AdminRole
  explicitPermissions?: PermissionKey[]
}

export function resolveEffectivePermissions(ctx: AdminPermissionContext): Set<PermissionKey> {
  const base = new Set<PermissionKey>(ROLE_PERMISSION_PRESETS[ctx.role] || [])
  if (ctx.explicitPermissions) {
    for (const p of ctx.explicitPermissions) base.add(p)
  }
  return base
}

export function hasPermission(effective: Set<PermissionKey>, permission: PermissionKey): boolean {
  return effective.has(permission)
}

export function hasAnyPermission(effective: Set<PermissionKey>, permissions: PermissionKey[]): boolean {
  return permissions.some((p) => effective.has(p))
}

