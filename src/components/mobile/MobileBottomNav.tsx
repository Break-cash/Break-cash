import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../../i18nCore'

export function MobileBottomNav() {
  const { t } = useI18n()
  const location = useLocation()
  const navItems = [
    { to: '/portfolio', label: t('nav_wallet'), icon: '💼' },
    { to: '/friends', label: t('nav_friends'), icon: '👥' },
    { to: '/market', label: t('nav_markets'), icon: '📈' },
    { to: '/futures', label: t('nav_trades'), icon: '📊' },
    { to: '/watchlist', label: t('nav_watchlist'), icon: '⭐' },
    { to: '/mining', label: t('nav_mining'), icon: '⛏️', isNew: true },
  ]
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={location.pathname.startsWith(item.to) ? 'mobile-bottom-item active' : 'mobile-bottom-item'}
        >
          {item.isNew ? <span className="mobile-bottom-new">{t('nav_new_badge')}</span> : null}
          <span className="mobile-bottom-icon" aria-hidden="true">{item.icon}</span>
          <span className="mobile-bottom-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
