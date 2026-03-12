import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiFetch, type AuthUser } from './api'
import { InstallPrompt } from './components/InstallPrompt'
import { MobileBottomNav } from './components/mobile/MobileBottomNav'
import { type Language, useI18n } from './i18nCore'

type LayoutProps = {
  children: ReactNode
  user: AuthUser
  onLogout: () => void
  canManageUsers?: boolean
  canManageInvites?: boolean
  canManageBalances?: boolean
  canManagePermissions?: boolean
  canViewReports?: boolean
}

export function Layout({
  children,
  user,
  onLogout,
  canManageUsers,
  canManageInvites,
  canManageBalances,
  canManagePermissions,
  canViewReports,
}: LayoutProps) {
  const { t, language, setLanguage, direction } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<
    { id: number; title: string; body: string; is_read: number }[]
  >([])
  const baseLinks = [
    { title: t('nav_wallet'), route: '/portfolio' },
    { title: t('nav_friends'), route: '/friends' },
    { title: t('nav_markets'), route: '/market' },
    { title: t('nav_watchlist'), route: '/watchlist' },
    { title: t('nav_futures'), route: '/futures' },
    { title: t('nav_profile'), route: '/profile' },
  ]

  const adminLinks = [
    canViewReports ? { title: t('nav_admin'), route: '/admin/dashboard' } : null,
    canManageUsers ? { title: 'Users', route: '/admin/users' } : null,
    canManageInvites ? { title: 'Invites', route: '/admin/invites' } : null,
    canManageBalances ? { title: 'Balances', route: '/admin/balances' } : null,
    canManagePermissions ? { title: 'Permissions', route: '/admin/permissions' } : null,
  ].filter(Boolean) as { title: string; route: string }[]

  const isOwner = user.role === 'owner'
  const ownerLink = isOwner ? { title: t('nav_owner'), route: '/owner' } : null

  useEffect(() => {
    apiFetch('/api/notifications/unreadCount')
      .then((res) => setUnreadCount((res as { unreadCount: number }).unreadCount))
      .catch(() => setUnreadCount(0))
  }, [])

  async function toggleNotifications() {
    const next = !notificationsOpen
    setNotificationsOpen(next)
    if (!next) return
    const res = (await apiFetch('/api/notifications/list')) as {
      notifications: { id: number; title: string; body: string; is_read: number }[]
    }
    setNotifications(res.notifications)
  }

  return (
    <div className="app-root" dir={direction}>
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-circle">
            <img
              src="/logo-bc.png"
              alt="Break cash"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div>
            <div className="logo-title">ExCoreX</div>
            <div className="logo-sub">Digital Trading Platform</div>
          </div>
        </div>

        <nav className="menu">
          {baseLinks.map((item) => (
            <Link
              key={item.route}
              to={item.route}
              className={
                location.pathname === item.route
                  ? 'menu-item menu-item-active'
                  : 'menu-item'
              }
            >
              <span className="menu-icon" aria-hidden="true">
                •
              </span>
              <span>{item.title}</span>
            </Link>
          ))}
          {adminLinks.length > 0 && <div className="logo-sub">{t('nav_admin')}</div>}
          {adminLinks.map((item) => (
            <Link
              key={item.route}
              to={item.route}
              className={
                location.pathname === item.route ? 'menu-item menu-item-active' : 'menu-item'
              }
            >
              <span className="menu-icon" aria-hidden="true">
                •
              </span>
              <span>{item.title}</span>
            </Link>
          ))}
          {ownerLink && (
            <>
              <div className="logo-sub">{t('nav_owner')}</div>
              <Link
                to={ownerLink.route}
                className={
                  location.pathname === ownerLink.route ? 'menu-item menu-item-active menu-item-owner' : 'menu-item menu-item-owner'
                }
              >
                <span className="menu-icon" aria-hidden="true">★</span>
                <span>{ownerLink.title}</span>
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar-circle">
              {String(user.id).slice(-2)}
            </div>
            <div className="user-meta">
              <div className="user-id">UID: {user.id}</div>
              <div className="user-email">{user.email || user.phone || t('contact_hidden')}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="top-bar">
          <div className="top-actions">
            <label className="lang-select-wrap" aria-label={t('language')}>
              <span>{t('language')}</span>
              <select
                className="lang-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
              >
                <option value="ar">AR</option>
                <option value="en">EN</option>
                <option value="tr">TR</option>
              </select>
            </label>
            <button
              className="top-profile-trigger"
              type="button"
              onClick={() => navigate('/profile')}
              aria-label={t('profile_menu_title')}
            >
              <span className="top-profile-avatar" aria-hidden="true">
                👤
              </span>
              <span className="top-profile-title">حسابي</span>
            </button>
            <button className="top-notifications-btn" type="button" onClick={toggleNotifications}>
              <span className="top-notifications-icon">🔔</span>
              {unreadCount > 0 && <span className="top-notifications-dot" />}
            </button>
            <InstallPrompt />
          </div>
        </header>
        {notificationsOpen && (
          <div className="card notifications-panel">
            {notifications.length === 0 ? (
              <div className="text-muted">{t('no_notifications')}</div>
            ) : (
              notifications.map((item) => (
                <div className="table-row" key={item.id}>
                  <span>{item.title}</span>
                  <span>{item.body}</span>
                  <button
                    className="link-btn"
                    type="button"
                    onClick={async () => {
                      await apiFetch('/api/notifications/markAsRead', {
                        method: 'POST',
                        body: JSON.stringify({ id: item.id }),
                      })
                      setNotifications((rows) =>
                        rows.map((row) => (row.id === item.id ? { ...row, is_read: 1 } : row)),
                      )
                      setUnreadCount((value) => (value > 0 ? value - 1 : 0))
                    }}
                  >
                    {t('mark_read')}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        <div className="content">{children}</div>
        <MobileBottomNav />
      </main>
    </div>
  )
}

