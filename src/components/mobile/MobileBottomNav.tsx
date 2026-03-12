import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18nCore'

export function MobileBottomNav() {
  const { t } = useI18n()
  const location = useLocation()
  const navItems = [
    { to: '/portfolio', label: t('nav_wallet') },
    { to: '/friends', label: t('nav_friends') },
    { to: '/market', label: t('nav_markets') },
    { to: '/futures', label: t('nav_futures') },
    { to: '/watchlist', label: t('nav_watchlist') },
  ]
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={location.pathname.startsWith(item.to) ? 'mobile-bottom-item active' : 'mobile-bottom-item'}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
