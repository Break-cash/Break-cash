import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CandlestickChart,
  ChartNoAxesCombined,
  House,
  Pickaxe,
  Sparkles,
  Wallet,
} from 'lucide-react'
import {
  getMobileNavConfig,
  type MobileNavConfigItem,
} from '../../api'
import { useI18n } from '../../i18nCore'

export function MobileBottomNav() {
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
      className="fixed inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-50 px-2"
      aria-label={t('nav_mobile') || 'Mobile navigation'}
    >
      <div className="elite-enter elite-shine relative mx-auto w-full max-w-[760px] rounded-[24px] border border-white/12 bg-[var(--bg-surface)]/95 px-2.5 pb-2 pt-2 shadow-[var(--shadow-card)] backdrop-blur-2xl">
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
                      ? 'h-[58px] w-[58px] rounded-full border border-white/20 bg-gradient-to-b from-[var(--bg-elevated)] to-[var(--bg-base)] shadow-[var(--shadow-card),inset_0_1px_0_rgba(255,255,255,0.12)]'
                      : `h-9 w-9 rounded-full border ${
                          isActive
                            ? 'elite-active-glow border-[var(--border-blue)] bg-brand-blue/20 shadow-[0_0_0_2px_rgba(37,99,235,0.2)]'
                            : 'border-white/10 bg-white/[0.04]'
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
