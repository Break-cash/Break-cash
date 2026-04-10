import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
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
  hasSessionToken,
  getHeaderIconConfig,
  getHomeLeaderboardConfig,
  getPushPublicKey,
  getPushSubscriptionStatus,
  removeNativePushToken,
  removePushSubscription,
  savePushSubscription,
  saveNativePushToken,
  sendPushTest,
  sendNativePushTest,
  subscribeToLiveUpdates,
  updateMyProfile,
  type AuthUser,
  type HomeLeaderboardConfig,
  type HeaderIconConfigItem,
} from './api'
import { playFeedbackSound, primeAppFeedback } from './appFeedback'
import { LeaderboardSection, defaultHomeLeaderboardConfig } from './components/home/LeaderboardSection'
import { InstallPrompt } from './components/InstallPrompt'
import { AppHeader } from './components/layout/AppHeader'
import { MobileBottomNav } from './components/mobile/MobileBottomNav'
import { UserIdentityBadges } from './components/user/UserIdentityBadges'
import { useFrameRateProfile } from './hooks/useFrameRateProfile'
import { useInNativeApp } from './hooks/useInNativeApp'
import { type Language, useI18n } from './i18nCore'
import {
  getCurrentNativePushToken,
  getLastNativePushError,
  getNativePushPermission,
  getNativePushPlatform,
  registerNativePush,
  requestNativePushPermission,
  supportsNativePush,
  unregisterNativePush,
} from './nativePush'
import { getPremiumProfileColorClass } from './premiumIdentity'

const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb7YcfVEVccPWi28j22U'

const COUNTRY_FLAG_ALIASES: Record<string, string> = {
  tr: 'TR',
  turkey: 'TR',
  turkiye: 'TR',
  'türkiye': 'TR',
  'تركيا': 'TR',
  sa: 'SA',
  saudi: 'SA',
  'saudi arabia': 'SA',
  'السعودية': 'SA',
  eg: 'EG',
  egypt: 'EG',
  'مصر': 'EG',
  ae: 'AE',
  uae: 'AE',
  'united arab emirates': 'AE',
  'الامارات': 'AE',
  'الإمارات': 'AE',
  iq: 'IQ',
  iraq: 'IQ',
  'العراق': 'IQ',
  sy: 'SY',
  syria: 'SY',
  'سوريا': 'SY',
  jo: 'JO',
  jordan: 'JO',
  'الاردن': 'JO',
  'الأردن': 'JO',
  lb: 'LB',
  lebanon: 'LB',
  'لبنان': 'LB',
  kw: 'KW',
  kuwait: 'KW',
  'الكويت': 'KW',
  qa: 'QA',
  qatar: 'QA',
  'قطر': 'QA',
  bh: 'BH',
  bahrain: 'BH',
  'البحرين': 'BH',
  om: 'OM',
  oman: 'OM',
  'عمان': 'OM',
  ye: 'YE',
  yemen: 'YE',
  'اليمن': 'YE',
  ma: 'MA',
  morocco: 'MA',
  'المغرب': 'MA',
  dz: 'DZ',
  algeria: 'DZ',
  'الجزائر': 'DZ',
  tn: 'TN',
  tunisia: 'TN',
  'تونس': 'TN',
  ly: 'LY',
  libya: 'LY',
  'ليبيا': 'LY',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  america: 'US',
  'امريكا': 'US',
  'أمريكا': 'US',
  gb: 'GB',
  uk: 'GB',
  britain: 'GB',
  england: 'GB',
  'بريطانيا': 'GB',
  fr: 'FR',
  france: 'FR',
  'فرنسا': 'FR',
  de: 'DE',
  germany: 'DE',
  'ألمانيا': 'DE',
  'المانيا': 'DE',
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
  const { scaleDuration } = useFrameRateProfile()
  const inNativeApp = useInNativeApp()
  const nativePushAvailable = inNativeApp || supportsNativePush()
  const { t, language, setLanguage, direction } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [leaderboardConfig, setLeaderboardConfig] = useState<HomeLeaderboardConfig>(defaultHomeLeaderboardConfig)
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
  const [pushError, setPushError] = useState('')
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [avatarRetryNonce, setAvatarRetryNonce] = useState(0)
  const [avatarFailureCount, setAvatarFailureCount] = useState(0)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
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
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  function mapNativePermissionState(permission: string) {
    const normalized = String(permission || '').trim().toLowerCase()
    if (normalized === 'granted') return 'granted' as const
    if (normalized.startsWith('prompt')) return 'default' as const
    return 'denied' as const
  }

  const pushTexts =
    language === 'ar'
      ? {
          enable: 'ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠØ©',
          disable: 'Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠØ©',
          enabledHint: 'Ø³ÙŠØµÙ„Ùƒ Ø¥Ø´Ø¹Ø§Ø± Ø­ØªÙ‰ Ø¹Ù†Ø¯ Ø§Ù„Ø®Ø±ÙˆØ¬ Ù…Ù† Ø§Ù„ØªØ·Ø¨ÙŠÙ‚.',
          deniedHint: 'Ø§Ù„Ù…ØªØµÙØ­ Ù…Ù†Ø¹ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª. ÙØ¹Ù‘Ù„Ù‡Ø§ Ù…Ù† Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ØªØµÙØ­ Ø£Ùˆ Ø§Ù„Ù†Ø¸Ø§Ù….',
          idleHint: 'ÙØ¹Ù‘Ù„Ù‡Ø§ Ù„ÙŠØµÙ„Ùƒ Ø¥Ø´Ø¹Ø§Ø± ÙØ¹Ù„ÙŠ Ø¹Ù†Ø¯ Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø§Øª ÙˆØ§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª Ø§Ù„Ù…Ù‡Ù…Ø©.',
          loading: 'Ø¬Ø§Ø±Ù Ø§Ù„ØªÙØ¹ÙŠÙ„...',
          unsupported: 'Web Push ØºÙŠØ± Ù…Ø¯Ø¹ÙˆÙ… Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ù…ØªØµÙØ­ Ø£Ùˆ Ø§Ù„Ø¬Ù‡Ø§Ø².',
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
          mode="all"
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
        ? `Ø§Ù„ÙŠÙˆÙ…ØŒ ${timeOnly}`
        : language === 'tr'
          ? `BugÃ¼n, ${timeOnly}`
          : `Today, ${timeOnly}`
    }
    if (diffDays === 1) {
      return language === 'ar'
        ? `Ø£Ù…Ø³ØŒ ${timeOnly}`
        : language === 'tr'
          ? `DÃ¼n, ${timeOnly}`
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
      haystack.includes('Ø§Ù„Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ©') ||
      haystack.includes('Ø§Ù„Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠÙ‡') ||
      haystack.includes('ØµÙÙ‚Ø©') ||
      haystack.includes('ÙƒÙˆØ¯')
    )
  }

  function isSupportNotification(item: { title?: string; body?: string }) {
    const haystack = `${String(item.title || '')} ${String(item.body || '')}`.toLowerCase()
    return (
      haystack.includes('support') ||
      haystack.includes('help') ||
      haystack.includes('ticket') ||
      haystack.includes('Ø§Ù„Ø¯Ø¹Ù…') ||
      haystack.includes('Ù…Ø³Ø§Ø¹Ø¯Ø©') ||
      haystack.includes('Ù…Ø­Ø§Ø¯Ø«Ø©')
    )
  }

  function resolveNotificationRoute(item: { title?: string; body?: string }) {
    if (isStrategyNotification(item)) return '/futures'
    if (isSupportNotification(item)) return canManageSupport ? '/admin/support' : '/support'
    return null
  }

  useEffect(() => {
    if (!hasSessionToken()) {
      setUnreadCount(0)
      return
    }
    apiFetch('/api/notifications/unreadCount', { suppressErrorToast: true })
      .then((res) => setUnreadCount((res as { unreadCount: number }).unreadCount))
      .catch(() => setUnreadCount(0))
  }, [])

  useEffect(() => {
    const supported = nativePushAvailable
      ? true
      : typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window
    setPushSupported(supported)
    if (!supported) return
    if (nativePushAvailable) {
      getNativePushPermission()
        .then((permission) => setPushPermission(mapNativePermissionState(String(permission))))
        .catch(() => setPushPermission('default'))
    } else {
      setPushPermission(Notification.permission)
    }
    if (!hasSessionToken()) {
      setPushSubscribed(false)
      return
    }
    getPushSubscriptionStatus()
      .then((res) => setPushSubscribed(Boolean(res.subscribed)))
      .catch(() => setPushSubscribed(false))
  }, [nativePushAvailable])

  useEffect(() => {
    primeAppFeedback()
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToLiveUpdates((event) => {
      if (
        (event.type === 'settings_updated' || event.type === 'home_content_updated') &&
        String(event.key || '').trim().toLowerCase() === 'home_leaderboard'
      ) {
        getHomeLeaderboardConfig()
          .then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig))
          .catch(() => {})
      }
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
    setPushError('')
    const supported = nativePushAvailable
      ? true
      : typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window
    setPushSupported(supported)
    if (!supported) return
    setPushBusy(true)
    try {
      if (nativePushAvailable) {
        let permission = await getNativePushPermission()
        if (permission !== 'granted' && forcePrompt) {
          permission = await requestNativePushPermission()
        }
        const normalizedPermission = mapNativePermissionState(String(permission))
        setPushPermission(normalizedPermission)

        const token = await registerNativePush()
        if (!token) {
          const nativeError = String(getLastNativePushError() || '').trim()
          const timeoutLike =
            nativeError === 'NATIVE_REGISTRATION_TIMEOUT' ||
            nativeError === 'SERVICE_NOT_AVAILABLE'
          setPushError(
            timeoutLike
              ? 'ØªØ¹Ø°Ø± Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ Ø±Ù…Ø² Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ù…Ù† Ø®Ø¯Ù…Ø§Øª Google. ØªØ­Ù‚Ù‚ Ù…Ù† Ø§ØªØµØ§Ù„ Ø§Ù„Ø¥Ù†ØªØ±Ù†Øª ÙˆØ®Ø¯Ù…Ø§Øª Google Play Ø«Ù… Ø£Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø©.'
              : nativeError
              ? `ØªØ¹Ø°Ø± ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¬Ù‡Ø§Ø² Ù„Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª (${nativeError}).`
              : 'ØªØ¹Ø°Ø± ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¬Ù‡Ø§Ø² Ù„Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª. Ø­Ø¯Ù‘Ø« Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø«Ù… Ø£Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø©.',
          )
          return
        }
        await saveNativePushToken(token, getNativePushPlatform())
        setPushSubscribed(true)
        if (permission !== 'granted') {
          setPushError('ØªÙ… Ø±Ø¨Ø· Ø§Ù„Ø¬Ù‡Ø§Ø²ØŒ Ù„ÙƒÙ† Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù†Ø¸Ø§Ù… Ù…Ø§ Ø²Ø§Ù„Øª Ù…Ø¹Ø·Ù„Ø©. ÙØ¹Ù‘Ù„Ù‡Ø§ Ù…Ù† Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„ØªØ·Ø¨ÙŠÙ‚.')
        }
        await sendNativePushTest().catch(() => {})
        return
      }

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ØªØ¹Ø°Ø± ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª.'
      setPushError(message)
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePushNotifications() {
    if (pushBusy) return
    setPushError('')
    setPushBusy(true)
    try {
      if (nativePushAvailable) {
        const token = getCurrentNativePushToken()
        await unregisterNativePush().catch(() => {})
        await removeNativePushToken(token).catch(() => {})
      } else if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        const endpoint = subscription?.endpoint || null
        if (subscription) await subscription.unsubscribe().catch(() => {})
        await removePushSubscription(endpoint).catch(() => {})
      } else {
        await removePushSubscription(null).catch(() => {})
      }
      setPushSubscribed(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ØªØ¹Ø°Ø± Ø¥ÙŠÙ‚Ø§Ù Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª.'
      setPushError(message)
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    if (!pushSupported) return
    if (pushPermission !== 'granted') return
    enablePushNotifications(false).catch(() => {})
  }, [pushSupported, pushPermission, nativePushAvailable])

  useEffect(() => {
    getHeaderIconConfig()
      .then((res) => {
        if (Array.isArray(res.items) && res.items.length === 4) setHeaderIcons(res.items)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    getHomeLeaderboardConfig()
      .then((res) => setLeaderboardConfig(res.config || defaultHomeLeaderboardConfig))
      .catch(() => setLeaderboardConfig(defaultHomeLeaderboardConfig))
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
    function onDocPointerDown(event: PointerEvent) {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : []
      const target = event.target as Node | null
      const moreContainsTarget =
        !!moreMenuRef.current &&
        !!target &&
        (moreMenuRef.current.contains(target) || path.includes(moreMenuRef.current))

      if (!moreContainsTarget) setMoreMenuOpen(false)
    }

    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
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
    setLeaderboardOpen(false)
    setMoreMenuOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  async function toggleNotifications() {
    const next = !notificationsOpen
    if (next) {
      setSearchOpen(false)
      setLeaderboardOpen(false)
      setMoreMenuOpen(false)
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
  const computedBadgeColor =
    user.badge_color === 'blue' ||
    user.badge_color === 'gold' ||
    user.badge_color === 'red' ||
    user.badge_color === 'green' ||
    user.badge_color === 'purple' ||
    user.badge_color === 'silver' ||
    user.badge_color === 'none'
      ? user.badge_color
      : Number(user.blue_badge || 0) === 1
        ? 'blue'
        : 'none'
  const premiumProfileColorClass = getPremiumProfileColorClass(user.profile_color)
  const showUtilityLinksInHeader = utilityLinks.length > 0 && location.pathname !== '/portfolio'
  const isPortfolioDashboard = location.pathname === '/portfolio'
  const desktopQuickLinks = [
    { to: '/portfolio', label: t('nav_home'), icon: House },
    { to: '/market', label: t('nav_markets'), icon: BarChart3 },
    { to: '/assets', label: t('wallet_assets'), icon: Wallet },
    { to: '/friends', label: t('nav_friends'), icon: User },
    { to: '/profile', label: t('nav_profile'), icon: UserCircle2 },
  ]
  const headerTitleMap: Record<string, string> = {
    '/portfolio': 'Break Cash',
    '/wallet': t('nav_wallet'),
    '/market': t('nav_markets'),
    '/arena': t('arena_home_title'),
    '/deposit': t('deposit_page_title'),
    '/withdraw': t('withdraw_page_title'),
    '/support': t('support_page_title'),
    '/notifications': t('notifications'),
    '/profile': t('nav_profile'),
    '/friends': t('nav_friends'),
    '/vip': 'VIP',
    '/mining': t('nav_mining'),
  }
  const currentHeaderTitle =
    location.pathname.startsWith('/arena/result/')
      ? t('arena_result_title') : location.pathname.startsWith('/arena/round/')
        ? t('arena_round_title') : headerTitleMap[location.pathname] || (showBackButton ? document.title || 'Break Cash' : 'Break Cash')

  function closeHeaderPopups() {
    setNotificationsOpen(false)
    setLeaderboardOpen(false)
    setSearchOpen(false)
    setMoreMenuOpen(false)
    setMenuOpen(false)
  }

  function applyLanguage(lang: Language) {
    setNotificationsOpen(false)
    setLeaderboardOpen(false)
    setSearchOpen(false)
    setMoreMenuOpen(false)
    setLanguage(lang)
  }

  const moreMenu = moreMenuOpen ? (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.985 }}
      transition={{ duration: scaleDuration(0.2), ease: 'easeOut' }}
      onPointerDown={(event) => event.stopPropagation()}
      className="app-header-more-menu app-header-more-menu--language z-[95] rounded-2xl border border-app-border bg-[#0f1628]/95 p-2 shadow-[0_20px_46px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
    >
      <div className="mb-1 px-2 text-[11px] font-semibold text-white/60">{t('language')}</div>
      <div className="space-y-1">
        {[
          { id: 'ar', label: t('language_name_ar') },
          { id: 'en', label: t('language_name_en') },
          { id: 'tr', label: t('language_name_tr') },
        ].map((item) => {
          const active = language === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => applyLanguage(item.id as Language)}
              className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm transition ${
                active
                  ? 'border border-brand-blue/40 bg-brand-blue/18 text-white'
                  : 'text-white/80 hover:bg-white/8 hover:text-white'
              }`}
            >
              <span>{item.label}</span>
              {active ? <Globe2 size={14} className="text-brand-blue" /> : null}
            </button>
          )
        })}
      </div>
    </motion.div>
  ) : null

  const utilityLinksRow = showUtilityLinksInHeader ? (
    <>
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
    </>
  ) : null

  const extraPanels = (
    <>
      <AnimatePresence initial={false}>
        {leaderboardOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: scaleDuration(0.2), ease: 'easeOut' }}
            className="liquid-modal-backdrop app-header-notifications-panel"
          >
            <div className="liquid-modal-card glass-panel rounded-2xl border border-app-border bg-app-card p-2">
              <div className="max-h-[72dvh] overflow-auto rounded-2xl [&_section]:mb-0">
                <LeaderboardSection config={leaderboardConfig} previewMode={!leaderboardConfig?.enabled} />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {searchOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -6, height: 0 }}
            transition={{ duration: scaleDuration(0.2), ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="glass-panel rounded-2xl p-2">
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
                <button type="button" className="glass-pill rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]" onClick={() => { closeHeaderPopups(); navigate('/market') }}>{t('nav_markets')}</button>
                <button type="button" className="glass-pill rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]" onClick={() => { closeHeaderPopups(); navigate('/futures') }}>{t('nav_futures')}</button>
                <button type="button" className="glass-pill rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]" onClick={() => { closeHeaderPopups(); navigate('/friends') }}>{t('nav_friends')}</button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {notificationsOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: scaleDuration(0.2), ease: 'easeOut' }}
            className="liquid-modal-backdrop app-header-notifications-panel"
          >
            <div className="liquid-modal-card glass-panel rounded-2xl border border-app-border bg-app-card p-3">
              <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-medium text-white">{pushSubscribed ? pushTexts.disable : pushTexts.enable}</div>
                <div className="mt-1 text-xs text-white/60">
                  {pushPermission === 'denied' ? pushTexts.deniedHint : pushSubscribed ? pushTexts.enabledHint : pushTexts.idleHint}
                </div>
                {pushError ? <div className="mt-2 rounded-lg border border-red-400/35 bg-red-500/15 px-2 py-1 text-[11px] text-red-100">{pushError}</div> : null}
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
                        Number(item.is_read || 0) === 0 ? 'border border-brand-blue/30 bg-brand-blue/10 shadow-[0_0_0_1px_rgba(0,123,255,0.12)]' : 'opacity-80'
                      } ${isStrategyNotification(item) || isSupportNotification(item) ? 'border border-amber-400/25 bg-amber-500/10' : ''}`}
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
                          {Number(item.is_read || 0) === 0 ? <span className="rounded-full border border-brand-blue/30 bg-brand-blue/15 px-2 py-0.5 text-[10px] font-bold text-brand-blue">Ø¬Ø¯ÙŠØ¯</span> : null}
                          {isStrategyNotification(item) || isSupportNotification(item) ? <span className="rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-200">Ù…Ù‡Ù…</span> : null}
                        </div>
                        <div className="text-xs text-white/60">{item.body}</div>
                        <div className="mt-1 text-[11px] text-white/40">{formatNotificationTimestamp(item.created_at)}</div>
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
                            setNotifications((rows) => rows.map((row) => (row.id === item.id ? { ...row, is_read: 1 } : row)))
                            setUnreadCount((value) => (value > 0 ? value - 1 : 0))
                          }}
                        >
                          {t('mark_read')}
                        </button>
                      ) : (
                        <div className="px-2 py-1 text-[11px] text-white/35">Ù…Ù‚Ø±ÙˆØ¡</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )

  const menuDrawer = menuOpen ? (
    <AnimatePresence initial={false}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: scaleDuration(0.16), ease: 'easeOut' }}
        className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm"
        onClick={() => setMenuOpen(false)}
      >
        <motion.div
          initial={{ x: direction === 'rtl' ? 26 : -26, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction === 'rtl' ? 26 : -26, opacity: 0 }}
          transition={{ duration: scaleDuration(0.18), ease: 'easeOut' }}
          className={`absolute top-[calc(env(safe-area-inset-top)+14px)] ${
            direction === 'rtl' ? 'left-3' : 'right-3'
          } w-[min(320px,calc(100vw-24px))] rounded-[24px] border border-app-border bg-[linear-gradient(180deg,rgba(12,16,29,0.98),rgba(10,13,24,0.98))] p-3 shadow-[0_24px_64px_rgba(0,0,0,0.45)]`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3 flex items-center gap-2 rounded-2xl border border-app-border bg-app-elevated p-3">
            <div className={`h-10 w-10 overflow-hidden rounded-full border border-app-border bg-app-surface ${premiumProfileColorClass}`}>
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
            <div className="min-w-0 flex-1">{renderProfileIdentity(true)}</div>
          </div>

          <div className="space-y-1">
            {desktopQuickLinks.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname.startsWith(item.to)
              return (
                <Link
                  key={`drawer-${item.to}`}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                    isActive
                      ? 'border border-[var(--border-blue)] bg-brand-blue/14 text-white shadow-[var(--shadow-inner)]'
                      : 'border border-transparent text-white/78 hover:border-app-border hover:bg-app-elevated'
                  }`}
                  onClick={() => closeHeaderPopups()}
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-surface/85">
                    <Icon size={16} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          {utilityLinks.length > 0 ? (
            <div className="mt-3 border-t border-white/8 pt-3">
              <div className="mb-2 text-xs font-semibold text-white/45">{t('nav_admin')}</div>
              <div className="space-y-1">
                {utilityLinks.map((item) => (
                  <button
                    key={`drawer-util-${item.route}`}
                    type="button"
                    className="w-full rounded-2xl px-3 py-2.5 text-start text-sm text-white/82 hover:bg-app-elevated"
                    onClick={() => {
                      closeHeaderPopups()
                      navigate(item.route)
                    }}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-3 border-t border-white/8 pt-3">
            <button
              type="button"
              className="w-full rounded-2xl bg-white/6 px-3 py-3 text-start text-sm text-white/82 hover:bg-white/10"
              onClick={() => {
                closeHeaderPopups()
                navigate('/support')
              }}
            >
              {t('support_page_title')}
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-2xl bg-[#2a3342] px-3 py-3 text-start text-sm text-white/92 hover:bg-[#313b4d]"
              onClick={() => {
                closeHeaderPopups()
                onLogout()
              }}
            >
              {t('logout') || 'Logout'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  ) : null

  return (
    <div dir={direction} className="min-h-[100dvh] overflow-x-clip bg-app-bg text-[var(--text-primary)]">
      <AppHeader
        variant={isPortfolioDashboard ? 'home' : showBackButton ? 'inner' : 'default'}
        direction={direction}
        brandName="Break Cash"
        title={currentHeaderTitle}
        subtitle={isPortfolioDashboard ? (user.display_name || `#${user.id}`) : undefined}
        showBack={showBackButton}
        showMenu={!showBackButton}
        showSearch={effectiveHeaderIcons.some((item) => item.id === 'search' && item.visible)}
        showNotifications={effectiveHeaderIcons.some((item) => item.id === 'notifications' && item.visible)}
        showMore
        showSupport
        menuAvatarUrl={!showBackButton && user.avatar_url && !avatarBroken ? resolveAvatarSrc(user.avatar_url) : null}
        menuAvatarAlt={user.display_name || t('nav_profile')}
        unreadCount={unreadCount}
        onBack={() => {
          closeHeaderPopups()
          navigate(-1)
        }}
        onMenu={() => {
          setNotificationsOpen(false)
          setSearchOpen(false)
          setLeaderboardOpen(false)
          setMoreMenuOpen(false)
          setMenuOpen((value) => !value)
        }}
        onSearch={() => {
          setNotificationsOpen(false)
          setLeaderboardOpen(false)
          setMoreMenuOpen(false)
          setSearchOpen((value) => !value)
        }}
        onNotifications={toggleNotifications}
        onMore={() => {
          setNotificationsOpen(false)
          setSearchOpen(false)
          setLeaderboardOpen(false)
          setMoreMenuOpen((value) => !value)
        }}
        onSupport={() => {
          closeHeaderPopups()
          window.open(WHATSAPP_CHANNEL_URL, '_blank', 'noopener,noreferrer')
        }}
        moreMenu={moreMenu}
        extraPanels={extraPanels}
        utilityLinks={utilityLinksRow}
        menuDrawer={menuDrawer}
        moreMenuRef={moreMenuRef}
      />

      <main className={isPortfolioDashboard ? 'portfolio-layout-main' : 'mx-auto w-full max-w-[1280px] px-3 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-3 lg:px-6 lg:pb-[calc(9rem+env(safe-area-inset-bottom))]'}>
        <div className={isPortfolioDashboard ? 'portfolio-layout-content' : 'lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-4'}>
          {!isPortfolioDashboard ? (
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
          ) : null}
          <div className="min-w-0">{children}</div>
        </div>
      </main>
      <InstallPrompt />
      <MobileBottomNav />
    </div>
  )
}

