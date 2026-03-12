import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { getCurrentUser, getToken, setToken, type AuthUser } from './api'
import { I18nProvider } from './i18n'
import { Layout } from './Layout'
import { Login } from './pages/Login'
import { Profile } from './pages/Profile'

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
const DepositPage = lazy(() => import('./pages/DepositPage').then((m) => ({ default: m.DepositPage })))
const FriendsPage = lazy(() => import('./pages/FriendsPage').then((m) => ({ default: m.FriendsPage })))
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
const OwnerDashboardPage = lazy(() =>
  import('./pages/owner/OwnerDashboardPage').then((m) => ({ default: m.OwnerDashboardPage })),
)

type LoginRouteWrapperProps = {
  onAuthSuccess: () => void
}

function LoginRouteWrapper({ onAuthSuccess }: LoginRouteWrapperProps) {
  const [isLeaving, setIsLeaving] = useState(false)
  const [shouldNavigate, setShouldNavigate] = useState(false)

  if (shouldNavigate) {
    return <Navigate to="/portfolio" replace />
  }

  return (
    <div className={`screen-wrapper ${isLeaving ? 'screen-leave' : ''}`}>
      <Login
        onAuthSuccess={() => {
          setIsLeaving(true)
          onAuthSuccess()
          setTimeout(() => {
            setShouldNavigate(true)
          }, 300)
        }}
      />
    </div>
  )
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(() => !!getToken())

  useEffect(() => {
    const token = getToken()
    if (!token) return
    getCurrentUser()
      .then((res) => setUser(res.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  const isAuthenticated = !!user
  const canManageUsers = useMemo(
    () => user?.role === 'owner' || user?.role === 'admin' || user?.role === 'moderator',
    [user],
  )
  const canManageInvites = canManageUsers
  const canManageBalances = canManageUsers
  const canManagePermissions = user?.role === 'owner' || user?.role === 'admin'
  const canViewReports = canManageUsers

  function handleAuthSuccess() {
    getCurrentUser()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
  }

  function handleLogout() {
    setToken(null)
    setUser(null)
  }

  if (loading) return <div className="login-wrapper">Loading...</div>

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
          <Suspense fallback={<div className="login-wrapper">Loading...</div>}>
            <AccessDenied />
          </Suspense>
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
                    <Route path="/friends" element={<FriendsPage />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/assets" element={<Assets />} />
                    <Route path="/market" element={<Market />} />
                    <Route path="/watchlist" element={<WatchlistPage />} />
                    <Route path="/futures" element={<FuturesPage />} />
                    <Route
                      path="/profile"
                      element={<ProfilePage onLogout={handleLogout} user={user as AuthUser} />}
                    />
                    <Route path="/sync" element={<SyncTrade />} />
                    <Route path="/options" element={<Options />} />
                    <Route
                      path="/admin/dashboard"
                      element={
                        canViewReports ? <AdminDashboardPage /> : <Navigate to="/portfolio" replace />
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        canManageUsers ? <AdminUsersPage /> : <Navigate to="/portfolio" replace />
                      }
                    />
                    <Route
                      path="/admin/invites"
                      element={
                        canManageInvites ? <AdminInvitesPage /> : <Navigate to="/portfolio" replace />
                      }
                    />
                    <Route
                      path="/admin/balances"
                      element={
                        canManageBalances ? (
                          <AdminBalancesPage />
                        ) : (
                          <Navigate to="/portfolio" replace />
                        )
                      }
                    />
                    <Route
                      path="/admin/permissions"
                      element={
                        canManagePermissions ? (
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
    </I18nProvider>
  )
}

export default App
