import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CandlestickChart, ChartNoAxesCombined, House, Pickaxe, Wallet } from 'lucide-react'
import { useFrameRateProfile } from '../../hooks/useFrameRateProfile'
import { useI18n } from '../../i18nCore'

export function MobileBottomNav() {
  const { t, direction } = useI18n()
  const { scaleDuration } = useFrameRateProfile()
  const location = useLocation()

  const navItems = useMemo(
    () => [
      { id: 'home', to: '/portfolio', label: t('nav_home'), icon: House },
      { id: 'markets', to: '/market', label: t('nav_markets'), icon: ChartNoAxesCombined },
      { id: 'trades', to: '/futures', label: t('nav_trades'), icon: CandlestickChart, featured: true },
      { id: 'mining', to: '/mining', label: t('nav_mining'), icon: Pickaxe },
      { id: 'wallet', to: '/wallet', label: t('nav_wallet'), icon: Wallet },
    ],
    [t],
  )

  return (
    <motion.nav
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: scaleDuration(0.3), ease: 'easeOut' }}
      className="mobile-bottom-nav-modern"
      aria-label={t('nav_mobile') || 'Mobile navigation'}
    >
      <div className={`mobile-bottom-nav-modern__inner ${direction === 'rtl' ? 'is-rtl' : ''}`}>
        <div className="mobile-bottom-nav-modern__grid">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.to === '/portfolio'
                ? location.pathname === '/portfolio'
                : item.to === '/futures'
                  ? location.pathname.startsWith('/futures') || location.pathname.startsWith('/arena')
                : location.pathname.startsWith(item.to)

            return (
              <NavLink
                key={item.id}
                to={item.to}
                className={`mobile-bottom-nav-modern__item ${
                  item.featured ? 'mobile-bottom-nav-modern__item--featured' : ''
                } ${isActive ? 'is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="mobile-bottom-nav-modern__icon-wrap">
                  <Icon size={item.featured ? 22 : 18} strokeWidth={1.9} />
                </span>
                <span className="mobile-bottom-nav-modern__label">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </div>
    </motion.nav>
  )
}
