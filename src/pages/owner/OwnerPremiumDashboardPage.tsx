import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Bell,
  ChartColumn,
  CircleDollarSign,
  Coins,
  FileCheck2,
  Gem,
  HandCoins,
  LifeBuoy,
  Lock,
  Percent,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import {
  apiFetch,
  createBonusRule,
  createContentCampaign,
  createAdminStaff,
  createDailyTradeCampaign,
  addKycWatchlistEntry,
  getAdminStaffList,
  getBonusRules,
  getContentCampaigns,
  getDailyTradeCampaigns,
  getKycWatchlist,
  getOwnerKycSubmissions,
  getOwnerGrowthSummary,
  getPartnerProfiles,
  getReferralSummary,
  getReferralDetails,
  getReferralStats,
  getSecurityOverview,
  getSecuritySessions,
  getHeaderIconConfig,
  getAppleTouchIconUrl,
  getFaviconUrl,
  getLogoUrl,
  getLoginLogoVariant,
  getMobileNavConfig,
  getAdsAdmin,
  getVipTiers,
  processAutoKycReviews,
  replaceAdminStaffPermissions,
  reviewOwnerKycSubmission,
  revokeAllUserSessions,
  runUnusualActivityDetection,
  setAdminSensitiveAccess,
  updateLogoUrl,
  updateLoginLogoVariant,
  updateHeaderIconConfig,
  updateAppleTouchIconUrl,
  updateFaviconUrl,
  updateThemeColor,
  getThemeColor,
  getPwaConfig,
  updatePwaConfig,
  updateMobileNavConfig,
  uploadAdMedia,
  createAd,
  updateAd,
  deleteAd,
  toggleAd,
  reorderAds,
  toggleDailyTradeCampaign,
  toggleKycWatchlistEntry,
  updateAdminStaffRole,
  updateUserTwoFactor,
  ownerUploadSettingImage,
  upsertPartnerProfile,
  upsertVipTier,
  type AdminStaffItem,
  type AuthUser,
  type BonusRule,
  type ContentCampaign,
  type DailyTradeCampaign,
  type KycSubmissionRow,
  type KycWatchlistItem,
  type HeaderIconConfigItem,
  type MobileNavConfigItem,
  type PartnerProfile,
  type AdItem,
  type SecurityOverview,
  type UserSessionItem,
  type VipTier,
  type PwaConfig,
} from '../../api'
import { useI18n } from '../../i18nCore'
import { emitToast } from '../../toastBus'
import { AD_PLACEMENTS, AD_TITLE_MAX, AD_DESCRIPTION_MAX, validateAdForm } from '../../components/ads/adConstants'

type OwnerPremiumDashboardProps = {
  user: AuthUser | null
}

type SectionKey =
  | 'overview'
  | 'users'
  | 'wallets'
  | 'deposits'
  | 'withdrawals'
  | 'trades'
  | 'assets'
  | 'vip'
  | 'referrals'
  | 'bonuses'
  | 'kyc'
  | 'notifications'
  | 'support'
  | 'security'
  | 'reports'
  | 'settings'
  | 'staff_permissions'

type UserStats = {
  totalUsers: number
  approvedUsers: number
  pendingUsers: number
  bannedUsers: number
}

type BalanceStats = {
  balancesCount: number
  totalAmount: number
  transactionsCount: number
}

type TxStats = {
  depositsTotal: number
  withdrawTotal: number
}

export function OwnerPremiumDashboardPage({ user }: OwnerPremiumDashboardProps) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<SectionKey>('overview')
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0,
    approvedUsers: 0,
    pendingUsers: 0,
    bannedUsers: 0,
  })
  const [balanceStats, setBalanceStats] = useState<BalanceStats>({
    balancesCount: 0,
    totalAmount: 0,
    transactionsCount: 0,
  })
  const [txStats, setTxStats] = useState<TxStats>({ depositsTotal: 0, withdrawTotal: 0 })
  const [permissionsCount, setPermissionsCount] = useState(0)
  const [ownerSummary, setOwnerSummary] = useState({
    activeDailyTrades: 0,
    activeBonusRules: 0,
    activePartners: 0,
    activeContent: 0,
  })
  const [dailyTrades, setDailyTrades] = useState<DailyTradeCampaign[]>([])
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([])
  const [vipTiers, setVipTiers] = useState<VipTier[]>([])
  const [partners, setPartners] = useState<PartnerProfile[]>([])
  const [refSummary, setRefSummary] = useState<Array<Record<string, unknown>>>([])
  const [refStats, setRefStats] = useState({ pendingCount: 0, qualifiedCount: 0, rewardReleasedCount: 0, totalRewardsValue: 0 })
  const [selectedRefUserId, setSelectedRefUserId] = useState<number | null>(null)
  const [refDetails, setRefDetails] = useState<Array<Record<string, unknown>>>([])
  const [contentCampaigns, setContentCampaigns] = useState<ContentCampaign[]>([])

  const [dailyTitle, setDailyTitle] = useState('')
  const [dailySymbol, setDailySymbol] = useState('')
  const [dailyVisibility, setDailyVisibility] = useState<'all' | 'depositors' | 'vip' | 'vip_level'>('all')
  const [dailySuccessRate, setDailySuccessRate] = useState('')

  const [bonusType, setBonusType] = useState<'deposit' | 'first_deposit' | 'referral' | 'seasonal'>('deposit')
  const [bonusTitle, setBonusTitle] = useState('')
  const [bonusPercent, setBonusPercent] = useState('')

  const [vipLevelForm, setVipLevelForm] = useState('1')
  const [vipTitleForm, setVipTitleForm] = useState('')
  const [vipDepositForm, setVipDepositForm] = useState('')
  const [vipMultiplierForm, setVipMultiplierForm] = useState('1')

  const [partnerUserId, setPartnerUserId] = useState('')
  const [partnerRate, setPartnerRate] = useState('')

  const [campaignType, setCampaignType] = useState<'notification' | 'popup' | 'banner' | 'news'>('notification')
  const [campaignTitle, setCampaignTitle] = useState('')
  const [campaignBody, setCampaignBody] = useState('')
  const [securityOverview, setSecurityOverview] = useState<SecurityOverview>({
    suspiciousIps: [],
    multiDeviceUsers: [],
    proxyAlerts: [],
    unusualActivity: [],
    recentLoginLogs: [],
    recentAuditLogs: [],
  })
  const [securitySessions, setSecuritySessions] = useState<UserSessionItem[]>([])
  const [staffList, setStaffList] = useState<AdminStaffItem[]>([])
  const [kycSubmissions, setKycSubmissions] = useState<KycSubmissionRow[]>([])
  const [kycWatchlist, setKycWatchlist] = useState<KycWatchlistItem[]>([])
  const [staffIdentifier, setStaffIdentifier] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [staffDisplayName, setStaffDisplayName] = useState('')
  const [staffRole, setStaffRole] = useState<'super_admin' | 'admin' | 'finance' | 'support' | 'moderator'>('admin')
  const [staffPreset, setStaffPreset] = useState<'read_only' | 'finance' | 'kyc' | 'trading' | 'marketing' | 'support' | 'full_admin'>('read_only')
  const [securityUserId, setSecurityUserId] = useState('')
  const [kycStatusFilter, setKycStatusFilter] = useState('')
  const [kycReviewSubmissionId, setKycReviewSubmissionId] = useState('')
  const [kycDecision, setKycDecision] = useState<'approve' | 'reject' | 'auto'>('approve')
  const [kycRejectReason, setKycRejectReason] = useState('')
  const [watchlistUserId, setWatchlistUserId] = useState('')
  const [watchlistNote, setWatchlistNote] = useState('')
  const [watchlistSource, setWatchlistSource] = useState('')
  const [logoUrlEdit, setLogoUrlEdit] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [faviconUrlEdit, setFaviconUrlEdit] = useState('')
  const [faviconFile, setFaviconFile] = useState<File | null>(null)
  const [appleTouchIconUrlEdit, setAppleTouchIconUrlEdit] = useState('')
  const [appleTouchIconFile, setAppleTouchIconFile] = useState<File | null>(null)
  const [themeColorEdit, setThemeColorEdit] = useState('#00C853')
  const [pwaNameEdit, setPwaNameEdit] = useState('Break cash')
  const [pwaShortNameEdit, setPwaShortNameEdit] = useState('Break cash')
  const [pwaDescriptionEdit, setPwaDescriptionEdit] = useState('Invite-only trading dashboard PWA')
  const [pwaBackgroundColorEdit, setPwaBackgroundColorEdit] = useState('#0A0E17')
  const [pwaIcon192Edit, setPwaIcon192Edit] = useState('/break-cash-logo-premium.png')
  const [pwaIcon512Edit, setPwaIcon512Edit] = useState('/break-cash-logo-premium.png')
  const [pwaIcon192File, setPwaIcon192File] = useState<File | null>(null)
  const [pwaIcon512File, setPwaIcon512File] = useState<File | null>(null)
  const [loginLogoVariant, setLoginLogoVariant] = useState<'a' | 'b'>('a')
  const [mobileNavDraft, setMobileNavDraft] = useState<MobileNavConfigItem[]>([])
  const [headerIconDraft, setHeaderIconDraft] = useState<HeaderIconConfigItem[]>([
    { id: 'search', visible: true },
    { id: 'language', visible: true },
    { id: 'notifications', visible: true },
    { id: 'profile', visible: true },
  ])
  const [adsList, setAdsList] = useState<AdItem[]>([])
  const [adsSaving, setAdsSaving] = useState(false)
  const [adFormOpen, setAdFormOpen] = useState(false)
  const [adFormEdit, setAdFormEdit] = useState<AdItem | null>(null)
  const [adFormType, setAdFormType] = useState<'image' | 'video'>('image')
  const [adFormMediaUrl, setAdFormMediaUrl] = useState('')
  const [adFormTitle, setAdFormTitle] = useState('')
  const [adFormDescription, setAdFormDescription] = useState('')
  const [adFormLinkUrl, setAdFormLinkUrl] = useState('')
  const [adFormPlacement, setAdFormPlacement] = useState('all')
  const [adFormFile, setAdFormFile] = useState<File | null>(null)
  const [adFormUploading, setAdFormUploading] = useState(false)
  const [adFormValidationError, setAdFormValidationError] = useState<string | null>(null)
  const [adToggleLoading, setAdToggleLoading] = useState<number | null>(null)
  const [adDeleteLoading, setAdDeleteLoading] = useState<number | null>(null)
  const [adReorderLoading, setAdReorderLoading] = useState(false)
  const [adDeleteConfirmId, setAdDeleteConfirmId] = useState<number | null>(null)
  const [adFormPreviewUrl, setAdFormPreviewUrl] = useState<string | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  useEffect(() => {
    if (!adFormFile) {
      setAdFormPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(adFormFile)
    setAdFormPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [adFormFile])
  const applyLinkTag = (rel: 'icon' | 'apple-touch-icon', href: string) => {
    const value = String(href || '').trim()
    if (!value) return
    let tag = document.querySelector(`link[rel='${rel}']`) as HTMLLinkElement | null
    if (!tag) {
      tag = document.createElement('link')
      tag.rel = rel
      document.head.appendChild(tag)
    }
    if (rel === 'icon') {
      tag.type = 'image/png'
    }
    tag.href = value
  }
  const applyThemeMeta = (color: string) => {
    const value = /^#[0-9a-fA-F]{6}$/.test(String(color || '').trim()) ? String(color).trim() : '#00C853'
    let tag = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null
    if (!tag) {
      tag = document.createElement('meta')
      tag.name = 'theme-color'
      document.head.appendChild(tag)
    }
    tag.content = value
  }
  const refreshManifestLink = () => {
    let tag = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null
    if (!tag) {
      tag = document.createElement('link')
      tag.rel = 'manifest'
      document.head.appendChild(tag)
    }
    tag.href = `/manifest.json?v=${Date.now()}`
  }
  const sections: Array<{ key: SectionKey; label: string; icon: typeof Sparkles }> = [
    { key: 'overview', label: t('owner_nav_overview'), icon: Sparkles },
    { key: 'users', label: t('owner_nav_users'), icon: Users },
    { key: 'wallets', label: t('owner_nav_wallets'), icon: Wallet },
    { key: 'deposits', label: t('owner_nav_deposits'), icon: CircleDollarSign },
    { key: 'withdrawals', label: t('owner_nav_withdrawals'), icon: HandCoins },
    { key: 'trades', label: t('owner_nav_trades'), icon: TrendingUp },
    { key: 'assets', label: t('owner_nav_assets'), icon: Coins },
    { key: 'vip', label: t('owner_nav_vip'), icon: Gem },
    { key: 'referrals', label: t('owner_nav_referrals'), icon: Users },
    { key: 'bonuses', label: t('owner_nav_bonuses'), icon: Percent },
    { key: 'kyc', label: t('owner_nav_kyc'), icon: FileCheck2 },
    { key: 'notifications', label: t('owner_nav_notifications'), icon: Bell },
    { key: 'support', label: t('owner_nav_support'), icon: LifeBuoy },
    { key: 'security', label: t('owner_nav_security'), icon: Lock },
    { key: 'reports', label: t('owner_nav_reports'), icon: ChartColumn },
    { key: 'settings', label: t('owner_nav_settings'), icon: Settings },
    { key: 'staff_permissions', label: t('owner_nav_staff_permissions'), icon: UserCog },
  ]

  const isOwner = user?.role === 'owner'
  if (user && !isOwner) return <Navigate to="/portfolio" replace />

  useEffect(() => {
    Promise.all([
      apiFetch('/api/stats/userStats'),
      apiFetch('/api/stats/balanceStats'),
      apiFetch('/api/stats/transactionStats'),
      apiFetch('/api/permissions/available'),
      getOwnerGrowthSummary(),
      getDailyTradeCampaigns(),
      getBonusRules(),
      getVipTiers(),
      getPartnerProfiles(),
      getReferralSummary(),
      getReferralStats(),
      getContentCampaigns(),
      getSecurityOverview(),
      getSecuritySessions(),
      getAdminStaffList(),
      getOwnerKycSubmissions(),
      getKycWatchlist(),
    ])
      .then(([u, b, t, p, gs, dt, br, vt, pp, rs, refStats, cc, so, ss, st, ks, kw]) => {
        setUserStats({
          totalUsers: Number((u as UserStats).totalUsers || 0),
          approvedUsers: Number((u as UserStats).approvedUsers || 0),
          pendingUsers: Number((u as UserStats).pendingUsers || 0),
          bannedUsers: Number((u as UserStats).bannedUsers || 0),
        })
        setBalanceStats({
          balancesCount: Number((b as BalanceStats).balancesCount || 0),
          totalAmount: Number((b as BalanceStats).totalAmount || 0),
          transactionsCount: Number((b as BalanceStats).transactionsCount || 0),
        })
        setTxStats({
          depositsTotal: Number((t as TxStats).depositsTotal || 0),
          withdrawTotal: Number((t as TxStats).withdrawTotal || 0),
        })
        setPermissionsCount(((p as { permissions: string[] }).permissions || []).length)
        setOwnerSummary(gs as { activeDailyTrades: number; activeBonusRules: number; activePartners: number; activeContent: number })
        setDailyTrades((dt as { items: DailyTradeCampaign[] }).items || [])
        setBonusRules((br as { items: BonusRule[] }).items || [])
        setVipTiers((vt as { items: VipTier[] }).items || [])
        setPartners((pp as { items: PartnerProfile[] }).items || [])
        setRefSummary((rs as { summary: Array<Record<string, unknown>> }).summary || [])
        setRefStats((refStats as { pendingCount: number; qualifiedCount: number; rewardReleasedCount: number; totalRewardsValue: number }) || { pendingCount: 0, qualifiedCount: 0, rewardReleasedCount: 0, totalRewardsValue: 0 })
        setContentCampaigns((cc as { items: ContentCampaign[] }).items || [])
        setSecurityOverview(so as SecurityOverview)
        setSecuritySessions((ss as { items: UserSessionItem[] }).items || [])
        setStaffList((st as { items: AdminStaffItem[] }).items || [])
        setKycSubmissions((ks as { items: KycSubmissionRow[] }).items || [])
        setKycWatchlist((kw as { items: KycWatchlistItem[] }).items || [])
      })
      .catch(() => {})

    getLogoUrl()
      .then((res) => setLogoUrlEdit(String(res.logoUrl || '').trim()))
      .catch(() => {})
    getFaviconUrl()
      .then((res) => setFaviconUrlEdit(String(res.faviconUrl || '').trim()))
      .catch(() => {})
    getAppleTouchIconUrl()
      .then((res) => setAppleTouchIconUrlEdit(String(res.appleTouchIconUrl || '').trim()))
      .catch(() => {})
    getThemeColor()
      .then((res) => {
        const value = String(res.themeColor || '#00C853').trim()
        setThemeColorEdit(/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#00C853')
      })
      .catch(() => {})
    getPwaConfig()
      .then((res) => {
        const cfg = res.config as PwaConfig
        setPwaNameEdit(String(cfg.name || 'Break cash'))
        setPwaShortNameEdit(String(cfg.short_name || 'Break cash'))
        setPwaDescriptionEdit(String(cfg.description || 'Invite-only trading dashboard PWA'))
        setPwaBackgroundColorEdit(String(cfg.background_color || '#0A0E17'))
        setPwaIcon192Edit(String(cfg.icon_192 || '/break-cash-logo-premium.png'))
        setPwaIcon512Edit(String(cfg.icon_512 || '/break-cash-logo-premium.png'))
      })
      .catch(() => {})
    getLoginLogoVariant()
      .then((res) => setLoginLogoVariant(res.variant === 'b' ? 'b' : 'a'))
      .catch(() => {})
    getMobileNavConfig()
      .then((res) => setMobileNavDraft(Array.isArray(res.items) ? res.items : []))
      .catch(() => setMobileNavDraft([]))
    getHeaderIconConfig()
      .then((res) => {
        if (Array.isArray(res.items) && res.items.length === 4) setHeaderIconDraft(res.items)
      })
      .catch(() => {})
    getAdsAdmin()
      .then((res) => setAdsList(res.items || []))
      .catch(() => setAdsList([]))
  }, [])

  useEffect(() => {
    if (!selectedRefUserId || selectedRefUserId <= 0) {
      setRefDetails([])
      return
    }
    getReferralDetails(selectedRefUserId)
      .then((res) => setRefDetails(res.referrals || []))
      .catch(() => setRefDetails([]))
  }, [selectedRefUserId])

  async function refreshOwnerGrowthData() {
    const [gs, dt, br, vt, pp, rs, refStats, cc, so, ss, st, ks, kw, adsRes] = await Promise.all([
      getOwnerGrowthSummary(),
      getDailyTradeCampaigns(),
      getBonusRules(),
      getVipTiers(),
      getPartnerProfiles(),
      getReferralSummary(),
      getReferralStats(),
      getContentCampaigns(),
      getSecurityOverview(),
      getSecuritySessions(),
      getAdminStaffList(),
      getOwnerKycSubmissions(kycStatusFilter ? { status: kycStatusFilter } : {}),
      getKycWatchlist(),
      getAdsAdmin(),
    ])
    setOwnerSummary(gs)
    setDailyTrades(dt.items || [])
    setBonusRules(br.items || [])
    setVipTiers(vt.items || [])
    setPartners(pp.items || [])
    setRefSummary(rs.summary || [])
    setRefStats(refStats || { pendingCount: 0, qualifiedCount: 0, rewardReleasedCount: 0, totalRewardsValue: 0 })
    if (selectedRefUserId) {
      getReferralDetails(selectedRefUserId).then((res) => setRefDetails(res.referrals || [])).catch(() => setRefDetails([]))
    }
    setContentCampaigns(cc.items || [])
    setSecurityOverview(so)
    setSecuritySessions(ss.items || [])
    setStaffList(st.items || [])
    setKycSubmissions(ks.items || [])
    setKycWatchlist(kw.items || [])
    setAdsList(adsRes.items || [])
  }

  const volumeBars = useMemo(() => {
    const max = Math.max(1, txStats.depositsTotal, txStats.withdrawTotal)
    return {
      dep: Math.max(8, (txStats.depositsTotal / max) * 100),
      wd: Math.max(8, (txStats.withdrawTotal / max) * 100),
    }
  }, [txStats.depositsTotal, txStats.withdrawTotal])

  return (
    <div className="page">
      <div className="mx-auto grid w-full max-w-[1200px] gap-3 lg:grid-cols-[280px_1fr]">
        <aside className="elite-panel p-3">
          <div className="elite-subpanel mb-3 p-3">
            <div className="text-[11px] uppercase tracking-[0.13em] text-app-muted">Break cash</div>
            <div className="mt-1 text-sm font-semibold text-white">{t('owner_brand_suite')}</div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
              <ShieldCheck size={12} />
              {t('owner_only_protected')}
            </div>
          </div>

          <div className="space-y-1">
            {sections.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition ${
                    isActive
                      ? 'border border-brand-blue/50 bg-brand-blue/18 text-white shadow-[0_0_0_1px_rgba(0,123,255,0.2)]'
                      : 'border border-transparent text-white/75 hover:border-white/10 hover:bg-app-elevated'
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="space-y-3">
          <section className="elite-panel p-4">
            <h1 className="text-lg font-semibold text-white">{t('owner_dashboard_title')}</h1>
            <p className="mt-1 text-sm text-app-muted">
              {t('owner_dashboard_subtitle')}
            </p>
          </section>

          {activeSection === 'overview' ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="elite-panel p-3">
                  <div className="text-xs text-app-muted">{t('owner_total_users')}</div>
                  <div className="mt-1 text-2xl font-bold text-white">{userStats.totalUsers}</div>
                </div>
                <div className="elite-panel p-3">
                  <div className="text-xs text-app-muted">{t('owner_approved_users')}</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-300">{userStats.approvedUsers}</div>
                </div>
                <div className="elite-panel p-3">
                  <div className="text-xs text-app-muted">{t('owner_pending_users')}</div>
                  <div className="mt-1 text-2xl font-bold text-amber-300">{userStats.pendingUsers}</div>
                </div>
                <div className="elite-panel p-3">
                  <div className="text-xs text-app-muted">{t('owner_blocked_users')}</div>
                  <div className="mt-1 text-2xl font-bold text-rose-300">{userStats.bannedUsers}</div>
                </div>
              </section>

              <section className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                <div className="rounded-2xl border border-app-border bg-app-card p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_transactions_volume')}</div>
                  <div className="space-y-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-app-muted">
                        <span>{t('owner_deposits')}</span>
                        <span>{txStats.depositsTotal.toFixed(2)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-app-elevated">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${volumeBars.dep}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-xs text-app-muted">
                        <span>{t('owner_withdrawals')}</span>
                        <span>{txStats.withdrawTotal.toFixed(2)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-app-elevated">
                        <div className="h-full rounded-full bg-rose-500" style={{ width: `${volumeBars.wd}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-app-border bg-app-card p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_core_system_stats')}</div>
                  <div className="space-y-1.5 text-sm text-white/85">
                    <div className="flex justify-between"><span>{t('owner_balances_rows')}</span><span>{balanceStats.balancesCount}</span></div>
                    <div className="flex justify-between"><span>{t('owner_total_amount')}</span><span>{balanceStats.totalAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>{t('owner_transactions')}</span><span>{balanceStats.transactionsCount}</span></div>
                    <div className="flex justify-between"><span>{t('owner_rbac_permissions')}</span><span>{permissionsCount}</span></div>
                  </div>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-app-border bg-app-card p-3">
                  <div className="text-xs text-app-muted">{t('owner_active_daily_trades')}</div>
                  <div className="mt-1 text-2xl font-bold text-cyan-300">{ownerSummary.activeDailyTrades}</div>
                </div>
                <div className="rounded-2xl border border-app-border bg-app-card p-3">
                  <div className="text-xs text-app-muted">{t('owner_active_bonus_rules')}</div>
                  <div className="mt-1 text-2xl font-bold text-indigo-300">{ownerSummary.activeBonusRules}</div>
                </div>
                <div className="rounded-2xl border border-app-border bg-app-card p-3">
                  <div className="text-xs text-app-muted">{t('owner_active_partners')}</div>
                  <div className="mt-1 text-2xl font-bold text-amber-300">{ownerSummary.activePartners}</div>
                </div>
                <div className="rounded-2xl border border-app-border bg-app-card p-3">
                  <div className="text-xs text-app-muted">{t('owner_active_content_campaigns')}</div>
                  <div className="mt-1 text-2xl font-bold text-fuchsia-300">{ownerSummary.activeContent}</div>
                </div>
              </section>
            </>
          ) : null}

          {activeSection === 'bonuses' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">{t('owner_section_daily_trade_bonus')}</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_create_daily_trade')}</div>
                  <div className="space-y-2">
                    <input className="field-input" placeholder={t('owner_daily_trade_title_ph')} value={dailyTitle} onChange={(e) => setDailyTitle(e.target.value)} />
                    <input className="field-input" placeholder={t('owner_daily_trade_symbol_ph')} value={dailySymbol} onChange={(e) => setDailySymbol(e.target.value)} />
                    <div className="captcha-row">
                      <select className="field-input" value={dailyVisibility} onChange={(e) => setDailyVisibility(e.target.value as 'all' | 'depositors' | 'vip' | 'vip_level')}>
                        <option value="all">{t('owner_scope_all')}</option>
                        <option value="depositors">{t('owner_scope_depositors')}</option>
                        <option value="vip">{t('owner_scope_vip')}</option>
                        <option value="vip_level">{t('owner_scope_vip_level')}</option>
                      </select>
                      <input className="field-input" placeholder={t('owner_success_rate_ph')} value={dailySuccessRate} onChange={(e) => setDailySuccessRate(e.target.value)} />
                    </div>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        await createDailyTradeCampaign({
                          title: dailyTitle,
                          symbol: dailySymbol,
                          visibilityScope: dailyVisibility,
                          successRate: Number(dailySuccessRate || 0),
                          isVisible: true,
                        })
                        setDailyTitle('')
                        setDailySymbol('')
                        setDailySuccessRate('')
                        await refreshOwnerGrowthData()
                      }}
                    >
                      {t('owner_publish_daily_trade')}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_bonus_rule_engine')}</div>
                  <div className="space-y-2">
                    <select className="field-input" value={bonusType} onChange={(e) => setBonusType(e.target.value as 'deposit' | 'first_deposit' | 'referral' | 'seasonal')}>
                      <option value="deposit">{t('owner_bonus_type_deposit')}</option>
                      <option value="first_deposit">{t('owner_bonus_type_first_deposit')}</option>
                      <option value="referral">{t('owner_bonus_type_referral')}</option>
                      <option value="seasonal">{t('owner_bonus_type_seasonal')}</option>
                    </select>
                    <input className="field-input" placeholder={t('owner_bonus_rule_title_ph')} value={bonusTitle} onChange={(e) => setBonusTitle(e.target.value)} />
                    <input className="field-input" placeholder={t('owner_bonus_reward_ph')} value={bonusPercent} onChange={(e) => setBonusPercent(e.target.value)} />
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        await createBonusRule({
                          ruleType: bonusType,
                          title: bonusTitle,
                          conditions: { flexible: true },
                          reward: { value: Number(bonusPercent || 0) },
                          isActive: true,
                        })
                        setBonusTitle('')
                        setBonusPercent('')
                        await refreshOwnerGrowthData()
                      }}
                    >
                      {t('owner_save_bonus_rule')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_daily_trades_list')}</div>
                  <div className="space-y-1.5">
                    {dailyTrades.slice(0, 8).map((row) => (
                      <div key={row.id} className="flex items-center justify-between rounded-lg border border-app-border px-2 py-1 text-xs">
                        <span>{row.title} ({row.visibility_scope})</span>
                        <button
                          type="button"
                          className="text-brand-blue"
                          onClick={async () => {
                            await toggleDailyTradeCampaign(row.id, Number(row.is_visible) !== 1)
                            await refreshOwnerGrowthData()
                          }}
                        >
                          {Number(row.is_visible) === 1 ? t('owner_action_hide') : t('owner_action_show')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_bonus_rules_list')}</div>
                  <div className="space-y-1.5">
                    {bonusRules.slice(0, 8).map((row) => (
                      <div key={row.id} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        {row.title} - {row.rule_type} ({Number(row.is_active) ? t('owner_status_active') : t('owner_status_inactive')})
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'vip' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">{t('owner_section_vip_partnerships')}</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_vip_tier_builder')}</div>
                  <div className="space-y-2">
                    <div className="captcha-row">
                      <input className="field-input" placeholder={t('owner_vip_level_ph')} value={vipLevelForm} onChange={(e) => setVipLevelForm(e.target.value)} />
                      <input className="field-input" placeholder={t('owner_vip_title_ph')} value={vipTitleForm} onChange={(e) => setVipTitleForm(e.target.value)} />
                    </div>
                    <div className="captcha-row">
                      <input className="field-input" placeholder={t('owner_min_deposit_ph')} value={vipDepositForm} onChange={(e) => setVipDepositForm(e.target.value)} />
                      <input className="field-input" placeholder={t('owner_referral_multiplier_ph')} value={vipMultiplierForm} onChange={(e) => setVipMultiplierForm(e.target.value)} />
                    </div>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        await upsertVipTier({
                          level: Number(vipLevelForm || 1),
                          title: vipTitleForm,
                          minDeposit: Number(vipDepositForm || 0),
                          minTradeVolume: 0,
                          referralMultiplier: Number(vipMultiplierForm || 1),
                          perks: ['direct_support', 'extra_trades'],
                          isActive: true,
                        })
                        await refreshOwnerGrowthData()
                      }}
                    >
                      {t('owner_save_vip_tier')}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_partner_profile')}</div>
                  <div className="space-y-2">
                    <div className="captcha-row">
                      <input className="field-input" placeholder={t('owner_partner_user_id_ph')} value={partnerUserId} onChange={(e) => setPartnerUserId(e.target.value)} />
                      <input className="field-input" placeholder={t('owner_partner_commission_ph')} value={partnerRate} onChange={(e) => setPartnerRate(e.target.value)} />
                    </div>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        await upsertPartnerProfile({
                          userId: Number(partnerUserId || 0),
                          commissionRate: Number(partnerRate || 0),
                          status: 'active',
                          notes: 'managed-by-owner',
                        })
                        setPartnerUserId('')
                        setPartnerRate('')
                        await refreshOwnerGrowthData()
                      }}
                    >
                      {t('owner_save_partner')}
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_vip_tiers')}</div>
                  <div className="space-y-1.5">
                    {vipTiers.map((tier) => (
                      <div key={tier.id} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        VIP {tier.level} - {tier.title} | Multiplier: x{tier.referral_multiplier}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">{t('owner_partner_performance')}</div>
                  <div className="space-y-1.5">
                    {partners.slice(0, 8).map((p) => (
                      <div key={p.id} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        #{p.user_id} {p.display_name || ''} | Commission {Number(p.commission_rate).toFixed(2)}% | Referrals {Number(p.referrals_count || 0)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'referrals' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">{t('owner_section_referrals')}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3 text-xs">
                  <div className="text-app-muted">{t('owner_referrals_stats_pending')}</div>
                  <div className="mt-1 text-lg font-semibold text-amber-300">{refStats.pendingCount}</div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3 text-xs">
                  <div className="text-app-muted">{t('owner_referrals_stats_qualified')}</div>
                  <div className="mt-1 text-lg font-semibold text-emerald-300">{refStats.qualifiedCount}</div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3 text-xs">
                  <div className="text-app-muted">{t('owner_referrals_stats_reward_released')}</div>
                  <div className="mt-1 text-lg font-semibold text-cyan-300">{refStats.rewardReleasedCount}</div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3 text-xs">
                  <div className="text-app-muted">{t('owner_referrals_stats_total_value')}</div>
                  <div className="mt-1 text-lg font-semibold text-white">${Number(refStats.totalRewardsValue).toFixed(2)}</div>
                </div>
              </div>
              {selectedRefUserId ? (
                <div className="mt-4">
                  <button
                    type="button"
                    className="mb-3 text-sm text-app-muted hover:text-white"
                    onClick={() => setSelectedRefUserId(null)}
                  >
                    ← {t('owner_referrals_back_to_summary')}
                  </button>
                  <div className="table-card">
                    <div className="table-head">
                      <span>{t('owner_referrals_detail_referred_user')}</span>
                      <span>{t('owner_referrals_detail_status')}</span>
                      <span>{t('owner_referrals_detail_first_deposit')}</span>
                      <span>{t('owner_referrals_detail_reward')}</span>
                      <span>{t('owner_referrals_detail_qualified_at')}</span>
                      <span>{t('owner_referrals_detail_reward_released_at')}</span>
                    </div>
                    {refDetails.map((row, idx) => {
                      const statusKey =
                        row.status === 'reward_released'
                          ? 'referral_status_reward_released'
                          : row.status === 'active'
                            ? 'referral_status_first_deposit_qualified'
                            : 'referral_status_pending'
                      return (
                        <div key={idx} className="table-row">
                          <span>{String(row.display_name || row.email || '—')} #{String(row.referred_user_id ?? '')}</span>
                          <span>{t(statusKey)}</span>
                          <span>${Number(row.first_deposit_amount || 0).toFixed(2)}</span>
                          <span>${Number(row.reward_amount || 0).toFixed(2)}</span>
                          <span>{row.qualified_at ? new Date(String(row.qualified_at)).toLocaleString() : '—'}</span>
                          <span>{row.reward_released_at ? new Date(String(row.reward_released_at)).toLocaleString() : '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 table-card">
                  <div className="table-head">
                    <span>{t('owner_referrals_user')}</span>
                    <span>{t('owner_referrals_code')}</span>
                    <span>{t('owner_referrals_metrics')}</span>
                    <span></span>
                  </div>
                  {refSummary.map((row, idx) => (
                    <div key={idx} className="table-row">
                      <span>{String(row.display_name || row.user_id)}</span>
                      <span>{String(row.referral_code || '—')}</span>
                      <span>
                        {String(row.pending_count || 0)} / {String(row.active_count || 0)} / {String(row.reward_released_count || 0)} / ${Number(row.rewards_value || 0).toFixed(2)}
                      </span>
                      <span>
                        <button
                          type="button"
                          className="text-xs text-cyan-400 hover:underline"
                          onClick={() => setSelectedRefUserId(Number(row.user_id || 0))}
                        >
                          {t('owner_referrals_view_details')}
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {activeSection === 'notifications' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">{t('owner_section_content_notifications')}</h2>
              <div className="mt-3 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="space-y-2">
                  <select className="field-input" value={campaignType} onChange={(e) => setCampaignType(e.target.value as 'notification' | 'popup' | 'banner' | 'news')}>
                    <option value="notification">{t('owner_campaign_type_notification')}</option>
                    <option value="popup">{t('owner_campaign_type_popup')}</option>
                    <option value="banner">{t('owner_campaign_type_banner')}</option>
                    <option value="news">{t('owner_campaign_type_news')}</option>
                  </select>
                  <input className="field-input" placeholder={t('owner_campaign_title_ph')} value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} />
                  <textarea className="field-input" placeholder={t('owner_campaign_body_ph')} value={campaignBody} onChange={(e) => setCampaignBody(e.target.value)} />
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    onClick={async () => {
                      await createContentCampaign({
                        campaignType,
                        title: campaignTitle,
                        body: campaignBody,
                        targetFilters: {},
                        isActive: true,
                      })
                      setCampaignTitle('')
                      setCampaignBody('')
                      await refreshOwnerGrowthData()
                    }}
                  >
                    {t('owner_publish_campaign')}
                  </button>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="mb-2 text-sm font-medium text-white">{t('owner_recent_campaigns')}</div>
                <div className="space-y-1.5">
                  {contentCampaigns.slice(0, 10).map((row) => (
                    <div key={row.id} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                      [{row.campaign_type}] {row.title} ({Number(row.is_active) ? t('owner_status_active') : t('owner_status_inactive')})
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'security' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">Security Center</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3 text-xs">
                  <div className="text-app-muted">Suspicious IPs (24h)</div>
                  <div className="mt-1 text-lg font-semibold text-rose-300">{securityOverview.suspiciousIps.length}</div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3 text-xs">
                  <div className="text-app-muted">Multiple devices alerts</div>
                  <div className="mt-1 text-lg font-semibold text-amber-300">{securityOverview.multiDeviceUsers.length}</div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3 text-xs">
                  <div className="text-app-muted">Unusual activity alerts</div>
                  <div className="mt-1 text-lg font-semibold text-cyan-300">{securityOverview.unusualActivity.length}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={async () => {
                    await runUnusualActivityDetection()
                    await refreshOwnerGrowthData()
                  }}
                >
                  Run Unusual Activity Detection
                </button>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">2FA and Session Controls</div>
                  <div className="space-y-2">
                    <input
                      className="field-input"
                      placeholder="User ID"
                      value={securityUserId}
                      onChange={(e) => setSecurityUserId(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="wallet-action-btn owner-set-btn"
                        onClick={async () => {
                          await updateUserTwoFactor(Number(securityUserId || 0), true, false)
                          await refreshOwnerGrowthData()
                        }}
                      >
                        Enable 2FA User
                      </button>
                      <button
                        type="button"
                        className="wallet-action-btn owner-set-btn"
                        onClick={async () => {
                          await updateUserTwoFactor(Number(securityUserId || 0), true, true)
                          await refreshOwnerGrowthData()
                        }}
                      >
                        Enable 2FA Admin
                      </button>
                      <button
                        type="button"
                        className="wallet-action-btn owner-set-btn"
                        onClick={async () => {
                          await revokeAllUserSessions(Number(securityUserId || 0))
                          await refreshOwnerGrowthData()
                        }}
                      >
                        Logout All Devices
                      </button>
                      <button
                        type="button"
                        className="wallet-action-btn owner-set-btn"
                        onClick={async () => {
                          const response = await getSecuritySessions(Number(securityUserId || 0) || undefined)
                          setSecuritySessions(response.items || [])
                        }}
                      >
                        Refresh Sessions
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">Suspicious IP List</div>
                  <div className="space-y-1.5">
                    {securityOverview.suspiciousIps.slice(0, 10).map((ip) => (
                      <div key={ip.ip_address} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        {ip.ip_address} - Failed attempts: {Number(ip.failed_count || 0)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">Active Sessions</div>
                  <div className="space-y-1.5">
                    {securitySessions.slice(0, 12).map((s) => (
                      <div key={`${s.id}-${s.session_id}`} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        U#{s.user_id} | {s.ip_address || 'n/a'} | {Number(s.is_active) ? 'Active' : 'Revoked'}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">Audit Logs</div>
                  <div className="space-y-1.5">
                    {securityOverview.recentAuditLogs.slice(0, 12).map((a) => (
                      <div key={a.id} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        {a.section} / {a.action} | actor #{a.actor_user_id}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'staff_permissions' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">Admin Roles & Permissions</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">Create Admin Team Member</div>
                  <div className="space-y-2">
                    <input className="field-input" placeholder="Email / phone" value={staffIdentifier} onChange={(e) => setStaffIdentifier(e.target.value)} />
                    <input className="field-input" placeholder="Password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} />
                    <input className="field-input" placeholder="Display name" value={staffDisplayName} onChange={(e) => setStaffDisplayName(e.target.value)} />
                    <div className="captcha-row">
                      <select className="field-input" value={staffRole} onChange={(e) => setStaffRole(e.target.value as 'super_admin' | 'admin' | 'finance' | 'support' | 'moderator')}>
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="finance">Finance</option>
                        <option value="support">Support</option>
                        <option value="moderator">Moderator</option>
                      </select>
                      <select className="field-input" value={staffPreset} onChange={(e) => setStaffPreset(e.target.value as 'read_only' | 'finance' | 'kyc' | 'trading' | 'marketing' | 'support' | 'full_admin')}>
                        <option value="read_only">Read-only</option>
                        <option value="finance">Finance</option>
                        <option value="kyc">KYC</option>
                        <option value="trading">Trading</option>
                        <option value="marketing">Marketing</option>
                        <option value="support">Support</option>
                        <option value="full_admin">Full Admin</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        await createAdminStaff({
                          identifier: staffIdentifier,
                          password: staffPassword,
                          displayName: staffDisplayName,
                          adminRole: staffRole,
                          accessPreset: staffPreset,
                        })
                        setStaffIdentifier('')
                        setStaffPassword('')
                        setStaffDisplayName('')
                        await refreshOwnerGrowthData()
                      }}
                    >
                      Create Staff Member
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">Team Members</div>
                  <div className="space-y-1.5">
                    {staffList.slice(0, 20).map((member) => (
                      <div key={member.id} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        #{member.id} {member.display_name || member.email || member.phone || 'Member'} | {member.admin_role} | perms:{' '}
                        {member.permissions_count}
                        <div className="mt-1 flex flex-wrap gap-1">
                          <button
                            type="button"
                            className="text-brand-blue"
                            onClick={async () => {
                              await updateAdminStaffRole(member.id, member.admin_role, Number(member.is_active) !== 1)
                              await refreshOwnerGrowthData()
                            }}
                          >
                            {Number(member.is_active) === 1 ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            className="text-brand-blue"
                            onClick={async () => {
                              await setAdminSensitiveAccess(member.id, Number(member.can_view_sensitive) !== 1)
                              await refreshOwnerGrowthData()
                            }}
                          >
                            {Number(member.can_view_sensitive) === 1 ? 'Hide Sensitive' : 'Allow Sensitive'}
                          </button>
                          <button
                            type="button"
                            className="text-brand-blue"
                            onClick={async () => {
                              await replaceAdminStaffPermissions(member.id, ['dashboard.overview.view', 'reports.view'])
                              await refreshOwnerGrowthData()
                            }}
                          >
                            Set Read-only
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'kyc' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">KYC / AML Center</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">Review Queue</div>
                  <div className="space-y-2">
                    <select className="field-input" value={kycStatusFilter} onChange={(e) => setKycStatusFilter(e.target.value)}>
                      <option value="">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="pending_auto">Pending auto</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        const response = await getOwnerKycSubmissions(kycStatusFilter ? { status: kycStatusFilter } : {})
                        setKycSubmissions(response.items || [])
                      }}
                    >
                      Refresh KYC Queue
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        await processAutoKycReviews()
                        await refreshOwnerGrowthData()
                      }}
                    >
                      Process Auto Approvals
                    </button>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {kycSubmissions.slice(0, 12).map((row) => (
                      <div key={row.id} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        #{row.id} U#{row.user_id} | {row.review_status} | {row.aml_risk_level || 'low'}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">KYC Review Action</div>
                  <div className="space-y-2">
                    <input className="field-input" placeholder="Submission ID" value={kycReviewSubmissionId} onChange={(e) => setKycReviewSubmissionId(e.target.value)} />
                    <select className="field-input" value={kycDecision} onChange={(e) => setKycDecision(e.target.value as 'approve' | 'reject' | 'auto')}>
                      <option value="approve">Approve</option>
                      <option value="reject">Reject</option>
                      <option value="auto">Auto approve random delay</option>
                    </select>
                    <input className="field-input" placeholder="Rejection reason (if reject)" value={kycRejectReason} onChange={(e) => setKycRejectReason(e.target.value)} />
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        await reviewOwnerKycSubmission({
                          submissionId: Number(kycReviewSubmissionId || 0),
                          decision: kycDecision,
                          rejectionReason: kycRejectReason,
                        })
                        setKycReviewSubmissionId('')
                        setKycRejectReason('')
                        await refreshOwnerGrowthData()
                      }}
                    >
                      Execute Review
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">Watchlist / Manual Review</div>
                  <div className="space-y-2">
                    <input className="field-input" placeholder="User ID (optional)" value={watchlistUserId} onChange={(e) => setWatchlistUserId(e.target.value)} />
                    <input className="field-input" placeholder="Reason / note" value={watchlistNote} onChange={(e) => setWatchlistNote(e.target.value)} />
                    <input className="field-input" placeholder="Source" value={watchlistSource} onChange={(e) => setWatchlistSource(e.target.value)} />
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={async () => {
                        await addKycWatchlistEntry({
                          userId: Number(watchlistUserId || 0) || undefined,
                          note: watchlistNote,
                          source: watchlistSource || undefined,
                        })
                        setWatchlistUserId('')
                        setWatchlistNote('')
                        setWatchlistSource('')
                        await refreshOwnerGrowthData()
                      }}
                    >
                      Add to Watchlist
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <div className="mb-2 text-sm font-medium text-white">Watchlist Entries</div>
                  <div className="space-y-1.5">
                    {kycWatchlist.slice(0, 14).map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-app-border px-2 py-1 text-xs">
                        #{entry.id} U#{entry.user_id || '-'} | {entry.note} | {Number(entry.is_active) ? 'Active' : 'Inactive'}
                        <button
                          type="button"
                          className="ms-2 text-brand-blue"
                          onClick={async () => {
                            await toggleKycWatchlistEntry(entry.id, Number(entry.is_active) !== 1)
                            await refreshOwnerGrowthData()
                          }}
                        >
                          {Number(entry.is_active) ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === 'settings' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">Logo Settings (Owner)</h2>
              <p className="mt-1 text-sm text-app-muted">
                Update BREAK CASH logo. Splash and header will use the same logo automatically.
              </p>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <input
                  className="field-input"
                  value={logoUrlEdit}
                  onChange={(e) => setLogoUrlEdit(e.target.value)}
                  placeholder="Logo URL"
                />
                <input
                  className="field-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    disabled={settingsSaving}
                    onClick={async () => {
                      if (settingsSaving) return
                      setSettingsSaving(true)
                      try {
                        let nextLogo = logoUrlEdit.trim()
                        if (logoFile) {
                          const res = await ownerUploadSettingImage('logo_url', logoFile)
                          nextLogo = String(res.url || '').trim()
                          setLogoUrlEdit(nextLogo)
                          setLogoFile(null)
                        } else {
                          await updateLogoUrl(nextLogo)
                        }
                        if (nextLogo) {
                          setFaviconUrlEdit(nextLogo)
                          setAppleTouchIconUrlEdit(nextLogo)
                          setPwaIcon192Edit(nextLogo)
                          setPwaIcon512Edit(nextLogo)
                          applyLinkTag('icon', nextLogo)
                          applyLinkTag('apple-touch-icon', nextLogo)
                        }
                      } catch {
                        // Error toast shown by api
                      } finally {
                        setSettingsSaving(false)
                      }
                    }}
                  >
                    {settingsSaving ? t('owner_settings_saving') : 'Save Logo'}
                  </button>
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    onClick={async () => {
                      const res = await getLogoUrl()
                      setLogoUrlEdit(String(res.logoUrl || '').trim())
                    }}
                  >
                    Reload Current Logo
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="text-sm font-medium text-white">{t('owner_favicon_settings_title')}</div>
                <p className="text-xs text-app-muted">{t('owner_favicon_settings_hint')}</p>
                <input
                  className="field-input"
                  value={faviconUrlEdit}
                  onChange={(e) => setFaviconUrlEdit(e.target.value)}
                  placeholder={t('owner_favicon_url_ph')}
                />
                <input
                  className="field-input"
                  type="file"
                  accept="image/png,image/x-icon,image/svg+xml,image/*"
                  onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    disabled={settingsSaving}
                    onClick={async () => {
                      if (settingsSaving) return
                      setSettingsSaving(true)
                      try {
                        if (faviconFile) {
                          const res = await ownerUploadSettingImage('favicon_url', faviconFile)
                          setFaviconUrlEdit(res.url || '')
                          setFaviconFile(null)
                          await updateFaviconUrl(res.url || '')
                          applyLinkTag('icon', res.url || '')
                        } else {
                          const value = faviconUrlEdit.trim()
                          await updateFaviconUrl(value)
                          applyLinkTag('icon', value)
                        }
                      } catch {
                        // Error toast shown by api
                      } finally {
                        setSettingsSaving(false)
                      }
                    }}
                  >
                    {settingsSaving ? t('owner_settings_saving') : t('owner_favicon_save')}
                  </button>
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    onClick={async () => {
                      const res = await getFaviconUrl()
                      const value = String(res.faviconUrl || '').trim()
                      setFaviconUrlEdit(value)
                      applyLinkTag('icon', value)
                    }}
                  >
                    {t('owner_favicon_reload')}
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="text-sm font-medium text-white">{t('owner_apple_touch_icon_title')}</div>
                <p className="text-xs text-app-muted">{t('owner_apple_touch_icon_hint')}</p>
                <input
                  className="field-input"
                  value={appleTouchIconUrlEdit}
                  onChange={(e) => setAppleTouchIconUrlEdit(e.target.value)}
                  placeholder={t('owner_apple_touch_icon_url_ph')}
                />
                <input
                  className="field-input"
                  type="file"
                  accept="image/png,image/svg+xml,image/*"
                  onChange={(e) => setAppleTouchIconFile(e.target.files?.[0] || null)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    disabled={settingsSaving}
                    onClick={async () => {
                      if (settingsSaving) return
                      setSettingsSaving(true)
                      try {
                        if (appleTouchIconFile) {
                          const res = await ownerUploadSettingImage('apple_touch_icon_url', appleTouchIconFile)
                          setAppleTouchIconUrlEdit(res.url || '')
                          setAppleTouchIconFile(null)
                          await updateAppleTouchIconUrl(res.url || '')
                          applyLinkTag('apple-touch-icon', res.url || '')
                        } else {
                          const value = appleTouchIconUrlEdit.trim()
                          await updateAppleTouchIconUrl(value)
                          applyLinkTag('apple-touch-icon', value)
                        }
                      } catch {
                        // Error toast shown by api
                      } finally {
                        setSettingsSaving(false)
                      }
                    }}
                  >
                    {settingsSaving ? t('owner_settings_saving') : t('owner_apple_touch_icon_save')}
                  </button>
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    onClick={async () => {
                      const res = await getAppleTouchIconUrl()
                      const value = String(res.appleTouchIconUrl || '').trim()
                      setAppleTouchIconUrlEdit(value)
                      applyLinkTag('apple-touch-icon', value)
                    }}
                  >
                    {t('owner_apple_touch_icon_reload')}
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="text-sm font-medium text-white">{t('owner_theme_color_title')}</div>
                <p className="text-xs text-app-muted">{t('owner_theme_color_hint')}</p>
                <div className="flex items-center gap-2">
                  <input
                    className="h-10 w-14 rounded-lg border border-app-border bg-transparent p-1"
                    type="color"
                    value={themeColorEdit}
                    onChange={(e) => setThemeColorEdit(e.target.value)}
                  />
                  <input
                    className="field-input"
                    value={themeColorEdit}
                    onChange={(e) => setThemeColorEdit(e.target.value)}
                    placeholder="#00C853"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    disabled={settingsSaving}
                    onClick={async () => {
                      if (settingsSaving) return
                      setSettingsSaving(true)
                      try {
                        const normalized = /^#[0-9a-fA-F]{6}$/.test(themeColorEdit) ? themeColorEdit : '#00C853'
                        const res = await updateThemeColor(normalized)
                        const value = String(res.themeColor || normalized)
                        setThemeColorEdit(value)
                        applyThemeMeta(value)
                      } catch {
                        // Error toast shown by api
                      } finally {
                        setSettingsSaving(false)
                      }
                    }}
                  >
                    {settingsSaving ? t('owner_settings_saving') : t('owner_theme_color_save')}
                  </button>
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    onClick={async () => {
                      const res = await getThemeColor()
                      const value = String(res.themeColor || '#00C853')
                      setThemeColorEdit(value)
                      applyThemeMeta(value)
                    }}
                  >
                    {t('owner_theme_color_reload')}
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="text-sm font-medium text-white">{t('owner_pwa_android_title')}</div>
                <p className="text-xs text-app-muted">{t('owner_pwa_android_hint')}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="field-input"
                    value={pwaNameEdit}
                    onChange={(e) => setPwaNameEdit(e.target.value)}
                    placeholder={t('owner_pwa_name_ph')}
                  />
                  <input
                    className="field-input"
                    value={pwaShortNameEdit}
                    onChange={(e) => setPwaShortNameEdit(e.target.value)}
                    placeholder={t('owner_pwa_short_name_ph')}
                  />
                </div>
                <textarea
                  className="field-input"
                  value={pwaDescriptionEdit}
                  onChange={(e) => setPwaDescriptionEdit(e.target.value)}
                  placeholder={t('owner_pwa_description_ph')}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="h-10 w-14 rounded-lg border border-app-border bg-transparent p-1"
                      type="color"
                      value={pwaBackgroundColorEdit}
                      onChange={(e) => setPwaBackgroundColorEdit(e.target.value)}
                    />
                    <input
                      className="field-input"
                      value={pwaBackgroundColorEdit}
                      onChange={(e) => setPwaBackgroundColorEdit(e.target.value)}
                      placeholder="#0A0E17"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="h-10 w-14 rounded-lg border border-app-border bg-transparent p-1"
                      type="color"
                      value={themeColorEdit}
                      onChange={(e) => setThemeColorEdit(e.target.value)}
                    />
                    <input
                      className="field-input"
                      value={themeColorEdit}
                      onChange={(e) => setThemeColorEdit(e.target.value)}
                      placeholder="#00C853"
                    />
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    className="field-input"
                    value={pwaIcon192Edit}
                    onChange={(e) => setPwaIcon192Edit(e.target.value)}
                    placeholder={t('owner_pwa_icon_192_ph')}
                  />
                  <input
                    className="field-input"
                    value={pwaIcon512Edit}
                    onChange={(e) => setPwaIcon512Edit(e.target.value)}
                    placeholder={t('owner_pwa_icon_512_ph')}
                  />
                  <input
                    className="field-input"
                    type="file"
                    accept="image/png,image/svg+xml,image/*"
                    onChange={(e) => setPwaIcon192File(e.target.files?.[0] || null)}
                  />
                  <input
                    className="field-input"
                    type="file"
                    accept="image/png,image/svg+xml,image/*"
                    onChange={(e) => setPwaIcon512File(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    disabled={settingsSaving}
                    onClick={async () => {
                      if (settingsSaving) return
                      setSettingsSaving(true)
                      try {
                        let icon192 = pwaIcon192Edit.trim() || '/break-cash-logo-premium.png'
                        let icon512 = pwaIcon512Edit.trim() || '/break-cash-logo-premium.png'
                        if (pwaIcon192File) {
                          const up = await ownerUploadSettingImage('pwa_icon_192', pwaIcon192File)
                          icon192 = up.url || icon192
                          setPwaIcon192Edit(icon192)
                          setPwaIcon192File(null)
                        }
                        if (pwaIcon512File) {
                          const up = await ownerUploadSettingImage('pwa_icon_512', pwaIcon512File)
                          icon512 = up.url || icon512
                          setPwaIcon512Edit(icon512)
                          setPwaIcon512File(null)
                        }
                        const normalizedTheme = /^#[0-9a-fA-F]{6}$/.test(themeColorEdit) ? themeColorEdit : '#00C853'
                        const normalizedBg = /^#[0-9a-fA-F]{6}$/.test(pwaBackgroundColorEdit) ? pwaBackgroundColorEdit : '#0A0E17'
                        const res = await updatePwaConfig({
                          name: pwaNameEdit.trim() || 'Break cash',
                          short_name: pwaShortNameEdit.trim() || 'Break cash',
                          description: pwaDescriptionEdit.trim() || 'Invite-only trading dashboard PWA',
                          background_color: normalizedBg,
                          theme_color: normalizedTheme,
                          icon_192: icon192,
                          icon_512: icon512,
                        })
                        setPwaNameEdit(res.config.name)
                        setPwaShortNameEdit(res.config.short_name)
                        setPwaDescriptionEdit(res.config.description)
                        setPwaBackgroundColorEdit(res.config.background_color)
                        setThemeColorEdit(res.config.theme_color)
                        setPwaIcon192Edit(res.config.icon_192)
                        setPwaIcon512Edit(res.config.icon_512)
                        await updateThemeColor(res.config.theme_color)
                        applyThemeMeta(res.config.theme_color)
                        refreshManifestLink()
                      } catch {
                        // Error toast shown by api
                      } finally {
                        setSettingsSaving(false)
                      }
                    }}
                  >
                    {settingsSaving ? t('owner_settings_saving') : t('owner_pwa_save')}
                  </button>
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    onClick={async () => {
                      const res = await getPwaConfig()
                      setPwaNameEdit(String(res.config.name || 'Break cash'))
                      setPwaShortNameEdit(String(res.config.short_name || 'Break cash'))
                      setPwaDescriptionEdit(String(res.config.description || 'Invite-only trading dashboard PWA'))
                      setPwaBackgroundColorEdit(String(res.config.background_color || '#0A0E17'))
                      setThemeColorEdit(String(res.config.theme_color || '#00C853'))
                      setPwaIcon192Edit(String(res.config.icon_192 || '/break-cash-logo-premium.png'))
                      setPwaIcon512Edit(String(res.config.icon_512 || '/break-cash-logo-premium.png'))
                      refreshManifestLink()
                    }}
                  >
                    {t('owner_pwa_reload')}
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="text-sm font-medium text-white">{t('owner_login_variant_title')}</div>
                <p className="text-xs text-app-muted">
                  {t('owner_login_variant_hint')}
                </p>
                <select
                  className="field-input"
                  value={loginLogoVariant}
                  onChange={(e) => setLoginLogoVariant(e.target.value === 'b' ? 'b' : 'a')}
                >
                  <option value="a">{t('owner_login_variant_a')}</option>
                  <option value="b">{t('owner_login_variant_b')}</option>
                </select>
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={async () => {
                    const res = await updateLoginLogoVariant(loginLogoVariant)
                    setLoginLogoVariant(res.variant === 'b' ? 'b' : 'a')
                  }}
                >
                  {t('owner_login_variant_save')}
                </button>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="text-sm font-medium text-white">{t('owner_mobile_nav_customization')}</div>
                <p className="text-xs text-app-muted">{t('owner_mobile_nav_customization_hint')}</p>
                {mobileNavDraft.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="grid gap-2 rounded-lg border border-app-border p-2 md:grid-cols-4">
                    <input
                      className="field-input"
                      value={item.label}
                      onChange={(e) =>
                        setMobileNavDraft((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)),
                        )
                      }
                      placeholder={t('owner_mobile_nav_label')}
                    />
                    <input
                      className="field-input"
                      value={item.to}
                      onChange={(e) =>
                        setMobileNavDraft((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, to: e.target.value } : it)),
                        )
                      }
                      placeholder={t('owner_mobile_nav_route')}
                    />
                    <select
                      className="field-input"
                      value={item.icon}
                      onChange={(e) =>
                        setMobileNavDraft((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, icon: e.target.value as MobileNavConfigItem['icon'] } : it)),
                        )
                      }
                    >
                      <option value="wallet">wallet</option>
                      <option value="chart">chart</option>
                      <option value="pickaxe">pickaxe</option>
                      <option value="house">house</option>
                      <option value="candlestick">candlestick</option>
                      <option value="sparkles">sparkles</option>
                      <option value="bcmark">bcmark</option>
                    </select>
                    <button
                      type="button"
                      className={`wallet-action-btn ${item.isFab ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                      onClick={() =>
                        setMobileNavDraft((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, isFab: !it.isFab } : { ...it, isFab: false })),
                        )
                      }
                    >
                      {item.isFab ? t('owner_mobile_nav_fab_on') : t('owner_mobile_nav_fab_off')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={async () => {
                    const res = await updateMobileNavConfig(mobileNavDraft)
                    setMobileNavDraft(res.items || [])
                  }}
                >
                  {t('owner_mobile_nav_save')}
                </button>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="text-sm font-medium text-white">{t('owner_header_icon_customization')}</div>
                <p className="text-xs text-app-muted">{t('owner_header_icon_customization_hint')}</p>
                {headerIconDraft.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-app-border p-2">
                    <span className="rounded-md border border-app-border bg-app-card px-2 py-1 text-xs text-white/85">{item.id}</span>
                    <button
                      type="button"
                      className={`wallet-action-btn ${item.visible ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                      onClick={() =>
                        setHeaderIconDraft((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? { ...it, visible: it.id === 'profile' ? true : !it.visible }
                              : it,
                          ),
                        )
                      }
                    >
                      {item.visible ? t('owner_icon_visible') : t('owner_icon_hidden')}
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      disabled={idx === 0}
                      onClick={() =>
                        setHeaderIconDraft((prev) => {
                          if (idx === 0) return prev
                          const next = [...prev]
                          const tmp = next[idx - 1]
                          next[idx - 1] = next[idx]
                          next[idx] = tmp
                          return next
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      disabled={idx === headerIconDraft.length - 1}
                      onClick={() =>
                        setHeaderIconDraft((prev) => {
                          if (idx >= prev.length - 1) return prev
                          const next = [...prev]
                          const tmp = next[idx + 1]
                          next[idx + 1] = next[idx]
                          next[idx] = tmp
                          return next
                        })
                      }
                    >
                      ↓
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={async () => {
                    const res = await updateHeaderIconConfig(headerIconDraft)
                    setHeaderIconDraft(res.items || [])
                  }}
                >
                  {t('owner_header_icon_save')}
                </button>
              </div>
              <div className="mt-3 space-y-2 rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="text-sm font-medium text-white">{t('owner_ads_management_title')}</div>
                <p className="text-xs text-app-muted">{t('owner_ads_management_hint')}</p>
                {adsList.length === 0 && !adFormOpen ? (
                  <div className="rounded-xl border border-dashed border-app-border bg-app-card p-6 text-center">
                    <p className="text-sm font-medium text-white">{t('owner_ads_empty_cta')}</p>
                    <p className="mt-1 text-xs text-app-muted">{t('owner_ads_empty_cta_hint')}</p>
                    <button
                      type="button"
                      className="mt-3 wallet-action-btn wallet-action-deposit"
                      onClick={() => { setAdFormEdit(null); setAdFormType('image'); setAdFormMediaUrl(''); setAdFormTitle(''); setAdFormDescription(''); setAdFormLinkUrl(''); setAdFormPlacement('all'); setAdFormFile(null); setAdFormValidationError(null); setAdFormOpen(true) }}
                    >
                      {t('owner_banner_add')}
                    </button>
                  </div>
                ) : null}
                {adFormOpen ? (
                  <div className="space-y-2 rounded-lg border border-app-border p-3">
                    <select className="field-input" value={adFormType} onChange={(e) => { setAdFormType(e.target.value as 'image' | 'video'); setAdFormFile(null); setAdFormValidationError(null) }}>
                      <option value="image">{t('owner_ad_type_image')}</option>
                      <option value="video">{t('owner_ad_type_video')}</option>
                    </select>
                    <input type="file" accept={adFormType === 'video' ? 'video/*' : 'image/*'} className="field-input" onChange={(e) => { setAdFormFile(e.target.files?.[0] || null); setAdFormValidationError(null) }} />
                    <input className="field-input" value={adFormMediaUrl} onChange={(e) => { setAdFormMediaUrl(e.target.value); setAdFormValidationError(null) }} placeholder={t('owner_ad_media_url')} />
                    {(adFormFile || adFormMediaUrl.trim()) ? (
                      <div className="rounded-lg border border-app-border bg-black/40 p-2">
                        <p className="mb-2 text-[10px] text-app-muted">{t('owner_ad_preview')}</p>
                        <div className="relative aspect-[2.2/1] overflow-hidden rounded-lg">
                          {adFormFile && adFormPreviewUrl ? (
                            adFormType === 'video' ? (
                              <video src={adFormPreviewUrl} muted playsInline loop className="h-full w-full object-cover" />
                            ) : (
                              <img src={adFormPreviewUrl} alt="" className="h-full w-full object-cover" />
                            )
                          ) : (
                            adFormType === 'video' ? (
                              <video src={adFormMediaUrl.trim()} muted playsInline loop className="h-full w-full object-cover" />
                            ) : (
                              <img src={adFormMediaUrl.trim()} alt="" className="h-full w-full object-cover" onError={() => {}} />
                            )
                          )}
                        </div>
                      </div>
                    ) : null}
                    <input className="field-input" value={adFormTitle} onChange={(e) => setAdFormTitle(e.target.value.slice(0, AD_TITLE_MAX))} placeholder={t('owner_ad_title')} maxLength={AD_TITLE_MAX} />
                    <input className="field-input" value={adFormDescription} onChange={(e) => setAdFormDescription(e.target.value.slice(0, AD_DESCRIPTION_MAX))} placeholder={t('owner_ad_description')} maxLength={AD_DESCRIPTION_MAX} />
                    <input className="field-input" value={adFormLinkUrl} onChange={(e) => setAdFormLinkUrl(e.target.value)} placeholder={t('owner_ad_link_url')} />
                    <select className="field-input" value={adFormPlacement} onChange={(e) => setAdFormPlacement(e.target.value)}>
                      {AD_PLACEMENTS.map((p) => (
                        <option key={p} value={p}>
                          {p === 'all' ? t('owner_banner_place_all') : p === 'home' ? t('owner_banner_place_home') : p === 'profile' ? t('owner_banner_place_profile') : p === 'mining' ? t('owner_banner_place_mining') : t('owner_ad_place_deposit')}
                        </option>
                      ))}
                    </select>
                    {adFormValidationError ? <p className="text-xs text-red-400">{t(adFormValidationError)}</p> : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="wallet-action-btn owner-set-btn"
                        disabled={adsSaving || adFormUploading}
                        onClick={async () => {
                          setAdFormValidationError(null)
                          let url = adFormMediaUrl.trim()
                          if (adFormFile) {
                            setAdFormUploading(true)
                            try {
                              const up = await uploadAdMedia(adFormFile)
                              url = up.url
                              emitToast({ kind: 'success', message: t('owner_ad_uploaded'), durationMs: 2400 })
                            } finally {
                              setAdFormUploading(false)
                            }
                          }
                          const err = validateAdForm({ mediaUrl: url, type: adFormType, title: adFormTitle, description: adFormDescription, linkUrl: adFormLinkUrl, placement: adFormPlacement })
                          if (err) {
                            setAdFormValidationError(err)
                            return
                          }
                          setAdsSaving(true)
                          try {
                            if (adFormEdit) {
                              await updateAd(adFormEdit.id, { type: adFormType, mediaUrl: url, title: adFormTitle, description: adFormDescription, linkUrl: adFormLinkUrl || undefined, placement: adFormPlacement })
                              emitToast({ kind: 'success', message: t('owner_ad_saved'), durationMs: 2400 })
                            } else {
                              await createAd({ type: adFormType, mediaUrl: url, title: adFormTitle, description: adFormDescription, linkUrl: adFormLinkUrl || undefined, placement: adFormPlacement })
                              emitToast({ kind: 'success', message: t('owner_ad_saved'), durationMs: 2400 })
                            }
                            setAdFormOpen(false)
                            setAdFormEdit(null)
                            setAdFormMediaUrl('')
                            setAdFormTitle('')
                            setAdFormDescription('')
                            setAdFormLinkUrl('')
                            setAdFormFile(null)
                            const res = await getAdsAdmin()
                            setAdsList(res.items || [])
                          } finally {
                            setAdsSaving(false)
                          }
                        }}
                      >
                        {adFormUploading ? t('owner_ad_uploading') : adsSaving ? t('owner_settings_saving') : (adFormEdit ? t('owner_ad_save') : t('owner_banner_add'))}
                      </button>
                      <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => { setAdFormOpen(false); setAdFormEdit(null); setAdFormValidationError(null) }}>
                        {t('common_cancel')}
                      </button>
                    </div>
                  </div>
                ) : null}
                {adsList.length > 0 ? (
                  <div className="space-y-2">
                    {adsList.map((item, idx) => (
                      <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-app-border p-2">
                        <span className="text-xs text-white/80">#{item.id} {item.type}</span>
                        <span className="truncate text-xs text-white/70 max-w-[120px]">{item.title || item.mediaUrl}</span>
                        <span className="text-[10px] text-app-muted">{item.placement}</span>
                        <button type="button" className="wallet-action-btn owner-set-btn text-xs" onClick={() => { setAdFormEdit(item); setAdFormType(item.type); setAdFormMediaUrl(item.mediaUrl); setAdFormTitle(item.title || ''); setAdFormDescription(item.description || ''); setAdFormLinkUrl(item.linkUrl || ''); setAdFormPlacement(item.placement); setAdFormFile(null); setAdFormValidationError(null); setAdFormOpen(true) }}>{t('owner_ad_edit')}</button>
                        <button type="button" className={`wallet-action-btn text-xs ${item.isActive ? 'wallet-action-deposit' : 'owner-set-btn'}`} disabled={adToggleLoading !== null} onClick={async () => { setAdToggleLoading(item.id); try { await toggleAd(item.id, !item.isActive); emitToast({ kind: 'success', message: t('owner_ad_toggled'), durationMs: 2000 }); const res = await getAdsAdmin(); setAdsList(res.items || []) } finally { setAdToggleLoading(null) } }}>{adToggleLoading === item.id ? '…' : (item.isActive ? t('owner_banner_enabled') : t('owner_banner_disabled'))}</button>
                        {adDeleteConfirmId === item.id ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button type="button" className="wallet-action-btn wallet-action-withdraw text-xs" disabled={adDeleteLoading === item.id} onClick={async () => { setAdDeleteLoading(item.id); try { await deleteAd(item.id); emitToast({ kind: 'success', message: t('owner_ad_deleted'), durationMs: 2400 }); const res = await getAdsAdmin(); setAdsList(res.items || []); setAdDeleteConfirmId(null) } finally { setAdDeleteLoading(null) } }}>{adDeleteLoading === item.id ? '…' : t('common_confirm')}</button>
                            <button type="button" className="wallet-action-btn owner-set-btn text-xs" onClick={() => { setAdDeleteConfirmId(null) }}>{t('common_cancel')}</button>
                          </span>
                        ) : (
                          <button type="button" className="wallet-action-btn wallet-action-withdraw text-xs" onClick={() => setAdDeleteConfirmId(item.id)}>{t('owner_banner_remove')}</button>
                        )}
                        {idx > 0 && <button type="button" className="wallet-action-btn owner-set-btn text-xs" disabled={adReorderLoading} onClick={async () => { setAdReorderLoading(true); try { const order = adsList.map((a) => a.id); const tmp = order[idx]; order[idx] = order[idx - 1]; order[idx - 1] = tmp; await reorderAds(order); emitToast({ kind: 'success', message: t('owner_ad_reordered'), durationMs: 2000 }); const res = await getAdsAdmin(); setAdsList(res.items || []) } finally { setAdReorderLoading(false) } }}>↑</button>}
                        {idx < adsList.length - 1 && <button type="button" className="wallet-action-btn owner-set-btn text-xs" disabled={adReorderLoading} onClick={async () => { setAdReorderLoading(true); try { const order = adsList.map((a) => a.id); const tmp = order[idx]; order[idx] = order[idx + 1]; order[idx + 1] = tmp; await reorderAds(order); emitToast({ kind: 'success', message: t('owner_ad_reordered'), durationMs: 2000 }); const res = await getAdsAdmin(); setAdsList(res.items || []) } finally { setAdReorderLoading(false) } }}>↓</button>}
                      </div>
                    ))}
                  </div>
                ) : null}
                {!adFormOpen && adsList.length > 0 ? (
                  <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => { setAdFormEdit(null); setAdFormType('image'); setAdFormMediaUrl(''); setAdFormTitle(''); setAdFormDescription(''); setAdFormLinkUrl(''); setAdFormPlacement('all'); setAdFormFile(null); setAdFormValidationError(null); setAdFormOpen(true) }}>
                    {t('owner_banner_add')}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection !== 'overview' &&
          activeSection !== 'bonuses' &&
          activeSection !== 'vip' &&
          activeSection !== 'referrals' &&
          activeSection !== 'notifications' &&
          activeSection !== 'security' &&
          activeSection !== 'staff_permissions' &&
          activeSection !== 'kyc' &&
          activeSection !== 'settings' ? (
            <section className="rounded-2xl border border-app-border bg-app-card p-4">
              <h2 className="text-base font-semibold text-white">
                {sections.find((s) => s.key === activeSection)?.label}
              </h2>
              <p className="mt-1 text-sm text-app-muted">
                {t('owner_control_panel_hint')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/wallet" className="rounded-xl border border-brand-blue/30 bg-brand-blue/10 px-3 py-1.5 text-sm font-medium text-brand-blue">{t('owner_nav_my_wallet')}</Link>
                <Link to="/admin/users" className="rounded-xl border border-app-border bg-app-elevated px-3 py-1.5 text-sm text-white/90">{t('owner_quick_users')}</Link>
                <Link to="/admin/balances" className="rounded-xl border border-app-border bg-app-elevated px-3 py-1.5 text-sm text-white/90">{t('owner_quick_wallets')}</Link>
                <Link to="/admin/invites" className="rounded-xl border border-app-border bg-app-elevated px-3 py-1.5 text-sm text-white/90">{t('owner_quick_referrals')}</Link>
                <Link to="/admin/permissions" className="rounded-xl border border-app-border bg-app-elevated px-3 py-1.5 text-sm text-white/90">{t('owner_quick_staff_permissions')}</Link>
                <Link to="/owner/operations" className="rounded-xl border border-brand-blue/45 bg-brand-blue/15 px-3 py-1.5 text-sm text-white">{t('owner_quick_operations')}</Link>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-app-border bg-app-card p-3 text-xs text-app-muted">
            {t('owner_branding_note')}
          </section>
        </main>
      </div>
    </div>
  )
}
