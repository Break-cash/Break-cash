import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { appData } from './data'

type LayoutProps = {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()

  return (
    <div className="app-root" dir="rtl">
      <aside className="sidebar">
        <div className="logo-area">
          <div className="logo-circle">Ex</div>
          <div>
            <div className="logo-title">{appData.app_name}</div>
            <div className="logo-sub">منصة تداول رقمية</div>
          </div>
        </div>

        <nav className={location.pathname === '/options' ? 'menu compact' : 'menu'}>
          {appData.navigation_menu.map((item) => (
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
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar-circle">
              {appData.user_profile.uid.slice(-2)}
            </div>
            <div className="user-meta">
              <div className="user-id">UID: {appData.user_profile.uid}</div>
              <div className="user-email">{appData.user_profile.email}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="top-bar">
          <div />
          <div className="top-actions">
            <button className="primary-btn">إيداع</button>
            <button className="ghost-btn">سحب</button>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  )
}

