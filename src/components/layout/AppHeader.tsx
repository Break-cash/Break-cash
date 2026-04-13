import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell, Ellipsis, Grid2x2, MessageCircleMore, Search } from 'lucide-react'
import { useI18n } from '../../i18nCore'
import './AppHeader.css'

type AppHeaderProps = {
  variant?: 'home' | 'default' | 'inner' | 'transparent'
  direction: 'rtl' | 'ltr'
  brandName?: string
  title?: string
  subtitle?: string
  showBack?: boolean
  showMenu?: boolean
  showSearch?: boolean
  showNotifications?: boolean
  showMore?: boolean
  showSupport?: boolean
  menuAvatarUrl?: string | null
  menuAvatarAlt?: string
  unreadCount?: number
  onBack?: () => void
  onMenu?: () => void
  onSearch?: () => void
  onNotifications?: () => void
  onMore?: () => void
  onSupport?: () => void
  moreMenu?: ReactNode
  extraPanels?: ReactNode
  utilityLinks?: ReactNode
  menuDrawer?: ReactNode
  moreMenuRef?: RefObject<HTMLDivElement | null>
}

export function AppHeader({
  variant = 'default',
  direction,
  brandName = 'Break Cash',
  title,
  subtitle,
  showBack = false,
  showMenu = false,
  showSearch = true,
  showNotifications = true,
  showMore = true,
  showSupport = true,
  menuAvatarUrl,
  menuAvatarAlt = 'Profile',
  unreadCount = 0,
  onBack,
  onMenu,
  onSearch,
  onNotifications,
  onMore,
  onSupport,
  moreMenu,
  extraPanels,
  utilityLinks,
  menuDrawer,
  moreMenuRef,
}: AppHeaderProps) {
  const { t } = useI18n()
  const startLabel = showBack ? t('back') : t('app_menu')
  const secondaryLabel = title && title !== brandName ? title : subtitle
  const menuAvatarSrc = !showBack ? menuAvatarUrl ?? undefined : undefined
  const showMenuAvatar = Boolean(menuAvatarSrc)

  return (
    <>
      <header className={`app-header-v3 app-header-v3--${variant}`} dir={direction}>
        <div className="app-header-v3__shell">
          <div className="app-header-v3__row">
            <div className="app-header-v3__brand-side">
              <div className="app-header-v3__brand-block">
                <Link to="/portfolio" className="app-header-v3__brand-link" aria-label={brandName} dir="ltr">
                  <span className="app-header-brand-mark" aria-hidden="true">
                    <span className="app-header-brand-mark-line app-header-brand-mark-line-lg" />
                    <span className="app-header-brand-mark-line app-header-brand-mark-line-md" />
                    <span className="app-header-brand-mark-line app-header-brand-mark-line-sm" />
                  </span>
                  <span className="app-header-brand-wordmark">{brandName}</span>
                  <span className="app-header-brand-badge" aria-hidden="true">
                    <span className="app-header-brand-badge-check">✓</span>
                  </span>
                </Link>
                {secondaryLabel ? <div className="app-header-v3__subtitle">{secondaryLabel}</div> : null}
              </div>
            </div>

            <div className="app-header-v3__actions">
              {showNotifications ? (
                <button
                  type="button"
                  className="arena-page__icon-btn"
                  aria-label={t('notifications')}
                  onClick={onNotifications}
                >
                  <Bell size={16} />
                  {unreadCount > 0 ? (
                    <span className="arena-page__icon-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                  ) : null}
                </button>
              ) : null}

              {showSearch ? (
                <button type="button" className="app-header-v3__icon" aria-label={t('common_search')} onClick={onSearch}>
                  <Search size={16} />
                </button>
              ) : null}

              {showSupport ? (
                <button type="button" className="app-header-v3__icon" aria-label={t('support_page_title')} onClick={onSupport}>
                  <MessageCircleMore size={16} />
                </button>
              ) : null}

              {showMore ? (
                <div className="app-header-v3__menu-anchor" ref={moreMenuRef}>
                  <button type="button" className="app-header-v3__icon" aria-label={t('common_more')} onClick={onMore}>
                    <Ellipsis size={16} />
                  </button>
                  {moreMenu}
                </div>
              ) : null}

              {showBack || showMenu ? (
                <button
                  type="button"
                  className="app-header-v3__icon app-header-v3__icon--start app-header-v3__icon--menu"
                  onClick={showBack ? onBack : onMenu}
                  aria-label={startLabel}
                >
                  {showMenuAvatar ? <img src={menuAvatarSrc} alt={menuAvatarAlt} className="app-header-v3__menu-avatar" /> : null}
                  {!showMenuAvatar ? (
                    <span className="app-header-v3__menu-glyph" aria-hidden="true">
                      {showBack ? direction === 'rtl' ? <ArrowRight size={15} /> : <ArrowLeft size={15} /> : <Grid2x2 size={15} />}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>
          </div>

          {utilityLinks ? <div className="app-header-v3__utility-row">{utilityLinks}</div> : null}
          {extraPanels ? <div className="app-header-v3__panel-stack">{extraPanels}</div> : null}
        </div>
      </header>
      {menuDrawer}
    </>
  )
}

