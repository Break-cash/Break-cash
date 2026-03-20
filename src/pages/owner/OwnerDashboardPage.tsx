import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  apiFetch,
  createBonusRule,
  createAd,
  createDailyTradeCampaign,
  deleteBonusRule,
  deleteDailyTradeCampaign,
  deleteAd,
  getAdsAdmin,
  getAssetImages,
  getBonusRules,
  getDailyTradeCampaigns,
  getIconAttractionKeys,
  getRegistrationStatus,
  ownerUploadSettingImage,
  ownerUploadUserAvatar,
  reorderAds,
  getStrategyCodesAdmin,
  toggleAd,
  upsertStrategyCodeAdmin,
  updateAd,
  toggleStrategyCodeAdmin,
  deleteStrategyCodeAdmin,
  getMiningAdminConfig,
  getOwnerKycSubmissions,
  getRecoveryCodeReviewRequests,
  updateMiningAdminConfig,
  processAutoKycReviews,
  reviewOwnerKycSubmission,
  reviewRecoveryCodeRequest,
  uploadAdMedia,
  uploadMiningMediaAdmin,
  type AdItem,
  type AuthUser,
  type BonusRule,
  type DailyTradeCampaign,
  type IconAttractionAssignments,
  type IconAttractionTarget,
  type KycSubmissionRow,
  type MiningConfig,
  type RecoveryCodeReviewRequestItem,
  type RewardTierRule,
  type StrategyCodeAdminItem,
  type StrategyCodeUsageAdminItem,
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
import { useI18n } from '../../i18nCore'

type OwnerDashboardProps = {
  user: AuthUser | null
}

export function OwnerDashboardPage({ user }: OwnerDashboardProps) {
  const { t } = useI18n()
  const [targetUserId, setTargetUserId] = useState('')
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
    featureType: 'trial_trade' as 'trial_trade' | 'promo_bonus',
    rewardMode: 'percent' as 'percent' | 'fixed',
    rewardValue: '0',
    assetSymbol: 'BTCUSDT',
    tradeReturnPercent: '0',
    expiresAt: '',
    isActive: true,
  })
  const [strategySaving, setStrategySaving] = useState(false)
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

  const isOwner = user?.role === 'owner'
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

  async function refreshStrategyCodes() {
    const refreshed = await getStrategyCodesAdmin()
    setStrategyCodes(refreshed.items || [])
    setStrategyUsages(refreshed.usages || [])
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
        featureType: strategyCodeDraft.featureType,
        rewardMode: strategyCodeDraft.rewardMode,
        rewardValue: Number(strategyCodeDraft.rewardValue || 0),
        assetSymbol: strategyCodeDraft.assetSymbol,
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
        rewardValue: '0',
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
              </div>
            ) : (
              <p className="owner-empty">أدخل رقم مستخدم صحيح لعرض إعداداته المتقدمة.</p>
            )}
          </section>

          <section className="owner-balance-section">
            <h2 className="owner-section-title">إدارة أكواد الاستراتيجية</h2>
            <p className="owner-hint">
              من هنا ينشئ المالك أكواد صفقة تجريبية أو مكافأة ترويجية، مع تحديد الحالة والانتهاء والتتبع الكامل.
            </p>
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
              <div className="owner-form-row">
                <select
                  className="field-input"
                  value={strategyCodeDraft.featureType}
                  onChange={(e) =>
                    setStrategyCodeDraft((prev) => ({
                      ...prev,
                      featureType: e.target.value as 'trial_trade' | 'promo_bonus',
                    }))
                  }
                >
                  <option value="trial_trade">يفتح صفقة تجريبية</option>
                  <option value="promo_bonus">يفعل مكافأة ترويجية</option>
                </select>
                <select
                  className="field-input"
                  value={strategyCodeDraft.rewardMode}
                  onChange={(e) =>
                    setStrategyCodeDraft((prev) => ({
                      ...prev,
                      rewardMode: e.target.value as 'percent' | 'fixed',
                    }))
                  }
                >
                  <option value="percent">النسبة</option>
                  <option value="fixed">القيمة الثابتة</option>
                </select>
              </div>
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder="قيمة المكافأة أو نسبتها"
                  value={strategyCodeDraft.rewardValue}
                  onChange={(e) => setStrategyCodeDraft((prev) => ({ ...prev, rewardValue: e.target.value }))}
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
                    <span>{item.featureType === 'trial_trade' ? 'صفقة' : 'مكافأة'}</span>
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
                      <span>{Number(usage.stakeAmount || 0).toFixed(2)} USDT</span>
                      <span>{usage.usedAt || usage.confirmedAt || '-'}</span>
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
                        <small>
                          <a href={item.id_document_path} target="_blank" rel="noreferrer" className="owner-nav-link">عرض الهوية</a>
                          {' | '}
                          <a href={item.selfie_path} target="_blank" rel="noreferrer" className="owner-nav-link">عرض السيلفي</a>
                        </small>
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
    </div>
  )
}
