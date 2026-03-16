import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  acknowledgeRecoveryCode,
  getAppleTouchIconUrl,
  getCurrentUser,
  getFaviconUrl,
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
import { Login } from './pages/Login'
import { Profile } from './pages/Profile'
import { PremiumSplashIntro } from './components/splash/PremiumSplashIntro'

const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const Market = lazy(() => import('./pages/Market').then((m) => ({ default: m.Market })))
const Assets = lazy(() => import('./pages/Assets').then((m) => ({ default: m.Assets })))
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
const FriendsPage = lazy(() => import('./pages/FriendsPage').then((m) => ({ default: m.FriendsPage })))
const VipPage = lazy(() => import('./pages/VipPage').then((m) => ({ default: m.VipPage })))
const ReferralPage = lazy(() => import('./pages/ReferralPage').then((m) => ({ default: m.ReferralPage })))
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
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
const OwnerPremiumDashboardPage = lazy(() =>
  import('./pages/owner/OwnerPremiumDashboardPage').then((m) => ({ default: m.OwnerPremiumDashboardPage })),
)
const OwnerUnifiedControlPage = lazy(() =>
  import('./pages/owner/OwnerUnifiedControlPage').then((m) => ({ default: m.OwnerUnifiedControlPage })),
)
const OwnerDashboardPage = lazy(() =>
  import('./pages/owner/OwnerDashboardPage').then((m) => ({ default: m.OwnerDashboardPage })),
)

type LoginRouteWrapperProps = {
  onAuthSuccess: () => void
}

type SplashMode = 'always' | 'session'

const SPLASH_MODE_KEY = 'breakcash_splash_mode'
const SPLASH_SESSION_SEEN_KEY = 'breakcash_splash_seen_session'
const DEFAULT_BRAND_LOGO_URL = '/break-cash-logo-premium.png'

function resolveSplashMode(): SplashMode {
  const raw = String(localStorage.getItem(SPLASH_MODE_KEY) || '').trim().toLowerCase()
  if (raw === 'session') return 'session'
  return 'always'
}

function shouldShowSplashOnEntry(mode: SplashMode): boolean {
  if (mode === 'always') return true
  return sessionStorage.getItem(SPLASH_SESSION_SEEN_KEY) !== '1'
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

function LoginRouteWrapper({ onAuthSuccess }: LoginRouteWrapperProps) {
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
          transition={{ duration: 0.34, ease: 'easeOut' }}
        >
          <Login
            onAuthSuccess={() => {
              setIsLeaving(true)
              onAuthSuccess()
              setTimeout(() => {
                setShouldNavigate(true)
              }, 300)
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(() => !!getToken())
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryCountdown, setRecoveryCountdown] = useState(5)
  const [recoveryCopyDone, setRecoveryCopyDone] = useState(false)
  const [recoverySaving, setRecoverySaving] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) return
    getCurrentUser()
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

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
    if (!user) {
      Sentry.setUser(null)
      return
    }
    Sentry.setUser({ id: String(user.id), username: user.display_name || undefined, role: user.role })
  }, [user])

  useEffect(() => {
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

  const isAuthenticated = !!user
  const canManageUsers = useMemo(
    () => user?.role === 'owner',
    [user],
  )
  const canManageInvites = canManageUsers
  const canManageBalances = canManageUsers
  const canManagePermissions = user?.role === 'owner'
  const canViewReports = canManageUsers

  function handleAuthSuccess() {
    getCurrentUser()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
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
    const res = await getCurrentUser()
    setUser(res.user)
  }

  if (loading) return <div className="login-wrapper">Loading...</div>

  const dict = translations[resolveUiLanguage()]

  return (
    <I18nProvider>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/portfolio" replace />
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

      <Route
        path="*"
        element={
          !isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <>
              <Layout
                user={user as AuthUser}
                onLogout={handleLogout}
                canManageUsers={canManageUsers}
                canManageInvites={canManageInvites}
                canManageBalances={canManageBalances}
                canManagePermissions={!!canManagePermissions}
                canViewReports={canViewReports}
              >
                <Suspense fallback={<div className="login-wrapper">Loading...</div>}>
                  <Routes>
                    <Route path="/portfolio" element={<Profile />} />
                    <Route path="/deposit" element={<DepositPage user={user as AuthUser} />} />
                    <Route path="/withdraw" element={<DepositPage user={user as AuthUser} pageMode="withdraw" />} />
                    <Route path="/friends" element={<FriendsPage />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/assets" element={<Assets />} />
                    <Route path="/market" element={<Market />} />
                    <Route path="/watchlist" element={<WatchlistPage />} />
                    <Route path="/futures" element={<FuturesPage />} />
                    <Route path="/mining" element={<MiningPage />} />
                    <Route path="/vip" element={<VipPage />} />
                    <Route path="/referral" element={<ReferralPage />} />
                    <Route
                      path="/profile"
                      element={(
                        <ProfilePage
                          onLogout={handleLogout}
                          user={user as AuthUser}
                          onProfileRefresh={refreshCurrentUser}
                        />
                      )}
                    />
                    <Route path="/sync" element={<SyncTrade />} />
                    <Route path="/options" element={<Options />} />
                    <Route
                      path="/admin/dashboard"
                      element={
                        user?.role === 'owner' ? <AdminDashboardPage /> : <Navigate to="/portfolio" replace />
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        user?.role === 'owner' ? <AdminUsersPage /> : <Navigate to="/portfolio" replace />
                      }
                    />
                    <Route
                      path="/admin/invites"
                      element={
                        user?.role === 'owner' ? <AdminInvitesPage /> : <Navigate to="/portfolio" replace />
                      }
                    />
                    <Route
                      path="/admin/balances"
                      element={
                        user?.role === 'owner' ? (
                          <AdminBalancesPage />
                        ) : (
                          <Navigate to="/portfolio" replace />
                        )
                      }
                    />
                    <Route
                      path="/admin/permissions"
                      element={
                        user?.role === 'owner' ? (
                          <AdminPermissionsPage />
                        ) : (
                          <Navigate to="/portfolio" replace />
                        )
                      }
                    />
                    <Route
                      path="/owner"
                      element={
                        user?.role === 'owner' ? (
                          <OwnerUnifiedControlPage user={user as AuthUser} />
                        ) : (
                          <Navigate to="/portfolio" replace />
                        )
                      }
                    />
                    <Route
                      path="/owner/premium"
                      element={
                        user?.role === 'owner' ? (
                          <OwnerPremiumDashboardPage user={user as AuthUser} />
                        ) : (
                          <Navigate to="/portfolio" replace />
                        )
                      }
                    />
                    <Route
                      path="/owner/operations"
                      element={
                        user?.role === 'owner' ? (
                          <OwnerDashboardPage user={user as AuthUser} />
                        ) : (
                          <Navigate to="/portfolio" replace />
                        )
                      }
                    />
                    <Route path="*" element={<Navigate to="/portfolio" replace />} />
                  </Routes>
                </Suspense>
              </Layout>
            </>
          )
        }
      />
      </Routes>
      {logoutConfirmOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-card p-4 shadow-[0_20px_44px_rgba(0,0,0,0.35)]">
            <h3 className="text-base font-semibold text-white">{dict.logout_confirm_title}</h3>
            <p className="mt-2 text-sm text-white/70">{dict.logout_confirm_message}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-app-border bg-app-elevated px-3 py-1.5 text-sm text-white/80 hover:bg-[#343945]"
                onClick={cancelLogout}
              >
                {dict.logout_confirm_cancel}
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:brightness-110"
                onClick={confirmLogout}
              >
                {dict.logout_confirm_confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {recoveryModalOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-brand-blue/35 bg-app-card p-4 shadow-[0_22px_50px_rgba(0,0,0,0.45)]">
            <h3 className="text-base font-semibold text-white">{dict.recovery_code_title}</h3>
            <p className="mt-2 text-sm text-white/75">{dict.recovery_code_message}</p>
            <div className="mt-3 rounded-xl border border-app-border bg-app-elevated p-3">
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
                className="rounded-lg border border-brand-blue/35 bg-brand-blue/10 px-3 py-2 text-sm text-white hover:bg-brand-blue/20"
                onClick={copyRecoveryCode}
              >
                {recoveryCopyDone ? dict.recovery_code_copied : dict.recovery_code_copy}
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
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
      ) : null}
      <AppToastViewport />
    </I18nProvider>
  )
}

export default App
