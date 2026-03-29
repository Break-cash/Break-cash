import { useEffect, useState } from 'react'
import { Crown, Eye, EyeOff, Medal, Sparkles } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import {
  apiFetch,
  adjustUserProfit,
  createAdminStaff,
  createBonusRule,
  createContentCampaign,
  createAd,
  createDailyTradeCampaign,
  getBalanceRules,
  getAdminUnlockOverride,
  getAdminStaffList,
  getAdminUsersList,
  getAdminUserWallet,
  deleteBonusRule,
  deleteDailyTradeCampaign,
  deleteAd,
  getAdsAdmin,
  getAssetImages,
  getBonusRules,
  getContentCampaigns,
  getDailyTradeCampaigns,
  getIconAttractionKeys,
  getKycWatchlist,
  getOwnerGrowthSummary,
  getOwnerFinancialGuard,
  getOwnerMonthlyFinanceReport,
  getPartnerProfiles,
  getHomeLeaderboardConfig,
  deleteRewardPayoutOverrideOwner,
  getRewardPayoutRulesOwner,
  getRegistrationStatus,
  getReferralDetails,
  getReferralStats,
  getReferralSummary,
  ownerUploadSettingImage,
  ownerUploadUserAvatar,
  replaceAdminStaffPermissions,
  reorderAds,
  revokeAllUserSessions,
  runAdminAccountHealthScan,
  runUnusualActivityDetection,
  setAdminSensitiveAccess,
  getSecurityOverview,
  getSecuritySessions,
  getStrategyTradeDisplayConfig,
  getStrategyCodesAdmin,
  getVipTiers,
  toggleAd,
  toggleKycWatchlistEntry,
  upsertStrategyCodeAdmin,
  upsertPartnerProfile,
  upsertAdminUnlockOverride,
  upsertVipTier,
  updateAd,
  updateAdminStaffRole,
  toggleStrategyCodeAdmin,
  deleteStrategyCodeAdmin,
  deleteStrategyUsageAdmin,
  getMiningAdminConfig,
  getOwnerKycSubmissions,
  getRecoveryCodeReviewRequests,
  updateMiningAdminConfig,
  updateBalanceRules,
  updateHomeLeaderboardConfig,
  updateOwnerFinancialGuardConfig,
  updateRewardPayoutRulesOwner,
  updateStrategyTradeDisplayConfig,
  updateUserTwoFactor,
  processAutoKycReviews,
  reviewOwnerKycSubmission,
  reviewRecoveryCodeRequest,
  addKycWatchlistEntry,
  upsertRewardPayoutOverridesOwner,
  uploadAdMedia,
  uploadMiningMediaAdmin,
  type AdItem,
  type AdminAccountHealthScan,
  type AdminStaffItem,
  type AdminUserRow,
  type AuthUser,
  type BalanceRules,
  type BonusRule,
  type ContentCampaign,
  type DailyTradeCampaign,
  type EarningEntry,
  type HomeLeaderboardConfig,
  type IconAttractionAssignments,
  type IconAttractionTarget,
  type KycWatchlistItem,
  type KycSubmissionRow,
  type MiningConfig,
  type OwnerMonthlyFinanceReport,
  type OwnerFinancialApprovalItem,
  type OwnerFinancialGuardConfig,
  type PartnerProfile,
  type RewardPayoutMode,
  type RewardPayoutApplyResult,
  type RewardPayoutRulesResponse,
  type RewardPayoutSource,
  type RecoveryCodeReviewRequestItem,
  type RewardTierRule,
  type SecurityOverview,
  type StrategyCodeAdminItem,
  type StrategyTradeDisplayConfig,
  type StrategyCodeUsageAdminItem,
  type UserUnlockOverride,
  type UserSessionItem,
  type VipTier,
  type WithdrawalSummary,
  reviewOwnerFinancialGuardReport,
  toggleBonusRule,
  toggleDailyTradeCampaign,
  updateIconAttractionKeys,
  updateRegistrationStatus,
  updateUserBadgeStyle,
  updateUserBan,
  updateUserFreeze,
  updateUserVipLevel,
} from '../../api'
import { AD_DESCRIPTION_MAX, AD_PLACEMENTS, AD_TITLE_MAX, validateAdForm } from '../../components/ads/adConstants'
import { LeaderboardSection, defaultHomeLeaderboardConfig } from '../../components/home/LeaderboardSection'
import { useI18n } from '../../i18nCore'

type OwnerDashboardProps = {
  user: AuthUser | null
}

type KycAttachmentPreview = {
  title: string
  url: string
  alt: string
}

type OwnerProfitSnapshot = {
  user: { id: number; email: string | null; phone: string | null; display_name: string | null } | null
  overview: {
    total_assets: number
    by_currency: Record<string, number>
    by_source: { source_type: string; currency: string; balance: number }[]
    main_balance: number
    locked_balance: number
    withdrawable_balance: number
  }
  withdraw_summary: WithdrawalSummary
  earning_entries: EarningEntry[]
}

function formatOwnerDateTime(value: string | null | undefined) {
  if (!value) return 'غير محدد'
  const ms = Date.parse(String(value))
  if (Number.isNaN(ms)) return String(value)
  return new Date(ms).toLocaleString('ar')
}

const REWARD_PAYOUT_SOURCE_OPTIONS: Array<{
  value: RewardPayoutSource
  label: string
  description: string
}> = [
  { value: 'all', label: 'كل المكتسبات', description: 'تطبيق القاعدة على جميع المصادر للمستخدم المحدد.' },
  { value: 'mining', label: 'التعدين', description: 'يشمل الأرباح اليومية القادمة من التعدين.' },
  { value: 'tasks', label: 'المهام والمكافآت', description: 'يشمل المهام والعروض والصفقات التجريبية.' },
  { value: 'referrals', label: 'الإحالات', description: 'يشمل مكافآت الإحالة.' },
  { value: 'deposits', label: 'مكافآت الإيداع', description: 'يشمل مكافآت أول إيداع وما شابهها.' },
]

const REWARD_PAYOUT_MODE_OPTIONS: Array<{ value: RewardPayoutMode; label: string }> = [
  { value: 'withdrawable', label: 'قابلة للسحب' },
  { value: 'bonus_locked', label: 'غير قابلة للسحب' },
]

function createDefaultRewardPayoutRules(): RewardPayoutRulesResponse {
  return {
    defaultMode: 'withdrawable',
    sourceModes: { referrals: 'withdrawable', deposits: 'withdrawable' },
    defaultLockHours: 0,
    sourceLockHours: {},
    overridesCount: 0,
    overrides: [],
  }
}

function createDefaultPrincipalWithdrawalRule() {
  return {
    enabled: true,
    withdrawableRatio: 0.5,
    clearProfitRestriction: true,
    applyToAllVipLevels: true,
    ownerApprovalRequired: false,
  }
}

function createDefaultBalanceRules(): BalanceRules {
  return {
    minDeposit: 10,
    minWithdrawal: 10,
    depositMethods: ['USDT TRC20', 'Bank Transfer'],
    withdrawalMethods: ['USDT TRC20'],
    manualReview: true,
    withdrawalFeePercent: 10,
    minimumProfitToUnlock: 0,
    defaultUnlockRatio: 0.5,
    unlockRatioByLevel: { 0: 0.5, 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5 },
    principalWithdrawalRule: createDefaultPrincipalWithdrawalRule(),
  }
}

function createDefaultOwnerFinancialGuardConfig(): OwnerFinancialGuardConfig {
  return {
    enabled: true,
    watchDepositApprovals: true,
    watchManualBalanceAdds: true,
    watchBonusAdds: true,
  }
}

function getOwnerFinancialActionLabel(value: OwnerFinancialApprovalItem['actionType']) {
  if (value === 'deposit_approval') return 'اعتماد إيداع'
  if (value === 'bonus_add') return 'إضافة أرباح/مكافأة'
  return 'إضافة رصيد يدوية'
}

function getPrincipalWithdrawPercent(rules: BalanceRules) {
  return Math.round(Number(rules.principalWithdrawalRule?.withdrawableRatio ?? rules.defaultUnlockRatio ?? 0.5) * 100)
}

const ownerLeaderboardPlaceMeta = [
  {
    badge: 'الأول',
    icon: Crown,
    iconClass: 'text-yellow-200',
    chipClass: 'border-yellow-400/30 bg-yellow-400/12 text-yellow-100',
    cardClass: 'border-yellow-400/16 bg-[linear-gradient(180deg,rgba(250,204,21,0.12),rgba(15,23,42,0.92))]',
  },
  {
    badge: 'الثاني',
    icon: Medal,
    iconClass: 'text-slate-200',
    chipClass: 'border-slate-300/30 bg-slate-300/10 text-slate-100',
    cardClass: 'border-slate-300/14 bg-[linear-gradient(180deg,rgba(226,232,240,0.08),rgba(15,23,42,0.92))]',
  },
  {
    badge: 'الثالث',
    icon: Medal,
    iconClass: 'text-orange-200',
    chipClass: 'border-orange-400/30 bg-orange-400/10 text-orange-100',
    cardClass: 'border-orange-400/16 bg-[linear-gradient(180deg,rgba(251,146,60,0.09),rgba(15,23,42,0.92))]',
  },
]

function formatRewardApplyResult(result?: RewardPayoutApplyResult | null) {
  const releasedEntries = Number(result?.releasedEntries || 0)
  const releasedAmount = Number(result?.releasedAmount || 0)
  const lockedEntries = Number(result?.lockedEntries || 0)
  const lockedAmount = Number(result?.lockedAmount || 0)
  const bonusLockedEntries = Number(result?.bonusLockedEntries || 0)
  if (releasedEntries > 0 && lockedEntries > 0) {
    return `تم تحرير ${releasedEntries} أرباح معلقة بقيمة ${releasedAmount.toFixed(2)} USDT، وتم تمديد أو إنشاء قفل زمني لـ ${lockedEntries} سجل بقيمة ${lockedAmount.toFixed(2)} USDT.`
  }
  if (releasedEntries > 0) {
    return `تم تحرير ${releasedEntries} أرباح معلقة بقيمة ${releasedAmount.toFixed(2)} USDT.`
  }
  if (lockedEntries > 0) {
    return `تم تمديد أو إنشاء قفل زمني لـ ${lockedEntries} سجل بقيمة ${lockedAmount.toFixed(2)} USDT.`
  }
  if (bonusLockedEntries > 0) {
    return `تم تحويل ${bonusLockedEntries} سجلًا معلقًا إلى وضع غير قابل للسحب.`
  }
  return ''
}

export function OwnerDashboardPage({ user }: OwnerDashboardProps) {
  const { t } = useI18n()
  const [targetUserId, setTargetUserId] = useState('')
  const [userProfitAdjustDraft, setUserProfitAdjustDraft] = useState({
    amount: '',
    target: 'main' as 'main' | 'pending',
    sourceType: 'all' as RewardPayoutSource,
    note: '',
  })
  const [userProfitAdjustSaving, setUserProfitAdjustSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [avatarTargetUserId, setAvatarTargetUserId] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [assetKey, setAssetKey] = useState('logo_url')
  const [assetFile, setAssetFile] = useState<File | null>(null)
  const [assetSaving, setAssetSaving] = useState(false)
  const [assetImages, setAssetImages] = useState<{ key: string; url: string }[]>([])
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  const [registrationSaving, setRegistrationSaving] = useState(false)
  const [homeLeaderboardDraft, setHomeLeaderboardDraft] = useState<HomeLeaderboardConfig>(defaultHomeLeaderboardConfig)
  const [homeLeaderboardSaving, setHomeLeaderboardSaving] = useState(false)
  const [homeLeaderboardPreviewOpen, setHomeLeaderboardPreviewOpen] = useState(false)
  const [homeLeaderboardPreviewMode, setHomeLeaderboardPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [homeLeaderboardSearchDrafts, setHomeLeaderboardSearchDrafts] = useState<string[]>(['', '', ''])
  const [homeLeaderboardSearchResults, setHomeLeaderboardSearchResults] = useState<AdminUserRow[][]>([[], [], []])
  const [homeLeaderboardSearchLoadingIndex, setHomeLeaderboardSearchLoadingIndex] = useState<number | null>(null)
  const [attractionKeys, setAttractionKeys] = useState<Array<'hot' | 'new' | 'most_requested'>>([])
  const [attractionTargets, setAttractionTargets] = useState<IconAttractionTarget[]>([])
  const [attractionAssignments, setAttractionAssignments] = useState<IconAttractionAssignments>({})
  const [attractionSaving, setAttractionSaving] = useState(false)
  const [userFlags, setUserFlags] = useState<{
    is_banned: number
    is_frozen: number
    vip_level: number
    badge_color: 'none' | 'gold' | 'blue'
  } | null>(null)
  const [flagsSaving, setFlagsSaving] = useState(false)
  const [strategyCodes, setStrategyCodes] = useState<StrategyCodeAdminItem[]>([])
  const [strategyUsages, setStrategyUsages] = useState<StrategyCodeUsageAdminItem[]>([])
  const [strategyCodeDraft, setStrategyCodeDraft] = useState({
    code: '',
    title: '',
    description: '',
    expertName: '',
    assetSymbol: 'BTCUSDT',
    purchasePercent: '50',
    tradeReturnPercent: '0',
    expiresAt: '',
    isActive: true,
  })
  const [strategySaving, setStrategySaving] = useState(false)
  const [strategyUsageDeletingId, setStrategyUsageDeletingId] = useState<number | null>(null)
  const [strategyDisplaySaving, setStrategyDisplaySaving] = useState(false)
  const [strategyTradeDisplayDraft, setStrategyTradeDisplayDraft] = useState<StrategyTradeDisplayConfig>({
    preview_notice: 'سيتم فتح الصفقة الاستراتيجية بعد التأكيد وفق آلية المعالجة الداخلية للنظام.',
    active_notice: 'تتم إعادة أصل الصفقة مع الربح تلقائيًا بعد اكتمال المعالجة الداخلية.',
    settled_notice: 'تمت تسوية الصفقة الاستراتيجية وإرجاع الأصل مع الربح.',
  })
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([])
  const [dailyTradeCampaigns, setDailyTradeCampaigns] = useState<DailyTradeCampaign[]>([])
  const [dailyTradeDraft, setDailyTradeDraft] = useState({
    id: 0,
    title: 'لوحة الأرباح اليومية',
    symbol: 'BTCUSDT',
    side: 'buy',
    entryPrice: '',
    takeProfit: '',
    stopLoss: '',
    successRate: '78',
    rewardAmount: '10',
    rewardCurrency: 'USDT',
    visibilityScope: 'all' as 'all' | 'depositors' | 'vip' | 'vip_level',
    minVipLevel: '0',
    isVisible: true,
    startsAt: '',
    endsAt: '',
  })
  const [firstDepositBonusDraft, setFirstDepositBonusDraft] = useState({
    id: 0,
    title: 'مكافأة أول إيداع',
    minDeposit: '100',
    maxDeposit: '',
    rewardMode: 'percent' as 'percent' | 'fixed',
    rewardValue: '10',
    isActive: true,
  })
  const [referralBonusDraft, setReferralBonusDraft] = useState({
    id: 0,
    title: 'مكافأة المحيل بعد أول إيداع مؤكد',
    minDeposit: '100',
    maxDeposit: '',
    rewardMode: 'fixed' as 'percent' | 'fixed',
    rewardValue: '10',
    isActive: true,
  })
  const [bonusSaving, setBonusSaving] = useState(false)
  const [kycSubmissions, setKycSubmissions] = useState<KycSubmissionRow[]>([])
  const [kycLoading, setKycLoading] = useState(false)
  const [kycReviewLoadingId, setKycReviewLoadingId] = useState<number | null>(null)
  const [kycPreview, setKycPreview] = useState<KycAttachmentPreview | null>(null)
  const [kycPreviewError, setKycPreviewError] = useState(false)
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryCodeReviewRequestItem[]>([])
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [recoveryReviewLoadingId, setRecoveryReviewLoadingId] = useState<number | null>(null)
  const [miningConfigDraft, setMiningConfigDraft] = useState<MiningConfig | null>(null)
  const [miningSaving, setMiningSaving] = useState(false)
  const [adsList, setAdsList] = useState<AdItem[]>([])
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
  const [adsSaving, setAdsSaving] = useState(false)
  const [adValidationError, setAdValidationError] = useState<string | null>(null)
  const [adToggleLoading, setAdToggleLoading] = useState<number | null>(null)
  const [adDeleteLoading, setAdDeleteLoading] = useState<number | null>(null)
  const [adDeleteConfirmId, setAdDeleteConfirmId] = useState<number | null>(null)
  const [adReorderLoading, setAdReorderLoading] = useState(false)
  const [ownerSummary, setOwnerSummary] = useState({
    activeDailyTrades: 0,
    activeBonusRules: 0,
    activePartners: 0,
    activeContent: 0,
  })
  const [ownerFinancialGuardConfig, setOwnerFinancialGuardConfig] = useState<OwnerFinancialGuardConfig>(createDefaultOwnerFinancialGuardConfig())
  const [ownerFinancialQueue, setOwnerFinancialQueue] = useState<OwnerFinancialApprovalItem[]>([])
  const [ownerFinancialSummary, setOwnerFinancialSummary] = useState({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    pendingAmount: 0,
  })
  const [ownerFinancialGuardSaving, setOwnerFinancialGuardSaving] = useState(false)
  const [ownerFinancialReviewLoadingId, setOwnerFinancialReviewLoadingId] = useState<number | null>(null)
  const [ownerFinancialReviewNote, setOwnerFinancialReviewNote] = useState('')
  const [vipTiers, setVipTiers] = useState<VipTier[]>([])
  const [rewardPayoutRules, setRewardPayoutRules] = useState<RewardPayoutRulesResponse>(createDefaultRewardPayoutRules())
  const [balanceRules, setBalanceRules] = useState<BalanceRules>(createDefaultBalanceRules())
  const [balanceRulesSaving, setBalanceRulesSaving] = useState(false)
  const [principalRuleResetOverrides, setPrincipalRuleResetOverrides] = useState(true)
  const [rewardPayoutSaving, setRewardPayoutSaving] = useState(false)
  const [rewardPayoutApplyPendingGlobal, setRewardPayoutApplyPendingGlobal] = useState(false)
  const [rewardPayoutOverrideDraft, setRewardPayoutOverrideDraft] = useState({
    userIdsText: '',
    sourceType: 'all' as RewardPayoutSource,
    payoutMode: 'withdrawable' as RewardPayoutMode,
    lockHours: '0',
    note: '',
    applyPending: false,
  })
  const [rewardPayoutDeleteKey, setRewardPayoutDeleteKey] = useState('')
  const [vipTierDraft, setVipTierDraft] = useState({
    level: 1,
    title: 'VIP 1',
    minDeposit: '500',
    minTradeVolume: '0',
    referralMultiplier: '1',
    referralPercent: '4',
    dailyMiningPercent: '1.2',
    miningSpeedPercent: '0',
    dailyWithdrawalLimit: '200',
    processingHoursMin: '72',
    processingHoursMax: '72',
    withdrawalFeePercent: '10',
    activeExtraFeePercent: '5',
    level2ReferralPercent: '0',
    level3ReferralPercent: '0',
    profitMultiplier: '1',
    autoReinvest: false,
    dailyBonus: false,
    perks: '',
    isActive: true,
  })
  const [partnerProfiles, setPartnerProfiles] = useState<PartnerProfile[]>([])
  const [partnerDraft, setPartnerDraft] = useState({
    userId: '',
    commissionRate: '4',
    status: 'active',
    notes: '',
  })
  const [referralStats, setReferralStats] = useState({
    pendingCount: 0,
    qualifiedCount: 0,
    rewardReleasedCount: 0,
    totalRewardsValue: 0,
  })
  const [referralSummary, setReferralSummary] = useState<Array<Record<string, unknown>>>([])
  const [referralDetailUserId, setReferralDetailUserId] = useState('')
  const [referralDetails, setReferralDetails] = useState<Array<Record<string, unknown>>>([])
  const [contentCampaigns, setContentCampaigns] = useState<ContentCampaign[]>([])
  const [contentDraft, setContentDraft] = useState({
    campaignType: 'notification' as 'notification' | 'popup' | 'banner' | 'news',
    title: '',
    body: '',
    language: 'all',
    minVipLevel: '0',
    vipOnly: false,
    depositorsOnly: false,
    nonDepositorsOnly: false,
    isActive: true,
  })
  const [securityOverview, setSecurityOverview] = useState<SecurityOverview | null>(null)
  const [securitySessions, setSecuritySessions] = useState<UserSessionItem[]>([])
  const [securityUserId, setSecurityUserId] = useState('')
  const [securityActionLoading, setSecurityActionLoading] = useState<number | string | null>(null)
  const [staffItems, setStaffItems] = useState<AdminStaffItem[]>([])
  const [staffDraft, setStaffDraft] = useState({
    identifier: '',
    password: '',
    displayName: '',
    adminRole: 'support' as 'super_admin' | 'admin' | 'finance' | 'support' | 'moderator',
    accessPreset: 'support' as 'read_only' | 'finance' | 'kyc' | 'trading' | 'marketing' | 'support' | 'full_admin',
  })
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([])
  const [selectedStaffUserId, setSelectedStaffUserId] = useState('')
  const [selectedStaffPermissions, setSelectedStaffPermissions] = useState<string[]>([])
  const [watchlist, setWatchlist] = useState<KycWatchlistItem[]>([])
  const [watchlistDraft, setWatchlistDraft] = useState({
    userId: '',
    note: '',
    source: '',
  })
  const [monthlyFinanceMonth, setMonthlyFinanceMonth] = useState(new Date().toISOString().slice(0, 7))
  const [monthlyFinance, setMonthlyFinance] = useState<OwnerMonthlyFinanceReport | null>(null)
  const [profitPanelUserId, setProfitPanelUserId] = useState('')
  const [profitPanelCurrency, setProfitPanelCurrency] = useState('USDT')
  const [profitSnapshot, setProfitSnapshot] = useState<OwnerProfitSnapshot | null>(null)
  const [profitOverride, setProfitOverride] = useState<UserUnlockOverride | null>(null)
  const [profitOverrideDraft, setProfitOverrideDraft] = useState({
    forceUnlockPrincipal: false,
    customUnlockRatio: '',
    customMinProfit: '',
    note: '',
  })
  const [profitPanelLoading, setProfitPanelLoading] = useState(false)
  const [profitPanelSaving, setProfitPanelSaving] = useState(false)
  const [ownerExtraSaving, setOwnerExtraSaving] = useState(false)
  const [staffHealthLoading, setStaffHealthLoading] = useState(false)
  const [staffHealthScan, setStaffHealthScan] = useState<AdminAccountHealthScan | null>(null)
  const [staffHealthUserId, setStaffHealthUserId] = useState('')

  const isOwner = user?.role === 'owner' || Number(user?.is_owner || 0) === 1
  const firstDepositBonusRules = bonusRules.filter((rule) => rule.rule_type === 'first_deposit')
  const referralBonusRules = bonusRules.filter((rule) => rule.rule_type === 'referral')

  useEffect(() => {
    getAssetImages()
      .then((res) => setAssetImages(res.images || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    getRegistrationStatus()
      .then((res) => setRegistrationEnabled(!!res.enabled))
      .catch(() => {})
  }, [])

  useEffect(() => {
    getHomeLeaderboardConfig()
      .then((res) => setHomeLeaderboardDraft(res.config || defaultHomeLeaderboardConfig))
      .catch(() => setHomeLeaderboardDraft(defaultHomeLeaderboardConfig))
  }, [])

  useEffect(() => {
    getBalanceRules()
      .then((res) => setBalanceRules(res.rules || createDefaultBalanceRules()))
      .catch(() => setBalanceRules(createDefaultBalanceRules()))
  }, [])

  useEffect(() => {
    getIconAttractionKeys()
      .then((res) => {
        setAttractionKeys(res.keys || [])
        setAttractionTargets(res.targets || [])
        setAttractionAssignments(res.assignments || {})
      })
      .catch(() => {
        setAttractionKeys([])
        setAttractionTargets([])
        setAttractionAssignments({})
      })
  }, [])

  useEffect(() => {
    getStrategyCodesAdmin()
      .then((res) => {
        setStrategyCodes(res.items || [])
        setStrategyUsages(res.usages || [])
      })
      .catch(() => {
        setStrategyCodes([])
        setStrategyUsages([])
      })
    getStrategyTradeDisplayConfig()
      .then((res) => setStrategyTradeDisplayDraft(res.config))
      .catch(() => {})
    getMiningAdminConfig()
      .then((res) => setMiningConfigDraft(res.config))
      .catch(() => setMiningConfigDraft(null))
    getAdsAdmin()
      .then((res) => setAdsList(res.items || []))
      .catch(() => setAdsList([]))
    getDailyTradeCampaigns()
      .then((res) => setDailyTradeCampaigns(res.items || []))
      .catch(() => setDailyTradeCampaigns([]))
    getBonusRules()
      .then((res) => setBonusRules(res.items || []))
      .catch(() => setBonusRules([]))
    getOwnerKycSubmissions({ status: 'pending' })
      .then((res) => setKycSubmissions(res.items || []))
      .catch(() => setKycSubmissions([]))
    getRecoveryCodeReviewRequests('pending')
      .then((res) => setRecoveryRequests(res.items || []))
      .catch(() => setRecoveryRequests([]))
  }, [])

  useEffect(() => {
    getOwnerGrowthSummary()
      .then((res) => setOwnerSummary(res))
      .catch(() => {})
    getOwnerFinancialGuard()
      .then((res) => {
        setOwnerFinancialGuardConfig(res.config || createDefaultOwnerFinancialGuardConfig())
        setOwnerFinancialQueue(res.items || [])
        setOwnerFinancialSummary(res.summary || {
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          pendingAmount: 0,
        })
      })
      .catch(() => {
        setOwnerFinancialGuardConfig(createDefaultOwnerFinancialGuardConfig())
        setOwnerFinancialQueue([])
      })
    getRewardPayoutRulesOwner()
      .then((res) => setRewardPayoutRules(res))
      .catch(() => setRewardPayoutRules(createDefaultRewardPayoutRules()))
    getVipTiers()
      .then((res) => setVipTiers(res.items || []))
      .catch(() => setVipTiers([]))
    getPartnerProfiles()
      .then((res) => setPartnerProfiles(res.items || []))
      .catch(() => setPartnerProfiles([]))
    getReferralStats()
      .then((res) => setReferralStats(res))
      .catch(() => {})
    getReferralSummary()
      .then((res) => setReferralSummary(res.summary || []))
      .catch(() => setReferralSummary([]))
    getContentCampaigns()
      .then((res) => setContentCampaigns(res.items || []))
      .catch(() => setContentCampaigns([]))
    getSecurityOverview()
      .then((res) => setSecurityOverview(res))
      .catch(() => setSecurityOverview(null))
    getSecuritySessions()
      .then((res) => setSecuritySessions(res.items || []))
      .catch(() => setSecuritySessions([]))
    getAdminStaffList()
      .then((res) => setStaffItems(res.items || []))
      .catch(() => setStaffItems([]))
    apiFetch('/api/permissions/available')
      .then((res) => setAvailablePermissions(((res as { permissions?: string[] }).permissions || []).filter(Boolean)))
      .catch(() => setAvailablePermissions([]))
    getKycWatchlist()
      .then((res) => setWatchlist(res.items || []))
      .catch(() => setWatchlist([]))
    getOwnerMonthlyFinanceReport()
      .then((res) => setMonthlyFinance(res))
      .catch(() => setMonthlyFinance(null))
  }, [])

  useEffect(() => {
    const uid = Number(targetUserId)
    if (!Number.isFinite(uid) || uid <= 0) {
      setUserFlags(null)
      return
    }
    apiFetch(`/api/users/list?q=${uid}`)
      .then((res) => {
        const users = (res as { users: Array<{
          id: number
          is_banned: number
          is_frozen?: number
          blue_badge?: number
          verification_status?: 'verified' | 'pending' | 'unverified'
          vip_level?: number
        }> }).users || []
        const found = users.find((u) => Number(u.id) === uid)
        if (!found) {
          setUserFlags(null)
          return
        }
        const badgeColor: 'none' | 'gold' | 'blue' =
          Number(found.blue_badge || 0) === 1
            ? 'blue'
            : found.verification_status === 'verified'
              ? 'gold'
              : 'none'
        setUserFlags({
          is_banned: Number(found.is_banned || 0),
          is_frozen: Number(found.is_frozen || 0),
          vip_level: Number(found.vip_level || 0),
          badge_color: badgeColor,
        })
      })
      .catch(() => setUserFlags(null))
  }, [targetUserId])

  async function handleOwnerAvatarUpload() {
    const uid = Number(avatarTargetUserId)
    if (!uid || !avatarFile) {
      setMessage({ type: 'error', text: 'حدّد ID المستخدم واختر صورة أولاً.' })
      return
    }
    setAvatarSaving(true)
    setMessage(null)
    try {
      await ownerUploadUserAvatar(uid, avatarFile)
      setAvatarFile(null)
      setMessage({ type: 'success', text: `تم تحديث صورة المستخدم #${uid}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل رفع الصورة.' })
    } finally {
      setAvatarSaving(false)
    }
  }

  async function handleAssetUpload() {
    if (!assetFile) {
      setMessage({ type: 'error', text: 'اختر صورة من الجهاز أولاً.' })
      return
    }
    setAssetSaving(true)
    setMessage(null)
    try {
      const res = await ownerUploadSettingImage(assetKey, assetFile)
      setAssetFile(null)
      setMessage({ type: 'success', text: `تم تحديث الصورة: ${res.key}` })
      const list = await getAssetImages()
      setAssetImages(list.images || [])
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل رفع الصورة.' })
    } finally {
      setAssetSaving(false)
    }
  }

  async function handleToggleRegistration() {
    setRegistrationSaving(true)
    setMessage(null)
    try {
      const next = !registrationEnabled
      const res = await updateRegistrationStatus(next)
      setRegistrationEnabled(res.enabled)
      setMessage({
        type: 'success',
        text: res.enabled ? 'تم تفعيل إنشاء الحسابات.' : 'تم تعليق إنشاء الحسابات مؤقتاً.',
      })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث الحالة.' })
    } finally {
      setRegistrationSaving(false)
    }
  }

  function handleHomeLeaderboardFieldChange<K extends keyof HomeLeaderboardConfig>(key: K, value: HomeLeaderboardConfig[K]) {
    setHomeLeaderboardDraft((prev) => ({ ...prev, [key]: value }))
  }

  function handleHomeLeaderboardCompetitorChange(index: number, field: keyof HomeLeaderboardConfig['competitors'][number], value: string) {
    setHomeLeaderboardDraft((prev) => ({
      ...prev,
      competitors: prev.competitors.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        if (field === 'totalDeposits') {
          const numeric = Number(value)
          return { ...item, totalDeposits: Number.isFinite(numeric) ? numeric : 0 }
        }
        return { ...item, [field]: value }
      }),
    }))
  }

  function handleHomeLeaderboardSearchDraftChange(index: number, value: string) {
    setHomeLeaderboardSearchDrafts((prev) => prev.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  async function handleSearchHomeLeaderboardUser(index: number) {
    const q = String(homeLeaderboardSearchDrafts[index] || '').trim()
    if (!q) {
      setMessage({ type: 'error', text: 'اكتب اسم المستخدم أو رقمه أو بريده قبل البحث.' })
      return
    }
    setHomeLeaderboardSearchLoadingIndex(index)
    setMessage(null)
    try {
      const res = await getAdminUsersList({ q, limit: 8, sortBy: 'deposits_total', sortDir: 'desc' })
      setHomeLeaderboardSearchResults((prev) => prev.map((item, itemIndex) => (itemIndex === index ? res.users || [] : item)))
    } catch (e) {
      setHomeLeaderboardSearchResults((prev) => prev.map((item, itemIndex) => (itemIndex === index ? [] : item)))
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل البحث عن المستخدم.' })
    } finally {
      setHomeLeaderboardSearchLoadingIndex(null)
    }
  }

  function handleApplyHomeLeaderboardUser(index: number, userItem: AdminUserRow) {
    const displayName = String(userItem.display_name || '').trim() || `#${userItem.id}`
    const depositsTotal = Number(userItem.deposits_total ?? userItem.total_deposit ?? 0)
    setHomeLeaderboardDraft((prev) => ({
      ...prev,
      competitors: prev.competitors.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              id: Number(userItem.id) || item.id,
              name: displayName,
              username: `#${userItem.id}`,
              avatar: String(userItem.avatar_path || '').trim() || null,
              totalDeposits: Number.isFinite(depositsTotal) ? depositsTotal : item.totalDeposits,
              spotlight:
                item.spotlight && item.spotlight !== defaultHomeLeaderboardConfig.competitors[index]?.spotlight
                  ? item.spotlight
                  : `تمت تعبئة هذه البطاقة من حساب المستخدم ${displayName} مباشرة من لوحة المالك.`,
            }
          : item,
      ),
    }))
    setHomeLeaderboardSearchDrafts((prev) => prev.map((item, itemIndex) => (itemIndex === index ? displayName : item)))
    setHomeLeaderboardSearchResults((prev) => prev.map((item, itemIndex) => (itemIndex === index ? [] : item)))
    setMessage({ type: 'success', text: `تمت إضافة المستخدم ${displayName} إلى المركز ${index + 1}.` })
  }

  async function handleSaveHomeLeaderboard() {
    setHomeLeaderboardSaving(true)
    setMessage(null)
    try {
      const res = await updateHomeLeaderboardConfig(homeLeaderboardDraft)
      setHomeLeaderboardDraft(res.config)
      setMessage({
        type: 'success',
        text: res.config.enabled
          ? 'تم حفظ قسم أعلى المودعين وتفعيله في الرئيسية.'
          : 'تم حفظ قسم أعلى المودعين وهو ما يزال مخفيًا حتى تقوم بتفعيله.',
      })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ إعدادات أعلى المودعين.' })
    } finally {
      setHomeLeaderboardSaving(false)
    }
  }

  async function handleSaveAttractionKeys() {
    setAttractionSaving(true)
    setMessage(null)
    try {
      const res = await updateIconAttractionKeys(attractionKeys, attractionTargets, attractionAssignments)
      setAttractionKeys(res.keys || [])
      setAttractionTargets(res.targets || [])
      setAttractionAssignments(res.assignments || {})
      setMessage({ type: 'success', text: 'تم تحديث مفاتيح الجذب للأيقونات.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث المفاتيح.' })
    } finally {
      setAttractionSaving(false)
    }
  }

  async function handleUserFlagsSave() {
    const uid = Number(targetUserId)
    if (!uid || !userFlags) {
      setMessage({ type: 'error', text: 'أدخل رقم مستخدم صحيح أولاً.' })
      return
    }
    setFlagsSaving(true)
    setMessage(null)
    try {
      await Promise.all([
        updateUserBan(uid, userFlags.is_banned === 1),
        updateUserFreeze(uid, userFlags.is_frozen === 1),
        updateUserBadgeStyle(uid, userFlags.badge_color),
        updateUserVipLevel(uid, userFlags.vip_level),
      ])
      setMessage({ type: 'success', text: 'تم تحديث صلاحيات وحالة المستخدم بنجاح.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث صلاحيات المستخدم.' })
    } finally {
      setFlagsSaving(false)
    }
  }

  async function handleAdjustUserProfit() {
    const uid = Number(targetUserId)
    const amount = Number(userProfitAdjustDraft.amount || 0)
    if (!uid || !Number.isFinite(amount) || amount <= 0) {
      setMessage({ type: 'error', text: 'أدخل رقم مستخدم صحيحًا ومبلغ خصم أكبر من صفر.' })
      return
    }
    setUserProfitAdjustSaving(true)
    setMessage(null)
    try {
      const selectedTarget = userProfitAdjustDraft.target
      const selectedSourceType = userProfitAdjustDraft.sourceType
      const result = await adjustUserProfit({
        userId: uid,
        currency: 'USDT',
        amount,
        target: selectedTarget,
        sourceType: selectedSourceType,
        note: userProfitAdjustDraft.note.trim(),
      })
      if (Number(profitPanelUserId || 0) === uid) {
        const panelCurrency = String(profitPanelCurrency || 'USDT').trim().toUpperCase() || 'USDT'
        const [walletRes, overrideRes] = await Promise.all([
          getAdminUserWallet(uid, panelCurrency, 120),
          getAdminUnlockOverride(uid),
        ])
        setProfitSnapshot({
          user: walletRes.user,
          overview: walletRes.overview,
          withdraw_summary: walletRes.withdraw_summary,
          earning_entries: walletRes.earning_entries || [],
        })
        setProfitOverride(overrideRes.override)
      }
      setUserProfitAdjustDraft((prev) => ({ ...prev, amount: '', note: '' }))
      setMessage({
        type: 'success',
        text:
          result.target === 'main'
            ? `تم خصم ${amount.toFixed(2)} USDT من الأرباح العامة. الرصيد العام المتبقي: ${Number(result.remainingMainBalance || 0).toFixed(2)} USDT.`
            : `تم خصم ${amount.toFixed(2)} USDT من الأرباح الخاصة ${selectedSourceType === 'all' ? 'لكل المصادر' : `لمصدر ${selectedSourceType}`}. المتبقي من الأرباح المعلقة: ${Number(result.remainingPendingAmount || 0).toFixed(2)} USDT عبر ${Number(result.affectedEntries || 0)} سجل.`,
      })
      if (false) {
        const requestedUserId = 0
        const result = { summary: { restricted_users: 0, issues_total: 0 } } as const
        setMessage({
          type: 'success',
          text: `تم فحص المستخدم #${requestedUserId}. القيود الحالية: ${Number(result.summary.restricted_users || 0)} | المشاكل المرصودة: ${Number(result.summary.issues_total || 0)}.`,
        })
      }
      if (false) {
        const requestedUserId = 0
        const result = { summary: { restricted_users: 0, issues_total: 0 } } as const
        setMessage({
          type: 'success',
          text: `تم فحص المستخدم #${requestedUserId}. القيود الحالية: ${Number(result.summary.restricted_users || 0)} | المشاكل المرصودة: ${Number(result.summary.issues_total || 0)}.`,
        })
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل خصم الأرباح للمستخدم.' })
    } finally {
      setUserProfitAdjustSaving(false)
    }
  }

  async function refreshStrategyCodes() {
    const refreshed = await getStrategyCodesAdmin()
    setStrategyCodes(refreshed.items || [])
    setStrategyUsages(refreshed.usages || [])
  }

  async function handleDeleteStrategyUsage(usage: StrategyCodeUsageAdminItem) {
    if (String(usage.status || '') !== 'trade_settled') {
      setMessage({ type: 'error', text: 'يمكن حذف الصفقات الاستراتيجية المكتملة فقط.' })
      return
    }
    const confirmed = window.confirm(
      `هل تريد حذف الصفقة المكتملة #${usage.id} من السجل الظاهر فقط؟ سيبقى الربح اليومي المقفل أسبوعًا كما هو دون تغيير.`,
    )
    if (!confirmed) return

    setStrategyUsageDeletingId(usage.id)
    setMessage(null)
    try {
      await deleteStrategyUsageAdmin(usage.id)
      await refreshStrategyCodes()
      setMessage({ type: 'success', text: 'تم حذف الصفقة المكتملة من السجل دون المساس بالأصل أو الربح المقفل.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'فشل حذف الصفقة المكتملة.' })
    } finally {
      setStrategyUsageDeletingId(null)
    }
  }

  async function refreshBonusRules() {
    const res = await getBonusRules()
    setBonusRules(res.items || [])
  }

  async function refreshDailyTradeCampaigns() {
    const res = await getDailyTradeCampaigns()
    setDailyTradeCampaigns(res.items || [])
  }

  async function handleSaveDailyTradeCampaign() {
    setBonusSaving(true)
    setMessage(null)
    try {
      const entryPrice = dailyTradeDraft.entryPrice === '' ? 0 : Number(dailyTradeDraft.entryPrice)
      const takeProfit = dailyTradeDraft.takeProfit === '' ? 0 : Number(dailyTradeDraft.takeProfit)
      const stopLoss = dailyTradeDraft.stopLoss === '' ? 0 : Number(dailyTradeDraft.stopLoss)
      const successRate = dailyTradeDraft.successRate === '' ? 0 : Number(dailyTradeDraft.successRate)
      const rewardAmount = Number(dailyTradeDraft.rewardAmount || 0)
      if (!dailyTradeDraft.title.trim() || !Number.isFinite(rewardAmount) || rewardAmount <= 0) {
        throw new Error('أدخل عنوان اللوحة ومكافأتها بشكل صحيح.')
      }
      await createDailyTradeCampaign({
        id: dailyTradeDraft.id || undefined,
        title: dailyTradeDraft.title.trim(),
        symbol: dailyTradeDraft.symbol.trim(),
        side: dailyTradeDraft.side,
        entryPrice,
        takeProfit,
        stopLoss,
        successRate,
        rewardAmount,
        rewardCurrency: dailyTradeDraft.rewardCurrency || 'USDT',
        visibilityScope: dailyTradeDraft.visibilityScope,
        minVipLevel: Number(dailyTradeDraft.minVipLevel || 0),
        isVisible: dailyTradeDraft.isVisible,
        startsAt: dailyTradeDraft.startsAt || undefined,
        endsAt: dailyTradeDraft.endsAt || undefined,
      })
      await refreshDailyTradeCampaigns()
      setDailyTradeDraft({
        id: 0,
        title: 'لوحة الأرباح اليومية',
        symbol: 'BTCUSDT',
        side: 'buy',
        entryPrice: '',
        takeProfit: '',
        stopLoss: '',
        successRate: '78',
        rewardAmount: '10',
        rewardCurrency: 'USDT',
        visibilityScope: 'all',
        minVipLevel: '0',
        isVisible: true,
        startsAt: '',
        endsAt: '',
      })
      setMessage({ type: 'success', text: 'تم حفظ لوحة الأرباح اليومية وربطها بالنظام المالي الجديد.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ لوحة الأرباح اليومية.' })
    } finally {
      setBonusSaving(false)
    }
  }

  async function handleToggleDailyTradeCampaign(rule: DailyTradeCampaign) {
    setBonusSaving(true)
    setMessage(null)
    try {
      await toggleDailyTradeCampaign(rule.id, Number(rule.is_visible || 0) !== 1)
      await refreshDailyTradeCampaigns()
      setMessage({ type: 'success', text: 'تم تحديث حالة لوحة الأرباح اليومية.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث حالة اللوحة.' })
    } finally {
      setBonusSaving(false)
    }
  }

  async function handleDeleteDailyTradeCampaign(id: number) {
    setBonusSaving(true)
    setMessage(null)
    try {
      await deleteDailyTradeCampaign(id)
      await refreshDailyTradeCampaigns()
      setMessage({ type: 'success', text: 'تم حذف لوحة الأرباح اليومية.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حذف لوحة الأرباح اليومية.' })
    } finally {
      setBonusSaving(false)
    }
  }

  async function refreshKycSubmissions() {
    setKycLoading(true)
    try {
      const res = await getOwnerKycSubmissions({ status: 'pending' })
      setKycSubmissions(res.items || [])
    } finally {
      setKycLoading(false)
    }
  }

  async function refreshRecoveryRequests() {
    setRecoveryLoading(true)
    try {
      const res = await getRecoveryCodeReviewRequests('pending')
      setRecoveryRequests(res.items || [])
    } finally {
      setRecoveryLoading(false)
    }
  }

  async function handleReviewKyc(item: KycSubmissionRow, decision: 'approve' | 'reject' | 'auto') {
    setKycReviewLoadingId(item.id)
    setMessage(null)
    try {
      await reviewOwnerKycSubmission({
        submissionId: item.id,
        decision,
        reviewedNote:
          decision === 'approve'
            ? 'تمت مراجعة الطلب من لوحة المالك'
            : decision === 'auto'
              ? 'تم تحويل الطلب إلى مراجعة تلقائية'
              : 'تم رفض الطلب من لوحة المالك',
        rejectionReason: decision === 'reject' ? 'rejected_by_owner' : undefined,
        fullNameMatchScore: 100,
        faceMatchScore: 100,
        amlRiskLevel: 'low',
      })
      await refreshKycSubmissions()
      setMessage({
        type: 'success',
        text: decision === 'approve' ? 'تم اعتماد طلب التحقق.' : decision === 'auto' ? 'تم تحويل الطلب إلى مراجعة تلقائية.' : 'تم رفض طلب التحقق.',
      })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث طلب التحقق.' })
    } finally {
      setKycReviewLoadingId(null)
    }
  }

  async function handleProcessAutoKyc() {
    setKycLoading(true)
    setMessage(null)
    try {
      const res = await processAutoKycReviews()
      await refreshKycSubmissions()
      setMessage({ type: 'success', text: `تمت معالجة ${res.approvedCount} طلب تحقق تلقائيًا.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تنفيذ المراجعة التلقائية.' })
    } finally {
      setKycLoading(false)
    }
  }

  function getKycAttachmentLabel(item: KycSubmissionRow) {
    return item.display_name || item.email || item.phone || `المستخدم #${item.user_id}`
  }

  function openKycAttachmentPreview(title: string, url: string | null | undefined, alt: string) {
    const normalizedUrl = String(url || '').trim()
    if (!normalizedUrl) {
      setMessage({ type: 'error', text: 'هذا المرفق غير متاح حاليًا أو أن رابطه مفقود.' })
      return
    }
    setKycPreview({ title, url: normalizedUrl, alt })
    setKycPreviewError(false)
  }

  function handleOpenKycAttachmentInNewTab(url: string | null | undefined) {
    const normalizedUrl = String(url || '').trim()
    if (!normalizedUrl) {
      setMessage({ type: 'error', text: 'تعذر فتح المرفق لأن الرابط غير متاح.' })
      return
    }
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleReviewRecovery(item: RecoveryCodeReviewRequestItem, decision: 'approve' | 'reject') {
    setRecoveryReviewLoadingId(item.id)
    setMessage(null)
    try {
      await reviewRecoveryCodeRequest({
        id: item.id,
        decision,
        note:
          decision === 'approve'
            ? 'تم اعتماد طلب رمز الاسترداد من لوحة المالك'
            : 'تم رفض طلب رمز الاسترداد من لوحة المالك',
      })
      await refreshRecoveryRequests()
      setMessage({ type: 'success', text: decision === 'approve' ? 'تم اعتماد طلب رمز الاسترداد.' : 'تم رفض طلب رمز الاسترداد.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث طلب رمز الاسترداد.' })
    } finally {
      setRecoveryReviewLoadingId(null)
    }
  }

  async function handleSaveFirstDepositBonus() {
    setBonusSaving(true)
    setMessage(null)
    try {
      const minDeposit = Number(firstDepositBonusDraft.minDeposit || 0)
      const maxDeposit = firstDepositBonusDraft.maxDeposit === '' ? null : Number(firstDepositBonusDraft.maxDeposit)
      const rewardValue = Number(firstDepositBonusDraft.rewardValue || 0)
      if (!firstDepositBonusDraft.title.trim() || !Number.isFinite(minDeposit) || minDeposit <= 0 || !Number.isFinite(rewardValue) || rewardValue <= 0) {
        throw new Error('أدخل البيانات بشكل صحيح.')
      }
      await createBonusRule({
        id: firstDepositBonusDraft.id || undefined,
        ruleType: 'first_deposit',
        title: firstDepositBonusDraft.title.trim(),
        conditions: {
          minDeposit,
          maxDeposit,
        },
        reward: {
          mode: firstDepositBonusDraft.rewardMode,
          value: rewardValue,
        },
        isActive: firstDepositBonusDraft.isActive,
      })
      await refreshBonusRules()
      setFirstDepositBonusDraft({
        id: 0,
        title: 'مكافأة أول إيداع',
        minDeposit: '100',
        maxDeposit: '',
        rewardMode: 'percent',
        rewardValue: '10',
        isActive: true,
      })
      setMessage({ type: 'success', text: 'تم حفظ مكافأة أول إيداع.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ مكافأة أول إيداع.' })
    } finally {
      setBonusSaving(false)
    }
  }

  async function handleToggleFirstDepositBonus(rule: BonusRule) {
    setBonusSaving(true)
    setMessage(null)
    try {
      await toggleBonusRule(rule.id, Number(rule.is_active || 0) !== 1)
      await refreshBonusRules()
      setMessage({ type: 'success', text: 'تم تحديث حالة القاعدة.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث القاعدة.' })
    } finally {
      setBonusSaving(false)
    }
  }

  async function handleDeleteFirstDepositBonus(id: number) {
    setBonusSaving(true)
    setMessage(null)
    try {
      await deleteBonusRule(id)
      await refreshBonusRules()
      setMessage({ type: 'success', text: 'تم حذف القاعدة.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حذف القاعدة.' })
    } finally {
      setBonusSaving(false)
    }
  }

  async function handleSaveReferralBonus() {
    setBonusSaving(true)
    setMessage(null)
    try {
      const minDeposit = Number(referralBonusDraft.minDeposit || 0)
      const maxDeposit = referralBonusDraft.maxDeposit === '' ? null : Number(referralBonusDraft.maxDeposit)
      const rewardValue = Number(referralBonusDraft.rewardValue || 0)
      if (!referralBonusDraft.title.trim() || !Number.isFinite(minDeposit) || minDeposit <= 0 || !Number.isFinite(rewardValue) || rewardValue <= 0) {
        throw new Error('أدخل بيانات مكافأة الإحالة بشكل صحيح.')
      }
      await createBonusRule({
        id: referralBonusDraft.id || undefined,
        ruleType: 'referral',
        title: referralBonusDraft.title.trim(),
        conditions: {
          minDeposit,
          maxDeposit,
        },
        reward: {
          mode: referralBonusDraft.rewardMode,
          value: rewardValue,
        },
        isActive: referralBonusDraft.isActive,
      })
      await refreshBonusRules()
      setReferralBonusDraft({
        id: 0,
        title: 'مكافأة المحيل بعد أول إيداع مؤكد',
        minDeposit: '100',
        maxDeposit: '',
        rewardMode: 'fixed',
        rewardValue: '10',
        isActive: true,
      })
      setMessage({ type: 'success', text: 'تم حفظ مكافأة الإحالة.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ مكافأة الإحالة.' })
    } finally {
      setBonusSaving(false)
    }
  }

  async function handleCreateStrategyCode() {
    setStrategySaving(true)
    setMessage(null)
    try {
      await upsertStrategyCodeAdmin({
        code: strategyCodeDraft.code,
        title: strategyCodeDraft.title,
        description: strategyCodeDraft.description,
        expertName: strategyCodeDraft.expertName,
        assetSymbol: strategyCodeDraft.assetSymbol,
        purchasePercent: Number(strategyCodeDraft.purchasePercent || 0),
        tradeReturnPercent: Number(strategyCodeDraft.tradeReturnPercent || 0),
        expiresAt: strategyCodeDraft.expiresAt || null,
        isActive: strategyCodeDraft.isActive,
      })
      await refreshStrategyCodes()
      setStrategyCodeDraft((prev) => ({
        ...prev,
        code: '',
        title: '',
        description: '',
        expertName: '',
        purchasePercent: '50',
        tradeReturnPercent: '0',
        expiresAt: '',
      }))
      setMessage({ type: 'success', text: 'تم حفظ كود الاستراتيجية بنجاح.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ كود الاستراتيجية.' })
    } finally {
      setStrategySaving(false)
    }
  }

  async function handleSaveMiningConfig() {
    if (!miningConfigDraft) return
    setMiningSaving(true)
    setMessage(null)
    try {
      const res = await updateMiningAdminConfig(miningConfigDraft)
      setMiningConfigDraft(res.config)
      setMessage({ type: 'success', text: t('owner_mining_config_saved') })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('owner_mining_config_failed') })
    } finally {
      setMiningSaving(false)
    }
  }

  async function refreshAds() {
    const res = await getAdsAdmin()
    setAdsList(res.items || [])
  }

  function resetAdForm() {
    setAdFormEdit(null)
    setAdFormType('image')
    setAdFormMediaUrl('')
    setAdFormTitle('')
    setAdFormDescription('')
    setAdFormLinkUrl('')
    setAdFormPlacement('all')
    setAdFormFile(null)
    setAdValidationError(null)
  }

  function openCreateAdForm() {
    resetAdForm()
    setAdFormOpen(true)
  }

  function openEditAdForm(item: AdItem) {
    setAdFormEdit(item)
    setAdFormType(item.type)
    setAdFormMediaUrl(item.mediaUrl)
    setAdFormTitle(item.title || '')
    setAdFormDescription(item.description || '')
    setAdFormLinkUrl(item.linkUrl || '')
    setAdFormPlacement(item.placement || 'all')
    setAdFormFile(null)
    setAdValidationError(null)
    setAdFormOpen(true)
  }

  async function handleSaveAd() {
    setAdValidationError(null)
    let mediaUrl = adFormMediaUrl.trim()
    if (adFormFile) {
      setAdFormUploading(true)
      try {
        const uploaded = await uploadAdMedia(adFormFile)
        mediaUrl = uploaded.url
      } finally {
        setAdFormUploading(false)
      }
    }
    const validationError = validateAdForm({
      mediaUrl,
      type: adFormType,
      title: adFormTitle,
      description: adFormDescription,
      linkUrl: adFormLinkUrl,
      placement: adFormPlacement,
    })
    if (validationError) {
      setAdValidationError(validationError)
      return
    }
    setAdsSaving(true)
    setMessage(null)
    try {
      if (adFormEdit) {
        await updateAd(adFormEdit.id, {
          type: adFormType,
          mediaUrl,
          title: adFormTitle,
          description: adFormDescription,
          linkUrl: adFormLinkUrl || undefined,
          placement: adFormPlacement,
        })
      } else {
        await createAd({
          type: adFormType,
          mediaUrl,
          title: adFormTitle,
          description: adFormDescription,
          linkUrl: adFormLinkUrl || undefined,
          placement: adFormPlacement,
        })
      }
      await refreshAds()
      setAdFormOpen(false)
      resetAdForm()
      setMessage({ type: 'success', text: 'تم حفظ اللوحة الإعلانية بنجاح.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ اللوحة الإعلانية.' })
    } finally {
      setAdsSaving(false)
    }
  }

  async function handleToggleAd(id: number, isActive: boolean) {
    setAdToggleLoading(id)
    setMessage(null)
    try {
      await toggleAd(id, isActive)
      await refreshAds()
      setMessage({ type: 'success', text: 'تم تحديث حالة اللوحة الإعلانية.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث اللوحة الإعلانية.' })
    } finally {
      setAdToggleLoading(null)
    }
  }

  async function handleDeleteAd(id: number) {
    setAdDeleteLoading(id)
    setMessage(null)
    try {
      await deleteAd(id)
      await refreshAds()
      setAdDeleteConfirmId(null)
      setMessage({ type: 'success', text: 'تم حذف اللوحة الإعلانية.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حذف اللوحة الإعلانية.' })
    } finally {
      setAdDeleteLoading(null)
    }
  }

  async function handleMoveAd(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= adsList.length) return
    const order = adsList.map((item) => item.id)
    const temp = order[index]
    order[index] = order[target]
    order[target] = temp
    setAdReorderLoading(true)
    setMessage(null)
    try {
      await reorderAds(order)
      await refreshAds()
      setMessage({ type: 'success', text: 'تم تحديث ترتيب اللوحات الإعلانية.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث الترتيب.' })
    } finally {
      setAdReorderLoading(false)
    }
  }

  async function refreshAdvancedOwnerPanels() {
    const [summaryRes, financialGuardRes, vipRes, partnerRes, referralStatsRes, referralSummaryRes, contentRes, securityRes, staffRes, watchlistRes] = await Promise.all([
      getOwnerGrowthSummary(),
      getOwnerFinancialGuard(),
      getVipTiers(),
      getPartnerProfiles(),
      getReferralStats(),
      getReferralSummary(),
      getContentCampaigns(),
      getSecurityOverview(),
      getAdminStaffList(),
      getKycWatchlist(),
    ])
    setOwnerSummary(summaryRes)
    setOwnerFinancialGuardConfig(financialGuardRes.config || createDefaultOwnerFinancialGuardConfig())
    setOwnerFinancialQueue(financialGuardRes.items || [])
    setOwnerFinancialSummary(financialGuardRes.summary || {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingAmount: 0,
    })
    setVipTiers(vipRes.items || [])
    setPartnerProfiles(partnerRes.items || [])
    setReferralStats(referralStatsRes)
    setReferralSummary(referralSummaryRes.summary || [])
    setContentCampaigns(contentRes.items || [])
    setSecurityOverview(securityRes)
    setStaffItems(staffRes.items || [])
    setWatchlist(watchlistRes.items || [])
  }

  async function refreshOwnerFinancialGuard() {
    const res = await getOwnerFinancialGuard()
    setOwnerFinancialGuardConfig(res.config || createDefaultOwnerFinancialGuardConfig())
    setOwnerFinancialQueue(res.items || [])
    setOwnerFinancialSummary(res.summary || {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      pendingAmount: 0,
    })
    return res
  }

  async function handleSaveOwnerFinancialGuardConfig() {
    setOwnerFinancialGuardSaving(true)
    setMessage(null)
    try {
      const res = await updateOwnerFinancialGuardConfig(ownerFinancialGuardConfig)
      setOwnerFinancialGuardConfig(res.config || createDefaultOwnerFinancialGuardConfig())
      await refreshOwnerFinancialGuard()
      setMessage({ type: 'success', text: 'تم تحديث رقابة الاعتماد المالي الخاصة بالمالك.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث رقابة الاعتماد المالي.' })
    } finally {
      setOwnerFinancialGuardSaving(false)
    }
  }

  async function handleReviewOwnerFinancialItem(reportId: number, decision: 'approve' | 'reject') {
    setOwnerFinancialReviewLoadingId(reportId)
    setMessage(null)
    try {
      await reviewOwnerFinancialGuardReport({
        reportId,
        decision,
        ownerNote: ownerFinancialReviewNote.trim() || undefined,
      })
      await refreshOwnerFinancialGuard()
      setOwnerFinancialReviewNote('')
      setMessage({
        type: 'success',
        text: decision === 'approve' ? 'تم اعتماد العملية من المالك.' : 'تم رفض العملية وعكس أثرها المالي إن أمكن.',
      })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل مراجعة العملية المالية.' })
    } finally {
      setOwnerFinancialReviewLoadingId(null)
    }
  }

  async function handleSaveVipTier() {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await upsertVipTier({
        level: Number(vipTierDraft.level || 1),
        title: vipTierDraft.title.trim(),
        minDeposit: Number(vipTierDraft.minDeposit || 0),
        minTradeVolume: Number(vipTierDraft.minTradeVolume || 0),
        referralMultiplier: Number(vipTierDraft.referralMultiplier || 1),
        referralPercent: Number(vipTierDraft.referralPercent || 0),
        dailyMiningPercent: Number(vipTierDraft.dailyMiningPercent || 0),
        miningSpeedPercent: Number(vipTierDraft.miningSpeedPercent || 0),
        dailyWithdrawalLimit: Number(vipTierDraft.dailyWithdrawalLimit || 0),
        processingHoursMin: Number(vipTierDraft.processingHoursMin || 0),
        processingHoursMax: Number(vipTierDraft.processingHoursMax || 0),
        withdrawalFeePercent: Number(vipTierDraft.withdrawalFeePercent || 0),
        activeExtraFeePercent: Number(vipTierDraft.activeExtraFeePercent || 0),
        level2ReferralPercent: Number(vipTierDraft.level2ReferralPercent || 0),
        level3ReferralPercent: Number(vipTierDraft.level3ReferralPercent || 0),
        profitMultiplier: Number(vipTierDraft.profitMultiplier || 0),
        autoReinvest: vipTierDraft.autoReinvest,
        dailyBonus: vipTierDraft.dailyBonus,
        perks: vipTierDraft.perks.split('\n').map((item) => item.trim()).filter(Boolean),
        isActive: vipTierDraft.isActive,
      })
      const refreshed = await getVipTiers()
      setVipTiers(refreshed.items || [])
      setMessage({ type: 'success', text: 'تم حفظ مستوى VIP بنجاح.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ مستوى VIP.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function refreshRewardPayoutRules() {
    const refreshed = await getRewardPayoutRulesOwner()
    setRewardPayoutRules(refreshed)
    return refreshed
  }

  async function refreshBalanceRules() {
    const refreshed = (await getBalanceRules()).rules
    setBalanceRules(refreshed)
    return refreshed
  }

  async function handleSavePrincipalWithdrawalRule() {
    setBalanceRulesSaving(true)
    setMessage(null)
    try {
      const currentRule = balanceRules.principalWithdrawalRule || createDefaultPrincipalWithdrawalRule()
      const nextRatio = Math.max(0, Math.min(1, Number(currentRule?.withdrawableRatio || 0)))
      const nextRules: BalanceRules = {
        ...balanceRules,
        principalWithdrawalRule: {
          enabled: currentRule?.enabled !== false,
          withdrawableRatio: Number(nextRatio.toFixed(4)),
          clearProfitRestriction: currentRule?.clearProfitRestriction !== false,
          applyToAllVipLevels: currentRule?.applyToAllVipLevels !== false,
          ownerApprovalRequired: currentRule?.ownerApprovalRequired === true,
        },
      }
      await updateBalanceRules(nextRules, {
        resetPrincipalUnlockOverrides: principalRuleResetOverrides,
      })
      const refreshed = await refreshBalanceRules()
      const effectiveRatio = Number((refreshed.principalWithdrawalRule?.withdrawableRatio ?? refreshed.defaultUnlockRatio ?? 0.5) * 100)
      const ownerApprovalRequired = refreshed.principalWithdrawalRule?.ownerApprovalRequired === true
      setMessage({
        type: 'success',
        text: ownerApprovalRequired
          ? `تم حفظ قاعدة أصل الإيداع بنجاح. المسموح بالسحب الآن هو ${effectiveRatio.toFixed(0)}% من أصل الإيداع، بينما يبقى الجزء المحجوز تحت مراجعة إدارة المخاطر حتى يتم فتحه إداريًا.${principalRuleResetOverrides ? ' كما تمت إزالة أي استثناءات قديمة كانت تغيّر هذه القاعدة.' : ''}`
          : `تم حفظ قاعدة سحب أصل الإيداع وتطبيقها على المستخدمين الحاليين والجدد. المسموح الآن هو ${effectiveRatio.toFixed(0)}% من أصل الإيداع، ${refreshed.principalWithdrawalRule?.clearProfitRestriction !== false ? 'ولا يوجد شرط ربح إضافي على الجزء المحجوز.' : 'ويظل فتح الجزء المحجوز مرتبطًا بشرط الربح المحدد.'}${principalRuleResetOverrides ? ' كما تمت إزالة أي استثناءات قديمة كانت تغيّر هذه القاعدة.' : ''}`,
      })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ قاعدة سحب أصل الإيداع.' })
    } finally {
      setBalanceRulesSaving(false)
    }
  }

  async function handleSaveRewardPayoutConfig() {
    setRewardPayoutSaving(true)
    setMessage(null)
    try {
      const result = await updateRewardPayoutRulesOwner({
        defaultMode: rewardPayoutRules.defaultMode,
        sourceModes: rewardPayoutRules.sourceModes,
        defaultLockHours: Number(rewardPayoutRules.defaultLockHours || 0),
        sourceLockHours: rewardPayoutRules.sourceLockHours,
        applyPending: rewardPayoutApplyPendingGlobal,
      })
      const refreshed = await refreshRewardPayoutRules()
      const applyMessage = formatRewardApplyResult(result.applyPendingResult)
      setRewardPayoutApplyPendingGlobal(false)
      setMessage({
        type: 'success',
        text:
          refreshed.defaultMode === 'bonus_locked'
            ? `تم حفظ القاعدة العامة. الوضع الافتراضي الآن يجعل المكتسبات الجديدة غير قابلة للسحب.${applyMessage ? ` ${applyMessage}` : ''}`
            : `تم حفظ القاعدة العامة. الوضع الافتراضي الآن يجعل المكتسبات الجديدة قابلة للسحب.${applyMessage ? ` ${applyMessage}` : ''}`,
      })
      if (false) {
      setMessage({
        type: 'success',
        text:
          refreshed.defaultMode === 'bonus_locked'
            ? 'تم حفظ القاعدة العامة، والوضع الافتراضي الآن يجعل المكتسبات الجديدة غير قابلة للسحب.'
            : 'تم حفظ القاعدة العامة، والوضع الافتراضي الآن يجعل المكتسبات الجديدة قابلة للسحب.',
      })
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ قواعد السحب العامة.' })
    } finally {
      setRewardPayoutSaving(false)
    }
  }

  async function handleApplyHalfAssetsReferralPreset() {
    setRewardPayoutSaving(true)
    setMessage(null)
    try {
      const currentBalanceRules = await getBalanceRules()
      await updateBalanceRules(
        {
          ...currentBalanceRules.rules,
          principalWithdrawalRule: {
            enabled: true,
            withdrawableRatio: 0.5,
            clearProfitRestriction: true,
            applyToAllVipLevels: true,
          },
        },
        {
          resetPrincipalUnlockOverrides: true,
        },
      )
      await refreshBalanceRules()
      const result = await updateRewardPayoutRulesOwner({
        defaultMode: rewardPayoutRules.defaultMode,
        sourceModes: {
          ...rewardPayoutRules.sourceModes,
          referrals: 'withdrawable',
          deposits: 'withdrawable',
        },
        defaultLockHours: Number(rewardPayoutRules.defaultLockHours || 0),
        sourceLockHours: rewardPayoutRules.sourceLockHours,
        applyPending: true,
      })
      const refreshed = await refreshRewardPayoutRules()
      setRewardPayoutRules({
        ...refreshed,
        sourceModes: {
          ...refreshed.sourceModes,
          referrals: 'withdrawable',
          deposits: 'withdrawable',
        },
      })
      const applyMessage = formatRewardApplyResult(result.applyPendingResult)
      setRewardPayoutApplyPendingGlobal(false)
      setMessage({
        type: 'success',
        text: `تم تطبيق الإعداد على المستخدمين الحاليين والجدد: 50% فقط من إجمالي الأصول قابلة للسحب، مع إبقاء أرباح الإحالات والإيداع قابلة للسحب.${applyMessage ? ` ${applyMessage}` : ''}`,
      })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تطبيق إعداد 50% للأصول مع فتح سحب الإحالات.' })
    } finally {
      setRewardPayoutSaving(false)
    }
  }

  async function handleSaveStrategyTradeDisplay() {
    setStrategyDisplaySaving(true)
    setMessage(null)
    try {
      const res = await updateStrategyTradeDisplayConfig(strategyTradeDisplayDraft)
      setStrategyTradeDisplayDraft(res.config)
      setMessage({ type: 'success', text: 'تم تحديث الوصف الظاهر للمستخدم في الصفقات الاستراتيجية.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ وصف الصفقات الاستراتيجية.' })
    } finally {
      setStrategyDisplaySaving(false)
    }
  }

  async function handleSaveRewardPayoutOverride() {
    if (!rewardPayoutOverrideDraft.userIdsText.trim()) {
      setMessage({ type: 'error', text: 'أدخل رقم مستخدم واحد أو عدة أرقام مفصولة بفواصل أو أسطر.' })
      return
    }
    setRewardPayoutSaving(true)
    setMessage(null)
    try {
      const result = await upsertRewardPayoutOverridesOwner({
        userIdsText: rewardPayoutOverrideDraft.userIdsText,
        sourceType: rewardPayoutOverrideDraft.sourceType,
        payoutMode: rewardPayoutOverrideDraft.payoutMode,
        lockHours: Number(rewardPayoutOverrideDraft.lockHours || 0),
        note: rewardPayoutOverrideDraft.note.trim(),
        applyPending: rewardPayoutOverrideDraft.applyPending,
      })
      await refreshRewardPayoutRules()
      setRewardPayoutOverrideDraft((prev) => ({
        ...prev,
        userIdsText: '',
        lockHours: '0',
        note: '',
        applyPending: false,
      }))
      const applyMessage = formatRewardApplyResult(result.applyPendingResult)
      setMessage({
        type: 'success',
        text: `تم حفظ الاستثناء لـ ${result.affectedUsers} مستخدم/مستخدمين بنجاح.${applyMessage ? ` ${applyMessage}` : ''}`,
      })
      if (false) {
      const releasedEntries = Number(result.applyPendingResult?.releasedEntries || 0)
      const releasedAmount = Number(result.applyPendingResult?.releasedAmount || 0)
      setMessage({
        type: 'success',
        text:
          releasedEntries > 0
            ? `تم حفظ الاستثناء لـ ${result.affectedUsers} مستخدم/مستخدمين، وتم تحرير ${releasedEntries} أرباح معلقة بقيمة ${releasedAmount.toFixed(2)} USDT.`
            : `تم حفظ الاستثناء لـ ${result.affectedUsers} مستخدم/مستخدمين بنجاح.`,
      })
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ استثناءات السحب.' })
    } finally {
      setRewardPayoutSaving(false)
    }
  }

  async function handleDeleteRewardPayoutOverride(overrideKey: string) {
    setRewardPayoutDeleteKey(overrideKey)
    setMessage(null)
    try {
      await deleteRewardPayoutOverrideOwner(overrideKey)
      await refreshRewardPayoutRules()
      setMessage({ type: 'success', text: 'تم حذف الاستثناء المحدد.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حذف الاستثناء.' })
    } finally {
      setRewardPayoutDeleteKey('')
    }
  }

  async function handleSavePartnerProfile() {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await upsertPartnerProfile({
        userId: Number(partnerDraft.userId || 0),
        commissionRate: Number(partnerDraft.commissionRate || 0),
        status: partnerDraft.status,
        notes: partnerDraft.notes.trim(),
      })
      const refreshed = await getPartnerProfiles()
      setPartnerProfiles(refreshed.items || [])
      setMessage({ type: 'success', text: 'تم حفظ ملف الشريك بنجاح.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ الشريك.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleLoadReferralDetails() {
    const userId = Number(referralDetailUserId || 0)
    if (!userId) {
      setMessage({ type: 'error', text: 'أدخل رقم المستخدم أولاً لعرض تفاصيل الإحالات.' })
      return
    }
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      const res = await getReferralDetails(userId)
      setReferralDetails(res.referrals || [])
      setMessage({ type: 'success', text: `تم تحميل إحالات المستخدم #${userId}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحميل تفاصيل الإحالات.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleCreateContentCampaign() {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await createContentCampaign({
        campaignType: contentDraft.campaignType,
        title: contentDraft.title.trim(),
        body: contentDraft.body.trim(),
        targetFilters: {
          language: contentDraft.language === 'all' ? undefined : contentDraft.language,
          minVipLevel: Number(contentDraft.minVipLevel || 0),
          vipOnly: contentDraft.vipOnly,
          depositorsOnly: contentDraft.depositorsOnly,
          nonDepositorsOnly: contentDraft.nonDepositorsOnly,
        },
        isActive: contentDraft.isActive,
      })
      const refreshed = await getContentCampaigns()
      setContentCampaigns(refreshed.items || [])
      setMessage({ type: 'success', text: 'تم حفظ الحملة/الإشعار بنجاح.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ الحملة.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleRefreshSecuritySessions() {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      const userId = Number(securityUserId || 0)
      const res = await getSecuritySessions(userId > 0 ? userId : undefined)
      setSecuritySessions(res.items || [])
      setMessage({ type: 'success', text: userId > 0 ? `تم تحميل جلسات المستخدم #${userId}.` : 'تم تحميل الجلسات النشطة.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحميل الجلسات.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleRevokeSessions(userId: number) {
    setSecurityActionLoading(userId)
    setMessage(null)
    try {
      await revokeAllUserSessions(userId)
      const refreshed = await getSecuritySessions(Number(securityUserId || 0) > 0 ? Number(securityUserId || 0) : undefined)
      setSecuritySessions(refreshed.items || [])
      setMessage({ type: 'success', text: `تم إلغاء جميع الجلسات للمستخدم #${userId}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل إلغاء الجلسات.' })
    } finally {
      setSecurityActionLoading(null)
    }
  }

  async function handleToggleTwoFactorAction(userId: number, enabled: boolean, forAdminActions = false) {
    setSecurityActionLoading(`${userId}-${enabled ? 'on' : 'off'}`)
    setMessage(null)
    try {
      await updateUserTwoFactor(userId, enabled, forAdminActions)
      const refreshed = await getSecurityOverview()
      setSecurityOverview(refreshed)
      setMessage({ type: 'success', text: `تم تحديث المصادقة الثنائية للمستخدم #${userId}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث المصادقة الثنائية.' })
    } finally {
      setSecurityActionLoading(null)
    }
  }

  async function handleDetectUnusualActivity() {
    setSecurityActionLoading('detect')
    setMessage(null)
    try {
      const res = await runUnusualActivityDetection()
      const refreshed = await getSecurityOverview()
      setSecurityOverview(refreshed)
      setMessage({ type: 'success', text: `تم تنفيذ كشف النشاط غير المعتاد وإنشاء ${res.alertsCreated} تنبيه.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل فحص النشاط غير المعتاد.' })
    } finally {
      setSecurityActionLoading(null)
    }
  }

  async function handleCreateStaffMember() {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await createAdminStaff({
        identifier: staffDraft.identifier.trim(),
        password: staffDraft.password,
        displayName: staffDraft.displayName.trim(),
        adminRole: staffDraft.adminRole,
        accessPreset: staffDraft.accessPreset,
      })
      const refreshed = await getAdminStaffList()
      setStaffItems(refreshed.items || [])
      setStaffDraft({
        identifier: '',
        password: '',
        displayName: '',
        adminRole: 'support',
        accessPreset: 'support',
      })
      setMessage({ type: 'success', text: 'تم إنشاء عضو الطاقم بنجاح.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل إنشاء عضو الطاقم.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleLoadStaffPermissions() {
    const userId = Number(selectedStaffUserId || 0)
    if (!userId) {
      setMessage({ type: 'error', text: 'اختر رقم عضو الطاقم أولاً.' })
      return
    }
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      const res = await apiFetch(`/api/permissions/user/${userId}`) as { permissions?: string[] }
      setSelectedStaffPermissions(res.permissions || [])
      setMessage({ type: 'success', text: `تم تحميل صلاحيات المستخدم #${userId}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحميل صلاحيات المستخدم.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleSaveStaffPermissions() {
    const userId = Number(selectedStaffUserId || 0)
    if (!userId) {
      setMessage({ type: 'error', text: 'اختر رقم عضو الطاقم أولاً.' })
      return
    }
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await replaceAdminStaffPermissions(userId, selectedStaffPermissions)
      const refreshed = await getAdminStaffList()
      setStaffItems(refreshed.items || [])
      setMessage({ type: 'success', text: `تم تحديث صلاحيات المستخدم #${userId}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث صلاحيات الطاقم.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleUpdateStaffRoleAction(userId: number, adminRole: 'super_admin' | 'admin' | 'finance' | 'support' | 'moderator', enabled: boolean) {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await updateAdminStaffRole(userId, adminRole, enabled)
      const refreshed = await getAdminStaffList()
      setStaffItems(refreshed.items || [])
      setMessage({ type: 'success', text: `تم تحديث دور المستخدم #${userId}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث دور الطاقم.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleToggleSensitiveAccess(userId: number, canViewSensitive: boolean) {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await setAdminSensitiveAccess(userId, canViewSensitive)
      const refreshed = await getAdminStaffList()
      setStaffItems(refreshed.items || [])
      setMessage({ type: 'success', text: `تم تحديث الوصول الحساس للمستخدم #${userId}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث الوصول الحساس.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleRunStaffAccountHealthScan(target: 'all' | 'single' = 'all') {
    setStaffHealthLoading(true)
    setMessage(null)
    try {
      const requestedUserId = Number(staffHealthUserId || 0)
      if (target === 'single' && (!Number.isFinite(requestedUserId) || requestedUserId <= 0)) {
        throw new Error('أدخل رقم مستخدم صحيحًا قبل تنفيذ الفحص المحدد.')
      }
      const result = await runAdminAccountHealthScan(target === 'single' ? { userId: requestedUserId } : undefined)
      setStaffHealthScan(result)
      setMessage({
        type: 'success',
        text: `تم فحص ${Number(result.summary.scanned_users || 0)} حساب. القيود الحالية: ${Number(result.summary.restricted_users || 0)} | المشاكل المرصودة: ${Number(result.summary.issues_total || 0)}.`,
      })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل فحص الحسابات.' })
    } finally {
      setStaffHealthLoading(false)
    }
  }

  async function handleAddWatchlistItem() {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await addKycWatchlistEntry({
        userId: Number(watchlistDraft.userId || 0) || undefined,
        note: watchlistDraft.note.trim(),
        source: watchlistDraft.source.trim() || undefined,
      })
      const refreshed = await getKycWatchlist()
      setWatchlist(refreshed.items || [])
      setWatchlistDraft({ userId: '', note: '', source: '' })
      setMessage({ type: 'success', text: 'تمت إضافة العنصر إلى قائمة المراقبة.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل إضافة عنصر المراقبة.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleToggleWatchlist(item: KycWatchlistItem) {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      await toggleKycWatchlistEntry(item.id, Number(item.is_active || 0) !== 1)
      const refreshed = await getKycWatchlist()
      setWatchlist(refreshed.items || [])
      setMessage({ type: 'success', text: 'تم تحديث حالة عنصر المراقبة.' })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحديث عنصر المراقبة.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleLoadMonthlyFinanceReport() {
    setOwnerExtraSaving(true)
    setMessage(null)
    try {
      const res = await getOwnerMonthlyFinanceReport(monthlyFinanceMonth)
      setMonthlyFinance(res)
      setMessage({ type: 'success', text: `تم تحميل تقرير ${res.month}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحميل التقرير الشهري.' })
    } finally {
      setOwnerExtraSaving(false)
    }
  }

  async function handleLoadProfitPanel() {
    const userId = Number(profitPanelUserId || 0)
    const currency = String(profitPanelCurrency || 'USDT').trim().toUpperCase() || 'USDT'
    if (!userId) {
      setMessage({ type: 'error', text: 'أدخل رقم المستخدم أولًا لتحميل لوحة الأرباح.' })
      return
    }
    setProfitPanelLoading(true)
    setMessage(null)
    try {
      const [walletRes, overrideRes] = await Promise.all([
        getAdminUserWallet(userId, currency, 120),
        getAdminUnlockOverride(userId),
      ])
      setProfitSnapshot({
        user: walletRes.user,
        overview: walletRes.overview,
        withdraw_summary: walletRes.withdraw_summary,
        earning_entries: walletRes.earning_entries || [],
      })
      setProfitOverride(overrideRes.override)
      setProfitOverrideDraft({
        forceUnlockPrincipal: Number(overrideRes.override?.force_unlock_principal || 0) === 1,
        customUnlockRatio:
          overrideRes.override?.custom_unlock_ratio == null ? '' : String(overrideRes.override.custom_unlock_ratio),
        customMinProfit:
          overrideRes.override?.custom_min_profit == null ? '' : String(overrideRes.override.custom_min_profit),
        note: String(overrideRes.override?.note || ''),
      })
      setProfitPanelCurrency(currency)
      setMessage({ type: 'success', text: `تم تحميل لوحة الأرباح للمستخدم #${userId}.` })
    } catch (e) {
      setProfitSnapshot(null)
      setProfitOverride(null)
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل تحميل لوحة الأرباح.' })
    } finally {
      setProfitPanelLoading(false)
    }
  }

  async function handleSaveProfitOverride() {
    const userId = Number(profitPanelUserId || 0)
    if (!userId) {
      setMessage({ type: 'error', text: 'أدخل رقم المستخدم أولًا قبل حفظ إعدادات فك القيد.' })
      return
    }
    setProfitPanelSaving(true)
    setMessage(null)
    try {
      await upsertAdminUnlockOverride({
        userId,
        forceUnlockPrincipal: profitOverrideDraft.forceUnlockPrincipal,
        customUnlockRatio:
          profitOverrideDraft.customUnlockRatio.trim() === '' ? null : Number(profitOverrideDraft.customUnlockRatio),
        customMinProfit:
          profitOverrideDraft.customMinProfit.trim() === '' ? null : Number(profitOverrideDraft.customMinProfit),
        note: profitOverrideDraft.note.trim(),
      })
      await handleLoadProfitPanel()
      setMessage({ type: 'success', text: `تم حفظ إعدادات القابل للسحب للمستخدم #${userId}.` })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل حفظ إعدادات فك القيد.' })
    } finally {
      setProfitPanelSaving(false)
    }
  }

  if (user && !isOwner) return <Navigate to="/portfolio" replace />

  const attractionKeyOptions = [
    { key: 'hot' as const, label: 'ساخن' },
    { key: 'new' as const, label: 'جديد' },
    { key: 'most_requested' as const, label: 'الأكثر طلباً' },
  ]
  const attractionTargetOptions = [
    { key: 'assets' as const, label: t('owner_attraction_target_assets') },
    { key: 'markets' as const, label: t('owner_attraction_target_markets') },
    { key: 'tasks' as const, label: t('owner_attraction_target_tasks') },
    { key: 'mining' as const, label: t('owner_attraction_target_mining') },
    { key: 'home' as const, label: t('owner_attraction_target_home') },
    { key: 'quick_buy' as const, label: t('owner_attraction_target_quick_buy') },
    { key: 'rewards_center' as const, label: t('owner_attraction_target_rewards') },
    { key: 'referrals' as const, label: t('owner_attraction_target_referrals') },
    { key: 'more' as const, label: t('owner_attraction_target_more') },
  ]
  const ownerHighlights = [
    {
      label: 'حالة التسجيل',
      value: registrationEnabled ? 'مفعّل' : 'معلّق',
      tone: registrationEnabled ? 'success' : 'warning',
    },
    {
      label: 'أكواد الاستراتيجية',
      value: `${strategyCodes.filter((item) => item.isActive).length} فعّال`,
      tone: 'default',
    },
    {
      label: 'الإعلانات الظاهرة',
      value: `${adsList.filter((item) => item.isActive).length} لوحة`,
      tone: 'default',
    },
    {
      label: 'مستويات التعدين',
      value: `${(miningConfigDraft?.dailyTiers?.length ?? 0) + (miningConfigDraft?.monthlyTiers?.length ?? 0)} مستويات`,
      tone: 'default',
    },
  ] as const
  const profitSourceLabels: Record<string, string> = {
    mining: 'التعدين',
    tasks: 'المهام',
    bonuses: 'البونصات',
    rewards: 'المكافآت',
    referrals: 'الإحالات',
    deposits: 'الإيداعات',
    strategy_codes: 'أكواد الاستراتيجية',
    strategy: 'الاستراتيجية',
    trades: 'الصفقات',
  }
  const profitEntriesBySource = Object.values(
    (profitSnapshot?.earning_entries || []).reduce<
      Record<
        string,
        {
          source: string
          transferred: number
          pending: number
          total: number
          count: number
        }
      >
    >((acc, entry) => {
      const source = String(entry.source_type || 'other').trim().toLowerCase() || 'other'
      if (!acc[source]) {
        acc[source] = {
          source,
          transferred: 0,
          pending: 0,
          total: 0,
          count: 0,
        }
      }
      const amount = Number(entry.amount || 0)
      const transferred = Boolean(entry.transferred_at) || String(entry.status || '').toLowerCase() === 'transferred'
      acc[source].count += 1
      acc[source].total += amount
      if (transferred) acc[source].transferred += amount
      else acc[source].pending += amount
      return acc
    }, {}),
  ).sort((a, b) => b.total - a.total)
  const transferredEarningsTotal = Number(
    profitEntriesBySource.reduce((acc, item) => acc + Number(item.transferred || 0), 0).toFixed(2),
  )
  const pendingEarningsTotal = Number(
    profitEntriesBySource.reduce((acc, item) => acc + Number(item.pending || 0), 0).toFixed(2),
  )

  return (
    <div className="page owner-dashboard owner-dashboard-clean">
      <section className="owner-hero">
        <div className="owner-hero-copy">
          <span className="owner-hero-kicker">لوحة المالك</span>
          <h1 className="page-title owner-dashboard-title">تحكم كامل بالنظام الجديد</h1>
          <p className="owner-hero-text">
            هنا تدار العناصر الفعالة فقط في المشروع الحالي: التسجيل، المستخدمون، الأكواد، الإعلانات، التعدين،
            والصور، بعد إزالة لوحات النظام المالي القديم من هذه الصفحة.
          </p>
        </div>
        <div className="owner-hero-grid">
          {ownerHighlights.map((item) => (
            <div key={item.label} className={`owner-stat-card owner-stat-card-${item.tone}`}>
              <span className="owner-stat-label">{item.label}</span>
              <strong className="owner-stat-value">{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <nav className="owner-nav">
        <Link to="/admin/dashboard" className="owner-nav-link">لوحة الإدارة</Link>
        <Link to="/admin/users" className="owner-nav-link">المستخدمين</Link>
        <Link to="/admin/invites" className="owner-nav-link">الدعوات</Link>
        <Link to="/admin/permissions" className="owner-nav-link">الصلاحيات</Link>
      </nav>

      {message && (
        <div className={`owner-message owner-message-${message.type}`}>{message.text}</div>
      )}

      <section className="owner-balance-section">
        <h2 className="owner-section-title">تقارير الاعتماد المالي للمالك</h2>
        <p className="owner-hint">
          هذه اللوحة لا توقف المشرفين عن اعتماد الإيداع أو إضافة الرصيد، لكنها تسجل كل عملية مالية حساسة بانتظار قرار المالك النهائي.
        </p>
        <div className="owner-history-card">
          <div className="owner-form-row">
            <label className="owner-inline-check">
              <input
                type="checkbox"
                checked={ownerFinancialGuardConfig.enabled}
                onChange={(e) => setOwnerFinancialGuardConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <span>تفعيل رقابة المالك على العمليات المالية</span>
            </label>
            <label className="owner-inline-check">
              <input
                type="checkbox"
                checked={ownerFinancialGuardConfig.watchDepositApprovals}
                onChange={(e) => setOwnerFinancialGuardConfig((prev) => ({ ...prev, watchDepositApprovals: e.target.checked }))}
              />
              <span>اعتماد الإيداعات</span>
            </label>
            <label className="owner-inline-check">
              <input
                type="checkbox"
                checked={ownerFinancialGuardConfig.watchManualBalanceAdds}
                onChange={(e) => setOwnerFinancialGuardConfig((prev) => ({ ...prev, watchManualBalanceAdds: e.target.checked }))}
              />
              <span>الإضافة اليدوية للأرصدة</span>
            </label>
            <label className="owner-inline-check">
              <input
                type="checkbox"
                checked={ownerFinancialGuardConfig.watchBonusAdds}
                onChange={(e) => setOwnerFinancialGuardConfig((prev) => ({ ...prev, watchBonusAdds: e.target.checked }))}
              />
              <span>إضافات المكافآت والأرباح</span>
            </label>
          </div>
          <div className="owner-form-row">
            <div className="owner-stat-card owner-stat-card-warn">
              <span className="owner-stat-label">معلّق للمالك</span>
              <strong className="owner-stat-value">{ownerFinancialSummary.pendingCount}</strong>
            </div>
            <div className="owner-stat-card owner-stat-card-cool">
              <span className="owner-stat-label">إجمالي المبلغ المعلّق</span>
              <strong className="owner-stat-value">{ownerFinancialSummary.pendingAmount.toFixed(2)} USDT</strong>
            </div>
            <div className="owner-stat-card owner-stat-card-ok">
              <span className="owner-stat-label">معتمد</span>
              <strong className="owner-stat-value">{ownerFinancialSummary.approvedCount}</strong>
            </div>
            <div className="owner-stat-card owner-stat-card-danger">
              <span className="owner-stat-label">مرفوض</span>
              <strong className="owner-stat-value">{ownerFinancialSummary.rejectedCount}</strong>
            </div>
          </div>
          <div className="owner-buttons">
            <button
              type="button"
              className="wallet-action-btn owner-set-btn"
              onClick={handleSaveOwnerFinancialGuardConfig}
              disabled={ownerFinancialGuardSaving}
            >
              {ownerFinancialGuardSaving ? '...' : 'حفظ إعدادات الرقابة'}
            </button>
            <button
              type="button"
              className="wallet-action-btn wallet-action-deposit"
              onClick={() => refreshOwnerFinancialGuard().catch(() => {})}
              disabled={ownerFinancialGuardSaving}
            >
              تحديث التقرير
            </button>
          </div>
          <input
            className="field-input owner-note-input"
            placeholder="ملاحظة المالك عند الاعتماد أو الرفض"
            value={ownerFinancialReviewNote}
            onChange={(e) => setOwnerFinancialReviewNote(e.target.value)}
          />
          {ownerFinancialQueue.length === 0 ? (
            <p className="owner-empty">لا توجد عمليات مالية بانتظار قرار المالك الآن.</p>
          ) : (
            <ul className="owner-history-list">
              {ownerFinancialQueue.map((item) => {
                const targetLabel = item.targetUser.displayName || item.targetUser.email || item.targetUser.phone || `#${item.targetUserId}`
                const actorLabel = item.actorUser.displayName || item.actorUser.email || item.actorUser.phone || `#${item.actorUserId}`
                return (
                  <li key={item.id} className="owner-history-item">
                    <div className="owner-history-main">
                      <strong>{`${getOwnerFinancialActionLabel(item.actionType)} | ${item.amount.toFixed(2)} ${item.currency}`}</strong>
                      <small>{`الحساب: ${targetLabel} | المنفذ: ${actorLabel} (${item.actorUser.role || 'staff'})`}</small>
                      <small>{`الحالة: ${item.status} | وقت التنفيذ: ${formatOwnerDateTime(item.createdAt)}`}</small>
                      {item.note ? <small>{`ملاحظة العملية: ${item.note}`}</small> : null}
                    </div>
                    {item.status === 'pending' ? (
                      <div className="owner-buttons">
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-deposit"
                          onClick={() => handleReviewOwnerFinancialItem(item.id, 'approve')}
                          disabled={ownerFinancialReviewLoadingId === item.id}
                        >
                          {ownerFinancialReviewLoadingId === item.id ? '...' : 'اعتماد المالك'}
                        </button>
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-withdraw"
                          onClick={() => handleReviewOwnerFinancialItem(item.id, 'reject')}
                          disabled={ownerFinancialReviewLoadingId === item.id}
                        >
                          {ownerFinancialReviewLoadingId === item.id ? '...' : 'رفض وعكس الأثر'}
                        </button>
                      </div>
                    ) : (
                      <div className="owner-hint">
                        {item.status === 'approved' ? 'تم اعتمادها من المالك.' : 'تم رفضها من المالك.'}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <div className="owner-dashboard-grid">
        <aside className="owner-dashboard-side">
          <section className="owner-balance-section owner-sticky-panel">
            <h2 className="owner-section-title">التحكم في التسجيل</h2>
            <p className="owner-hint">يمكنك تعليق/تفعيل إنشاء الحسابات الجديدة بشكل فوري.</p>
            <div className="owner-reg-control">
              <span className={`owner-reg-badge ${registrationEnabled ? 'enabled' : 'disabled'}`}>
                {registrationEnabled ? 'التسجيل مفعل' : 'التسجيل معلق'}
              </span>
              <button
                type="button"
                className="wallet-action-btn owner-set-btn"
                onClick={handleToggleRegistration}
                disabled={registrationSaving}
              >
                {registrationSaving
                  ? '...'
                  : registrationEnabled
                    ? 'تعليق إنشاء الحسابات'
                    : 'تفعيل إنشاء الحسابات'}
              </button>
            </div>

            <div className="owner-section-divider" />

            <div className="rounded-[1.6rem] border border-sky-400/12 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,rgba(8,15,30,0.98),rgba(6,10,22,0.98))] p-4 shadow-[0_20px_55px_rgba(2,6,23,0.35)]">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sky-200">
                        <Sparkles size={13} />
                        لوحة أعلى المودعين
                      </div>
                      <h2 className="mt-3 text-xl font-black text-white">أعلى 3 مودعين</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        القسم مخفي افتراضيًا. عبّئ بيانات المتصدرين هنا ثم فعّله عند الجاهزية ليظهر في الصفحة الرئيسية.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`owner-reg-badge ${homeLeaderboardDraft.enabled ? 'enabled' : 'disabled'}`}>
                        <span className="inline-flex items-center gap-2">
                          {homeLeaderboardDraft.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                          {homeLeaderboardDraft.enabled ? 'القسم ظاهر في الرئيسية' : 'القسم مخفي حاليًا'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className={`wallet-action-btn ${homeLeaderboardDraft.enabled ? 'wallet-action-withdraw' : 'owner-set-btn'}`}
                        onClick={() => handleHomeLeaderboardFieldChange('enabled', !homeLeaderboardDraft.enabled)}
                      >
                        {homeLeaderboardDraft.enabled ? 'إخفاء القسم' : 'تفعيل القسم عند الجاهزية'}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                      <div className="text-[11px] text-slate-500">الحالة الحالية</div>
                      <div className="mt-2 text-sm font-bold text-white">{homeLeaderboardDraft.enabled ? 'معروض للعامة' : 'مخفي حتى الإذن'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                      <div className="text-[11px] text-slate-500">عدد البطاقات</div>
                      <div className="mt-2 text-sm font-bold text-white">{homeLeaderboardDraft.competitors.length} متصدرين</div>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3">
                      <div className="text-[11px] text-slate-500">ملخص الشهر</div>
                      <div className="mt-2 text-sm font-bold text-white">{homeLeaderboardDraft.summaryValue || 'غير محدد بعد'}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                    <span className="owner-hint">شارة القسم</span>
                    <input
                      value={homeLeaderboardDraft.badge}
                      onChange={(e) => handleHomeLeaderboardFieldChange('badge', e.target.value)}
                      placeholder="أعلى المودعين"
                    />
                  </label>
                  <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                    <span className="owner-hint">عنوان القسم</span>
                    <input
                      value={homeLeaderboardDraft.title}
                      onChange={(e) => handleHomeLeaderboardFieldChange('title', e.target.value)}
                      placeholder="أعلى 3 مودعين لهذا الشهر"
                    />
                  </label>
                </div>

                <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
                  <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                    <span className="owner-hint">وصف القسم</span>
                    <textarea
                      rows={4}
                      value={homeLeaderboardDraft.description}
                      onChange={(e) => handleHomeLeaderboardFieldChange('description', e.target.value)}
                      placeholder="وصف قصير يظهر أعلى القسم"
                    />
                  </label>
                  <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                    <span className="owner-hint">قيمة الملخص</span>
                    <input
                      value={homeLeaderboardDraft.summaryValue}
                      onChange={(e) => handleHomeLeaderboardFieldChange('summaryValue', e.target.value)}
                      placeholder="184,520 USDT"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-sky-400/15 bg-sky-400/8 px-4 py-3 text-sm leading-6 text-sky-100">
                  العرض العام مختصر جدًا: الصورة والاسم والمركز فقط، بينما تظهر الإيداعات واللقب والوصف عند الضغط على البطاقة.
                </div>

                <div className="space-y-4">
                  {homeLeaderboardDraft.competitors.map((item, index) => {
                    const meta = ownerLeaderboardPlaceMeta[index] || ownerLeaderboardPlaceMeta[0]
                    const PlaceIcon = meta.icon
                    return (
                      <div
                        key={item.id || index}
                        className={`rounded-[1.45rem] border p-4 shadow-[0_18px_40px_rgba(2,6,23,0.22)] ${meta.cardClass}`}
                      >
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${meta.chipClass}`}>
                              <PlaceIcon size={18} className={meta.iconClass} />
                            </div>
                            <div>
                              <div className="text-sm font-black text-white">المركز {index + 1}</div>
                              <div className="text-xs text-slate-400">بطاقة تحرير خاصة بصاحب المرتبة {meta.badge}</div>
                            </div>
                          </div>
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${meta.chipClass}`}>
                            {meta.badge}
                          </div>
                        </div>

                        <div className="mb-4 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                          <div className="mb-2 text-xs font-semibold tracking-[0.18em] text-slate-400">بحث وإضافة مستخدم</div>
                          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                            <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                              <span className="owner-hint">ابحث بالاسم أو رقم المستخدم أو البريد أو الهاتف</span>
                              <input
                                value={homeLeaderboardSearchDrafts[index] || ''}
                                onChange={(e) => handleHomeLeaderboardSearchDraftChange(index, e.target.value)}
                                placeholder="مثال: 3038 أو Zeus"
                              />
                            </label>
                            <div className="flex items-end">
                              <button
                                type="button"
                                className="wallet-action-btn owner-set-btn"
                                onClick={() => handleSearchHomeLeaderboardUser(index)}
                                disabled={homeLeaderboardSearchLoadingIndex === index}
                              >
                                {homeLeaderboardSearchLoadingIndex === index ? '...' : 'بحث'}
                              </button>
                            </div>
                          </div>

                          {homeLeaderboardSearchResults[index]?.length ? (
                            <div className="mt-3 space-y-2">
                              {homeLeaderboardSearchResults[index].map((userItem) => (
                                <div
                                  key={userItem.id}
                                  className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-slate-950/40 px-3 py-3 lg:flex-row lg:items-center lg:justify-between"
                                >
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white">
                                      {userItem.display_name || `#${userItem.id}`} <span className="text-slate-500">#{userItem.id}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">
                                      {userItem.email || userItem.phone || 'لا يوجد بريد أو هاتف ظاهر'}
                                    </div>
                                    <div className="mt-2 text-xs text-sky-200">
                                      إجمالي الإيداعات: {Number(userItem.deposits_total ?? userItem.total_deposit ?? 0).toLocaleString('en-US')} USDT
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="wallet-action-btn wallet-action-deposit"
                                    onClick={() => handleApplyHomeLeaderboardUser(index, userItem)}
                                  >
                                    إضافة إلى هذا المركز
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                          <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                            <span className="owner-hint">الاسم</span>
                            <input
                              value={item.name}
                              onChange={(e) => handleHomeLeaderboardCompetitorChange(index, 'name', e.target.value)}
                              placeholder="اسم المتصدر"
                            />
                          </label>
                          <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                            <span className="owner-hint">رابط الصورة أو صورة البروفايل</span>
                            <input
                              value={item.avatar || ''}
                              onChange={(e) => handleHomeLeaderboardCompetitorChange(index, 'avatar', e.target.value)}
                              placeholder="https://..."
                            />
                          </label>
                          <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                            <span className="owner-hint">إجمالي الإيداعات</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.totalDeposits}
                              onChange={(e) => handleHomeLeaderboardCompetitorChange(index, 'totalDeposits', e.target.value)}
                              placeholder="0"
                            />
                          </label>
                          <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                            <span className="owner-hint">نمو الشهر</span>
                            <input
                              value={item.monthlyGrowth}
                              onChange={(e) => handleHomeLeaderboardCompetitorChange(index, 'monthlyGrowth', e.target.value)}
                              placeholder="+12.5%"
                            />
                          </label>
                          <label className="wallet-inline-input" style={{ display: 'grid', gap: 6 }}>
                            <span className="owner-hint">اللقب</span>
                            <input
                              value={item.tierLabel}
                              onChange={(e) => handleHomeLeaderboardCompetitorChange(index, 'tierLabel', e.target.value)}
                              placeholder="حوت النخبة"
                            />
                          </label>
                          <label className="wallet-inline-input lg:col-span-2" style={{ display: 'grid', gap: 6 }}>
                            <span className="owner-hint">تفاصيل إضافية تظهر عند الضغط</span>
                            <textarea
                              rows={4}
                              value={item.spotlight}
                              onChange={(e) => handleHomeLeaderboardCompetitorChange(index, 'spotlight', e.target.value)}
                              placeholder="وصف مختصر للمركز"
                            />
                          </label>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                          <div>
                            <div className="text-[11px] text-slate-500">معاينة سريعة</div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              المركز {index + 1} • {item.name || 'بدون اسم بعد'}
                            </div>
                          </div>
                          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${meta.chipClass}`}>
                            <Sparkles size={12} />
                            {Number(item.totalDeposits || 0).toLocaleString('en-US')} USDT
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-col gap-3 rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">حفظ ونشر الحالة</div>
                    <div className="mt-1 text-sm text-slate-400">
                      يمكنك حفظ البيانات مع إبقاء القسم مخفيًا، أو تفعيله ليظهر مباشرة في الرئيسية.
                    </div>
                  </div>
                  <div className="owner-buttons">
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={() => setHomeLeaderboardPreviewOpen((prev) => !prev)}
                    >
                      {homeLeaderboardPreviewOpen ? 'إخفاء المعاينة المباشرة' : 'معاينة مباشرة قبل التفعيل'}
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn wallet-action-deposit"
                      onClick={handleSaveHomeLeaderboard}
                      disabled={homeLeaderboardSaving}
                    >
                      {homeLeaderboardSaving ? '...' : 'حفظ بيانات أعلى المودعين'}
                    </button>
                  </div>
                </div>

                {homeLeaderboardPreviewOpen ? (
                  <div className="rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] p-3 shadow-[0_20px_50px_rgba(2,6,23,0.32)]">
                    <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-bold text-white">المعاينة المباشرة</div>
                        <div className="mt-1 text-xs text-slate-400">هذه هي نفس البطاقة التي ستظهر في الرئيسية عند التفعيل، مع إمكانية مشاهدة شكل الجوال أو سطح المكتب.</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                          <Eye size={13} />
                          معاينة خاصة بالمالك
                        </div>
                        <button
                          type="button"
                          className={`wallet-action-btn ${homeLeaderboardPreviewMode === 'desktop' ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                          onClick={() => setHomeLeaderboardPreviewMode('desktop')}
                        >
                          سطح المكتب
                        </button>
                        <button
                          type="button"
                          className={`wallet-action-btn ${homeLeaderboardPreviewMode === 'mobile' ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                          onClick={() => setHomeLeaderboardPreviewMode('mobile')}
                        >
                          الجوال
                        </button>
                      </div>
                    </div>
                    {homeLeaderboardPreviewMode === 'desktop' ? (
                      <div className="rounded-[1.35rem] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.82),rgba(15,23,42,0.96))] p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="text-xs font-semibold tracking-[0.18em] text-slate-400">DESKTOP PREVIEW</div>
                          <div className="text-xs text-slate-500">1440px</div>
                        </div>
                        <LeaderboardSection config={{ ...homeLeaderboardDraft, enabled: true }} previewMode />
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <div className="w-full max-w-[430px] rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-3 shadow-[0_18px_40px_rgba(2,6,23,0.36)]">
                          <div className="mx-auto mb-3 h-1.5 w-24 rounded-full bg-white/12" />
                          <div className="mb-3 flex items-center justify-between px-1">
                            <div className="text-xs font-semibold tracking-[0.18em] text-slate-400">MOBILE PREVIEW</div>
                            <div className="text-xs text-slate-500">390px</div>
                          </div>
                          <div className="max-h-[75vh] overflow-y-auto rounded-[1.4rem] bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.82),rgba(15,23,42,0.96))] p-2">
                            <LeaderboardSection config={{ ...homeLeaderboardDraft, enabled: true }} previewMode />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="owner-section-divider" />

            <h2 className="owner-section-title">مفاتيح جذب الأيقونات</h2>
            <p className="owner-hint">يمكنك تفعيل أو إلغاء: ساخن / جديد / الأكثر طلباً فوق الأيقونات.</p>
            <div className="owner-buttons owner-pill-group">
              {attractionKeyOptions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`wallet-action-btn ${attractionKeys.includes(item.key) ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                  onClick={() =>
                    setAttractionKeys((prev) =>
                      prev.includes(item.key) ? prev.filter((x) => x !== item.key) : [...prev, item.key].slice(0, 3),
                    )
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="owner-hint owner-tight-hint">{t('owner_attraction_targets_hint')}</p>
            <div className="owner-buttons owner-pill-group">
              {attractionTargetOptions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`wallet-action-btn ${attractionTargets.includes(item.key) ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                  onClick={() =>
                    setAttractionTargets((prev) =>
                      prev.includes(item.key) ? prev.filter((x) => x !== item.key) : [...prev, item.key],
                    )
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="owner-hint owner-tight-hint">{t('owner_attraction_manual_assign_hint')}</p>
            <div className="owner-assignment-grid">
              {attractionTargetOptions.map((item) => (
                <label key={item.key} className="owner-assignment-row">
                  <span className="owner-assignment-label">{item.label}</span>
                  <select
                    className="field-input owner-image-key owner-assignment-select"
                    value={attractionAssignments[item.key] || ''}
                    onChange={(e) => {
                      const next = e.target.value as '' | 'hot' | 'new' | 'most_requested'
                      setAttractionAssignments((prev) => {
                        const updated: IconAttractionAssignments = { ...prev }
                        if (!next) delete updated[item.key]
                        else updated[item.key] = next
                        return updated
                      })
                    }}
                  >
                    <option value="">{t('owner_attraction_manual_auto')}</option>
                    <option value="hot">{t('tag_hot')}</option>
                    <option value="new">{t('tag_new')}</option>
                    <option value="most_requested">{t('tag_most_requested')}</option>
                  </select>
                </label>
              ))}
            </div>

            <div className="owner-save-row">
              <button
                type="button"
                className="wallet-action-btn owner-set-btn"
                onClick={handleSaveAttractionKeys}
                disabled={attractionSaving}
              >
                {attractionSaving ? '...' : 'حفظ المفاتيح'}
              </button>
            </div>
          </section>
        </aside>

        <div className="owner-dashboard-main">
          <section className="owner-balance-section">
            <h2 className="owner-section-title">إدارة المستخدم المتقدمة</h2>
            <p className="owner-hint">حظر، تجميد، خصم، توثيق ذهبي/أزرق، وتحديد مستوى VIP (1-5).</p>
            <div className="owner-search-row">
              <input
                type="text"
                inputMode="numeric"
                className="field-input owner-user-id-input"
                placeholder="رقم المستخدم (ID)"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
              />
            </div>
            {userFlags ? (
              <div className="owner-actions-card">
                <div className="owner-buttons">
                  <button
                    type="button"
                    className={`wallet-action-btn ${userFlags.is_banned ? 'wallet-action-withdraw' : 'wallet-action-deposit'}`}
                    onClick={() => setUserFlags((v) => (v ? { ...v, is_banned: v.is_banned ? 0 : 1 } : v))}
                  >
                    {userFlags.is_banned ? 'إلغاء الحظر' : 'حظر المستخدم'}
                  </button>
                  <button
                    type="button"
                    className={`wallet-action-btn ${userFlags.is_frozen ? 'wallet-action-withdraw' : 'owner-set-btn'}`}
                    onClick={() => setUserFlags((v) => (v ? { ...v, is_frozen: v.is_frozen ? 0 : 1 } : v))}
                  >
                    {userFlags.is_frozen ? 'إلغاء التجميد' : 'تجميد الحساب'}
                  </button>
                </div>

                <div className="owner-form-row owner-image-form">
                  <select
                    className="field-input owner-image-key"
                    value={userFlags.badge_color}
                    onChange={(e) =>
                      setUserFlags((v) =>
                        v ? { ...v, badge_color: e.target.value as 'none' | 'gold' | 'blue' } : v,
                      )
                    }
                  >
                    <option value="none">بدون توثيق</option>
                    <option value="gold">توثيق ذهبي ☑️</option>
                    <option value="blue">توثيق أزرق ☑️</option>
                  </select>
                  <select
                    className="field-input owner-image-key"
                    value={userFlags.vip_level}
                    onChange={(e) => setUserFlags((v) => (v ? { ...v, vip_level: Number(e.target.value) } : v))}
                  >
                    <option value={0}>VIP 0</option>
                    <option value={1}>VIP 1</option>
                    <option value={2}>VIP 2</option>
                    <option value={3}>VIP 3</option>
                    <option value={4}>VIP 4</option>
                    <option value={5}>VIP 5</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleUserFlagsSave}
                  disabled={flagsSaving}
                >
                  {flagsSaving ? 'جارٍ الحفظ...' : 'حفظ إعدادات المستخدم'}
                </button>

                <div className="owner-section-divider" />
                <h3 className="owner-wallet-heading">خصم الأرباح العامة والخاصة</h3>
                <p className="owner-hint">الخصم العام يسحب من الرصيد العام القابل للسحب. الخصم الخاص يسحب من الأرباح المعلقة/المقيدة حسب المصدر قبل ترحيلها.</p>
                <div className="owner-form-row owner-image-form">
                  <select
                    className="field-input owner-image-key"
                    value={userProfitAdjustDraft.target}
                    onChange={(e) =>
                      setUserProfitAdjustDraft((prev) => ({
                        ...prev,
                        target: e.target.value === 'pending' ? 'pending' : 'main',
                      }))
                    }
                  >
                    <option value="main">خصم أرباح عامة</option>
                    <option value="pending">خصم أرباح خاصة</option>
                  </select>
                  <input
                    type="number"
                    className="field-input"
                    placeholder="المبلغ بالـ USDT"
                    value={userProfitAdjustDraft.amount}
                    onChange={(e) => setUserProfitAdjustDraft((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                {userProfitAdjustDraft.target === 'pending' ? (
                  <select
                    className="field-input owner-image-key"
                    value={userProfitAdjustDraft.sourceType}
                    onChange={(e) =>
                      setUserProfitAdjustDraft((prev) => ({
                        ...prev,
                        sourceType: e.target.value as RewardPayoutSource,
                      }))
                    }
                  >
                    {REWARD_PAYOUT_SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : null}
                <input
                  className="field-input owner-note-input"
                  placeholder="ملاحظة داخلية لسبب الخصم"
                  value={userProfitAdjustDraft.note}
                  onChange={(e) => setUserProfitAdjustDraft((prev) => ({ ...prev, note: e.target.value }))}
                />
                <div className="owner-buttons">
                  <button
                    type="button"
                    className="wallet-action-btn wallet-action-withdraw"
                    onClick={handleAdjustUserProfit}
                    disabled={userProfitAdjustSaving}
                  >
                    {userProfitAdjustSaving ? '...' : userProfitAdjustDraft.target === 'main' ? 'خصم الأرباح العامة' : 'خصم الأرباح الخاصة'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="owner-empty">أدخل رقم مستخدم صحيح لعرض إعداداته المتقدمة.</p>
            )}
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">إدارة أكواد الاستراتيجية</h2>
            <p className="owner-hint">
              من هنا ينشئ المالك أكواد فتح صفقات استراتيجية أو مكافآت ترويجية، مع تحديد الحالة والانتهاء والتتبع الكامل.
            </p>
            <div className="owner-actions-card">
              <h3 className="owner-wallet-heading">الوصف الظاهر للمستخدم</h3>
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder="وصف ما قبل التأكيد"
                  value={strategyTradeDisplayDraft.preview_notice}
                  onChange={(e) => setStrategyTradeDisplayDraft((prev) => ({ ...prev, preview_notice: e.target.value }))}
                />
              </div>
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder="وصف أثناء المعالجة"
                  value={strategyTradeDisplayDraft.active_notice}
                  onChange={(e) => setStrategyTradeDisplayDraft((prev) => ({ ...prev, active_notice: e.target.value }))}
                />
              </div>
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder="وصف بعد التسوية"
                  value={strategyTradeDisplayDraft.settled_notice}
                  onChange={(e) => setStrategyTradeDisplayDraft((prev) => ({ ...prev, settled_notice: e.target.value }))}
                />
              </div>
              <div className="owner-buttons">
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-deposit"
                  onClick={handleSaveStrategyTradeDisplay}
                  disabled={strategyDisplaySaving}
                >
                  {strategyDisplaySaving ? '...' : 'حفظ الوصف الظاهر'}
                </button>
              </div>
            </div>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder="كود الاستراتيجية"
                  value={strategyCodeDraft.code}
                  onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, code: e.target.value }))}
                />
                <input
                  className="field-input"
                  placeholder="عنوان الكود"
                  value={strategyCodeDraft.title}
                  onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <input
                className="field-input owner-note-input"
                placeholder="وصف واضح للمستخدم"
                value={strategyCodeDraft.description}
                onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, description: e.target.value }))}
              />
              <input
                className="field-input owner-note-input"
                placeholder="اسم الخبير المعتمد الظاهر للمستخدم"
                value={strategyCodeDraft.expertName}
                onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, expertName: e.target.value }))}
              />
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder="نسبة الشراء من إجمالي الأصول بعد استثناء المقيد"
                  value={strategyCodeDraft.purchasePercent}
                  onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, purchasePercent: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder="نسبة العائد بعد إغلاق الصفقة"
                  value={strategyCodeDraft.tradeReturnPercent}
                  onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, tradeReturnPercent: e.target.value }))}
                />
              </div>
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder="الأصل الافتراضي مثل BTCUSDT"
                  value={strategyCodeDraft.assetSymbol}
                  onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, assetSymbol: e.target.value.toUpperCase() }))}
                />
                <input
                  type="datetime-local"
                  className="field-input"
                  value={strategyCodeDraft.expiresAt}
                  onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
              <div className="owner-buttons">
                <button
                  type="button"
                  className={`wallet-action-btn ${strategyCodeDraft.isActive ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                  onClick={() => setStrategyCodeDraft((prev) => ({ ...prev, isActive: !prev.isActive }))}
                >
                  {strategyCodeDraft.isActive ? 'فعال' : 'معطل'}
                </button>
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleCreateStrategyCode}
                  disabled={strategySaving}
                >
                  {strategySaving ? '...' : 'حفظ كود الاستراتيجية'}
                </button>
              </div>
            </div>

            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">الأكواد الحالية</h3>
              <ul className="owner-history-list">
                {strategyCodes.map((item) => (
                  <li key={item.id} className="owner-history-item">
                    <span>{item.code}</span>
                    <span>{Number(item.purchasePercent || 0).toFixed(0)}% من الأصول المتاحة</span>
                    <span>{item.expertName || 'بدون خبير'}</span>
                    <span>{item.usageCount} استخدام</span>
                    <span>{item.createdByName || `#${item.createdBy || '-'}`}</span>
                    <button
                      type="button"
                      className={`wallet-action-btn ${item.isActive ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                      onClick={async () => {
                        await toggleStrategyCodeAdmin(item.id, !item.isActive)
                        await refreshStrategyCodes()
                      }}
                    >
                      {item.isActive ? 'فعال' : 'معطل'}
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn wallet-action-withdraw"
                      onClick={async () => {
                        await deleteStrategyCodeAdmin(item.id)
                        await refreshStrategyCodes()
                      }}
                    >
                      حذف
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">سجل الاستخدام</h3>
              <ul className="owner-history-list">
                {strategyUsages.length === 0 ? (
                  <li className="owner-history-item">لا توجد استخدامات مسجلة بعد.</li>
                ) : (
                  strategyUsages.map((usage) => (
                    <li key={usage.id} className="owner-history-item">
                      <span>#{usage.codeId}</span>
                      <span>{usage.userDisplayName || usage.userEmail || usage.userPhone || `#${usage.userId}`}</span>
                      <span>{usage.status}</span>
                      <span>{usage.selectedSymbol || '--'}</span>
                      <span>{usage.expertName || 'بدون خبير'}</span>
                      <span>{Number(usage.stakeAmount || 0).toFixed(2)} USDT</span>
                      <span>{usage.usedAt || usage.confirmedAt || '-'}</span>
                      {usage.status === 'trade_settled' ? (
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-withdraw"
                          onClick={() => handleDeleteStrategyUsage(usage)}
                          disabled={strategyUsageDeletingId === usage.id}
                        >
                          {strategyUsageDeletingId === usage.id ? '...' : 'حذف من السجل'}
                        </button>
                      ) : (
                        <span>{usage.settledAt || '-'}</span>
                      )}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">إدارة اللوحات الإعلانية</h2>
            <p className="owner-hint">يمكن للمالك من هنا إضافة وتعديل وتعطيل وحذف وترتيب جميع اللوحات الإعلانية لكل المواضع: الرئيسية، الملف الشخصي، التعدين، والإيداع.</p>
            <div className="owner-actions-card">
              {!adFormOpen ? (
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-deposit"
                  onClick={openCreateAdForm}
                >
                  إضافة لوحة إعلانية
                </button>
              ) : (
                <div className="space-y-2">
                  <select
                    className="field-input"
                    value={adFormType}
                    onChange={(e) => {
                      setAdFormType(e.target.value as 'image' | 'video')
                      setAdFormFile(null)
                      setAdValidationError(null)
                    }}
                  >
                    <option value="image">صورة</option>
                    <option value="video">فيديو</option>
                  </select>
                  <input
                    type="file"
                    accept={adFormType === 'video' ? 'video/*' : 'image/*'}
                    className="field-input"
                    onChange={(e) => {
                      setAdFormFile(e.target.files?.[0] || null)
                      setAdValidationError(null)
                    }}
                  />
                  <input
                    className="field-input"
                    value={adFormMediaUrl}
                    onChange={(e) => {
                      setAdFormMediaUrl(e.target.value)
                      setAdValidationError(null)
                    }}
                    placeholder="رابط الوسيط الإعلاني"
                  />
                  <input
                    className="field-input"
                    value={adFormTitle}
                    onChange={(e) => setAdFormTitle(e.target.value.slice(0, AD_TITLE_MAX))}
                    placeholder="عنوان الإعلان"
                    maxLength={AD_TITLE_MAX}
                  />
                  <input
                    className="field-input"
                    value={adFormDescription}
                    onChange={(e) => setAdFormDescription(e.target.value.slice(0, AD_DESCRIPTION_MAX))}
                    placeholder="وصف الإعلان"
                    maxLength={AD_DESCRIPTION_MAX}
                  />
                  <input
                    className="field-input"
                    value={adFormLinkUrl}
                    onChange={(e) => setAdFormLinkUrl(e.target.value)}
                    placeholder="رابط الفتح عند الضغط"
                  />
                  <select
                    className="field-input"
                    value={adFormPlacement}
                    onChange={(e) => setAdFormPlacement(e.target.value)}
                  >
                    {AD_PLACEMENTS.map((placement) => (
                      <option key={placement} value={placement}>
                        {placement === 'all'
                          ? 'كل اللوحات'
                          : placement === 'home'
                            ? 'الرئيسية'
                            : placement === 'profile'
                              ? 'الملف الشخصي'
                              : placement === 'mining'
                                ? 'التعدين'
                                : 'الإيداع'}
                      </option>
                    ))}
                  </select>
                  {adValidationError ? <p className="owner-message owner-message-error">{t(adValidationError)}</p> : null}
                  <div className="owner-buttons">
                    <button
                      type="button"
                      className="wallet-action-btn wallet-action-deposit"
                      onClick={handleSaveAd}
                      disabled={adsSaving || adFormUploading}
                    >
                      {adFormUploading ? 'جارٍ رفع الوسيط...' : adsSaving ? 'جارٍ الحفظ...' : adFormEdit ? 'حفظ التعديل' : 'إنشاء الإعلان'}
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={() => {
                        setAdFormOpen(false)
                        resetAdForm()
                      }}
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">جميع اللوحات الإعلانية</h3>
              {adsList.length === 0 ? (
                <p className="owner-empty">لا توجد لوحات إعلانية مسجلة بعد.</p>
              ) : (
                <ul className="owner-history-list">
                  {adsList.map((item, index) => (
                    <li key={item.id} className="owner-history-item">
                      <span>#{item.id}</span>
                      <span>{item.title || item.mediaUrl}</span>
                      <span>{item.type === 'video' ? 'فيديو' : 'صورة'}</span>
                      <span>{item.placement}</span>
                      <button
                        type="button"
                        className="wallet-action-btn owner-set-btn"
                        onClick={() => openEditAdForm(item)}
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        className={`wallet-action-btn ${item.isActive ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                        onClick={() => handleToggleAd(item.id, !item.isActive)}
                        disabled={adToggleLoading !== null}
                      >
                        {adToggleLoading === item.id ? '...' : item.isActive ? 'مفعل' : 'معطل'}
                      </button>
                      {adDeleteConfirmId === item.id ? (
                        <>
                          <button
                            type="button"
                            className="wallet-action-btn wallet-action-withdraw"
                            onClick={() => handleDeleteAd(item.id)}
                            disabled={adDeleteLoading === item.id}
                          >
                            {adDeleteLoading === item.id ? '...' : 'تأكيد الحذف'}
                          </button>
                          <button
                            type="button"
                            className="wallet-action-btn owner-set-btn"
                            onClick={() => setAdDeleteConfirmId(null)}
                          >
                            إلغاء
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-withdraw"
                          onClick={() => setAdDeleteConfirmId(item.id)}
                        >
                          حذف
                        </button>
                      )}
                      {index > 0 ? (
                        <button
                          type="button"
                          className="wallet-action-btn owner-set-btn"
                          onClick={() => handleMoveAd(index, -1)}
                          disabled={adReorderLoading}
                        >
                          ↑
                        </button>
                      ) : null}
                      {index < adsList.length - 1 ? (
                        <button
                          type="button"
                          className="wallet-action-btn owner-set-btn"
                          onClick={() => handleMoveAd(index, 1)}
                          disabled={adReorderLoading}
                        >
                          ↓
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">مكافأة أول إيداع</h2>
            <p className="owner-hint">يمكنك تحديد نسبة مكافأة أو قاعدة ثابتة من نوع: أودع مبلغًا محددًا واحصل على مبلغ إضافي.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder="عنوان القاعدة"
                  value={firstDepositBonusDraft.title}
                  onChange={(e) => setFirstDepositBonusDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
                <select
                  className="field-input"
                  value={firstDepositBonusDraft.rewardMode}
                  onChange={(e) =>
                    setFirstDepositBonusDraft((prev) => ({
                      ...prev,
                      rewardMode: e.target.value as 'percent' | 'fixed',
                    }))
                  }
                >
                  <option value="percent">نسبة مئوية</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
              </div>
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder="أولًا أودع"
                  value={firstDepositBonusDraft.minDeposit}
                  onChange={(e) => setFirstDepositBonusDraft((prev) => ({ ...prev, minDeposit: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder="حتى مبلغ اختياري"
                  value={firstDepositBonusDraft.maxDeposit}
                  onChange={(e) => setFirstDepositBonusDraft((prev) => ({ ...prev, maxDeposit: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder={firstDepositBonusDraft.rewardMode === 'fixed' ? 'واحصل على مبلغ' : 'واحصل على نسبة %'}
                  value={firstDepositBonusDraft.rewardValue}
                  onChange={(e) => setFirstDepositBonusDraft((prev) => ({ ...prev, rewardValue: e.target.value }))}
                />
              </div>
              <label className="owner-checkbox">
                <input
                  type="checkbox"
                  checked={firstDepositBonusDraft.isActive}
                  onChange={(e) => setFirstDepositBonusDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                <span>القاعدة فعالة</span>
              </label>
              <div className="owner-hint">
                {firstDepositBonusDraft.rewardMode === 'fixed'
                  ? `أودع ${firstDepositBonusDraft.minDeposit || 0} واحصل على ${firstDepositBonusDraft.rewardValue || 0} USDT`
                  : `أودع ${firstDepositBonusDraft.minDeposit || 0} واحصل على ${firstDepositBonusDraft.rewardValue || 0}% كمكافأة`}
              </div>
              <div className="owner-buttons">
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleSaveFirstDepositBonus}
                  disabled={bonusSaving}
                >
                  {bonusSaving ? '...' : firstDepositBonusDraft.id ? 'تحديث القاعدة' : 'حفظ القاعدة'}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">قواعد أول إيداع الحالية</h3>
              {firstDepositBonusRules.length === 0 ? (
                <p className="owner-empty">لا توجد قواعد محفوظة حتى الآن.</p>
              ) : (
                <ul className="owner-history-list">
                  {firstDepositBonusRules.map((rule) => {
                    const conditions = (rule.conditions || {}) as Record<string, unknown>
                    const reward = (rule.reward || {}) as Record<string, unknown>
                    const rewardMode = String(reward.mode || 'percent')
                    return (
                      <li key={rule.id} className="owner-history-item">
                        <div className="owner-history-main">
                          <strong>{rule.title}</strong>
                          <small>
                            أودع {String(conditions.minDeposit ?? 0)}
                            {conditions.maxDeposit ? ` - ${String(conditions.maxDeposit)}` : '+'}
                            {' / '}
                            {rewardMode === 'fixed'
                              ? `واحصل على ${String(reward.value ?? 0)} USDT`
                              : `واحصل على ${String(reward.value ?? 0)}%`}
                          </small>
                        </div>
                        <div className="owner-history-actions">
                          <button
                            type="button"
                            className="wallet-action-btn owner-set-btn"
                            onClick={() =>
                              setFirstDepositBonusDraft({
                                id: rule.id,
                                title: rule.title,
                                minDeposit: String(conditions.minDeposit ?? ''),
                                maxDeposit: conditions.maxDeposit == null ? '' : String(conditions.maxDeposit),
                                rewardMode: rewardMode === 'fixed' ? 'fixed' : 'percent',
                                rewardValue: String(reward.value ?? 0),
                                isActive: Number(rule.is_active || 0) === 1,
                              })
                            }
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="wallet-action-btn owner-set-btn"
                            onClick={() => handleToggleFirstDepositBonus(rule)}
                            disabled={bonusSaving}
                          >
                            {Number(rule.is_active || 0) === 1 ? 'تعطيل' : 'تفعيل'}
                          </button>
                          <button
                            type="button"
                            className="wallet-action-btn owner-set-btn"
                            onClick={() => handleDeleteFirstDepositBonus(rule.id)}
                            disabled={bonusSaving}
                          >
                            حذف
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">مكافأة الإحالة بعد أول إيداع مؤكد</h2>
            <p className="owner-hint">لا تُحتسب إلا إذا سجّل المستخدم عبر كود/رابط الإحالة وتم تأكيد أول إيداع له فعليًا. وتُحتسب مرة واحدة فقط لكل مستخدم مُحال.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder="عنوان القاعدة"
                  value={referralBonusDraft.title}
                  onChange={(e) => setReferralBonusDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
                <select
                  className="field-input"
                  value={referralBonusDraft.rewardMode}
                  onChange={(e) =>
                    setReferralBonusDraft((prev) => ({
                      ...prev,
                      rewardMode: e.target.value as 'percent' | 'fixed',
                    }))
                  }
                >
                  <option value="fixed">مبلغ ثابت للمحيل</option>
                  <option value="percent">نسبة من أول إيداع</option>
                </select>
              </div>
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder="إذا أودع المحال أولًا"
                  value={referralBonusDraft.minDeposit}
                  onChange={(e) => setReferralBonusDraft((prev) => ({ ...prev, minDeposit: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder="حتى مبلغ اختياري"
                  value={referralBonusDraft.maxDeposit}
                  onChange={(e) => setReferralBonusDraft((prev) => ({ ...prev, maxDeposit: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder={referralBonusDraft.rewardMode === 'fixed' ? 'يحصل المحيل على مبلغ' : 'يحصل المحيل على نسبة %'}
                  value={referralBonusDraft.rewardValue}
                  onChange={(e) => setReferralBonusDraft((prev) => ({ ...prev, rewardValue: e.target.value }))}
                />
              </div>
              <label className="owner-checkbox">
                <input
                  type="checkbox"
                  checked={referralBonusDraft.isActive}
                  onChange={(e) => setReferralBonusDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                <span>القاعدة فعالة</span>
              </label>
              <div className="owner-hint">
                {referralBonusDraft.rewardMode === 'fixed'
                  ? `إذا أودع المحال ${referralBonusDraft.minDeposit || 0} يحصل المحيل على ${referralBonusDraft.rewardValue || 0} USDT`
                  : `إذا أودع المحال ${referralBonusDraft.minDeposit || 0} يحصل المحيل على ${referralBonusDraft.rewardValue || 0}%`}
              </div>
              <div className="owner-buttons">
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleSaveReferralBonus}
                  disabled={bonusSaving}
                >
                  {bonusSaving ? '...' : referralBonusDraft.id ? 'تحديث القاعدة' : 'حفظ القاعدة'}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">قواعد الإحالة الحالية</h3>
              {referralBonusRules.length === 0 ? (
                <p className="owner-empty">لا توجد قواعد إحالة محفوظة حتى الآن.</p>
              ) : (
                <ul className="owner-history-list">
                  {referralBonusRules.map((rule) => {
                    const conditions = (rule.conditions || {}) as Record<string, unknown>
                    const reward = (rule.reward || {}) as Record<string, unknown>
                    const rewardMode = String(reward.mode || 'fixed')
                    return (
                      <li key={rule.id} className="owner-history-item">
                        <div className="owner-history-main">
                          <strong>{rule.title}</strong>
                          <small>
                            أول إيداع مؤكد للمحال: {String(conditions.minDeposit ?? 0)}
                            {conditions.maxDeposit ? ` - ${String(conditions.maxDeposit)}` : '+'}
                            {' / '}
                            {rewardMode === 'fixed'
                              ? `مكافأة المحيل ${String(reward.value ?? 0)} USDT`
                              : `مكافأة المحيل ${String(reward.value ?? 0)}%`}
                          </small>
                        </div>
                        <div className="owner-history-actions">
                          <button
                            type="button"
                            className="wallet-action-btn owner-set-btn"
                            onClick={() =>
                              setReferralBonusDraft({
                                id: rule.id,
                                title: rule.title,
                                minDeposit: String(conditions.minDeposit ?? ''),
                                maxDeposit: conditions.maxDeposit == null ? '' : String(conditions.maxDeposit),
                                rewardMode: rewardMode === 'percent' ? 'percent' : 'fixed',
                                rewardValue: String(reward.value ?? 0),
                                isActive: Number(rule.is_active || 0) === 1,
                              })
                            }
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            className="wallet-action-btn owner-set-btn"
                            onClick={() => handleToggleFirstDepositBonus(rule)}
                            disabled={bonusSaving}
                          >
                            {Number(rule.is_active || 0) === 1 ? 'تعطيل' : 'تفعيل'}
                          </button>
                          <button
                            type="button"
                            className="wallet-action-btn owner-set-btn"
                            onClick={() => handleDeleteFirstDepositBonus(rule.id)}
                            disabled={bonusSaving}
                          >
                            حذف
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">طلبات التحقق المرفوعة</h2>
            <p className="owner-hint">
              هنا تظهر الحسابات التي رفعت مستندات الهوية. يمكنك اعتماد الطلب أو رفضه أو تحويله إلى مراجعة تلقائية، وسيتم تحديث حالة التحقق للمستخدم مباشرة.
            </p>
            <div className="owner-buttons">
              <button
                type="button"
                className="wallet-action-btn owner-set-btn"
                onClick={() => refreshKycSubmissions()}
                disabled={kycLoading}
              >
                {kycLoading ? '...' : 'تحديث القائمة'}
              </button>
              <button
                type="button"
                className="wallet-action-btn owner-set-btn"
                onClick={handleProcessAutoKyc}
                disabled={kycLoading}
              >
                {kycLoading ? '...' : 'تنفيذ المراجعة التلقائية'}
              </button>
            </div>
            <div className="owner-history-card">
              {kycSubmissions.length === 0 ? (
                <p className="owner-empty">لا توجد طلبات تحقق معلقة حاليًا.</p>
              ) : (
                <ul className="owner-history-list">
                  {kycSubmissions.map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>
                          #{item.id} - {item.display_name || item.email || item.phone || `المستخدم #${item.user_id}`}
                        </strong>
                        <small>
                          الحالة الحالية: {item.review_status} | تاريخ الرفع: {item.created_at}
                        </small>
                        <div className="owner-kyc-attachments">
                          <button
                            type="button"
                            className="owner-kyc-attachment-btn"
                            onClick={() =>
                              openKycAttachmentPreview(
                                `الهوية - ${getKycAttachmentLabel(item)}`,
                                item.id_document_url || item.id_document_path,
                                `الهوية - ${getKycAttachmentLabel(item)}`,
                              )
                            }
                          >
                            عرض الهوية
                          </button>
                          <button
                            type="button"
                            className="owner-kyc-attachment-btn"
                            onClick={() =>
                              openKycAttachmentPreview(
                                `السيلفي - ${getKycAttachmentLabel(item)}`,
                                item.selfie_url || item.selfie_path,
                                `السيلفي - ${getKycAttachmentLabel(item)}`,
                              )
                            }
                          >
                            عرض السيلفي
                          </button>
                          {item.avatar_url ? (
                            <button
                              type="button"
                              className="owner-kyc-attachment-btn"
                              onClick={() =>
                                openKycAttachmentPreview(
                                  `صورة الحساب - ${getKycAttachmentLabel(item)}`,
                                  item.avatar_url,
                                  `صورة الحساب - ${getKycAttachmentLabel(item)}`,
                                )
                              }
                            >
                              صورة الحساب
                            </button>
                          ) : null}
                        </div>
                        <div className="owner-kyc-attachment-links">
                          <button
                            type="button"
                            className="owner-nav-link owner-kyc-link-btn"
                            onClick={() => handleOpenKycAttachmentInNewTab(item.id_document_url || item.id_document_path)}
                          >
                            فتح الهوية
                          </button>
                          <button
                            type="button"
                            className="owner-nav-link owner-kyc-link-btn"
                            onClick={() => handleOpenKycAttachmentInNewTab(item.selfie_url || item.selfie_path)}
                          >
                            فتح السيلفي
                          </button>
                          {item.avatar_url ? (
                            <button
                              type="button"
                              className="owner-nav-link owner-kyc-link-btn"
                              onClick={() => handleOpenKycAttachmentInNewTab(item.avatar_url)}
                            >
                              فتح صورة الحساب
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="owner-history-actions">
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-deposit"
                          onClick={() => handleReviewKyc(item, 'approve')}
                          disabled={kycReviewLoadingId === item.id}
                        >
                          اعتماد
                        </button>
                        <button
                          type="button"
                          className="wallet-action-btn owner-set-btn"
                          onClick={() => handleReviewKyc(item, 'auto')}
                          disabled={kycReviewLoadingId === item.id}
                        >
                          تلقائي
                        </button>
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-withdraw"
                          onClick={() => handleReviewKyc(item, 'reject')}
                          disabled={kycReviewLoadingId === item.id}
                        >
                          رفض
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">طلبات رموز الاسترداد</h2>
            <p className="owner-hint">
              هذه الخانة تستقبل الطلبات القادمة من المستخدمين الذين أدخلوا رمز الاسترداد من شاشة الدخول. آلية العمل المقترحة: تراجع بيانات الطلب أولًا، ثم تعتمد أو ترفض الطلب مع توثيق القرار داخل السجل.
            </p>
            <div className="owner-history-card">
              <div className="owner-hint" style={{ marginBottom: 10 }}>
                اعتماد الطلب هنا لا يسجل دخولًا تلقائيًا للمستخدم، لكنه يثبت قرار المالك ويحتفظ به في السجل الإداري للمراجعة والمتابعة.
              </div>
              <div className="owner-buttons">
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={() => refreshRecoveryRequests()}
                  disabled={recoveryLoading}
                >
                  {recoveryLoading ? '...' : 'تحديث الطلبات'}
                </button>
              </div>
              {recoveryRequests.length === 0 ? (
                <p className="owner-empty">لا توجد طلبات رموز استرداد معلقة حاليًا.</p>
              ) : (
                <ul className="owner-history-list">
                  {recoveryRequests.map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>
                          #{item.id} - {item.display_name || item.email || item.phone || `المستخدم #${item.user_id}`}
                        </strong>
                        <small>رمز الاسترداد: {item.recovery_code}</small>
                        <small>تاريخ الطلب: {item.created_at}</small>
                      </div>
                      <div className="owner-history-actions">
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-deposit"
                          onClick={() => handleReviewRecovery(item, 'approve')}
                          disabled={recoveryReviewLoadingId === item.id}
                        >
                          اعتماد
                        </button>
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-withdraw"
                          onClick={() => handleReviewRecovery(item, 'reject')}
                          disabled={recoveryReviewLoadingId === item.id}
                        >
                          رفض
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">لوحات الأرباح اليومية</h2>
            <p className="owner-hint">يستطيع المالك من هنا إنشاء لوحة ربح يومي للمستخدمين. وعند مطالبة المستخدم بها تُسجل مرة واحدة فقط وتُصرف عبر النظام المالي الجديد مباشرة إلى الرصيد الرئيسي.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder="عنوان اللوحة"
                  value={dailyTradeDraft.title}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
                <input
                  className="field-input"
                  placeholder="الرمز مثل BTCUSDT"
                  value={dailyTradeDraft.symbol}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                />
                <select
                  className="field-input"
                  value={dailyTradeDraft.side}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, side: e.target.value }))}
                >
                  <option value="buy">شراء</option>
                  <option value="sell">بيع</option>
                </select>
              </div>
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder="سعر الدخول"
                  value={dailyTradeDraft.entryPrice}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, entryPrice: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder="جني الربح"
                  value={dailyTradeDraft.takeProfit}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, takeProfit: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder="وقف الخسارة"
                  value={dailyTradeDraft.stopLoss}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, stopLoss: e.target.value }))}
                />
              </div>
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder="نسبة النجاح %"
                  value={dailyTradeDraft.successRate}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, successRate: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder="مكافأة المستخدم"
                  value={dailyTradeDraft.rewardAmount}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, rewardAmount: e.target.value }))}
                />
                <select
                  className="field-input"
                  value={dailyTradeDraft.visibilityScope}
                  onChange={(e) =>
                    setDailyTradeDraft((prev) => ({
                      ...prev,
                      visibilityScope: e.target.value as 'all' | 'depositors' | 'vip' | 'vip_level',
                    }))
                  }
                >
                  <option value="all">كل المستخدمين</option>
                  <option value="depositors">المودعون فقط</option>
                  <option value="vip">أعضاء VIP</option>
                  <option value="vip_level">من مستوى VIP محدد</option>
                </select>
              </div>
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder="أقل مستوى VIP"
                  value={dailyTradeDraft.minVipLevel}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, minVipLevel: e.target.value }))}
                />
                <input
                  type="datetime-local"
                  className="field-input"
                  value={dailyTradeDraft.startsAt}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, startsAt: e.target.value }))}
                />
                <input
                  type="datetime-local"
                  className="field-input"
                  value={dailyTradeDraft.endsAt}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, endsAt: e.target.value }))}
                />
              </div>
              <label className="owner-checkbox">
                <input
                  type="checkbox"
                  checked={dailyTradeDraft.isVisible}
                  onChange={(e) => setDailyTradeDraft((prev) => ({ ...prev, isVisible: e.target.checked }))}
                />
                <span>اللوحة فعالة ويمكن للمستخدمين المطالبة بها</span>
              </label>
              <div className="owner-hint">
                {`المكافأة الحالية: ${dailyTradeDraft.rewardAmount || 0} ${dailyTradeDraft.rewardCurrency} مرة واحدة لكل مستخدم.`}
              </div>
              <div className="owner-buttons">
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleSaveDailyTradeCampaign}
                  disabled={bonusSaving}
                >
                  {bonusSaving ? '...' : dailyTradeDraft.id ? 'تحديث اللوحة' : 'حفظ اللوحة'}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">اللوحات الحالية</h3>
              {dailyTradeCampaigns.length === 0 ? (
                <p className="owner-empty">لا توجد لوحات أرباح يومية محفوظة حتى الآن.</p>
              ) : (
                <ul className="owner-history-list">
                  {dailyTradeCampaigns.map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>{item.title}</strong>
                        <small>{`${item.symbol || 'USDT'} / ${Number(item.reward_amount || 0).toFixed(2)} ${item.reward_currency || 'USDT'} / مطالبات: ${Number(item.claims_count || 0)}`}</small>
                      </div>
                      <div className="owner-history-actions">
                        <button
                          type="button"
                          className="wallet-action-btn owner-set-btn"
                          onClick={() =>
                            setDailyTradeDraft({
                              id: item.id,
                              title: item.title,
                              symbol: item.symbol || 'BTCUSDT',
                              side: item.side || 'buy',
                              entryPrice: item.entry_price == null ? '' : String(item.entry_price),
                              takeProfit: item.take_profit == null ? '' : String(item.take_profit),
                              stopLoss: item.stop_loss == null ? '' : String(item.stop_loss),
                              successRate: item.success_rate == null ? '0' : String(item.success_rate),
                              rewardAmount: item.reward_amount == null ? '0' : String(item.reward_amount),
                              rewardCurrency: item.reward_currency || 'USDT',
                              visibilityScope: item.visibility_scope,
                              minVipLevel: String(item.min_vip_level || 0),
                              isVisible: Number(item.is_visible || 0) === 1,
                              startsAt: item.starts_at ? String(item.starts_at).slice(0, 16) : '',
                              endsAt: item.ends_at ? String(item.ends_at).slice(0, 16) : '',
                            })
                          }
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="wallet-action-btn owner-set-btn"
                          onClick={() => handleToggleDailyTradeCampaign(item)}
                          disabled={bonusSaving}
                        >
                          {Number(item.is_visible || 0) === 1 ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button
                          type="button"
                          className="wallet-action-btn owner-set-btn"
                          onClick={() => handleDeleteDailyTradeCampaign(item.id)}
                          disabled={bonusSaving}
                        >
                          حذف
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">الصلاحيات الإدارية الفعالة</h2>
            <p className="owner-hint">هذه الأقسام مربوطة مباشرة بالصلاحيات والـ APIs الفعالة الموجودة فعليًا في النظام.</p>
            <div className="owner-history-card">
              <div className="owner-form-row">
                <div className="owner-actions-card">
                  <h3 className="owner-wallet-heading">ملخص النمو الفعلي</h3>
                  <div className="owner-hint">{`لوحات يومية فعالة: ${ownerSummary.activeDailyTrades} | قواعد مكافآت فعالة: ${ownerSummary.activeBonusRules}`}</div>
                  <div className="owner-hint">{`شركاء نشطون: ${ownerSummary.activePartners} | حملات محتوى فعالة: ${ownerSummary.activeContent}`}</div>
                </div>
                <div className="owner-actions-card">
                  <h3 className="owner-wallet-heading">ملخص الإحالات</h3>
                  <div className="owner-hint">{`معلّقة: ${referralStats.pendingCount} | مؤهلة: ${referralStats.qualifiedCount}`}</div>
                  <div className="owner-hint">{`تم صرفها: ${referralStats.rewardReleasedCount} | القيمة: ${Number(referralStats.totalRewardsValue || 0).toFixed(2)} USDT`}</div>
                </div>
              </div>
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">سياسة السحب الموحدة</h2>
            <p className="owner-hint">هذا القسم هو المرجع الرئيسي لقرار السحب داخل النظام. من هنا تضبط أصل الإيداع، والمكتسبات، والاستثناءات الفردية، بينما تبقى حقول السحب داخل VIP للعرض المرجعي فقط لتقليل التعارض.</p>
            <div className="owner-history-card">
              <div className="owner-form-row">
                <div className="owner-actions-card">
                  <h3 className="owner-wallet-heading">ملخص السياسة الحالية</h3>
                  <div className="owner-hint">{`أصل الإيداع القابل للسحب الآن: ${getPrincipalWithdrawPercent(balanceRules)}%`}</div>
                  <div className="owner-hint">
                    {balanceRules.principalWithdrawalRule?.clearProfitRestriction !== false
                      ? 'لا يوجد شرط ربح إضافي على أصل الإيداع ضمن هذه القاعدة.'
                      : 'ما زال شرط الربح مفعّلًا على أصل الإيداع.'}
                  </div>
                </div>
                <div className="owner-actions-card">
                  <h3 className="owner-wallet-heading">المكتسبات الافتراضية</h3>
                  <div className="owner-hint">{rewardPayoutRules.defaultMode === 'bonus_locked' ? 'المكتسبات الجديدة غير قابلة للسحب افتراضيًا.' : 'المكتسبات الجديدة قابلة للسحب افتراضيًا.'}</div>
                  <div className="owner-hint">{`عدد الاستثناءات الحالية: ${Number(rewardPayoutRules.overridesCount || 0)}`}</div>
                </div>
              </div>
            </div>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <label className="owner-checkbox">
                  <input
                    type="checkbox"
                    checked={balanceRules.principalWithdrawalRule?.enabled !== false}
                    onChange={(e) =>
                      setBalanceRules((prev) => {
                        const principalRule = prev.principalWithdrawalRule || createDefaultPrincipalWithdrawalRule()
                        return {
                          ...prev,
                          principalWithdrawalRule: {
                            enabled: e.target.checked,
                            withdrawableRatio: principalRule.withdrawableRatio,
                            clearProfitRestriction: principalRule.clearProfitRestriction,
                            applyToAllVipLevels: principalRule.applyToAllVipLevels,
                            ownerApprovalRequired: principalRule.ownerApprovalRequired,
                          },
                        }
                      })
                    }
                  />
                  <span>تفعيل قاعدة سحب أصل الإيداع من لوحة المالك</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  className="field-input"
                  placeholder="النسبة القابلة للسحب من أصل الإيداع %"
                  value={String(Math.round(Number(balanceRules.principalWithdrawalRule?.withdrawableRatio ?? 0.5) * 100))}
                  onChange={(e) =>
                    setBalanceRules((prev) => {
                      const principalRule = prev.principalWithdrawalRule || createDefaultPrincipalWithdrawalRule()
                      return {
                        ...prev,
                          principalWithdrawalRule: {
                            enabled: principalRule.enabled,
                            withdrawableRatio: Math.max(0, Math.min(1, Number(e.target.value || 0) / 100)),
                            clearProfitRestriction: principalRule.clearProfitRestriction,
                            applyToAllVipLevels: principalRule.applyToAllVipLevels,
                            ownerApprovalRequired: principalRule.ownerApprovalRequired,
                          },
                      }
                    })
                  }
                />
              </div>
              <div className="owner-form-row">
                <label className="owner-checkbox">
                  <input
                    type="checkbox"
                    checked={balanceRules.principalWithdrawalRule?.clearProfitRestriction !== false}
                    onChange={(e) =>
                      setBalanceRules((prev) => {
                        const principalRule = prev.principalWithdrawalRule || createDefaultPrincipalWithdrawalRule()
                        return {
                          ...prev,
                          principalWithdrawalRule: {
                            enabled: principalRule.enabled,
                            withdrawableRatio: principalRule.withdrawableRatio,
                            clearProfitRestriction: e.target.checked,
                            applyToAllVipLevels: principalRule.applyToAllVipLevels,
                            ownerApprovalRequired: principalRule.ownerApprovalRequired,
                          },
                        }
                      })
                    }
                  />
                  <span>فك جميع قيود الربح المطلوبة عن أصل الإيداع</span>
                </label>
                <label className="owner-checkbox">
                  <input
                    type="checkbox"
                    checked={balanceRules.principalWithdrawalRule?.ownerApprovalRequired === true}
                    onChange={(e) =>
                      setBalanceRules((prev) => {
                        const principalRule = prev.principalWithdrawalRule || createDefaultPrincipalWithdrawalRule()
                        return {
                          ...prev,
                          principalWithdrawalRule: {
                            enabled: principalRule.enabled,
                            withdrawableRatio: principalRule.withdrawableRatio,
                            clearProfitRestriction: principalRule.clearProfitRestriction,
                            applyToAllVipLevels: principalRule.applyToAllVipLevels,
                            ownerApprovalRequired: e.target.checked,
                          },
                        }
                      })
                    }
                  />
                  <span>إخضاع الجزء المحجوز من أصل الإيداع لمراجعة إدارة المخاطر</span>
                </label>
                <label className="owner-checkbox">
                  <input
                    type="checkbox"
                    checked={balanceRules.principalWithdrawalRule?.applyToAllVipLevels !== false}
                    onChange={(e) =>
                      setBalanceRules((prev) => {
                        const principalRule = prev.principalWithdrawalRule || createDefaultPrincipalWithdrawalRule()
                        return {
                          ...prev,
                          principalWithdrawalRule: {
                            enabled: principalRule.enabled,
                            withdrawableRatio: principalRule.withdrawableRatio,
                            clearProfitRestriction: principalRule.clearProfitRestriction,
                            applyToAllVipLevels: e.target.checked,
                            ownerApprovalRequired: principalRule.ownerApprovalRequired,
                          },
                        }
                      })
                    }
                  />
                  <span>توحيد هذه النسبة على جميع مستويات VIP</span>
                </label>
              </div>
              <label className="owner-checkbox">
                <input
                  type="checkbox"
                  checked={principalRuleResetOverrides}
                  onChange={(e) => setPrincipalRuleResetOverrides(e.target.checked)}
                />
                <span>طبّق القاعدة الآن على جميع المستخدمين الحاليين، وأزل أي استثناءات قديمة كانت تغيّر نسبة فك أصل الإيداع أو تعيد تقييده.</span>
              </label>
              <div className="owner-hint">{`الوضع الحالي: ${getPrincipalWithdrawPercent(balanceRules)}% من أصل الإيداع قابل للسحب.${balanceRules.principalWithdrawalRule?.ownerApprovalRequired === true ? ' الجزء المحجوز يبقى تحت مراجعة إدارة المخاطر حتى يتم فتحه إداريًا.' : balanceRules.principalWithdrawalRule?.clearProfitRestriction !== false ? ' لا يوجد شرط ربح إضافي لهذه القاعدة.' : ' ما زال شرط الربح مفعّلًا.'}`}</div>
              <div className="owner-hint">هذا الإعداد يخص أصل الإيداع نفسه في السحب، وليس قواعد أرباح الإحالات أو مكافآت الإيداع أو بقية المكتسبات.</div>
              <div className="owner-buttons">
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleSavePrincipalWithdrawalRule} disabled={balanceRulesSaving}>
                  {balanceRulesSaving ? '...' : 'حفظ وتطبيق قاعدة أصل الإيداع'}
                </button>
              </div>
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">المكتسبات والاستثناءات</h2>
            <p className="owner-hint">هذا الجزء يكمل سياسة السحب الموحدة: يحدد قابلية سحب الإحالات، والإيداع، والتعدين، والمهام، مع دعم الاستثناءات الفردية أو الجماعية عند الحاجة فقط.</p>
            <div className="owner-actions-card">
              <h3 className="owner-wallet-heading">القاعدة العامة</h3>
              <div className="owner-form-row">
                <select
                  className="field-input"
                  value={rewardPayoutRules.defaultMode}
                  onChange={(e) =>
                    setRewardPayoutRules((prev) => ({
                      ...prev,
                      defaultMode: e.target.value === 'bonus_locked' ? 'bonus_locked' : 'withdrawable',
                    }))
                  }
                >
                  {REWARD_PAYOUT_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="field-input"
                  placeholder="مدة التقييد العامة بالساعات"
                  value={rewardPayoutRules.defaultLockHours}
                  onChange={(e) =>
                    setRewardPayoutRules((prev) => ({
                      ...prev,
                      defaultLockHours: Math.max(0, Number(e.target.value || 0)),
                    }))
                  }
                />
                <div className="owner-actions-card">
                  <div className="owner-hint">
                    {rewardPayoutRules.defaultMode === 'bonus_locked'
                      ? 'القاعدة العامة الحالية: أي مكتسب جديد يبقى مقيدًا ما لم توجد قاعدة أكثر تخصيصًا.'
                      : 'القاعدة العامة الحالية: أي مكتسب جديد يدخل في الرصيد القابل للسحب ما لم توجد قاعدة أكثر تخصيصًا.'}
                  </div>
                  <div className="owner-hint">{`إجمالي الاستثناءات الحالية: ${Number(rewardPayoutRules.overridesCount || 0)}`}</div>
                </div>
              </div>
              <div className="owner-hint">{`الوضع المالي الحالي: ${getPrincipalWithdrawPercent(balanceRules)}% من أصل الإيداع قابل للسحب من خلال قاعدة السحب أعلاه، بينما أرباح الإحالات والإيداع تتبع إعدادات هذا القسم.`}</div>
              {REWARD_PAYOUT_SOURCE_OPTIONS.filter((source) => source.value !== 'all').map((source) => {
                const sourceKey = source.value as Exclude<RewardPayoutSource, 'all'>
                const currentMode = rewardPayoutRules.sourceModes[sourceKey] || rewardPayoutRules.defaultMode
                return (
                  <div key={source.value} className="owner-form-row">
                    <div className="owner-actions-card">
                      <strong>{source.label}</strong>
                      <div className="owner-hint">{source.description}</div>
                    </div>
                    <select
                      className="field-input"
                      value={currentMode}
                      onChange={(e) =>
                        setRewardPayoutRules((prev) => ({
                          ...prev,
                          sourceModes: {
                            ...prev.sourceModes,
                            [sourceKey]: e.target.value === 'bonus_locked' ? 'bonus_locked' : 'withdrawable',
                          },
                        }))
                      }
	                    >
	                      {REWARD_PAYOUT_MODE_OPTIONS.map((option) => (
	                        <option key={option.value} value={option.value}>{option.label}</option>
	                      ))}
	                    </select>
	                    <input
	                      type="number"
	                      min="0"
	                      step="1"
	                      className="field-input"
	                      placeholder="مدة التقييد بالساعات"
	                      value={rewardPayoutRules.sourceLockHours[sourceKey] ?? rewardPayoutRules.defaultLockHours}
	                      onChange={(e) =>
	                        setRewardPayoutRules((prev) => ({
	                          ...prev,
	                          sourceLockHours: {
	                            ...prev.sourceLockHours,
	                            [sourceKey]: Math.max(0, Number(e.target.value || 0)),
	                          },
	                        }))
	                      }
	                    />
	                  </div>
                )
              })}
              <label className="owner-checkbox">
                <input
                  type="checkbox"
                  checked={rewardPayoutApplyPendingGlobal}
                  onChange={(e) => setRewardPayoutApplyPendingGlobal(e.target.checked)}
                />
                <span>طبّق القواعد الحالية أيضًا على الأرباح المعلقة الحالية. إذا كانت هناك مدة تقييد فسيتم تمديد القفل من وقت فك القفل الحالي أو من الآن.</span>
              </label>
              <div className="owner-buttons">
                <button type="button" className="wallet-action-btn owner-set-btn" onClick={handleApplyHalfAssetsReferralPreset} disabled={rewardPayoutSaving}>
                  {rewardPayoutSaving ? '...' : 'تطبيق 50% للأصول + فتح الإحالات والإيداع'}
                </button>
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleSaveRewardPayoutConfig} disabled={rewardPayoutSaving}>
                  {rewardPayoutSaving ? '...' : 'حفظ القواعد العامة'}
                </button>
              </div>
            </div>

            <div className="owner-actions-card">
              <h3 className="owner-wallet-heading">استثناء فردي أو جماعي</h3>
              <p className="owner-hint">أدخل رقم مستخدم واحد أو عدة أرقام مفصولة بفواصل أو أسطر، ثم اختر المصدر ونوع السحب. هذه القاعدة تتغلب على الإعداد العام لذلك المستخدم.</p>
              <textarea
                className="field-input"
                rows={3}
                placeholder={'أرقام المستخدمين: 12, 18, 55'}
                value={rewardPayoutOverrideDraft.userIdsText}
                onChange={(e) => setRewardPayoutOverrideDraft((prev) => ({ ...prev, userIdsText: e.target.value }))}
              />
              <div className="owner-form-row">
                <select
                  className="field-input"
                  value={rewardPayoutOverrideDraft.sourceType}
                  onChange={(e) =>
                    setRewardPayoutOverrideDraft((prev) => ({
                      ...prev,
                      sourceType: e.target.value as RewardPayoutSource,
                    }))
                  }
                >
                  {REWARD_PAYOUT_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select
                  className="field-input"
                  value={rewardPayoutOverrideDraft.payoutMode}
                  onChange={(e) =>
                    setRewardPayoutOverrideDraft((prev) => ({
                      ...prev,
                      payoutMode: e.target.value === 'bonus_locked' ? 'bonus_locked' : 'withdrawable',
                    }))
                  }
                >
                  {REWARD_PAYOUT_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="field-input"
                  placeholder="مدة التقييد بالساعات"
                  value={rewardPayoutOverrideDraft.lockHours}
                  onChange={(e) =>
                    setRewardPayoutOverrideDraft((prev) => ({
                      ...prev,
                      lockHours: e.target.value,
                    }))
                  }
                />
              </div>
              <textarea
                className="field-input"
                rows={2}
                placeholder="ملاحظة داخلية عن سبب الاستثناء"
                value={rewardPayoutOverrideDraft.note}
                onChange={(e) => setRewardPayoutOverrideDraft((prev) => ({ ...prev, note: e.target.value }))}
              />
              <label className="owner-checkbox">
                <input
                  type="checkbox"
                  checked={rewardPayoutOverrideDraft.applyPending}
                  onChange={(e) =>
                    setRewardPayoutOverrideDraft((prev) => ({
                      ...prev,
                      applyPending: e.target.checked,
                    }))
                  }
                />
                <span>إذا أصبحت القاعدة قابلة للسحب، حرر أيضًا الأرباح المعلقة السابقة لنفس المصدر.</span>
              </label>
              <div className="owner-buttons">
                <button type="button" className="wallet-action-btn owner-set-btn" onClick={handleSaveRewardPayoutOverride} disabled={rewardPayoutSaving}>
                  {rewardPayoutSaving ? '...' : 'حفظ الاستثناء'}
                </button>
              </div>
            </div>

            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">الاستثناءات الحالية</h3>
              {rewardPayoutRules.overrides.length === 0 ? (
                <p className="owner-empty">لا توجد استثناءات فردية أو جماعية محفوظة حاليًا.</p>
              ) : (
                <ul className="owner-history-list">
                  {rewardPayoutRules.overrides.map((item) => {
                    const sourceLabel = REWARD_PAYOUT_SOURCE_OPTIONS.find((option) => option.value === item.sourceType)?.label || item.sourceType
                    const payoutLabel = REWARD_PAYOUT_MODE_OPTIONS.find((option) => option.value === item.payoutMode)?.label || item.payoutMode
                    const lockLabel =
                      item.lockHours == null
                        ? 'المُدة: حسب القاعدة العامة'
                        : Number(item.lockHours || 0) > 0
                          ? `المدة: ${Number(item.lockHours || 0)} ساعة`
                          : 'المدة: بدون تقييد زمني'
                    const userLabel = item.user.displayName || item.user.email || item.user.phone || `#${item.userId}`
                    return (
                      <li key={item.overrideKey} className="owner-history-item">
                        <div className="owner-history-main">
                          <strong>{`${userLabel} | ${sourceLabel}`}</strong>
                          <small>{lockLabel}</small>
                          <small>{`الوضع: ${payoutLabel} | النوع: ${item.legacy ? 'قديم' : 'مخصص'} | آخر تحديث: ${item.updatedAt || '-'}`}</small>
                          <small>{`أرباح معلقة مرتبطة بهذه القاعدة: ${Number(item.pendingAmount || 0).toFixed(2)} USDT عبر ${Number(item.pendingCount || 0)} سجل`}</small>
                          {item.note ? <small>{`ملاحظة: ${item.note}`}</small> : null}
                        </div>
                        <div className="owner-history-actions">
                          <button
                            type="button"
                            className="wallet-action-btn owner-set-btn"
                            onClick={() => handleDeleteRewardPayoutOverride(item.overrideKey)}
                            disabled={rewardPayoutDeleteKey === item.overrideKey}
                          >
                            {rewardPayoutDeleteKey === item.overrideKey ? '...' : 'حذف'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">إدارة مستويات VIP</h2>
            <p className="owner-hint">تحكم مباشر بمستويات VIP الفعالة: الحد الأدنى، نسبة الإحالة، المضاعف، والمزايا النصية. إعدادات السحب داخل هذا القسم أصبحت مرجعية للعرض فقط، بينما مصدر القرار الفعلي موجود في سياسة السحب الموحدة أعلاه.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <select className="field-input" value={vipTierDraft.level} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, level: Number(e.target.value || 1) }))}>
                  {[1, 2, 3, 4, 5].map((level) => <option key={level} value={level}>{`VIP ${level}`}</option>)}
                </select>
                <input className="field-input" placeholder="اسم المستوى" value={vipTierDraft.title} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, title: e.target.value }))} />
                <input type="number" className="field-input" placeholder="الحد الأدنى للإيداع" value={vipTierDraft.minDeposit} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, minDeposit: e.target.value }))} />
              </div>
              <div className="owner-form-row">
                <input type="number" className="field-input" placeholder="حجم الفريق/التداول" value={vipTierDraft.minTradeVolume} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, minTradeVolume: e.target.value }))} />
                <input type="number" className="field-input" placeholder="مضاعف الإحالة" value={vipTierDraft.referralMultiplier} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, referralMultiplier: e.target.value }))} />
                <input type="number" className="field-input" placeholder="نسبة الإحالة %" value={vipTierDraft.referralPercent} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, referralPercent: e.target.value }))} />
              </div>
              <div className="owner-form-row">
                <input type="number" className="field-input" placeholder="عائد التعدين اليومي %" value={vipTierDraft.dailyMiningPercent} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, dailyMiningPercent: e.target.value }))} />
                <input type="number" className="field-input" placeholder="سرعة التعدين %" value={vipTierDraft.miningSpeedPercent} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, miningSpeedPercent: e.target.value }))} />
                <input type="number" className="field-input" placeholder="الحد اليومي للسحب" value={vipTierDraft.dailyWithdrawalLimit} disabled readOnly />
              </div>
              <div className="owner-form-row">
                <input type="number" className="field-input" placeholder="أدنى مدة معالجة بالساعات" value={vipTierDraft.processingHoursMin} disabled readOnly />
                <input type="number" className="field-input" placeholder="أعلى مدة معالجة بالساعات" value={vipTierDraft.processingHoursMax} disabled readOnly />
                <input type="number" className="field-input" placeholder="رسوم السحب %" value={vipTierDraft.withdrawalFeePercent} disabled readOnly />
              </div>
              <div className="owner-hint">لمنع التعارض، أي تعديل على حد السحب أو الرسوم أو أوقات المعالجة يتم من سياسة السحب الموحدة فقط، وليس من نموذج VIP.</div>
              <div className="owner-form-row">
                <input type="number" className="field-input" placeholder="رسوم إضافية عند نشاط التعدين/الصفقات %" value={vipTierDraft.activeExtraFeePercent} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, activeExtraFeePercent: e.target.value }))} />
                <input type="number" className="field-input" placeholder="عمولة المستوى الثاني %" value={vipTierDraft.level2ReferralPercent} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, level2ReferralPercent: e.target.value }))} />
                <input type="number" className="field-input" placeholder="عمولة المستوى الثالث %" value={vipTierDraft.level3ReferralPercent} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, level3ReferralPercent: e.target.value }))} />
              </div>
              <div className="owner-form-row">
                <input type="number" className="field-input" placeholder="مضاعف الأرباح" value={vipTierDraft.profitMultiplier} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, profitMultiplier: e.target.value }))} />
                <label className="owner-checkbox">
                  <input type="checkbox" checked={vipTierDraft.autoReinvest} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, autoReinvest: e.target.checked }))} />
                  <span>إعادة استثمار تلقائي</span>
                </label>
                <label className="owner-checkbox">
                  <input type="checkbox" checked={vipTierDraft.dailyBonus} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, dailyBonus: e.target.checked }))} />
                  <span>بونص يومي</span>
                </label>
              </div>
              <textarea className="field-input" rows={4} placeholder="مزايا المستوى، كل سطر ميزة مستقلة" value={vipTierDraft.perks} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, perks: e.target.value }))} />
              <label className="owner-checkbox">
                <input type="checkbox" checked={vipTierDraft.isActive} onChange={(e) => setVipTierDraft((prev) => ({ ...prev, isActive: e.target.checked }))} />
                <span>المستوى فعال</span>
              </label>
              <div className="owner-buttons">
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleSaveVipTier} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'حفظ مستوى VIP'}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              {vipTiers.length === 0 ? (
                <p className="owner-empty">لا توجد مستويات VIP محملة حاليًا.</p>
              ) : (
                <ul className="owner-history-list">
                  {vipTiers.map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>{`VIP ${item.level} - ${item.title}`}</strong>
                        <small>{`من ${Number(item.min_deposit || 0).toFixed(2)}$ | إحالة ${Number(item.referral_percent || 0).toFixed(2)}% | تعدين ${Number(item.daily_mining_percent || 0).toFixed(2)}%`}</small>
                        <small>{`حد السحب ${Number(item.daily_withdrawal_limit || 0).toFixed(2)} | رسوم ${Number(item.withdrawal_fee_percent || 0).toFixed(2)}% | L2 ${Number(item.level2_referral_percent || 0).toFixed(2)}% | L3 ${Number(item.level3_referral_percent || 0).toFixed(2)}%`}</small>
                        <small>{Array.isArray(item.perks) ? item.perks.join(' | ') : ''}</small>
                      </div>
                      <div className="owner-history-actions">
                        <button
                          type="button"
                          className="wallet-action-btn owner-set-btn"
                          onClick={() =>
                            setVipTierDraft({
                              level: item.level,
                              title: item.title,
                              minDeposit: String(item.min_deposit || 0),
                              minTradeVolume: String(item.min_trade_volume || 0),
                              referralMultiplier: String(item.referral_multiplier || 1),
                              referralPercent: String(item.referral_percent || 0),
                              dailyMiningPercent: String(item.daily_mining_percent || 0),
                              miningSpeedPercent: String(item.mining_speed_percent || 0),
                              dailyWithdrawalLimit: String(item.daily_withdrawal_limit || 0),
                              processingHoursMin: String(item.processing_hours_min || 0),
                              processingHoursMax: String(item.processing_hours_max || 0),
                              withdrawalFeePercent: String(item.withdrawal_fee_percent || 0),
                              activeExtraFeePercent: String(item.active_extra_fee_percent || 0),
                              level2ReferralPercent: String(item.level2_referral_percent || 0),
                              level3ReferralPercent: String(item.level3_referral_percent || 0),
                              profitMultiplier: String(item.profit_multiplier || 1),
                              autoReinvest: Number(item.auto_reinvest || 0) === 1,
                              dailyBonus: Number(item.daily_bonus || 0) === 1,
                              perks: Array.isArray(item.perks) ? item.perks.join('\n') : '',
                              isActive: Number(item.is_active || 0) === 1,
                            })
                          }
                        >
                          تعديل
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">إدارة الشركاء والإحالات</h2>
            <p className="owner-hint">هذه اللوحة تربط الشريك مباشرة بملفه، ونسبة العمولة، والحالة، وتسمح بعرض تفاصيل الإحالات لمستخدم محدد.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input className="field-input" inputMode="numeric" placeholder="رقم المستخدم" value={partnerDraft.userId} onChange={(e) => setPartnerDraft((prev) => ({ ...prev, userId: e.target.value }))} />
                <input type="number" className="field-input" placeholder="نسبة العمولة %" value={partnerDraft.commissionRate} onChange={(e) => setPartnerDraft((prev) => ({ ...prev, commissionRate: e.target.value }))} />
                <select className="field-input" value={partnerDraft.status} onChange={(e) => setPartnerDraft((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="active">نشط</option>
                  <option value="inactive">معطل</option>
                  <option value="paused">موقوف</option>
                </select>
              </div>
              <input className="field-input" placeholder="ملاحظات الشريك" value={partnerDraft.notes} onChange={(e) => setPartnerDraft((prev) => ({ ...prev, notes: e.target.value }))} />
              <div className="owner-buttons">
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleSavePartnerProfile} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'حفظ الشريك'}
                </button>
              </div>
            </div>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input className="field-input" inputMode="numeric" placeholder="رقم المستخدم لعرض تفاصيل الإحالات" value={referralDetailUserId} onChange={(e) => setReferralDetailUserId(e.target.value)} />
                <button type="button" className="wallet-action-btn owner-set-btn" onClick={handleLoadReferralDetails} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'عرض التفاصيل'}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">الشركاء الحاليون</h3>
              {partnerProfiles.length === 0 ? <p className="owner-empty">لا توجد ملفات شركاء حتى الآن.</p> : (
                <ul className="owner-history-list">
                  {partnerProfiles.map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>{item.display_name || item.email || item.phone || `المستخدم #${item.user_id}`}</strong>
                        <small>{`العمولة ${Number(item.commission_rate || 0).toFixed(2)}% | الحالة: ${item.status} | الإحالات: ${Number(item.referrals_count || 0)}`}</small>
                        <small>{item.notes || 'بدون ملاحظات'}</small>
                      </div>
                      <div className="owner-history-actions">
                        <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => setPartnerDraft({ userId: String(item.user_id), commissionRate: String(item.commission_rate || 0), status: item.status || 'active', notes: item.notes || '' })}>
                          تعديل
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">ملخص الإحالات</h3>
              {referralSummary.length === 0 ? <p className="owner-empty">لا يوجد ملخص إحالات متاح حاليًا.</p> : (
                <ul className="owner-history-list">
                  {referralSummary.slice(0, 8).map((item, index) => (
                    <li key={index} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>{String(item.display_name || item.referral_code || `المستخدم #${item.user_id || index}`)}</strong>
                        <small>{`إجمالي الإحالات: ${Number(item.total_referrals || 0)} | النشطة: ${Number(item.active_count || 0)} | القيمة: ${Number(item.rewards_value || 0).toFixed(2)} USDT`}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {referralDetails.length > 0 ? (
                <>
                  <div className="owner-section-divider" />
                  <h3 className="owner-wallet-heading">تفاصيل إحالات المستخدم المحدد</h3>
                  <ul className="owner-history-list">
                    {referralDetails.slice(0, 12).map((item, index) => (
                      <li key={index} className="owner-history-item">
                        <div className="owner-history-main">
                          <strong>{String(item.display_name || item.email || item.phone || `إحالة #${index + 1}`)}</strong>
                          <small>{`الحالة: ${String(item.status || 'unknown')} | أول إيداع: ${Number(item.first_deposit_amount || 0).toFixed(2)} | المكافأة: ${Number(item.reward_amount || 0).toFixed(2)}`}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">الحملات والمحتوى</h2>
            <p className="owner-hint">لوحة حية للحملات والإشعارات والبنرات والنشرات، مرتبطة مباشرة بمسار المحتوى الفعال في النظام.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <select className="field-input" value={contentDraft.campaignType} onChange={(e) => setContentDraft((prev) => ({ ...prev, campaignType: e.target.value as 'notification' | 'popup' | 'banner' | 'news' }))}>
                  <option value="notification">إشعار</option>
                  <option value="popup">نافذة منبثقة</option>
                  <option value="banner">بانر</option>
                  <option value="news">خبر</option>
                </select>
                <input className="field-input" placeholder="عنوان الحملة" value={contentDraft.title} onChange={(e) => setContentDraft((prev) => ({ ...prev, title: e.target.value }))} />
                <select className="field-input" value={contentDraft.language} onChange={(e) => setContentDraft((prev) => ({ ...prev, language: e.target.value }))}>
                  <option value="all">كل اللغات</option>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                  <option value="tr">Türkçe</option>
                </select>
              </div>
              <textarea className="field-input" rows={4} placeholder="محتوى الحملة أو الإشعار" value={contentDraft.body} onChange={(e) => setContentDraft((prev) => ({ ...prev, body: e.target.value }))} />
              <div className="owner-form-row">
                <input type="number" className="field-input" placeholder="أقل مستوى VIP" value={contentDraft.minVipLevel} onChange={(e) => setContentDraft((prev) => ({ ...prev, minVipLevel: e.target.value }))} />
                <label className="owner-checkbox"><input type="checkbox" checked={contentDraft.vipOnly} onChange={(e) => setContentDraft((prev) => ({ ...prev, vipOnly: e.target.checked }))} /><span>أعضاء VIP فقط</span></label>
                <label className="owner-checkbox"><input type="checkbox" checked={contentDraft.depositorsOnly} onChange={(e) => setContentDraft((prev) => ({ ...prev, depositorsOnly: e.target.checked }))} /><span>المودعون فقط</span></label>
                <label className="owner-checkbox"><input type="checkbox" checked={contentDraft.nonDepositorsOnly} onChange={(e) => setContentDraft((prev) => ({ ...prev, nonDepositorsOnly: e.target.checked }))} /><span>غير المودعين فقط</span></label>
              </div>
              <label className="owner-checkbox"><input type="checkbox" checked={contentDraft.isActive} onChange={(e) => setContentDraft((prev) => ({ ...prev, isActive: e.target.checked }))} /><span>الحملة فعالة</span></label>
              <div className="owner-buttons">
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleCreateContentCampaign} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'إرسال/حفظ الحملة'}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              {contentCampaigns.length === 0 ? <p className="owner-empty">لا توجد حملات محفوظة حتى الآن.</p> : (
                <ul className="owner-history-list">
                  {contentCampaigns.map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>{item.title}</strong>
                        <small>{`${item.campaign_type} | ${Number(item.is_active || 0) === 1 ? 'فعال' : 'معطل'}`}</small>
                        <small>{item.body || 'بدون نص إضافي'}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">الأمن والجلسات</h2>
            <p className="owner-hint">لوحة الصلاحيات الأمنية الفعالة: الجلسات، النشاط غير المعتاد، وسجلات المتابعة.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input className="field-input" inputMode="numeric" placeholder="رقم مستخدم لتحميل جلساته" value={securityUserId} onChange={(e) => setSecurityUserId(e.target.value)} />
                <button type="button" className="wallet-action-btn owner-set-btn" onClick={handleRefreshSecuritySessions} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'تحميل الجلسات'}
                </button>
                <button type="button" className="wallet-action-btn wallet-action-withdraw" onClick={handleDetectUnusualActivity} disabled={securityActionLoading !== null}>
                  {securityActionLoading === 'detect' ? '...' : 'فحص النشاط غير المعتاد'}
                </button>
              </div>
              <div className="owner-hint">{`IP مشبوهة: ${securityOverview?.suspiciousIps?.length || 0} | أجهزة متعددة: ${securityOverview?.multiDeviceUsers?.length || 0} | Proxy/VPN: ${securityOverview?.proxyAlerts?.length || 0} | تنبيهات غير معتادة: ${securityOverview?.unusualActivity?.length || 0}`}</div>
            </div>
            <div className="owner-history-card">
              {securitySessions.length === 0 ? <p className="owner-empty">لا توجد جلسات محملة حاليًا.</p> : (
                <ul className="owner-history-list">
                  {securitySessions.slice(0, 20).map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>{`المستخدم #${item.user_id} - ${item.is_active ? 'نشط' : 'مغلق'}`}</strong>
                        <small>{`${item.ip_address || '-'} | ${item.created_at}`}</small>
                        <small>{item.user_agent || 'بدون وكيل مستخدم'}</small>
                      </div>
                      <div className="owner-history-actions">
                        <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => handleRevokeSessions(item.user_id)} disabled={securityActionLoading !== null}>
                          {securityActionLoading === item.user_id ? '...' : 'إلغاء كل الجلسات'}
                        </button>
                        <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => handleToggleTwoFactorAction(item.user_id, true, true)} disabled={securityActionLoading !== null}>
                          تفعيل 2FA
                        </button>
                        <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => handleToggleTwoFactorAction(item.user_id, false, false)} disabled={securityActionLoading !== null}>
                          تعطيل 2FA
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">إدارة الطاقم والصلاحيات</h2>
            <p className="owner-hint">لوحة إنشاء الطاقم، تعديل دوره، الوصول الحساس، واستبدال الصلاحيات الفعلية الموجودة بالنظام.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input className="field-input" placeholder="البريد أو الهاتف" value={staffDraft.identifier} onChange={(e) => setStaffDraft((prev) => ({ ...prev, identifier: e.target.value }))} />
                <input className="field-input" placeholder="اسم العرض" value={staffDraft.displayName} onChange={(e) => setStaffDraft((prev) => ({ ...prev, displayName: e.target.value }))} />
                <input className="field-input" placeholder="كلمة المرور" value={staffDraft.password} onChange={(e) => setStaffDraft((prev) => ({ ...prev, password: e.target.value }))} />
              </div>
              <div className="owner-form-row">
                <select className="field-input" value={staffDraft.adminRole} onChange={(e) => setStaffDraft((prev) => ({ ...prev, adminRole: e.target.value as 'super_admin' | 'admin' | 'finance' | 'support' | 'moderator' }))}>
                  <option value="support">Support</option>
                  <option value="finance">Finance</option>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <select className="field-input" value={staffDraft.accessPreset} onChange={(e) => setStaffDraft((prev) => ({ ...prev, accessPreset: e.target.value as 'read_only' | 'finance' | 'kyc' | 'trading' | 'marketing' | 'support' | 'full_admin' }))}>
                  <option value="read_only">Read only</option>
                  <option value="support">Support</option>
                  <option value="finance">Finance</option>
                  <option value="kyc">KYC</option>
                  <option value="trading">Trading</option>
                  <option value="marketing">Marketing</option>
                  <option value="full_admin">Full admin</option>
                </select>
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleCreateStaffMember} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'إنشاء عضو طاقم'}
                </button>
              </div>
            </div>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input className="field-input" inputMode="numeric" placeholder="رقم عضو الطاقم" value={selectedStaffUserId} onChange={(e) => setSelectedStaffUserId(e.target.value)} />
                <button type="button" className="wallet-action-btn owner-set-btn" onClick={handleLoadStaffPermissions} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'تحميل صلاحياته'}
                </button>
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleSaveStaffPermissions} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'حفظ الصلاحيات'}
                </button>
              </div>
              <div className="owner-history-list">
                {availablePermissions.map((permission) => (
                  <label key={permission} className="owner-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedStaffPermissions.includes(permission)}
                      onChange={(e) =>
                        setSelectedStaffPermissions((prev) =>
                          e.target.checked ? [...prev, permission] : prev.filter((item) => item !== permission),
                        )
                      }
                    />
                    <span>{permission}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="owner-actions-card">
              <div className="owner-hint">
                يتم خصم نسبة الشراء من إجمالي الأصول بعد استثناء الجزء المقيد، ويعود أصل مبلغ الصفقة كاملًا للمستخدم عند انتهاء المدة.
              </div>
              <div className="owner-form-row">
                <input
                  className="field-input"
                  inputMode="numeric"
                  placeholder="رقم مستخدم محدد"
                  value={staffHealthUserId}
                  onChange={(e) => setStaffHealthUserId(e.target.value)}
                />
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={() => handleRunStaffAccountHealthScan('single')}
                  disabled={staffHealthLoading}
                >
                  {staffHealthLoading && staffHealthUserId ? 'جارٍ فحص المستخدم...' : 'فحص مستخدم محدد'}
                </button>
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={() => handleRunStaffAccountHealthScan('all')} disabled={staffHealthLoading}>
                  {staffHealthLoading ? 'جارٍ فحص كل الحسابات...' : 'فحص كل الحسابات'}
                </button>
                <span className="owner-hint">
                  {staffHealthScan ? `آخر فحص: ${formatOwnerDateTime(staffHealthScan.summary.scanned_at)}` : 'يفحص القيود والتعليق والجلسات ومخالفات المحفظة والصلاحيات.'}
                </span>
              </div>
              {staffHealthScan ? (
                <>
                  <div className="owner-hero-grid">
                    {[
                      { label: 'الحسابات المفحوصة', value: String(Number(staffHealthScan.summary.scanned_users || 0)), tone: 'neutral' },
                      { label: 'الحسابات المقيّدة', value: String(Number(staffHealthScan.summary.restricted_users || 0)), tone: Number(staffHealthScan.summary.restricted_users || 0) > 0 ? 'warning' : 'success' },
                      { label: 'مشاكل الجلسات', value: String(Number(staffHealthScan.summary.active_blocked_session_issues || 0)), tone: Number(staffHealthScan.summary.active_blocked_session_issues || 0) > 0 ? 'danger' : 'success' },
                      { label: 'مشاكل الصلاحيات', value: String(Number(staffHealthScan.summary.staff_permission_issues || 0)), tone: Number(staffHealthScan.summary.staff_permission_issues || 0) > 0 ? 'warning' : 'success' },
                      { label: 'مشاكل المحفظة', value: String(Number(staffHealthScan.summary.wallet_integrity_issues || 0) + Number(staffHealthScan.summary.linkage_issues || 0) + Number(staffHealthScan.summary.earning_transfer_issues || 0) + Number(staffHealthScan.summary.zero_balance_issues || 0)), tone: Number(staffHealthScan.summary.wallet_integrity_issues || 0) + Number(staffHealthScan.summary.linkage_issues || 0) + Number(staffHealthScan.summary.earning_transfer_issues || 0) + Number(staffHealthScan.summary.zero_balance_issues || 0) > 0 ? 'danger' : 'success' },
                      { label: 'إجمالي المشاكل', value: String(Number(staffHealthScan.summary.issues_total || 0)), tone: Number(staffHealthScan.summary.issues_total || 0) > 0 ? 'danger' : 'success' },
                    ].map((item) => (
                      <div key={item.label} className={`owner-stat-card owner-stat-card-${item.tone}`}>
                        <span className="owner-stat-label">{item.label}</span>
                        <strong className="owner-stat-value">{item.value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="owner-history-card">
                    <h3 className="owner-wallet-heading">الحسابات المقيّدة أو المعلّقة</h3>
                    {staffHealthScan.restricted_accounts.length === 0 ? (
                      <p className="owner-empty">لا توجد حسابات مقيّدة أو معلّقة في آخر فحص.</p>
                    ) : (
                      <ul className="owner-history-list">
                        {staffHealthScan.restricted_accounts.map((item) => (
                          <li key={`restricted-${item.user_id}`} className="owner-history-item">
                            <div className="owner-history-main">
                              <strong>{item.display_name || item.email || item.phone || `المستخدم #${item.user_id}`}</strong>
                              <small>{item.states.join(' | ') || 'قيد غير محدد'}</small>
                            </div>
                            <div className="owner-history-meta">
                              {item.banned_until ? <small>{`حتى ${formatOwnerDateTime(item.banned_until)}`}</small> : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="owner-history-card">
                    <h3 className="owner-wallet-heading">المشاكل المكتشفة</h3>
                    {staffHealthScan.issues.length === 0 ? (
                      <p className="owner-empty">لم يتم رصد أخطاء تشغيلية أو تعارضات في آخر فحص.</p>
                    ) : (
                      <ul className="owner-history-list">
                        {staffHealthScan.issues.map((item, index) => (
                          <li key={`${item.kind}-${item.user_id || 'global'}-${index}`} className="owner-history-item">
                            <div className="owner-history-main">
                              <strong>{item.title}</strong>
                              <small>{item.details}</small>
                            </div>
                            <div className="owner-history-meta">
                              <small>{`${item.severity === 'error' ? 'خطأ' : 'تنبيه'}${item.user_id ? ` | المستخدم #${item.user_id}` : ''}`}</small>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            <div className="owner-history-card">
              {staffItems.length === 0 ? <p className="owner-empty">لا يوجد طاقم إداري محمل حاليًا.</p> : (
                <ul className="owner-history-list">
                  {staffItems.map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>{item.display_name || item.email || item.phone || `المستخدم #${item.id}`}</strong>
                        <small>{`${item.admin_role} | ${Number(item.permissions_count || 0)} صلاحية | ${Number(item.can_view_sensitive || 0) === 1 ? 'وصول حساس' : 'وصول عادي'}`}</small>
                      </div>
                      <div className="owner-history-actions">
                        <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => handleUpdateStaffRoleAction(item.id, item.admin_role, Number(item.is_active || 0) !== 1)} disabled={ownerExtraSaving}>
                          {Number(item.is_active || 0) === 1 ? 'تعطيل العضو' : 'تفعيل العضو'}
                        </button>
                        <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => handleToggleSensitiveAccess(item.id, Number(item.can_view_sensitive || 0) !== 1)} disabled={ownerExtraSaving}>
                          {Number(item.can_view_sensitive || 0) === 1 ? 'إلغاء الوصول الحساس' : 'تفعيل الوصول الحساس'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">قائمة مراقبة KYC</h2>
            <p className="owner-hint">لوحة الصلاحية الفعالة الخاصة بقائمة المراقبة الأمنية/التحقيقية.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input className="field-input" inputMode="numeric" placeholder="رقم المستخدم - اختياري" value={watchlistDraft.userId} onChange={(e) => setWatchlistDraft((prev) => ({ ...prev, userId: e.target.value }))} />
                <input className="field-input" placeholder="المصدر" value={watchlistDraft.source} onChange={(e) => setWatchlistDraft((prev) => ({ ...prev, source: e.target.value }))} />
              </div>
              <textarea className="field-input" rows={3} placeholder="ملاحظة عنصر المراقبة" value={watchlistDraft.note} onChange={(e) => setWatchlistDraft((prev) => ({ ...prev, note: e.target.value }))} />
              <div className="owner-buttons">
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleAddWatchlistItem} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'إضافة إلى القائمة'}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              {watchlist.length === 0 ? <p className="owner-empty">لا توجد عناصر مراقبة حاليًا.</p> : (
                <ul className="owner-history-list">
                  {watchlist.map((item) => (
                    <li key={item.id} className="owner-history-item">
                      <div className="owner-history-main">
                        <strong>{item.user_id ? `المستخدم #${item.user_id}` : `عنصر #${item.id}`}</strong>
                        <small>{`${item.source || 'بدون مصدر'} | ${Number(item.is_active || 0) === 1 ? 'فعال' : 'معطل'}`}</small>
                        <small>{item.note}</small>
                      </div>
                      <div className="owner-history-actions">
                        <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => handleToggleWatchlist(item)} disabled={ownerExtraSaving}>
                          {Number(item.is_active || 0) === 1 ? 'تعطيل' : 'تفعيل'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">التقرير الشهري للتعدين والإيداعات</h2>
            <p className="owner-hint">يعرض هذا التقرير اشتراكات التعدين الأصلية فقط بشكل منفصل عن الإيداعات العامة.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input type="month" className="field-input" value={monthlyFinanceMonth} onChange={(e) => setMonthlyFinanceMonth(e.target.value)} />
                <button type="button" className="wallet-action-btn owner-set-btn" onClick={handleLoadMonthlyFinanceReport} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'تحميل التقرير'}
                </button>
                <button type="button" className="wallet-action-btn owner-set-btn" onClick={refreshAdvancedOwnerPanels} disabled={ownerExtraSaving}>
                  {ownerExtraSaving ? '...' : 'تحديث كل اللوحات'}
                </button>
              </div>
              {monthlyFinance ? (
                <>
                  <div className="owner-hint">{`شهر التقرير: ${monthlyFinance.month}`}</div>
                  <div className="owner-hint">{`اشتراكات التعدين الأصلية: ${monthlyFinance.mining.totalOriginalSubscriptions.toFixed(2)} USDT | المشتركون: ${monthlyFinance.mining.subscriberCount}`}</div>
                  <div className="owner-hint">{`الإيداعات العامة: ${monthlyFinance.deposits.totalDeposits.toFixed(2)} USDT | المودعون: ${monthlyFinance.deposits.depositorCount}`}</div>
                  <div className="owner-section-divider" />
                  <h3 className="owner-wallet-heading">أعلى مشتركين تعدين</h3>
                  <ul className="owner-history-list">
                    {monthlyFinance.mining.items.slice(0, 8).map((item) => (
                      <li key={`${item.user_id}-${item.last_subscription_at || 'm'}`} className="owner-history-item">
                        <div className="owner-history-main">
                          <strong>{item.display_name || item.email || item.phone || `المستخدم #${item.user_id}`}</strong>
                          <small>{`${Number(item.original_subscription_total || 0).toFixed(2)} USDT | عدد الاشتراكات: ${Number(item.subscription_count || 0)}`}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="owner-empty">لا يوجد تقرير شهري محمل حاليًا.</p>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">الأرباح القابلة وغير القابلة للسحب</h2>
            <p className="owner-hint">حمّل حساب مستخدم واحدًا لترى الأرباح المرحّلة إلى المحفظة، والأرباح غير المرحّلة بعد، والمبلغ القابل للسحب الآن، والمبلغ المقيد بسبب أصل الإيداع.</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input
                  className="field-input"
                  inputMode="numeric"
                  placeholder="رقم المستخدم"
                  value={profitPanelUserId}
                  onChange={(e) => setProfitPanelUserId(e.target.value)}
                />
                <input
                  className="field-input"
                  placeholder="العملة"
                  value={profitPanelCurrency}
                  onChange={(e) => setProfitPanelCurrency(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleLoadProfitPanel}
                  disabled={profitPanelLoading || profitPanelSaving}
                >
                  {profitPanelLoading ? '...' : 'تحميل لوحة الأرباح'}
                </button>
              </div>
              <div className="owner-form-row">
                <label className="owner-checkbox">
                  <input
                    type="checkbox"
                    checked={profitOverrideDraft.forceUnlockPrincipal}
                    onChange={(e) =>
                      setProfitOverrideDraft((prev) => ({ ...prev, forceUnlockPrincipal: e.target.checked }))
                    }
                  />
                  <span>فك قيد أصل الإيداع يدويًا</span>
                </label>
                <input
                  className="field-input"
                  placeholder="نسبة فك القيد المخصصة"
                  value={profitOverrideDraft.customUnlockRatio}
                  onChange={(e) => setProfitOverrideDraft((prev) => ({ ...prev, customUnlockRatio: e.target.value }))}
                />
                <input
                  className="field-input"
                  placeholder="الربح الأدنى المخصص"
                  value={profitOverrideDraft.customMinProfit}
                  onChange={(e) => setProfitOverrideDraft((prev) => ({ ...prev, customMinProfit: e.target.value }))}
                />
              </div>
              <textarea
                className="field-input"
                rows={2}
                placeholder="ملاحظة الاستثناء أو سبب تعديل القيد"
                value={profitOverrideDraft.note}
                onChange={(e) => setProfitOverrideDraft((prev) => ({ ...prev, note: e.target.value }))}
              />
              <div className="owner-buttons">
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-deposit"
                  onClick={handleSaveProfitOverride}
                  disabled={profitPanelLoading || profitPanelSaving}
                >
                  {profitPanelSaving ? '...' : 'حفظ إعدادات القيد'}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              {!profitSnapshot ? (
                <p className="owner-empty">لا توجد بيانات محملة بعد. أدخل رقم المستخدم ثم حمّل اللوحة.</p>
              ) : (
                <>
                  <div className="owner-hint">
                    {`المستخدم: ${
                      profitSnapshot.user?.display_name || profitSnapshot.user?.email || profitSnapshot.user?.phone || `#${profitPanelUserId}`
                    } | VIP ${Number(profitSnapshot.withdraw_summary.vip_level || 0)} | ${profitSnapshot.withdraw_summary.currency}`}
                  </div>
                  <div className="owner-hint">{`الأرباح المرحّلة إلى المحفظة: ${transferredEarningsTotal.toFixed(2)} ${profitSnapshot.withdraw_summary.currency} | الأرباح غير المرحّلة: ${pendingEarningsTotal.toFixed(2)} ${profitSnapshot.withdraw_summary.currency}`}</div>
                  <div className="owner-hint">{`القابل للسحب الآن: ${Number(profitSnapshot.withdraw_summary.withdrawable_balance || 0).toFixed(2)} | أصل الإيداع المقيد: ${Number(profitSnapshot.withdraw_summary.locked_balance || 0).toFixed(2)} | الربح المحتسب: ${Number(profitSnapshot.withdraw_summary.earned_profit || 0).toFixed(2)}`}</div>
                  <div className="owner-hint">{`المتبقي لفك القيد: ${Number(profitSnapshot.withdraw_summary.remaining_profit_to_unlock || 0).toFixed(2)} | هدف فك القيد: ${Number(profitSnapshot.withdraw_summary.unlock_target_profit || 0).toFixed(2)} | نسبة التقدم: ${Number(profitSnapshot.withdraw_summary.unlock_progress_pct || 0).toFixed(2)}%`}</div>
                  <div className="owner-hint">{`الرصيد الحالي: ${Number(profitSnapshot.withdraw_summary.current_balance || 0).toFixed(2)} | أصل الإيداع المحسوب: ${Number(profitSnapshot.withdraw_summary.deposited_principal || 0).toFixed(2)} | فك قيد يدوي: ${profitSnapshot.withdraw_summary.force_unlock_principal ? 'نعم' : 'لا'}`}</div>
                  <div className="owner-hint">{`الاستثناء الحالي: نسبة فك القيد ${profitOverride?.custom_unlock_ratio == null ? 'افتراضية' : profitOverride.custom_unlock_ratio} | الربح الأدنى ${profitOverride?.custom_min_profit == null ? 'افتراضي' : profitOverride.custom_min_profit}`}</div>
                  <div className="owner-section-divider" />
                  <h3 className="owner-wallet-heading">تفصيل الأرباح حسب المصدر</h3>
                  {profitEntriesBySource.length === 0 ? (
                    <p className="owner-empty">لا توجد أرباح مسجلة لهذا المستخدم حتى الآن.</p>
                  ) : (
                    <ul className="owner-history-list">
                      {profitEntriesBySource.map((item) => (
                        <li key={item.source} className="owner-history-item">
                          <div className="owner-history-main">
                            <strong>{profitSourceLabels[item.source] || item.source}</strong>
                            <small>{`الإجمالي: ${item.total.toFixed(2)} | المرحّل: ${item.transferred.toFixed(2)} | غير المرحّل: ${item.pending.toFixed(2)}`}</small>
                            <small>{`عدد السجلات: ${item.count}`}</small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">{t('owner_mining_management_title')}</h2>
            <p className="owner-hint">{t('owner_mining_management_hint')}</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder={t('owner_mining_min_subscription')}
                  value={String(miningConfigDraft?.minSubscription || 500)}
                  onChange={(e) =>
                    setMiningConfigDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            minSubscription: Number(e.target.value || 500),
                          }
                        : prev,
                    )
                  }
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder={t('owner_mining_emergency_fee')}
                  value={String(miningConfigDraft?.emergencyFeePercent || 0)}
                  onChange={(e) =>
                    setMiningConfigDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            emergencyFeePercent: Number(e.target.value || 0),
                          }
                        : prev,
                    )
                  }
                />
              </div>
              <input
                className="field-input owner-note-input"
                placeholder={t('owner_mining_plans_csv')}
                value={(miningConfigDraft?.planOptions || []).join(',')}
                onChange={(e) =>
                  setMiningConfigDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          planOptions: e.target.value
                            .split(',')
                            .map((x) => Number(x.trim()))
                            .filter((x) => Number.isFinite(x) && x > 0),
                        }
                      : prev,
                  )
                }
              />
              <textarea
                className="field-input"
                rows={4}
                placeholder={t('owner_mining_daily_tiers')}
                value={JSON.stringify(miningConfigDraft?.dailyTiers || [], null, 2)}
                onChange={(e) =>
                  setMiningConfigDraft((prev) => {
                    if (!prev) return prev
                    try {
                      const parsed = JSON.parse(e.target.value) as RewardTierRule[]
                      return { ...prev, dailyTiers: parsed }
                    } catch {
                      return prev
                    }
                  })
                }
              />
              <textarea
                className="field-input"
                rows={4}
                placeholder={t('owner_mining_monthly_tiers')}
                value={JSON.stringify(miningConfigDraft?.monthlyTiers || [], null, 2)}
                onChange={(e) =>
                  setMiningConfigDraft((prev) => {
                    if (!prev) return prev
                    try {
                      const parsed = JSON.parse(e.target.value) as RewardTierRule[]
                      return { ...prev, monthlyTiers: parsed }
                    } catch {
                      return prev
                    }
                  })
                }
              />
              <div className="owner-buttons">
                <label className="profile-settings-upload-btn owner-upload-btn">
                  {t('owner_mining_upload_media')}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const uploaded = await uploadMiningMediaAdmin(file)
                        setMiningConfigDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                mediaItems: [
                                  ...prev.mediaItems,
                                  {
                                    id: `media_${Date.now()}`,
                                    type: uploaded.type,
                                    url: uploaded.url,
                                    title: '',
                                    enabled: true,
                                    order: prev.mediaItems.length + 1,
                                  },
                                ],
                              }
                            : prev,
                        )
                      } catch (err) {
                        setMessage({ type: 'error', text: err instanceof Error ? err.message : t('owner_mining_upload_failed') })
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleSaveMiningConfig}
                  disabled={miningSaving}
                >
                  {miningSaving ? '...' : t('owner_mining_save')}
                </button>
              </div>
            </div>
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">إدارة الصور (صلاحية المالك)</h2>
            <p className="owner-hint">يمكنك تغيير صور بروفايل المستخدمين وصور التطبيق مباشرة من الاستديو.</p>

            <div className="owner-image-grid">
              <div className="owner-actions-card">
                <h3 className="owner-wallet-heading">تغيير صورة بروفايل مستخدم</h3>
                <div className="owner-form-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="field-input owner-user-id-input"
                    placeholder="رقم المستخدم (ID)"
                    value={avatarTargetUserId}
                    onChange={(e) => setAvatarTargetUserId(e.target.value)}
                  />
                </div>
                <label className="profile-settings-upload-btn owner-upload-btn">
                  اختيار صورة من الجهاز
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-deposit owner-image-action"
                  onClick={handleOwnerAvatarUpload}
                  disabled={avatarSaving}
                >
                  {avatarSaving ? 'جارٍ الرفع...' : 'رفع وتحديث الصورة'}
                </button>
              </div>

              <div className="owner-actions-card">
                <h3 className="owner-wallet-heading">صور وشعارات التطبيق</h3>
                <div className="owner-form-row owner-image-form">
                  <select
                    className="field-input owner-image-key"
                    value={assetKey}
                    onChange={(e) => setAssetKey(e.target.value)}
                  >
                    <option value="logo_url">الشعار الرئيسي</option>
                    <option value="app_image_banner">بنر التطبيق</option>
                    <option value="app_image_icon">أيقونة التطبيق</option>
                    <option value="app_image_background">خلفية التطبيق</option>
                    <option value="app_image_deposit_proof">{t('owner_asset_key_deposit_proof_example')}</option>
                  </select>
                </div>
                <label className="profile-settings-upload-btn owner-upload-btn">
                  اختيار صورة من الجهاز
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setAssetFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-deposit owner-image-action"
                  onClick={handleAssetUpload}
                  disabled={assetSaving}
                >
                  {assetSaving ? 'جارٍ الرفع...' : 'رفع وتحديث الصورة'}
                </button>
              </div>
            </div>

            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">الصور الحالية</h3>
              {assetImages.length === 0 ? (
                <p className="owner-empty">لا توجد صور محفوظة بعد.</p>
              ) : (
                <div className="owner-images-list">
                  {assetImages.map((item) => (
                    <div key={item.key} className="owner-image-item">
                      <div className="owner-image-meta">
                        <strong>{item.key}</strong>
                        <small>{item.url}</small>
                      </div>
                      <img src={item.url} alt={item.key} className="owner-image-preview" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {kycPreview ? (
        <div className="owner-kyc-preview-backdrop" onClick={() => setKycPreview(null)}>
          <div
            className="owner-kyc-preview-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={kycPreview.title}
          >
            <div className="owner-kyc-preview-header">
              <div>
                <h3 className="owner-kyc-preview-title">{kycPreview.title}</h3>
                <p className="owner-kyc-preview-subtitle">يمكنك المعاينة هنا أو فتح المرفق في تبويب جديد.</p>
              </div>
              <button type="button" className="owner-kyc-preview-close" onClick={() => setKycPreview(null)}>
                ×
              </button>
            </div>
            <div className="owner-kyc-preview-content">
              {kycPreviewError ? (
                <div className="owner-kyc-preview-error">
                  تعذر تحميل الصورة. قد يكون الملف محذوفًا أو أن الرابط غير صالح.
                </div>
              ) : (
                <img
                  src={kycPreview.url}
                  alt={kycPreview.alt}
                  className="owner-kyc-preview-image"
                  onError={() => setKycPreviewError(true)}
                />
              )}
            </div>
            <div className="owner-kyc-preview-actions">
              <button
                type="button"
                className="wallet-action-btn owner-set-btn"
                onClick={() => handleOpenKycAttachmentInNewTab(kycPreview.url)}
              >
                فتح في تبويب جديد
              </button>
              <button type="button" className="wallet-action-btn wallet-action-withdraw" onClick={() => setKycPreview(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
