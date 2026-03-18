import type { PermissionKey } from './permissions'

export type OwnerNavSectionId =
  | 'dashboard'
  | 'users'
  | 'finance'
  | 'deposits'
  | 'withdrawals'
  | 'referrals'
  | 'vip'
  | 'tasks_mining'
  | 'promos'
  | 'settings'
  | 'admin_accounts'
  | 'audit'

export type OwnerNavItem = {
  id: string
  labelKey: string
  path: string
  icon: string
  section: OwnerNavSectionId
  permission?: PermissionKey
}

export const ownerNavItems: OwnerNavItem[] = [
  {
    id: 'overview',
    labelKey: 'owner_nav_overview',
    path: '/owner',
    icon: 'gauge',
    section: 'dashboard',
  },
  {
    id: 'users',
    labelKey: 'owner_nav_users',
    path: '/owner/users',
    icon: 'users',
    section: 'users',
  },
  {
    id: 'wallets',
    labelKey: 'owner_nav_wallets',
    path: '/owner/wallet',
    icon: 'wallet',
    section: 'finance',
  },
  {
    id: 'deposits',
    labelKey: 'owner_nav_deposits',
    path: '/owner/deposits',
    icon: 'arrow-down',
    section: 'deposits',
  },
  {
    id: 'withdrawals',
    labelKey: 'owner_nav_withdrawals',
    path: '/owner/withdrawals',
    icon: 'arrow-up',
    section: 'withdrawals',
  },
  {
    id: 'referrals',
    labelKey: 'owner_nav_referrals',
    path: '/owner/referrals',
    icon: 'users-round',
    section: 'referrals',
  },
  {
    id: 'vip',
    labelKey: 'owner_nav_vip',
    path: '/owner/vip',
    icon: 'crown',
    section: 'vip',
  },
  {
    id: 'tasks_mining',
    labelKey: 'owner_nav_trades',
    path: '/owner/features',
    icon: 'sparkles',
    section: 'tasks_mining',
  },
  {
    id: 'promos',
    labelKey: 'owner_nav_assets',
    path: '/owner/promos',
    icon: 'megaphone',
    section: 'promos',
  },
  {
    id: 'settings',
    labelKey: 'owner_nav_settings',
    path: '/owner/settings',
    icon: 'settings',
    section: 'settings',
  },
  {
    id: 'staff',
    labelKey: 'owner_nav_staff_permissions',
    path: '/owner/staff',
    icon: 'shield',
    section: 'admin_accounts',
  },
  {
    id: 'audit',
    labelKey: 'audit_log_title',
    path: '/owner/audit',
    icon: 'file-search',
    section: 'audit',
  },
]

