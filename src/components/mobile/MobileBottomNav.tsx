import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChartNoAxesCombined,
  Crown,
  Grid2x2,
  House,
  Pickaxe,
  Shield,
  Zap,
  Wallet,
} from 'lucide-react'
import { useFrameRateProfile } from '../../hooks/useFrameRateProfile'
import { useI18n } from '../../i18nCore'

const MINING_NAV_PULSE_EVENT = 'breakcash:mining-nav-pulse'

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
  const { scaleDuration } = useFrameRateProfile()
  const [miningPulseTick, setMiningPulseTick] = useState(0)

  const navItems = useMemo(
    () => [
      { id: 'home', to: '/portfolio', label: t('nav_home'), icon: 'house', isFab: false },
      { id: 'mining', to: '/mining', label: t('nav_mining'), icon: 'pickaxe', isFab: false },
      { id: 'tasks', to: '/futures', label: t('nav_tasks'), icon: 'zap', isFab: true },
      { id: 'assets', to: '/wallet', label: t('nav_wallet'), icon: 'wallet', isFab: false },
      { id: 'markets', to: '/market', label: t('nav_markets'), icon: 'grid', isFab: false },
    ],
    [t],
  )

  useEffect(() => {
    const handleMiningPulse = () => {
      const tick = Date.now()
      setMiningPulseTick(tick)
      window.setTimeout(() => {
        setMiningPulseTick((current) => (current === tick ? 0 : current))
      }, 1600)
    }

    window.addEventListener(MINING_NAV_PULSE_EVENT, handleMiningPulse)
    return () => {
      window.removeEventListener(MINING_NAV_PULSE_EVENT, handleMiningPulse)
    }
  }, [])

  const iconById = {
    wallet: Wallet,
    chart: ChartNoAxesCombined,
    pickaxe: Pickaxe,
    house: House,
    zap: Zap,
    grid: Grid2x2,
  } as const

  return (
    <motion.nav
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: scaleDuration(0.3), ease: 'easeOut' }}
      className="fixed inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-50 px-2 lg:px-4"
      aria-label={t('nav_mobile') || 'Mobile navigation'}
    >
      <div className="glass-panel elite-enter elite-shine relative mx-auto w-full max-w-[980px] rounded-[24px] border border-amber-200/10 bg-[linear-gradient(180deg,rgba(8,12,22,0.96),rgba(6,10,18,0.92))] px-2.5 pb-2 pt-2 shadow-[0_20px_46px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl lg:rounded-[28px] lg:px-4 lg:pb-3 lg:pt-3">
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
          {navItems.map((item) => {
            const isFab = Boolean(item.isFab)
            const isCenterActive = String(item.id).toLowerCase() === 'tasks'
            const isActive = isCenterActive
            const isMiningItem = String(item.id).toLowerCase() === 'mining'
            const Icon =
              item.icon === 'bcmark'
                ? null
                : (iconById[item.icon as keyof typeof iconById] ?? House)

            return (
              <Link
                key={`${item.id}-${item.to}`}
                to={item.to}
                className={`elite-hover-lift relative flex min-w-0 flex-1 flex-col items-center justify-end rounded-2xl px-1 pb-1 pt-0.5 transition ${
                  isFab ? '-translate-y-2' : ''
                } ${isActive ? 'text-amber-200' : 'text-slate-300/70 hover:text-slate-200'}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <motion.span
                  aria-hidden="true"
                  key={isMiningItem ? `mining-pulse-${miningPulseTick || 'idle'}` : `nav-icon-${item.id}`}
                  className={`relative inline-flex items-center justify-center ${
                    isFab
                      ? 'h-[60px] w-[60px] rounded-[22px] border border-amber-300/55 bg-[linear-gradient(180deg,rgba(21,26,42,0.98),rgba(12,16,28,0.95))] shadow-[0_0_28px_rgba(245,158,11,0.22),0_16px_34px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,223,163,0.25)]'
                      : `h-9 w-9 rounded-full border ${
                          isActive
                            ? 'border-amber-300/50 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.18)]'
                            : 'border-[var(--border-soft)] bg-white/[0.04]'
                        }`
                  }`}
                  animate={
                    isMiningItem && miningPulseTick
                      ? {
                          scale: [1, 1.18, 0.98, 1.08, 1],
                          boxShadow: [
                            '0 0 0 rgba(14,165,233,0)',
                            '0 0 0 8px rgba(14,165,233,0.10), 0 0 24px rgba(59,130,246,0.30)',
                            '0 0 0 rgba(14,165,233,0)',
                          ],
                        }
                      : undefined
                  }
                  transition={{ duration: 1.15, ease: 'easeOut' }}
                >
                  {isFab ? (
                    Icon ? (
                      <Icon
                        size={26}
                        strokeWidth={1.8}
                        className={isActive ? 'text-amber-300' : 'text-slate-200/80'}
                      />
                    ) : (
                      <span className="crypto-bottom-nav-bcmark" aria-hidden="true">
                        BC
                      </span>
                    )
                  ) : (
                    Icon && (
                      <Icon
                        size={22}
                        strokeWidth={1.8}
                        className={isActive ? 'text-amber-200' : 'text-slate-300/80'}
                      />
                    )
                  )}
                </motion.span>

                <span
                  className={`mb-1 mt-2 h-1 w-5 rounded-full ${
                    isActive && !isFab ? 'bg-amber-300/80' : 'bg-transparent'
                  }`}
                />

                <span
                  className={`text-[11px] leading-tight ${
                    isActive ? 'font-semibold text-amber-200' : 'text-slate-300/70'
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
