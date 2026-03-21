import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CandlestickChart,
  ChartNoAxesCombined,
  Crown,
  House,
  Pickaxe,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react'
import {
  getMobileNavConfig,
  type MobileNavConfigItem,
} from '../../api'
import { useI18n } from '../../i18nCore'

type ManagementShortcut = {
  to: string
  label: string
  count: number
  kind: 'owner' | 'admin'
}

type MobileBottomNavProps = {
  managementShortcut?: ManagementShortcut | null
}

export function MobileBottomNav({ managementShortcut = null }: MobileBottomNavProps) {
  const { t, direction } = useI18n()
  const location = useLocation()
  const [navItems, setNavItems] = useState<MobileNavConfigItem[]>([])

  const defaultNavItems = useMemo<MobileNavConfigItem[]>(
    () => [
      { id: 'home', to: '/portfolio', label: t('nav_home'), icon: 'house', isFab: false },
      { id: 'tasks', to: '/futures', label: t('nav_tasks'), icon: 'candlestick', isFab: true },
      { id: 'mining', to: '/mining', label: t('nav_mining'), icon: 'pickaxe', isFab: false },
      { id: 'assets', to: '/assets', label: t('wallet_assets'), icon: 'wallet', isFab: false },
      { id: 'markets', to: '/market', label: t('nav_markets'), icon: 'candlestick', isFab: false },
    ],
    [t],
  )

  useEffect(() => {
    let isMounted = true

    getMobileNavConfig()
      .then((res) => {
        if (!isMounted) return

        const items =
          res?.customized &&
          Array.isArray(res.items) &&
          res.items.length === 5
            ? res.items
            : []

        setNavItems(items)
      })
      .catch(() => {
        if (isMounted) setNavItems([])
      })

    return () => {
      isMounted = false
    }
  }, [])

  const effectiveNavItems = useMemo(() => {
    const sourceItems = navItems.length === 5 ? navItems : defaultNavItems
    const items = [...sourceItems]

    const tasksIndex = items.findIndex(
      (item) => String(item.id).toLowerCase() === 'tasks',
    )

    if (tasksIndex < 0) return items

    const [tasksItem] = items.splice(tasksIndex, 1)
    const middleIndex = Math.floor(items.length / 2)
    items.splice(middleIndex, 0, tasksItem)

    return items
  }, [defaultNavItems, navItems])

  const iconById = {
    wallet: Wallet,
    chart: ChartNoAxesCombined,
    pickaxe: Pickaxe,
    house: House,
    candlestick: CandlestickChart,
    sparkles: Sparkles,
  } as const

  const isItemActive = (to: string) => {
    return location.pathname === to || location.pathname.startsWith(`${to}/`)
  }

  return (
    <motion.nav
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-50 px-2 lg:px-4"
      aria-label={t('nav_mobile') || 'Mobile navigation'}
    >
      <div className="glass-panel elite-enter elite-shine relative mx-auto w-full max-w-[980px] rounded-[24px] px-2.5 pb-2 pt-2 backdrop-blur-2xl lg:rounded-[28px] lg:px-4 lg:pb-3 lg:pt-3">
        {managementShortcut ? (
          <Link
            to={managementShortcut.to}
            className="elite-hover-lift absolute -top-5 end-3 inline-flex items-center gap-2 rounded-2xl border border-brand-blue/45 bg-[#0d1426]/95 px-3 py-2 text-white shadow-[0_18px_42px_rgba(0,0,0,0.32)] backdrop-blur-2xl lg:-top-6 lg:px-4"
            aria-label={managementShortcut.label}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-blue/35 bg-brand-blue/18 text-white">
              {managementShortcut.kind === 'owner' ? <Crown size={18} /> : <Shield size={18} />}
            </span>
            <span className="hidden text-xs font-semibold sm:inline">{managementShortcut.label}</span>
            <span className="inline-flex min-w-[26px] items-center justify-center rounded-full bg-brand-blue px-2 py-1 text-[11px] font-bold text-white">
              {managementShortcut.count}
            </span>
          </Link>
        ) : null}
        <div
          className={`flex items-end justify-between gap-1 ${
            direction === 'rtl' ? 'flex-row-reverse' : ''
          }`}
        >
          {effectiveNavItems.map((item) => {
            const isActive = isItemActive(item.to)
            const isFab = Boolean(item.isFab)
            const Icon =
              item.icon === 'bcmark'
                ? null
                : (iconById[item.icon as keyof typeof iconById] ?? House)

            return (
              <Link
                key={`${item.id}-${item.to}`}
                to={item.to}
                className={`elite-hover-lift relative flex min-w-0 flex-1 flex-col items-center justify-end rounded-2xl px-1 pb-1 pt-0.5 text-white/70 transition ${
                  isFab ? '-translate-y-4' : ''
                } ${isActive ? 'text-white' : 'hover:text-white/90'}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  aria-hidden="true"
                  className={`relative inline-flex items-center justify-center ${
                    isFab
                      ? 'h-[58px] w-[58px] rounded-full border border-[var(--border-glass)] bg-gradient-to-b from-[var(--bg-elevated)] to-[var(--bg-base)] shadow-[var(--shadow-card),var(--glow-blue),inset_0_1px_0_rgba(255,255,255,0.12)]'
                      : `h-9 w-9 rounded-full border ${
                          isActive
                            ? 'elite-active-glow border-[var(--border-blue)] bg-brand-blue/20 shadow-[var(--shadow-inner),var(--glow-blue)]'
                            : 'border-[var(--border-soft)] bg-white/[0.04]'
                        }`
                  }`}
                >
                  {isFab ? (
                    Icon ? (
                      <Icon
                        size={28}
                        strokeWidth={1.8}
                        className={isActive ? 'text-white' : 'text-white/75'}
                      />
                    ) : (
                      <span className="crypto-bottom-nav-bcmark" aria-hidden="true">
                        BC
                      </span>
                    )
                  ) : (
                    Icon && (
                      <Icon
                        size={24}
                        strokeWidth={1.8}
                        className={isActive ? 'text-white' : 'text-white/75'}
                      />
                    )
                  )}
                </span>

                <span
                  className={`mb-1 mt-2 h-1 w-5 rounded-full ${
                    isActive && !isFab ? 'bg-brand-blue/80' : 'bg-transparent'
                  }`}
                />

                <span
                  className={`text-[11px] leading-tight ${
                    isActive ? 'font-semibold text-white' : 'text-white/70'
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </motion.nav>
  )
}
