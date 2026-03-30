import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Crown,
  Globe2,
  House,
  Search,
  Shield,
  User,
  UserCircle2,
  Wallet,
  X,
} from 'lucide-react'
import {
  apiFetch,
  getHeaderIconConfig,
  getPushPublicKey,
  getPushSubscriptionStatus,
  removePushSubscription,
  savePushSubscription,
  sendPushTest,
  subscribeToLiveUpdates,
  updateMyProfile,
  type AuthUser,
  type HeaderIconConfigItem,
} from './api'
import { playFeedbackSound, primeAppFeedback } from './appFeedback'
import { InstallPrompt } from './components/InstallPrompt'
import { MobileBottomNav } from './components/mobile/MobileBottomNav'
import { UserIdentityBadges } from './components/user/UserIdentityBadges'
import { type Language, useI18n } from './i18nCore'
import { getPremiumProfileColorClass } from './premiumIdentity'

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7YcfVEVccPWi28j22U'

const COUNTRY_FLAG_ALIASES: Record<string, string> = {
  tr: 'TR',
  turkey: 'TR',
  turkiye: 'TR',
  'türkiye': 'TR',
  تركيا: 'TR',
  sa: 'SA',
  saudi: 'SA',
  'saudi arabia': 'SA',
  السعودية: 'SA',
  eg: 'EG',
  egypt: 'EG',
  مصر: 'EG',
  ae: 'AE',
  uae: 'AE',
  'united arab emirates': 'AE',
  الامارات: 'AE',
  'الإمارات': 'AE',
  iq: 'IQ',
  iraq: 'IQ',
  العراق: 'IQ',
  sy: 'SY',
  syria: 'SY',
  سوريا: 'SY',
  jo: 'JO',
  jordan: 'JO',
  الاردن: 'JO',
  'الأردن': 'JO',
  lb: 'LB',
  lebanon: 'LB',
  لبنان: 'LB',
  kw: 'KW',
  kuwait: 'KW',
  الكويت: 'KW',
  qa: 'QA',
  qatar: 'QA',
  قطر: 'QA',
  bh: 'BH',
  bahrain: 'BH',
  البحرين: 'BH',
  om: 'OM',
  oman: 'OM',
  عمان: 'OM',
  ye: 'YE',
  yemen: 'YE',
  اليمن: 'YE',
  ma: 'MA',
  morocco: 'MA',
  المغرب: 'MA',
  dz: 'DZ',
  algeria: 'DZ',
  الجزائر: 'DZ',
  tn: 'TN',
  tunisia: 'TN',
  تونس: 'TN',
  ly: 'LY',
  libya: 'LY',
  ليبيا: 'LY',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  america: 'US',
  امريكا: 'US',
  'أمريكا': 'US',
  gb: 'GB',
  uk: 'GB',
  britain: 'GB',
  england: 'GB',
  بريطانيا: 'GB',
  fr: 'FR',
  france: 'FR',
  فرنسا: 'FR',
  de: 'DE',
  germany: 'DE',
  ألمانيا: 'DE',
  المانيا: 'DE',
}

type LayoutProps = {
  children: ReactNode
  user: AuthUser
  onLogout: () => void
  canManageUsers?: boolean
  canManageInvites?: boolean
  canManageBalances?: boolean
  canManagePermissions?: boolean
  canManageSupport?: boolean
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
  canManageSupport,
  canViewReports,
}: LayoutProps) {
  const { t, language, setLanguage, direction } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [headerIcons, setHeaderIcons] = useState<HeaderIconConfigItem[]>([
    { id: 'search', visible: true },
    { id: 'language', visible: true },
    { id: 'notifications', visible: true },
    { id: 'profile', visible: true },
  ])
  const [notifications, setNotifications] = useState<
    { id: number; title: string; body: string; is_read: number; created_at?: string | null }[]
  >([])
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<'default' | 'denied' | 'granted'>('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [avatarRetryNonce, setAvatarRetryNonce] = useState(0)
  const [avatarFailureCount, setAvatarFailureCount] = useState(0)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const languageSyncRef = useRef('')
  const readNotificationKeysRef = useRef<Set<string>>(new Set())
  const adminLinks = [
    canViewReports ? { title: t('nav_admin'), route: '/admin/dashboard' } : null,
    canManageUsers ? { title: t('admin_users'), route: '/admin/users' } : null,
    canManageInvites ? { title: t('admin_invites'), route: '/admin/invites' } : null,
    canManageBalances ? { title: t('admin_balances'), route: '/admin/balances' } : null,
    canManagePermissions ? { title: t('admin_permissions'), route: '/admin/permissions' } : null,
    canManageSupport ? { title: t('support_page_title'), route: '/admin/support' } : null,
  ].filter(Boolean) as { title: string; route: string }[]

  const isOwner = user.role === 'owner'
  const ownerLinks = isOwner
    ? [
        { title: t('nav_owner'), route: '/owner' },
        { title: t('owner_nav_my_wallet'), route: '/wallet' },
        { title: t('owner_premium_dashboard'), route: '/owner/premium' },
        { title: t('owner_quick_operations'), route: '/owner/operations' },
      ]
    : []
  const utilityLinks = [...ownerLinks, ...adminLinks].filter(Boolean) as { title: string; route: string }[]
  const managementShortcuts = [
    isOwner ? { title: t('nav_owner'), route: '/owner/operations' } : null,
    canViewReports ? { title: t('nav_admin'), route: '/admin/dashboard' } : null,
    canManageUsers ? { title: t('admin_users'), route: '/admin/users' } : null,
    canManageInvites ? { title: t('admin_invites'), route: '/admin/invites' } : null,
    canManageBalances ? { title: t('admin_balances'), route: '/admin/balances' } : null,
    canManagePermissions ? { title: t('admin_permissions'), route: '/admin/permissions' } : null,
    canManageSupport ? { title: t('support_page_title'), route: '/admin/support' } : null,
  ].filter(Boolean) as { title: string; route: string }[]
  const managementShortcut = managementShortcuts.length > 0
    ? {
        to: managementShortcuts[0].route,
        label: isOwner ? t('nav_owner') : t('nav_admin'),
        count: managementShortcuts.length,
        kind: isOwner ? 'owner' as const : 'admin' as const,
      }
    : null

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  const pushTexts =
    language === 'ar'
      ? {
          enable: 'تفعيل الإشعارات الخارجية',
          disable: 'إيقاف الإشعارات الخارجية',
          enabledHint: 'سيصلك إشعار حتى عند الخروج من التطبيق.',
          deniedHint: 'المتصفح منع الإشعارات. فعّلها من إعدادات المتصفح أو النظام.',
          idleHint: 'فعّلها ليصلك إشعار فعلي عند الموافقات والتحديثات المهمة.',
          loading: 'جارٍ التفعيل...',
          unsupported: 'Web Push غير مدعوم على هذا المتصفح أو الجهاز.',
        }
      : language === 'tr'
        ? {
            enable: 'Dis bildirimleri ac',
            disable: 'Dis bildirimleri kapat',
            enabledHint: 'Uygulama kapaliyken bile bildirim alirsiniz.',
            deniedHint: 'Tarayici bildirimleri engelledi. Tarayici veya sistem ayarlarindan izin verin.',
            idleHint: 'Onaylar ve onemli guncellemeler icin gercek bildirimleri acin.',
            loading: 'Etkinlestiriliyor...',
            unsupported: 'Web Push bu tarayici veya cihazda desteklenmiyor.',
          }
        : {
            enable: 'Enable push notifications',
            disable: 'Disable push notifications',
            enabledHint: 'You will receive alerts even when the app is closed.',
            deniedHint: 'Browser notifications are blocked. Enable them from browser or system settings.',
            idleHint: 'Enable real alerts for approvals and important updates.',
            loading: 'Enabling...',
            unsupported: 'Web Push is not supported on this browser or device.',
          }

  function getNotificationKey(item: { title?: string; body?: string }) {
    return `${String(item.title || '').trim()}|${String(item.body || '').trim()}`
  }

  function normalizeCountryCode(value?: string | null) {
    const raw = String(value || '').trim()
    if (!raw) return ''
    const lower = raw.toLowerCase()
    if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase()
    return COUNTRY_FLAG_ALIASES[lower] || COUNTRY_FLAG_ALIASES[raw] || ''
  }

  function getCountryFlagEmoji(value?: string | null) {
    const code = normalizeCountryCode(value)
    if (!code) return ''
    return String.fromCodePoint(...code.split('').map((char) => 127397 + char.charCodeAt(0)))
  }

  function renderProfileIdentity(compact = false) {
    const countryFlag = getCountryFlagEmoji(user.country)
    return (
      <>
        <div className="flex items-center gap-1.5">
          <div className="truncate text-sm font-semibold text-white">{user.display_name || `#${user.id}`}</div>
          {countryFlag ? (
            <span
              className={`inline-flex items-center justify-center rounded-full border border-white/10 bg-white/8 px-1.5 ${
                compact ? 'text-sm leading-5' : 'text-base leading-5'
              }`}
              title={String(user.country || '').trim()}
              aria-label={String(user.country || '').trim()}
            >
              {countryFlag}
            </span>
          ) : null}
        </div>
        <UserIdentityBadges
          badgeColor={computedBadgeColor}
          vipLevel={user.vip_level || 0}
          premiumBadge={user.profile_badge}
          mode="verified"
          className="mt-1"
        />
      </>
    )
  }

  function formatNotificationTimestamp(value?: string | null) {
    if (!value) return '--'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '--'
    const locale = language === 'ar' ? 'ar' : language === 'tr' ? 'tr-TR' : 'en-US'
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / (24 * 60 * 60 * 1000))
    const timeOnly = date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    })
    if (diffDays === 0) {
      return language === 'ar'
        ? `اليوم، ${timeOnly}`
        : language === 'tr'
          ? `Bugün, ${timeOnly}`
          : `Today, ${timeOnly}`
    }
    if (diffDays === 1) {
      return language === 'ar'
        ? `أمس، ${timeOnly}`
        : language === 'tr'
          ? `Dün, ${timeOnly}`
          : `Yesterday, ${timeOnly}`
    }
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function mergeNotifications(items: { id: number; title: string; body: string; is_read: number; created_at?: string | null }[]) {
    const byKey = new Map<string, { id: number; title: string; body: string; is_read: number; created_at?: string | null }>()
    for (const item of items) {
      const key = getNotificationKey(item)
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, item)
        continue
      }
      if (Number(existing.is_read || 0) === 1 && Number(item.is_read || 0) === 0) {
        continue
      }
      if (Number(existing.is_read || 0) === 0 && Number(item.is_read || 0) === 1) {
        byKey.set(key, item)
        continue
      }
      const existingTime = Date.parse(String(existing.created_at || '')) || 0
      const nextTime = Date.parse(String(item.created_at || '')) || 0
      if (nextTime > existingTime || Number(existing.id || 0) < Number(item.id || 0)) {
        byKey.set(key, {
          ...item,
          is_read: Number(existing.is_read || 0) === 1 || Number(item.is_read || 0) === 1 ? 1 : 0,
        })
      }
    }
    return Array.from(byKey.values()).sort((a, b) => {
      const timeDiff = (Date.parse(String(b.created_at || '')) || 0) - (Date.parse(String(a.created_at || '')) || 0)
      if (timeDiff !== 0) return timeDiff
      return Number(b.id || 0) - Number(a.id || 0)
    })
  }

  function isStrategyNotification(item: { title?: string; body?: string }) {
    const haystack = `${String(item.title || '')} ${String(item.body || '')}`.toLowerCase()
    return (
      haystack.includes('strategy') ||
      haystack.includes('الاستراتيجية') ||
      haystack.includes('الاستراتيجيه') ||
      haystack.includes('صفقة') ||
      haystack.includes('كود')
    )
  }

  function isSupportNotification(item: { title?: string; body?: string }) {
    const haystack = `${String(item.title || '')} ${String(item.body || '')}`.toLowerCase()
    return (
      haystack.includes('support') ||
      haystack.includes('help') ||
      haystack.includes('ticket') ||
      haystack.includes('الدعم') ||
      haystack.includes('مساعدة') ||
      haystack.includes('محادثة')
    )
  }

  function resolveNotificationRoute(item: { title?: string; body?: string }) {
    if (isStrategyNotification(item)) return '/futures'
    if (isSupportNotification(item)) return canManageSupport ? '/admin/support' : '/support'
    return null
  }

  useEffect(() => {
    apiFetch('/api/notifications/unreadCount')
      .then((res) => setUnreadCount((res as { unreadCount: number }).unreadCount))
      .catch(() => setUnreadCount(0))
  }, [])

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    setPushSupported(supported)
    if (!supported) return
    setPushPermission(Notification.permission)
    getPushSubscriptionStatus()
      .then((res) => setPushSubscribed(Boolean(res.subscribed)))
      .catch(() => setPushSubscribed(false))
  }, [])

  useEffect(() => {
    primeAppFeedback()
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToLiveUpdates((event) => {
      if (event.type !== 'notification_created') return
      if (!['notifications', 'support'].includes(String(event.source || '').trim().toLowerCase())) return
      const title = String(event.title || '').trim()
      const body = String(event.body || '').trim()
      if (!title && !body) return
      const notificationKey = getNotificationKey({ title, body })
      if (readNotificationKeysRef.current.has(notificationKey)) return
      const nextNotification = {
        id: Number(event.ts || Date.now()),
        title,
        body,
        is_read: 0,
        created_at: new Date(Number(event.ts || Date.now())).toISOString(),
      }
      setNotifications((prev) => {
        return mergeNotifications([nextNotification, ...prev]).slice(0, 100)
      })
      setUnreadCount((prev) => prev + 1)

      const key = String(event.key || '').trim().toLowerCase()
      if (key === 'deposit_approved') {
        playFeedbackSound('depositApproved').catch(() => {})
      } else if (key === 'withdrawal_approved') {
        playFeedbackSound('withdrawalApproved').catch(() => {})
      }
    })
    return unsubscribe
  }, [])

  async function enablePushNotifications(forcePrompt = true) {
    if (pushBusy) return
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    setPushSupported(supported)
    if (!supported) return
    setPushBusy(true)
    try {
      let permission: NotificationPermission = Notification.permission
      if (permission !== 'granted' && forcePrompt) permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') return
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        const { publicKey } = await getPushPublicKey()
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }
      await savePushSubscription(subscription.toJSON())
      setPushSubscribed(true)
      await sendPushTest().catch(() => {})
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePushNotifications() {
    if (pushBusy) return
    setPushBusy(true)
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        const endpoint = subscription?.endpoint || null
        if (subscription) await subscription.unsubscribe().catch(() => {})
        await removePushSubscription(endpoint).catch(() => {})
      } else {
        await removePushSubscription(null).catch(() => {})
      }
      setPushSubscribed(false)
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    if (!pushSupported) return
    if (pushPermission !== 'granted') return
    enablePushNotifications(false).catch(() => {})
  }, [pushSupported, pushPermission])

  useEffect(() => {
    getHeaderIconConfig()
      .then((res) => {
        if (Array.isArray(res.items) && res.items.length === 4) setHeaderIcons(res.items)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user?.id) return
    if (String(user.preferred_language || '').toLowerCase() === language) return
    const syncKey = `${user.id}:${language}`
    if (languageSyncRef.current === syncKey) return
    languageSyncRef.current = syncKey
    updateMyProfile({ preferredLanguage: language }).catch(() => {})
  }, [language, user?.id, user?.preferred_language])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!profileMenuRef.current) return
      if (!profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    // Reset fallback state when user updates avatar.
    setAvatarBroken(false)
    setAvatarRetryNonce(0)
    setAvatarFailureCount(0)
  }, [user.avatar_url])

  function retryAvatarLoad() {
    if (!user.avatar_url) return
    setAvatarBroken(false)
    setAvatarRetryNonce((prev) => prev + 1)
  }

  function resolveAvatarSrc(url: string) {
    if (!url) return ''
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}retry=${avatarRetryNonce}`
  }

  function handleAvatarLoadSuccess() {
    if (avatarBroken) setAvatarBroken(false)
    if (avatarFailureCount !== 0) setAvatarFailureCount(0)
  }

  function handleAvatarLoadError() {
    setAvatarFailureCount((prev) => prev + 1)
    if (avatarRetryNonce < 4) {
      setAvatarRetryNonce((prev) => prev + 1)
      return
    }
    setAvatarBroken(true)
  }

  useEffect(() => {
    if (!avatarBroken || !user.avatar_url) return
    const delay = Math.min(15000, 1500 * Math.max(1, avatarFailureCount))
    const id = window.setTimeout(() => {
      retryAvatarLoad()
    }, delay)
    return () => window.clearTimeout(id)
  }, [avatarBroken, avatarFailureCount, user.avatar_url])

  useEffect(() => {
    if (!user.avatar_url) return
    function handleRecoverableNetworkState() {
      if (!avatarBroken) return
      retryAvatarLoad()
    }
    window.addEventListener('online', handleRecoverableNetworkState)
    window.addEventListener('focus', handleRecoverableNetworkState)
    return () => {
      window.removeEventListener('online', handleRecoverableNetworkState)
      window.removeEventListener('focus', handleRecoverableNetworkState)
    }
  }, [avatarBroken, user.avatar_url])

  useEffect(() => {
    setNotificationsOpen(false)
  }, [location.pathname])

  async function toggleNotifications() {
    const next = !notificationsOpen
    if (next) {
      setSearchOpen(false)
      setProfileMenuOpen(false)
    }
    setNotificationsOpen(next)
    if (!next) return
    const res = (await apiFetch('/api/notifications/list')) as {
      notifications: { id: number; title: string; body: string; is_read: number; created_at?: string | null }[]
    }
    const merged = mergeNotifications(res.notifications || [])
    readNotificationKeysRef.current = new Set(
      merged
        .filter((item) => Number(item.is_read || 0) === 1)
        .map((item) => getNotificationKey(item)),
    )
    setNotifications(merged)
  }

  const showBackButton = !['/portfolio', '/home', '/'].includes(location.pathname)
  const effectiveHeaderIcons = headerIcons.length === 4
    ? headerIcons
    : [
      { id: 'search', visible: true },
      { id: 'language', visible: true },
      { id: 'notifications', visible: true },
      { id: 'profile', visible: true },
    ]
  const computedBadgeColor = Number(user.blue_badge || 0) === 1
    ? 'blue'
    : user.verification_status === 'verified'
      ? 'gold'
      : 'none'
  const premiumProfileColorClass = getPremiumProfileColorClass(user.profile_color)
  const profileIconVisible = effectiveHeaderIcons.some((item) => item.id === 'profile' && item.visible)
  const showUtilityLinksInHeader = utilityLinks.length > 0 && location.pathname !== '/portfolio'
  const desktopQuickLinks = [
    { to: '/portfolio', label: t('nav_home'), icon: House },
    { to: '/market', label: t('nav_markets'), icon: BarChart3 },
    { to: '/assets', label: t('wallet_assets'), icon: Wallet },
    { to: '/friends', label: t('nav_friends'), icon: User },
    { to: '/profile', label: t('nav_profile'), icon: UserCircle2 },
  ]

  function closeHeaderPopups(options?: { keepProfileMenu?: boolean }) {
    setNotificationsOpen(false)
    setSearchOpen(false)
    if (!options?.keepProfileMenu) setProfileMenuOpen(false)
  }

  return (
    <div dir={direction} className="min-h-[100dvh] overflow-x-clip bg-app-bg text-[var(--text-primary)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(7,11,20,0.96),rgba(11,17,32,0.9))] pt-[max(6px,env(safe-area-inset-top))] shadow-[0_8px_26px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        <div className="mx-auto w-full max-w-[1280px] px-3 pb-2 pt-1 lg:px-6 lg:pb-2 lg:pt-1.5">
          <div className="app-header-row">
            <div className="app-header-side app-header-side-start">
              {profileIconVisible ? (
                <div className="relative" ref={profileMenuRef}>
                  <button
                    className={`icon-interactive liquid-glass-icon flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-brand-blue/45 shadow-[0_0_0_1px_rgba(0,123,255,0.18)] focus:outline-none focus:ring-2 focus:ring-brand-blue/35 ${premiumProfileColorClass}`}
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false)
                      setSearchOpen(false)
                      setProfileMenuOpen((v) => !v)
                    }}
                    aria-label={t('profile_menu_title')}
                  >
                    {user.avatar_url && !avatarBroken ? (
                      <img
                        src={resolveAvatarSrc(user.avatar_url)}
                        alt={t('nav_profile')}
                        className="h-full w-full object-cover"
                        onLoad={handleAvatarLoadSuccess}
                        onError={handleAvatarLoadError}
                      />
                    ) : (
                      <UserCircle2 size={20} className="text-white/85" />
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {profileMenuOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="glass-panel absolute start-0 top-14 z-50 min-w-44 rounded-xl p-2 shadow-[0_16px_32px_rgba(0,0,0,0.45)]"
                      >
                        <div className="mb-1 rounded-lg border border-app-border bg-app-elevated px-3 py-2">
                          {renderProfileIdentity(true)}
                        </div>
                        {utilityLinks.length > 0 ? (
                          <div className="mb-1 space-y-1">
                            {utilityLinks.map((item) => (
                              <button
                                key={`menu-${item.route}`}
                                type="button"
                                className="w-full rounded-lg px-3 py-2 text-start text-sm text-white/90 hover:bg-app-elevated"
                                onClick={() => {
                                  closeHeaderPopups()
                                  navigate(item.route)
                                }}
                              >
                                {item.title}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-start text-sm text-white/90 hover:bg-app-elevated"
                          onClick={() => {
                            closeHeaderPopups()
                            navigate('/profile')
                          }}
                        >
                          {t('nav_profile')}
                        </button>
                        <button
                          type="button"
                          className="mt-1 w-full rounded-lg px-3 py-2 text-start text-sm text-white/90 hover:bg-[#2a3342]"
                          onClick={() => {
                            closeHeaderPopups()
                            onLogout()
                          }}
                        >
                          {t('logout') || 'Logout'}
                        </button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null}

              {showBackButton ? (
                <button
                  className="icon-interactive liquid-glass-icon flex h-10 w-10 items-center justify-center rounded-full text-white/85 hover:border-brand-blue/50 hover:text-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/35"
                  type="button"
                  onClick={() => {
                    closeHeaderPopups()
                    navigate(-1)
                  }}
                  aria-label={t('back')}
                >
                  {direction === 'rtl' ? <ArrowRight size={17} /> : <ArrowLeft size={17} />}
                </button>
              ) : (
                <div className="h-10 w-10" aria-hidden="true" />
              )}
            </div>

            <div className="app-header-brand-wrap">
              <Link to="/portfolio" className="app-header-brand-banner" aria-label="Break Cash" dir="ltr">
                <span className="app-header-brand-mark" aria-hidden="true">
                  <span className="app-header-brand-mark-line app-header-brand-mark-line-lg" />
                  <span className="app-header-brand-mark-line app-header-brand-mark-line-md" />
                  <span className="app-header-brand-mark-line app-header-brand-mark-line-sm" />
                </span>
                <span className="app-header-brand-wordmark">Break Cash</span>
                <span className="app-header-brand-badge" aria-hidden="true">
                  <span className="app-header-brand-badge-check">✓</span>
                </span>
              </Link>
            </div>

            <div className="app-header-side app-header-side-actions">
              <div className="glass-panel-soft app-header-actions-shell flex items-center gap-1.5 rounded-2xl p-1.5">
              {managementShortcut ? (
                <Link
                  to={managementShortcut.to}
                  className="icon-interactive liquid-glass-icon relative flex h-10 min-w-[46px] items-center justify-center gap-1 rounded-full px-2 text-white/90 hover:border-brand-blue/55 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue/35"
                  aria-label={managementShortcut.label}
                  title={managementShortcut.label}
                  onClick={() => closeHeaderPopups()}
                >
                  {managementShortcut.kind === 'owner' ? <Crown size={16} /> : <Shield size={16} />}
                  <span className="absolute -end-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand-blue px-1 text-[10px] font-bold leading-4 text-white">
                    {managementShortcut.count}
                  </span>
                </Link>
              ) : null}
              <a
                href={WHATSAPP_CHANNEL_URL}
                target="_blank"
                rel="noreferrer"
                className="icon-interactive liquid-glass-icon flex h-10 w-10 items-center justify-center rounded-full text-[#25D366] hover:border-emerald-400/55 hover:text-[#4af08a] focus:outline-none focus:ring-2 focus:ring-emerald-400/35"
                aria-label="WhatsApp Channel"
                title="WhatsApp Channel"
                onClick={() => closeHeaderPopups()}
              >
                <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-current" aria-hidden="true">
                  <path d="M19.05 4.91A9.82 9.82 0 0 0 12.03 2C6.61 2 2.2 6.41 2.2 11.83c0 1.74.45 3.43 1.3 4.92L2 22l5.4-1.42a9.8 9.8 0 0 0 4.63 1.18h.01c5.42 0 9.83-4.41 9.83-9.83a9.77 9.77 0 0 0-2.82-7.02Zm-7.02 15.19h-.01a8.15 8.15 0 0 1-4.15-1.13l-.3-.18-3.2.84.86-3.12-.2-.32a8.15 8.15 0 0 1-1.26-4.36c0-4.5 3.66-8.16 8.17-8.16a8.1 8.1 0 0 1 5.78 2.4 8.1 8.1 0 0 1 2.38 5.77c0 4.5-3.66 8.16-8.17 8.16Zm4.48-6.1c-.24-.12-1.4-.69-1.62-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.42-1.34-1.66-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.48-.4-.41-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.68 2.56 4.07 3.59.57.25 1.02.4 1.37.51.58.18 1.1.15 1.52.09.46-.07 1.4-.57 1.6-1.12.2-.55.2-1.02.14-1.12-.06-.1-.22-.16-.46-.28Z" />
                </svg>
              </a>
              {effectiveHeaderIcons.map((item) => {
                if (!item.visible) return null
                if (item.id === 'profile') return null
                if (item.id === 'search') {
                  if (searchOpen) return null
                  return (
                    <button
                      key="search"
                      className="icon-interactive liquid-glass-icon flex h-10 w-10 items-center justify-center rounded-full text-white/85 hover:border-brand-blue/55 hover:text-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/35"
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false)
                        setProfileMenuOpen(false)
                        setSearchOpen(true)
                      }}
                      aria-label={t('search_actions')}
                    >
                      <Search size={17} />
                    </button>
                  )
                }
                if (item.id === 'language') {
                  return (
                    <label key="language" className="liquid-glass-icon inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[11px] text-white/65">
                      <Globe2 size={13} />
                      <select
                        className="glass-input h-7 rounded-full px-2 text-xs text-[var(--text-primary)]"
                        value={language}
                        onChange={(e) => {
                          setNotificationsOpen(false)
                          setSearchOpen(false)
                          setLanguage(e.target.value as Language)
                        }}
                        aria-label={t('language')}
                      >
                        <option value="ar">AR</option>
                        <option value="en">EN</option>
                        <option value="tr">TR</option>
                      </select>
                    </label>
                  )
                }
                if (item.id === 'notifications') {
                  return (
                    <button
                      key="notifications"
                      className="icon-interactive liquid-glass-icon relative flex h-10 w-10 items-center justify-center rounded-full text-white/85 hover:border-brand-blue/55 hover:text-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/35"
                      type="button"
                      onClick={toggleNotifications}
                      aria-label={t('notifications')}
                    >
                      <Bell size={17} />
                      {unreadCount > 0 ? (
                        <span className="absolute -end-0.5 -top-0.5 min-w-[17px] rounded-full border border-[#1f2228] bg-brand-blue px-1 text-center text-[10px] font-semibold leading-4 text-white">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      ) : null}
                    </button>
                  )
                }
                return null
              })}
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {searchOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="glass-panel mt-2 rounded-2xl p-2">
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-white/40">
                      <Search size={15} />
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t('wallet_search')}
                      className="glass-input h-10 w-full rounded-full ps-10 pe-10 text-sm text-[var(--text-primary)] placeholder:text-app-muted/80 transition"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 end-2 inline-flex items-center text-white/60 hover:text-white"
                      onClick={() => setSearchOpen(false)}
                      aria-label={t('close_search')}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    <button
                      type="button"
                      className="glass-pill rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                      onClick={() => {
                        closeHeaderPopups()
                        navigate('/market')
                      }}
                    >
                      {t('nav_markets')}
                    </button>
                    <button
                      type="button"
                      className="glass-pill rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                      onClick={() => {
                        closeHeaderPopups()
                        navigate('/futures')
                      }}
                    >
                      {t('nav_futures')}
                    </button>
                    <button
                      type="button"
                      className="glass-pill rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                      onClick={() => {
                        closeHeaderPopups()
                        navigate('/friends')
                      }}
                    >
                      {t('nav_friends')}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {showUtilityLinksInHeader ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {utilityLinks.map((item) => (
                <Link
                  key={item.route}
                  to={item.route}
                  onClick={() => closeHeaderPopups()}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                    location.pathname === item.route
                      ? 'border border-brand-blue/60 bg-brand-blue/22 text-white shadow-[0_0_0_1px_rgba(0,123,255,0.22)]'
                      : 'border border-white/10 bg-[#242a34] text-white/85 hover:bg-[#2d3542]'
                  }`}
                >
                  <Shield size={11} />
                  {item.title}
                </Link>
              ))}
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {notificationsOpen ? (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.985 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="liquid-modal-backdrop app-header-notifications-panel mt-2"
              >
                <div className="liquid-modal-card glass-panel rounded-2xl border border-app-border bg-app-card p-3">
                  <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-sm font-medium text-white">
                      {pushSubscribed ? pushTexts.disable : pushTexts.enable}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {pushPermission === 'denied'
                        ? pushTexts.deniedHint
                        : pushSubscribed
                          ? pushTexts.enabledHint
                          : pushTexts.idleHint}
                    </div>
                    {pushSupported ? (
                      <button
                        type="button"
                        className="mt-3 icon-interactive rounded-full border border-app-border bg-app-elevated px-3 py-1.5 text-xs text-white/85 hover:border-brand-blue/40 hover:text-brand-blue"
                        onClick={() => {
                          if (pushSubscribed) disablePushNotifications().catch(() => {})
                          else enablePushNotifications(true).catch(() => {})
                        }}
                        disabled={pushBusy}
                      >
                        {pushBusy ? pushTexts.loading : pushSubscribed ? pushTexts.disable : pushTexts.enable}
                      </button>
                    ) : (
                      <div className="mt-3 text-xs text-white/45">{pushTexts.unsupported}</div>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="text-sm text-white/55">{t('no_notifications')}</div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((item) => (
                        <div
                          key={item.id}
                          className={`glass-panel-soft flex items-start justify-between gap-3 rounded-xl p-2 transition ${
                            Number(item.is_read || 0) === 0
                              ? 'border border-brand-blue/30 bg-brand-blue/10 shadow-[0_0_0_1px_rgba(0,123,255,0.12)]'
                              : 'opacity-80'
                          } ${
                            isStrategyNotification(item) || isSupportNotification(item)
                              ? 'border border-amber-400/25 bg-amber-500/10'
                              : ''
                          }`}
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-start"
                            onClick={() => {
                              const route = resolveNotificationRoute(item)
                              if (!route) return
                              closeHeaderPopups()
                              navigate(route)
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">{item.title}</div>
                              {Number(item.is_read || 0) === 0 ? (
                                <span className="rounded-full border border-brand-blue/30 bg-brand-blue/15 px-2 py-0.5 text-[10px] font-bold text-brand-blue">
                                  جديد
                                </span>
                              ) : null}
                              {isStrategyNotification(item) || isSupportNotification(item) ? (
                                <span className="rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                  مهم
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-white/60">{item.body}</div>
                            <div className="mt-1 text-[11px] text-white/40">{formatNotificationTimestamp(item.created_at)}</div>
                            {isStrategyNotification(item) ? (
                              <div className="mt-1 text-[11px] text-amber-200/85">اضغط لفتح لوحة الصفقات الاستراتيجية</div>
                            ) : isSupportNotification(item) ? (
                              <div className="mt-1 text-[11px] text-amber-200/85">
                                {canManageSupport ? 'اضغط لفتح مركز دعم الإدارة' : 'اضغط لفتح مركز المساعدة'}
                              </div>
                            ) : null}
                          </button>
                          {Number(item.is_read || 0) === 0 ? (
                            <button
                              className="icon-interactive rounded-full border border-app-border bg-app-elevated px-2 py-1 text-[11px] text-white/80 hover:border-brand-blue/40 hover:text-brand-blue"
                              type="button"
                              onClick={async () => {
                                await apiFetch('/api/notifications/markAsRead', {
                                  method: 'POST',
                                  body: JSON.stringify({ id: item.id, title: item.title, body: item.body }),
                                })
                                readNotificationKeysRef.current.add(getNotificationKey(item))
                                setNotifications((rows) =>
                                  rows.map((row) => (row.id === item.id ? { ...row, is_read: 1 } : row)),
                                )
                                setUnreadCount((value) => (value > 0 ? value - 1 : 0))
                              }}
                            >
                              {t('mark_read')}
                            </button>
                          ) : (
                            <div className="px-2 py-1 text-[11px] text-white/35">مقروء</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-3 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-3 lg:px-6 lg:pb-[calc(9rem+env(safe-area-inset-bottom))]">
        <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-4">
          <aside className="hidden lg:block">
            <div className="sticky top-[96px] space-y-3">
              <div className="glass-panel rounded-2xl p-3">
                <div className="flex items-center gap-2">
                  <div className={`h-11 w-11 overflow-hidden rounded-full border border-app-border bg-app-elevated ${premiumProfileColorClass}`}>
                    {user.avatar_url && !avatarBroken ? (
                      <img
                        src={resolveAvatarSrc(user.avatar_url)}
                        alt={t('nav_profile')}
                        className="h-full w-full object-cover"
                        onLoad={handleAvatarLoadSuccess}
                        onError={handleAvatarLoadError}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/70">
                        <UserCircle2 size={18} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    {renderProfileIdentity()}
                  </div>
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-2.5">
                <div className="space-y-1">
                  {desktopQuickLinks.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname.startsWith(item.to)
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition ${
                          isActive
                            ? 'border border-[var(--border-blue)] bg-brand-blue/15 text-white shadow-[var(--shadow-inner),var(--glow-blue)]'
                            : 'border border-transparent text-white/75 hover:border-app-border hover:bg-app-elevated'
                        }`}
                      >
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                            isActive
                              ? 'border-[var(--border-blue)] bg-brand-blue/18 text-white'
                              : 'border-white/10 bg-[var(--bg-elevated)] text-white/80 group-hover:border-white/20'
                          }`}
                        >
                          <Icon size={14} />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </main>
      <InstallPrompt />
      <MobileBottomNav />
    </div>
  )
}
