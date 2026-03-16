import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  adjustBalance,
  apiFetch,
  getAssetImages,
  getBalanceForUser,
  getBalanceHistory,
  getIconAttractionKeys,
  getRegistrationStatus,
  ownerUploadSettingImage,
  ownerUploadUserAvatar,
  setBalance,
  getTaskCodesAdmin,
  upsertTaskCodeAdmin,
  toggleTaskCodeAdmin,
  deleteTaskCodeAdmin,
  getMiningAdminConfig,
  updateMiningAdminConfig,
  uploadMiningMediaAdmin,
  type AuthUser,
  type IconAttractionAssignments,
  type IconAttractionTarget,
  type MiningConfig,
  type RewardTierRule,
  type TaskRewardCodeItem,
  updateIconAttractionKeys,
  updateRegistrationStatus,
  updateUserBadgeStyle,
  updateUserBan,
  updateUserFreeze,
  updateUserVipLevel,
} from '../../api'
import { useI18n } from '../../i18nCore'

type OwnerDashboardProps = {
  user: AuthUser | null
}

export function OwnerDashboardPage({ user }: OwnerDashboardProps) {
  const { t } = useI18n()
  const [targetUserId, setTargetUserId] = useState('')
  const [balances, setBalances] = useState<{ currency: string; amount: number; updated_at: string }[]>([])
  const [history, setHistory] = useState<{ id: number; type: string; currency: string; amount: number; note: string | null; created_at: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currency, setCurrency] = useState('USDT')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
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
  const [taskCodes, setTaskCodes] = useState<TaskRewardCodeItem[]>([])
  const [taskCodeDraft, setTaskCodeDraft] = useState({
    code: '',
    title: '',
    description: '',
    basePercent: '0',
    maxRewardAmount: '0',
    tiersText: '[{"minBalance":0,"maxBalance":999.99,"percent":3}]',
    isActive: true,
  })
  const [taskSaving, setTaskSaving] = useState(false)
  const [miningConfigDraft, setMiningConfigDraft] = useState<MiningConfig | null>(null)
  const [miningSaving, setMiningSaving] = useState(false)

  const isOwner = user?.role === 'owner'

  useEffect(() => {
    if (!targetUserId.trim()) {
      setBalances([])
      setHistory([])
      return
    }
    const id = Number(targetUserId)
    if (!Number.isFinite(id) || id < 1) return
    setLoading(true)
    setMessage(null)
    Promise.all([getBalanceForUser(id), getBalanceHistory(id)])
      .then(([balRes, histRes]) => {
        setBalances(balRes.balances)
        setHistory(histRes.history || [])
      })
      .catch(() => setMessage({ type: 'error', text: 'تعذر تحميل البيانات.' }))
      .finally(() => setLoading(false))
  }, [targetUserId])

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
    getTaskCodesAdmin()
      .then((res) => setTaskCodes(res.items || []))
      .catch(() => setTaskCodes([]))
    getMiningAdminConfig()
      .then((res) => setMiningConfigDraft(res.config))
      .catch(() => setMiningConfigDraft(null))
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

  async function handleAdjust(type: 'add' | 'deduct') {
    const uid = Number(targetUserId)
    const amt = Number(amount)
    if (!uid || !Number.isFinite(amt) || amt <= 0) {
      setMessage({ type: 'error', text: 'أدخل رقم مستخدم ومبلغاً صحيحاً.' })
      return
    }
    setActionLoading(true)
    setMessage(null)
    try {
      await adjustBalance({ userId: uid, currency, amount: amt, type, note })
      setMessage({ type: 'success', text: type === 'add' ? 'تمت الإضافة.' : 'تم الخصم.' })
      setAmount('')
      setNote('')
      const [balRes, histRes] = await Promise.all([getBalanceForUser(uid), getBalanceHistory(uid)])
      setBalances(balRes.balances)
      setHistory(histRes.history || [])
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل الإجراء.' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSet() {
    const uid = Number(targetUserId)
    const amt = Number(amount)
    if (!uid || !Number.isFinite(amt) || amt < 0) {
      setMessage({ type: 'error', text: 'أدخل رقم مستخدم ومبلغاً صحيحاً (≥0).' })
      return
    }
    setActionLoading(true)
    setMessage(null)
    try {
      await setBalance({ userId: uid, currency, amount: amt, note })
      setMessage({ type: 'success', text: 'تم تعيين الرصيد.' })
      setAmount('')
      setNote('')
      const [balRes, histRes] = await Promise.all([getBalanceForUser(uid), getBalanceHistory(uid)])
      setBalances(balRes.balances)
      setHistory(histRes.history || [])
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل الإجراء.' })
    } finally {
      setActionLoading(false)
    }
  }

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

  function parseTiersText(raw: string): RewardTierRule[] {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed
        .map((item) => ({
          minBalance: Number(item?.minBalance || 0),
          maxBalance: item?.maxBalance == null || item?.maxBalance === '' ? null : Number(item.maxBalance),
          percent: Number(item?.percent || 0),
        }))
        .filter((item) => Number.isFinite(item.minBalance) && item.minBalance >= 0 && Number.isFinite(item.percent) && item.percent >= 0)
        .slice(0, 24)
    } catch {
      return []
    }
  }

  async function handleCreateTaskCode() {
    setTaskSaving(true)
    setMessage(null)
    try {
      const tiers = parseTiersText(taskCodeDraft.tiersText)
      await upsertTaskCodeAdmin({
        code: taskCodeDraft.code,
        title: taskCodeDraft.title,
        description: taskCodeDraft.description,
        basePercent: Number(taskCodeDraft.basePercent || 0),
        maxRewardAmount: Number(taskCodeDraft.maxRewardAmount || 0),
        tiers,
        isActive: taskCodeDraft.isActive,
      })
      const refreshed = await getTaskCodesAdmin()
      setTaskCodes(refreshed.items || [])
      setTaskCodeDraft((prev) => ({ ...prev, code: '', title: '', description: '' }))
      setMessage({ type: 'success', text: t('owner_tasks_code_saved') })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('owner_tasks_code_save_failed') })
    } finally {
      setTaskSaving(false)
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

  return (
    <div className="page owner-dashboard owner-dashboard-clean">
      <h1 className="page-title owner-dashboard-title">لوحة المالك — تحكم كامل</h1>

      <nav className="owner-nav">
        <Link to="/admin/dashboard" className="owner-nav-link">لوحة الإدارة</Link>
        <Link to="/admin/users" className="owner-nav-link">المستخدمين</Link>
        <Link to="/admin/invites" className="owner-nav-link">الدعوات</Link>
        <Link to="/admin/balances" className="owner-nav-link">الأرصدة (إداري)</Link>
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
            <h2 className="owner-section-title">إدارة الأرصدة — واجهة المحفظة</h2>
            <p className="owner-hint">ابحث بالمستخدم برقم الـ ID ثم اعرض أرصدته وحرّكها (إضافة / خصم / تعيين).</p>
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

            {loading && <div className="owner-loading">جاري التحميل...</div>}

            {!loading && targetUserId.trim() && (
              <>
                <div className="owner-wallet-card">
                  <h3 className="owner-wallet-heading">أرصدة المستخدم #{targetUserId}</h3>
                  {balances.length === 0 ? (
                    <p className="owner-empty">لا توجد أرصدة.</p>
                  ) : (
                    <ul className="owner-balance-list">
                      {balances.map((b) => (
                        <li key={b.currency} className="owner-balance-item">
                          <span className="owner-balance-currency">{b.currency}</span>
                          <span className="owner-balance-amount">{Number(b.amount).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="owner-actions-card">
                  <h3 className="owner-wallet-heading">إضافة / خصم / تعيين الرصيد</h3>
                  <div className="owner-form-row">
                    <input
                      type="text"
                      className="field-input owner-currency-input"
                      placeholder="العملة"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    />
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="field-input owner-amount-input"
                      placeholder="المبلغ"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>
                  <input
                    type="text"
                    className="field-input owner-note-input"
                    placeholder="ملاحظة (اختياري)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="owner-buttons">
                    <button
                      type="button"
                      className="wallet-action-btn wallet-action-deposit"
                      onClick={() => handleAdjust('add')}
                      disabled={actionLoading}
                    >
                      إضافة
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn wallet-action-withdraw"
                      onClick={() => handleAdjust('deduct')}
                      disabled={actionLoading}
                    >
                      خصم
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={handleSet}
                      disabled={actionLoading}
                    >
                      تعيين الرصيد
                    </button>
                  </div>
                </div>

                {history.length > 0 && (
                  <div className="owner-history-card">
                    <h3 className="owner-wallet-heading">سجل الحركات</h3>
                    <ul className="owner-history-list">
                      {history.slice(0, 20).map((h) => (
                        <li key={h.id} className="owner-history-item">
                          <span>{h.type === 'add' ? '+' : '-'}</span>
                          <span>{h.amount} {h.currency}</span>
                          <span className="owner-history-date">{h.created_at}</span>
                          {h.note && <span className="owner-history-note">{h.note}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

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
            <h2 className="owner-section-title">{t('owner_tasks_management_title')}</h2>
            <p className="owner-hint">{t('owner_tasks_management_hint')}</p>
            <div className="owner-actions-card">
              <div className="owner-form-row">
                <input
                  className="field-input"
                  placeholder={t('owner_tasks_code_field')}
                  value={taskCodeDraft.code}
                  onChange={(e) => setTaskCodeDraft((prev) => ({ ...prev, code: e.target.value }))}
                />
                <input
                  className="field-input"
                  placeholder={t('owner_tasks_title_field')}
                  value={taskCodeDraft.title}
                  onChange={(e) => setTaskCodeDraft((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <input
                className="field-input owner-note-input"
                placeholder={t('owner_tasks_desc_field')}
                value={taskCodeDraft.description}
                onChange={(e) => setTaskCodeDraft((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="owner-form-row">
                <input
                  type="number"
                  className="field-input"
                  placeholder={t('owner_tasks_base_percent')}
                  value={taskCodeDraft.basePercent}
                  onChange={(e) => setTaskCodeDraft((prev) => ({ ...prev, basePercent: e.target.value }))}
                />
                <input
                  type="number"
                  className="field-input"
                  placeholder={t('owner_tasks_max_reward')}
                  value={taskCodeDraft.maxRewardAmount}
                  onChange={(e) => setTaskCodeDraft((prev) => ({ ...prev, maxRewardAmount: e.target.value }))}
                />
              </div>
              <textarea
                className="field-input"
                rows={4}
                value={taskCodeDraft.tiersText}
                onChange={(e) => setTaskCodeDraft((prev) => ({ ...prev, tiersText: e.target.value }))}
                placeholder={t('owner_tasks_tiers_json')}
              />
              <div className="owner-buttons">
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleCreateTaskCode}
                  disabled={taskSaving}
                >
                  {taskSaving ? '...' : t('owner_tasks_create')}
                </button>
              </div>
            </div>
            <div className="owner-history-card">
              <h3 className="owner-wallet-heading">{t('owner_tasks_codes_list')}</h3>
              <ul className="owner-history-list">
                {taskCodes.map((item) => (
                  <li key={item.id} className="owner-history-item">
                    <span>{item.code}</span>
                    <span>{item.basePercent}%</span>
                    <button
                      type="button"
                      className={`wallet-action-btn ${item.isActive ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                      onClick={async () => {
                        await toggleTaskCodeAdmin(item.id, !item.isActive)
                        const refreshed = await getTaskCodesAdmin()
                        setTaskCodes(refreshed.items || [])
                      }}
                    >
                      {item.isActive ? t('owner_tasks_enabled') : t('owner_tasks_disabled')}
                    </button>
                    <button
                      type="button"
                      className="wallet-action-btn wallet-action-withdraw"
                      onClick={async () => {
                        await deleteTaskCodeAdmin(item.id)
                        const refreshed = await getTaskCodesAdmin()
                        setTaskCodes(refreshed.items || [])
                      }}
                    >
                      {t('owner_tasks_delete')}
                    </button>
                  </li>
                ))}
              </ul>
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
