import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Wallet, ArrowDownLeft, ArrowUpRight, Sparkles, Crown, Megaphone, Settings, Shield, FileSearch, UserCog } from 'lucide-react'
import type { AuthUser } from '../../api'
import { useI18n } from '../../i18nCore'
import { ownerNavItems } from '../../owner/navConfig'
import { PERMISSIONS, resolveEffectivePermissions, type AdminRole } from '../../owner/permissions'

type OwnerLayoutProps = {
  user: AuthUser
  children: React.ReactNode
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  gauge: LayoutDashboard,
  users: Users,
  wallet: Wallet,
  'arrow-down': ArrowDownLeft,
  'arrow-up': ArrowUpRight,
  sparkles: Sparkles,
  crown: Crown,
  megaphone: Megaphone,
  settings: Settings,
  shield: Shield,
  'file-search': FileSearch,
  'user-cog': UserCog,
}

function resolveAdminRole(user: AuthUser): AdminRole {
  if (user.role === 'owner') return 'owner'
  const staffRole = (user as unknown as { admin_role?: string }).admin_role
  if (!staffRole) return 'analyst_read_only'
  switch (staffRole) {
    case 'super_admin':
    case 'finance_admin':
    case 'support_admin':
    case 'operations_admin':
    case 'moderator':
    case 'analyst_read_only':
      return staffRole
    default:
      return 'analyst_read_only'
  }
}

export function OwnerLayout({ user, children }: OwnerLayoutProps) {
  const { t } = useI18n()
  const role = resolveAdminRole(user)
  const effectivePermissions = resolveEffectivePermissions({
    role,
    explicitPermissions: role === 'owner' ? Object.values(PERMISSIONS) : undefined,
  })

  const items = ownerNavItems.filter((item) => {
    if (!item.permission) return true
    return effectivePermissions.has(item.permission)
  })

  return (
    <div className="owner-shell flex min-h-screen bg-[#050713] text-white">
      <aside className="owner-sidebar hidden w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] px-3 py-4 md:flex">
        <div className="mb-4 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
            <LayoutDashboard size={18} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
              {t('owner_brand_suite')}
            </p>
            <p className="truncate text-[11px] text-white/55">{t('owner_only_protected')}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto pb-4">
          {items.map((item) => {
            const Icon = iconMap[item.icon] || LayoutDashboard
            return (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  [
                    'owner-nav-item flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                  ].join(' ')
                }
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="truncate">{t(item.labelKey)}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-3 text-[11px] text-white/55">
          <p className="truncate">{user.display_name || user.email || `ID #${user.id}`}</p>
          <p className="truncate text-white/35">{`Role: ${role}`}</p>
        </div>
      </aside>
      <main className="owner-main flex min-h-screen flex-1 flex-col bg-[#050713]">
        <header className="owner-header sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#050713]/90 px-4 py-3 backdrop-blur">
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-[0.22em] text-white/60">
              {t('owner_dashboard_title')}
            </h1>
            <p className="text-[11px] text-white/45">{t('owner_dashboard_subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="truncate">{t('owner_only_protected')}</span>
          </div>
        </header>
        <div className="owner-content flex-1 px-3 py-4 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </main>
    </div>
  )
}

