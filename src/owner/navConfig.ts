import type { PermissionKey } from './permissions'

export type OwnerNavSectionId =
  | 'dashboard'
  | 'users'
  | 'referrals'
  | 'tasks_mining'
  | 'admin_accounts'

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
    path: '/owner/operations',
    icon: 'gauge',
    section: 'dashboard',
  },
  {
    id: 'users',
    labelKey: 'owner_nav_users',
    path: '/admin/users',
    icon: 'users',
    section: 'users',
  },
  {
    id: 'referrals',
    labelKey: 'admin_invites',
    path: '/admin/invites',
    icon: 'users',
    section: 'referrals',
  },
  {
    id: 'tasks_mining',
    labelKey: 'owner_quick_operations',
    path: '/owner/operations',
    icon: 'sparkles',
    section: 'tasks_mining',
  },
  {
    id: 'staff',
    labelKey: 'owner_nav_staff_permissions',
    path: '/admin/permissions',
    icon: 'shield',
    section: 'admin_accounts',
  },
]

