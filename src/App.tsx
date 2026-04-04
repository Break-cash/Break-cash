import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  acknowledgeRecoveryCode,
  getAppleTouchIconUrl,
  getCurrentUser,
  getFaviconUrl,
  getMyPermissions,
  getPwaConfig,
  getRecoveryCodeStatus,
  getThemeColor,
  getToken,
  setToken,
  type AuthUser,
} from './api'
import { I18nProvider } from './i18n'
import { translations, type Language } from './i18nCore'
import { Layout } from './Layout'
import { AppToastViewport } from './components/toast/AppToastViewport'
import { AppModalPortal } from './components/ui/AppModalPortal'
import { InstallPrompt } from './components/InstallPrompt'
import { useFrameRateProfile } from './hooks/useFrameRateProfile'
import { Login } from './pages/Login'
import { Profile } from './pages/Profile'
import { PremiumSplashIntro } from './components/splash/PremiumSplashIntro'
import { ProductionRefreshScreen, resetProductionRefreshAttempts } from './components/splash/ProductionRefreshScreen'

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const Market = lazy(() => import('./pages/Market').then((m) => ({ default: m.Market })))
const Options = lazy(() => import('./pages/Options').then((m) => ({ default: m.Options })))
const SyncTrade = lazy(() => import('./pages/SyncTrade').then((m) => ({ default: m.SyncTrade })))
const JoinInvite = lazy(() => import('./pages/JoinInvite').then((m) => ({ default: m.JoinInvite })))
const AccessDenied = lazy(() =>
  import('./pages/AccessDenied').then((m) => ({ default: m.AccessDenied })),
)
const WatchlistPage = lazy(() =>
  import('./pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })),
)
const FuturesPage = lazy(() => import('./pages/FuturesPage').then((m) => ({ default: m.FuturesPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const MiningPage = lazy(() => import('./pages/MiningPage').then((m) => ({ default: m.MiningPage })))
const DepositPage = lazy(() => import('./pages/DepositPage').then((m) => ({ default: m.DepositPage })))
const WalletPage = lazy(() => import('./pages/WalletPage').then((m) => ({ default: m.WalletPage })))
const FriendsPage = lazy(() => import('./pages/FriendsPage').then((m) => ({ default: m.FriendsPage })))
const VipPage = lazy(() => import('./pages/VipPage').then((m) => ({ default: m.VipPage })))
const ReferralPage = lazy(() => import('./pages/ReferralPage').then((m) => ({ default: m.ReferralPage })))
const SupportPage = lazy(() => import('./pages/SupportPage').then((m) => ({ default: m.SupportPage })))
const LeaderboardPreviewPage = lazy(() =>
  import('./pages/LeaderboardPreviewPage').then((m) => ({ default: m.LeaderboardPreviewPage })),
)
const AdminUsersPage = lazy(() =>
  import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
)
const AdminInvitesPage = lazy(() =>
  import('./pages/admin/AdminInvitesPage').then((m) => ({ default: m.AdminInvitesPage })),
)
const AdminBalancesPage = lazy(() =>
  import('./pages/admin/AdminBalancesPage').then((m) => ({ default: m.AdminBalancesPage })),
)
const AdminPermissionsPage = lazy(() =>
  import('./pages/admin/AdminPermissionsPage').then((m) => ({ default: m.AdminPermissionsPage })),
)
const AdminSupportPage = lazy(() =>
  import('./pages/admin/AdminSupportPage').then((m) => ({ default: m.AdminSupportPage })),
)
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
const OwnerDashboardPage = lazy(() =>
  import('./pages/owner/OwnerDashboardPage').then((m) => ({ default: m.OwnerDashboardPage })),
)
import { OwnerLayout } from './pages/owner/OwnerLayout'

type LoginRouteWrapperProps = {
  onAuthSuccess: () => void
}

type SplashMode = 'always' | 'session'

const SPLASH_MODE_KEY = 'breakcash_splash_mode'
const SPLASH_SESSION_SEEN_KEY = 'breakcash_splash_seen_session'
const DEFAULT_BRAND_LOGO_URL = '/break-cash-logo-premium.png'
const LOCAL_AUTH_BYPASS_HOSTS = new Set(['127.0.0.1', 'localhost'])
const LOCAL_PREVIEW_USER: AuthUser = {
  id: 999001,
  role: 'user',
  email: 'local-preview@breakcash.local',
  phone: null,
  display_name: 'Local Preview',
  bio: 'حساب معاينة محلي لتجاوز شاشة تسجيل الدخول فقط.',
  verification_status: 'verified',
  badge_color: 'blue',
  blue_badge: 1,
  vip_level: 2,
  country: 'TR',
  preferred_language: 'ar',
  deposit_privacy_enabled: 1,
}

function resolveSplashMode(): SplashMode {
  const raw = String(localStorage.getItem(SPLASH_MODE_KEY) || '').trim().toLowerCase()
  if (raw === 'session') return 'session'
  return 'always'
}

function shouldShowSplashOnEntry(mode: SplashMode): boolean {
  if (mode === 'always') return true
  return sessionStorage.getItem(SPLASH_SESSION_SEEN_KEY) !== '1'
}

type OwnerGuardProps = {
  user: AuthUser | null
}

function OwnerGuard({ user }: OwnerGuardProps) {
  if (!user || user.role !== 'owner') {
    return <Navigate to="/portfolio" replace />
  }
  return (
    <OwnerLayout user={user}>
      <Outlet />
    </OwnerLayout>
  )
}

function resolveUiLanguage(): Language {
  const saved = localStorage.getItem('breakcash_language')
  if (saved === 'ar' || saved === 'en' || saved === 'tr') return saved
  const browser = (navigator.language || '').toLowerCase()
  if (browser.startsWith('ar')) return 'ar'
  if (browser.startsWith('tr')) return 'tr'
  return 'en'
}

function applyIconLinkWithFallback(rel: 'icon' | 'apple-touch-icon', href: string) {
  const nextHref = String(href || '').trim() || DEFAULT_BRAND_LOGO_URL
  let iconLink = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null
  if (!iconLink) {
    iconLink = document.createElement('link')
    iconLink.rel = rel
    if (rel === 'icon') {
      iconLink.type = 'image/png'
    }
    document.head.appendChild(iconLink)
  }
  iconLink.onerror = () => {
    iconLink!.href = DEFAULT_BRAND_LOGO_URL
  }
  iconLink.href = nextHref
}

function applyMetaContent(name: string, content: string) {
  const nextContent = String(content || '').trim()
  if (!nextContent) return
  let meta = document.querySelector(`meta[name='${name}']`) as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }
  meta.content = nextContent
}

function LoginRouteWrapper({ onAuthSuccess }: LoginRouteWrapperProps) {
  const { scaleDuration } = useFrameRateProfile()
  const [isLeaving, setIsLeaving] = useState(false)
  const [shouldNavigate, setShouldNavigate] = useState(false)
  const [showSplash, setShowSplash] = useState(() => shouldShowSplashOnEntry(resolveSplashMode()))

  if (shouldNavigate) {
    return <Navigate to="/portfolio" replace />
  }

  return (
    <AnimatePresence mode="wait">
      {showSplash ? (
        <PremiumSplashIntro
          key="premium-splash"
          onComplete={() => {
            const mode = resolveSplashMode()
            if (mode === 'session') {
              sessionStorage.setItem(SPLASH_SESSION_SEEN_KEY, '1')
            }
            setShowSplash(false)
          }}
        />
      ) : (
        <motion.div
          key="login-view"
          className={`screen-wrapper ${isLeaving ? 'screen-leave' : ''}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: scaleDuration(0.34), ease: 'easeOut' }}
        >
          <Login
              onAuthSuccess={() => {
                setIsLeaving(true)
                onAuthSuccess()
                setTimeout(() => {
                  setShouldNavigate(true)
                }, Math.round(scaleDuration(0.3) * 1000))
              }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AnimatedAuthenticatedRoutes({
  user,
  canManageUsers,
  canManageInvites,
  canManageBalances,
  canManagePermissions,
  canManageSupport,
  canViewReports,
  handleLogout,
  refreshCurrentUser,
}: {
  user: AuthUser
  canManageUsers: boolean
  canManageInvites: boolean
  canManageBalances: boolean
  canManagePermissions: boolean
  canManageSupport: boolean
  canViewReports: boolean
  handleLogout: () => void
  refreshCurrentUser: () => Promise<void>
}) {
  const { scaleDuration } = useFrameRateProfile()
  const location = useLocation()

  return (
    <Layout
      user={user}
      onLogout={handleLogout}
      canManageUsers={canManageUsers}
      canManageInvites={canManageInvites}
      canManageBalances={canManageBalances}
      canManagePermissions={canManagePermissions}
      canManageSupport={canManageSupport}
      canViewReports={canViewReports}
    >
      <Suspense fallback={<div className="login-wrapper">Loading...</div>}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="liquid-page-transition"
            initial={{ opacity: 0, y: 16, scale: 0.992, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, scale: 0.996, filter: 'blur(8px)' }}
            transition={{ duration: scaleDuration(0.3), ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/portfolio" element={<Profile />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/deposit" element={<DepositPage user={user} />} />
              <Route path="/withdraw" element={<DepositPage user={user} pageMode="withdraw" />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/home" element={<Home />} />
              <Route path="/assets" element={<WalletPage />} />
              <Route path="/market" element={<Market />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/futures" element={<FuturesPage />} />
              <Route path="/mining" element={<MiningPage />} />
              <Route path="/vip" element={<VipPage />} />
              <Route path="/referral" element={<ReferralPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route
                path="/profile"
                element={(
                  <ProfilePage
                    onLogout={handleLogout}
                    user={user}
                    onProfileRefresh={refreshCurrentUser}
                  />
                )}
              />
              <Route path="/sync" element={<SyncTrade />} />
              <Route path="/options" element={<Options />} />
              <Route
                path="/admin/dashboard"
                element={canViewReports ? <AdminDashboardPage /> : <Navigate to="/portfolio" replace />}
              />
              <Route
                path="/admin/users"
                element={canManageUsers ? <AdminUsersPage /> : <Navigate to="/portfolio" replace />}
              />
              <Route
                path="/admin/invites"
                element={canManageInvites ? <AdminInvitesPage /> : <Navigate to="/portfolio" replace />}
              />
              <Route
                path="/admin/balances"
                element={canManageBalances ? <AdminBalancesPage /> : <Navigate to="/portfolio" replace />}
              />
              <Route
                path="/admin/permissions"
                element={canManagePermissions ? <AdminPermissionsPage /> : <Navigate to="/portfolio" replace />}
              />
              <Route
                path="/admin/support"
                element={canManageSupport ? <AdminSupportPage /> : <Navigate to="/portfolio" replace />}
              />
              <Route path="/owner/*" element={<OwnerGuard user={user} />}>
                <Route index element={<Navigate to="/owner/operations" replace />} />
                <Route path="premium" element={<Navigate to="/owner/operations" replace />} />
                <Route path="operations" element={<OwnerDashboardPage user={user} />} />
              </Route>
              <Route path="*" element={<Navigate to="/portfolio" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </Layout>
  )
}

function App() {
  const { fps, frameMs, motionScale } = useFrameRateProfile()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(() => !!getToken())
  const [productionRefreshRequired, setProductionRefreshRequired] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryCountdown, setRecoveryCountdown] = useState(5)
  const [recoveryCopyDone, setRecoveryCopyDone] = useState(false)
  const [recoverySaving, setRecoverySaving] = useState(false)
  const isLocalAuthBypassEnabled =
    typeof window !== 'undefined' && LOCAL_AUTH_BYPASS_HOSTS.has(window.location.hostname) && !getToken()

  useEffect(() => {
    document.documentElement.style.setProperty('--device-fps', String(fps))
    document.documentElement.style.setProperty('--device-frame-ms', `${frameMs.toFixed(2)}ms`)
    document.documentElement.style.setProperty('--motion-duration-scale', motionScale.toFixed(3))
  }, [fps, frameMs, motionScale])

  useEffect(() => {
    if (productionRefreshRequired) return
    const markRefreshRequired = (reason?: unknown) => {
      const message = String(
        (reason as { message?: string } | null)?.message ||
        (reason as { reason?: { message?: string } } | null)?.reason?.message ||
        reason ||
        '',
      ).toLowerCase()
      if (
        message.includes('failed to fetch dynamically imported module') ||
        message.includes('importing a module script failed') ||
        message.includes('loading chunk') ||
        message.includes('chunkloaderror') ||
        message.includes('dynamically imported')
      ) {
        setProductionRefreshRequired(true)
      }
    }

    const onError = (event: ErrorEvent) => markRefreshRequired(event.error || event.message)
    const onUnhandledRejection = (event: PromiseRejectionEvent) => markRefreshRequired(event.reason)
    const onVitePreloadError = (event: Event) => {
      event.preventDefault()
      setProductionRefreshRequired(true)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    window.addEventListener('vite:preloadError', onVitePreloadError as EventListener)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
      window.removeEventListener('vite:preloadError', onVitePreloadError as EventListener)
    }
  }, [productionRefreshRequired])

  useEffect(() => {
    const token = getToken()
    if (!token) return
    Promise.all([getCurrentUser(), getMyPermissions()])
      .then(([userRes, permissionsRes]) => {
        setUser(userRes.user)
        setGrantedPermissions(Array.isArray(permissionsRes.permissions) ? permissionsRes.permissions : [])
      })
      .catch(() => {
        setToken(null)
        setUser(null)
        setGrantedPermissions([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user || !loading) {
      resetProductionRefreshAttempts()
    }
  }, [loading, user])

  useEffect(() => {
    getFaviconUrl()
      .then((res) => {
        applyIconLinkWithFallback('icon', res.faviconUrl)
      })
      .catch(() => applyIconLinkWithFallback('icon', DEFAULT_BRAND_LOGO_URL))
  }, [])

  useEffect(() => {
    getAppleTouchIconUrl()
      .then((res) => {
        applyIconLinkWithFallback('apple-touch-icon', res.appleTouchIconUrl)
      })
      .catch(() => applyIconLinkWithFallback('apple-touch-icon', DEFAULT_BRAND_LOGO_URL))
  }, [])

  useEffect(() => {
    getThemeColor()
      .then((res) => {
        const themeColor = String(res.themeColor || '').trim()
        if (!/^#[0-9a-fA-F]{6}$/.test(themeColor)) return
        let themeMeta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null
        if (!themeMeta) {
          themeMeta = document.createElement('meta')
          themeMeta.name = 'theme-color'
          document.head.appendChild(themeMeta)
        }
        themeMeta.content = themeColor
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getPwaConfig()
      .then((res) => {
        const appName = String(res.config?.name || '').trim()
        const appDescription = String(res.config?.description || '').trim()
        if (appName) {
          document.title = appName
          applyMetaContent('application-name', appName)
          applyMetaContent('apple-mobile-web-app-title', appName)
        }
        if (appDescription) {
          applyMetaContent('description', appDescription)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) {
      Sentry.setUser(null)
      return
    }
    Sentry.setUser({ id: String(user.id), username: user.display_name || undefined, role: user.role })
  }, [user])

  useEffect(() => {
    if (isLocalAuthBypassEnabled) {
      setRecoveryModalOpen(false)
      return
    }
    if (!user) {
      setRecoveryModalOpen(false)
      setRecoveryCode('')
      setRecoveryCountdown(5)
      setRecoveryCopyDone(false)
      setRecoverySaving(false)
      return
    }
    getRecoveryCodeStatus()
      .then((res) => {
        if (!res.shouldShow || !res.recoveryCode) {
          setRecoveryModalOpen(false)
          return
        }
        setRecoveryCode(String(res.recoveryCode))
        setRecoveryCountdown(5)
        setRecoveryCopyDone(false)
        setRecoveryModalOpen(true)
      })
      .catch(() => {
        setRecoveryModalOpen(false)
      })
  }, [user])

  useEffect(() => {
    if (!recoveryModalOpen || recoveryCountdown <= 0) return
    const timer = window.setTimeout(() => {
      setRecoveryCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [recoveryModalOpen, recoveryCountdown])

  const effectiveUser = user ?? (isLocalAuthBypassEnabled ? LOCAL_PREVIEW_USER : null)
  const isAuthenticated = !!effectiveUser
  const isOwner = effectiveUser?.role === 'owner' || Number(effectiveUser?.is_owner || 0) === 1
  const hasGrantedPermission = useMemo(
    () => (permission: string) => Boolean(isOwner || grantedPermissions.includes(permission)),
    [grantedPermissions, isOwner],
  )
  const hasAnyGrantedPermission = useMemo(
    () => (permissions: string[]) => Boolean(isOwner || permissions.some((permission) => grantedPermissions.includes(permission))),
    [grantedPermissions, isOwner],
  )
  const canManageUsers = useMemo(
    () => hasAnyGrantedPermission(['manage_users', 'users.manage']),
    [hasAnyGrantedPermission],
  )
  const canManageInvites = useMemo(
    () => hasGrantedPermission('manage_invites'),
    [hasGrantedPermission],
  )
  const canManageBalances = useMemo(
    () => hasAnyGrantedPermission(['manage_balances', 'wallets.manage']),
    [hasAnyGrantedPermission],
  )
  const canManagePermissions = useMemo(
    () => hasAnyGrantedPermission(['manage_permissions', 'staff_permissions.manage']),
    [hasAnyGrantedPermission],
  )
  const canManageSupport = useMemo(
    () => hasAnyGrantedPermission(['support.manage']),
    [hasAnyGrantedPermission],
  )
  const canViewReports = useMemo(
    () => hasAnyGrantedPermission(['view_reports', 'reports.view', 'dashboard.overview.view']),
    [hasAnyGrantedPermission],
  )

  function handleAuthSuccess() {
    Promise.all([getCurrentUser(), getMyPermissions()])
      .then(([userRes, permissionsRes]) => {
        setUser(userRes.user)
        setGrantedPermissions(Array.isArray(permissionsRes.permissions) ? permissionsRes.permissions : [])
      })
      .catch(() => {
        setUser(null)
        setGrantedPermissions([])
      })
  }

  function handleLogout() {
    setLogoutConfirmOpen(true)
  }

  function cancelLogout() {
    setLogoutConfirmOpen(false)
  }

  function confirmLogout() {
    setToken(null)
    setUser(null)
    setGrantedPermissions([])
    setLogoutConfirmOpen(false)
  }

  async function copyRecoveryCode() {
    if (!recoveryCode) return
    try {
      await navigator.clipboard.writeText(recoveryCode)
      setRecoveryCopyDone(true)
      window.setTimeout(() => setRecoveryCopyDone(false), 1400)
    } catch {
      setRecoveryCopyDone(false)
    }
  }

  async function confirmRecoveryCodeSeen() {
    if (recoveryCountdown > 0 || recoverySaving) return
    setRecoverySaving(true)
    try {
      await acknowledgeRecoveryCode()
      setRecoveryModalOpen(false)
    } finally {
      setRecoverySaving(false)
    }
  }

  async function refreshCurrentUser() {
    if (isLocalAuthBypassEnabled) return
    const res = await getCurrentUser()
    setUser(res.user)
  }

  if (productionRefreshRequired) {
    return <ProductionRefreshScreen />
  }

  if (loading) return <div className="login-wrapper">Loading...</div>

  const dict = translations[resolveUiLanguage()]
  const isLocalPreviewEnabled = import.meta.env.DEV

  return (
    <I18nProvider>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to={isLocalAuthBypassEnabled ? "/home" : "/portfolio"} replace />
            ) : (
              <LoginRouteWrapper onAuthSuccess={handleAuthSuccess} />
            )
          }
        />
      <Route
        path="/join/:code"
        element={
          <Suspense fallback={<div className="login-wrapper">Loading...</div>}>
            <JoinInvite onAuthSuccess={handleAuthSuccess} />
          </Suspense>
        }
      />
      <Route
        path="/access-denied"
        element={
          isAuthenticated ? (
            <Navigate to="/portfolio" replace />
          ) : (
            <Suspense fallback={<div className="login-wrapper">Loading...</div>}>
              <AccessDenied />
            </Suspense>
          )
        }
      />
      {isLocalPreviewEnabled ? (
        <Route
          path="/preview/leaderboard"
          element={
            <Suspense fallback={<div className="login-wrapper">Loading...</div>}>
              <LeaderboardPreviewPage />
            </Suspense>
          }
        />
      ) : null}

      <Route
        path="*"
        element={
          !isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <AnimatedAuthenticatedRoutes
              user={effectiveUser as AuthUser}
              canManageUsers={canManageUsers}
              canManageInvites={canManageInvites}
              canManageBalances={canManageBalances}
              canManagePermissions={!!canManagePermissions}
              canManageSupport={canManageSupport}
              canViewReports={canViewReports}
              handleLogout={handleLogout}
              refreshCurrentUser={refreshCurrentUser}
            />
          )
        }
      />
      </Routes>
      {logoutConfirmOpen ? (
        <AppModalPortal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-4 shadow-[0_20px_44px_rgba(0,0,0,0.35)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{dict.logout_confirm_title}</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{dict.logout_confirm_message}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="glass-pill rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-white/10"
                onClick={cancelLogout}
              >
                {dict.logout_confirm_cancel}
              </button>
              <button
                type="button"
                className="action-button action-button-withdraw rounded-lg px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
                onClick={confirmLogout}
              >
                {dict.logout_confirm_confirm}
              </button>
            </div>
          </div>
        </div>
        </AppModalPortal>
      ) : null}
      {recoveryModalOpen ? (
        <AppModalPortal>
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-brand-blue/35 p-4 shadow-[0_22px_50px_rgba(0,0,0,0.45)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{dict.recovery_code_title}</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{dict.recovery_code_message}</p>
            <div className="glass-panel-soft mt-3 rounded-xl p-3">
              <div className="select-all text-center font-mono text-base font-semibold tracking-[0.14em] text-brand-blue">
                {recoveryCode}
              </div>
            </div>
            <p className="mt-3 rounded-xl border border-amber-400/35 bg-amber-500/10 p-2 text-xs text-amber-100">
              {dict.recovery_code_warning}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="action-button action-button-withdraw rounded-lg px-3 py-2 text-sm text-white hover:bg-brand-blue/20"
                onClick={copyRecoveryCode}
              >
                {recoveryCopyDone ? dict.recovery_code_copied : dict.recovery_code_copy}
              </button>
              <button
                type="button"
                className="action-button action-button-withdraw rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                onClick={confirmRecoveryCodeSeen}
                disabled={recoveryCountdown > 0 || recoverySaving}
              >
                {recoveryCountdown > 0
                  ? `${dict.recovery_code_wait} ${recoveryCountdown}s`
                  : recoverySaving
                    ? dict.common_loading
                    : dict.recovery_code_confirm}
              </button>
            </div>
          </div>
        </div>
        </AppModalPortal>
      ) : null}
      <InstallPrompt />
      <AppToastViewport />
    </I18nProvider>
  )
}

export default App
