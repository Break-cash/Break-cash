import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createDepositRequest,
  createWithdrawalRequest,
  getBalanceRules,
  getAssetImages,
  getAds,
  getActivePromotions,
  getMyBalanceRequests,
  getWithdrawLocksMy,
  getWithdrawSummaryMy,
  getLogoUrl,
  getMyProfile,
  getWalletLink,
  ownerUploadSettingImage,
  subscribeToLiveUpdates,
  type AdItem,
  type BalanceRequestStatus,
  type BalanceRules,
  type DepositRequestItem,
  type PromotionRule,
  type PublicPrincipalLockItem,
  type PublicWithdrawalSummary,
  type WithdrawalRequestItem,
  type AuthUser,
  updateLogoUrl,
  updateWalletLink,
} from '../api'
import { AdBanner } from '../components/ads/AdBanner'
import { AppModalPortal } from '../components/ui/AppModalPortal'
import { DEPOSIT_TERMS_AR } from '../depositTerms'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'
import { emitToast } from '../toastBus'
import { getWithdrawalRequestDetails } from '../utils/withdrawRequestDetails'

type DepositPageProps = {
  user: AuthUser | null
  pageMode?: 'deposit' | 'withdraw'
}

const QUICK_AMOUNTS = [75, 499, 1000] as const
const DEFAULT_DEPOSIT_PROOF_EXAMPLE_URL = '/help/deposit-proof.jpg'

export function DepositPage({ user, pageMode = 'deposit' }: DepositPageProps) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AuthUser | null>(user ?? null)
  const [walletLink, setWalletLink] = useState('')
  const [walletLinkEdit, setWalletLinkEdit] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUrlEdit, setLogoUrlEdit] = useState('')
  const [termsOpen, setTermsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingWallet, setSavingWallet] = useState(false)
  const [savingLogo, setSavingLogo] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [copyDone, setCopyDone] = useState(false)
  const [logoBroken, setLogoBroken] = useState(false)
  const [withdrawSummary, setWithdrawSummary] = useState<PublicWithdrawalSummary | null>(null)
  const [principalLocks, setPrincipalLocks] = useState<PublicPrincipalLockItem[]>([])
  const [rules, setRules] = useState<BalanceRules>({
    minDeposit: 10,
    minWithdrawal: 10,
    depositMethods: ['USDT TRC20', 'Bank Transfer'],
    withdrawalMethods: ['USDT TRC20'],
    manualReview: true,
    withdrawalFeePercent: 0,
    minimumProfitToUnlock: 0,
    defaultUnlockRatio: 1,
    unlockRatioByLevel: { 0: 1, 1: 0.9, 2: 0.75, 3: 0.6, 4: 0.45, 5: 0.3 },
  })
  const [requestStatusFilter, setRequestStatusFilter] = useState<'' | BalanceRequestStatus>('')
  const [depositRequests, setDepositRequests] = useState<DepositRequestItem[]>([])
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequestItem[]>([])
  const [depositAmount, setDepositAmount] = useState('')
  const [depositMethod, setDepositMethod] = useState('')
  const [transferRef, setTransferRef] = useState('')
  const [depositNotes, setDepositNotes] = useState('')
  const [proofImage, setProofImage] = useState<File | null>(null)
  const [depositProofExampleUrl, setDepositProofExampleUrl] = useState('')
  const [proofExampleOpen, setProofExampleOpen] = useState(false)
  const [proofExampleBroken, setProofExampleBroken] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('')
  const [withdrawAccountInfo, setWithdrawAccountInfo] = useState('')
  const [withdrawNotes, setWithdrawNotes] = useState('')
  const [requestMessage, setRequestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [depositSubmitting, setDepositSubmitting] = useState(false)
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false)
  const [depositAds, setDepositAds] = useState<AdItem[]>([])
  const [promotionRules, setPromotionRules] = useState<{ firstDeposit: PromotionRule[]; referral: PromotionRule[] }>({
    firstDeposit: [],
    referral: [],
  })

  const isOwner = profile?.role === 'owner'
  const isDepositPage = pageMode === 'deposit'
  const isWithdrawPage = pageMode === 'withdraw'
  const effectiveProofExampleUrl = (depositProofExampleUrl || '').trim() || DEFAULT_DEPOSIT_PROOF_EXAMPLE_URL
  const { summary: walletSummary, refresh: refreshWalletSummary } = useWalletSummary({
    subscribeLive: false,
  })

  function resolveUsdtDepositMethod(nextRules: BalanceRules) {
    const matched = (nextRules.depositMethods || []).find((item) => /usdt/i.test(String(item || '')))
    return matched || nextRules.depositMethods?.[0] || 'USDT'
  }

  async function refreshBalanceRulesLive() {
    try {
      const [rulesRes, summaryRes, locksRes] = await Promise.all([
        getBalanceRules(),
        getWithdrawSummaryMy('USDT'),
        getWithdrawLocksMy('USDT'),
      ])
      setRules(rulesRes.rules)
      setDepositMethod((current) => {
        const nextDefault = resolveUsdtDepositMethod(rulesRes.rules)
        return rulesRes.rules.depositMethods.includes(current) ? current : nextDefault
      })
      setWithdrawMethod((current) => {
        const methods = rulesRes.rules.withdrawalMethods || []
        if (methods.length === 0) return ''
        return methods.includes(current) ? current : methods[0]
      })
      setWithdrawSummary(summaryRes.summary)
      setPrincipalLocks(locksRes.items || [])
    } catch {
      // ignore transient live refresh failures
    }
  }

  useEffect(() => {
    if (!profile && user) setProfile(user)
  }, [user, profile])

  useEffect(() => {
    Promise.all([
      getMyProfile(),
      getWalletLink(),
      getLogoUrl(),
      getBalanceRules(),
      getWithdrawSummaryMy('USDT'),
      getWithdrawLocksMy('USDT'),
    ]).then(async ([profileRes, walletRes, logoRes, rulesRes, summaryRes, locksRes]) => {
        setProfile(profileRes.profile)
        setWalletLink(walletRes.walletLink || '')
        setWalletLinkEdit(walletRes.walletLink || '')
        const url = (logoRes.logoUrl || '').trim()
        setLogoUrl(url)
        setLogoUrlEdit(url)
        setRules(rulesRes.rules)
        setDepositMethod(resolveUsdtDepositMethod(rulesRes.rules))
        setWithdrawMethod(rulesRes.rules.withdrawalMethods[0] || '')
        setWithdrawSummary(summaryRes.summary)
        setPrincipalLocks(locksRes.items || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    getAssetImages()
      .then((res) => {
        const rows = Array.isArray(res.images) ? res.images : []
        const proofExample = rows.find((item) => String(item.key || '') === 'app_image_deposit_proof')
        const url = String(proofExample?.url || '').trim()
        setDepositProofExampleUrl(url)
        setProofExampleBroken(false)
      })
      .catch(() => setDepositProofExampleUrl(''))
  }, [])

  useEffect(() => {
    getAds('deposit')
      .then((res) => setDepositAds(res.items || []))
      .catch(() => setDepositAds([]))
    getActivePromotions()
      .then((res) => setPromotionRules({
        firstDeposit: res.firstDeposit || [],
        referral: res.referral || [],
      }))
      .catch(() => setPromotionRules({ firstDeposit: [], referral: [] }))
  }, [])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (event.type === 'home_content_updated') {
        getAds('deposit').then((res) => setDepositAds(res.items || [])).catch(() => {})
        if (event.source === 'balance_rules' || event.key === 'balance_rules') {
          refreshBalanceRulesLive().catch(() => {})
        }
      }
      if (event.type === 'balance_rules_updated') {
        refreshBalanceRulesLive().catch(() => {})
      }
      if (event.type === 'balance_updated' && event.scope === 'user') {
        refreshBalanceRulesLive().catch(() => {})
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    const handlePageRefresh = () => {
      refreshBalanceRulesLive().catch(() => {})
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshBalanceRulesLive().catch(() => {})
      }
    }
    window.addEventListener('focus', handlePageRefresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('focus', handlePageRefresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    getMyBalanceRequests(requestStatusFilter || undefined)
      .then((res) => {
        setDepositRequests(res.deposits || [])
        setWithdrawalRequests(res.withdrawals || [])
      })
      .catch(() => {
        setDepositRequests([])
        setWithdrawalRequests([])
      })
  }, [requestStatusFilter])

  const displayLogoUrl = (logoUrl || '').trim() ? logoUrl : '/break-cash-logo-premium.png'
  const formatPromotionText = (rule: PromotionRule) => {
    const conditions = (rule.conditions || {}) as Record<string, unknown>
    const reward = (rule.reward || {}) as Record<string, unknown>
    const minDeposit = Number(conditions.minDeposit ?? 0)
    const mode = String(reward.mode || 'percent')
    const value = Number(reward.value ?? reward.amount ?? reward.percent ?? 0)
    if (mode === 'fixed') return `أودع ${minDeposit || 0} واحصل على ${value.toFixed(2)} USDT`
    return `أودع ${minDeposit || 0} واحصل على ${value.toFixed(2)}%`
  }

  async function handleSaveWallet() {
    if (!isOwner) return
    const v = walletLinkEdit.trim()
    setSavingWallet(true)
    try {
      await updateWalletLink(v)
      setWalletLink(v)
    } finally {
      setSavingWallet(false)
    }
  }

  async function handleSaveLogo() {
    if (!isOwner) return
    const v = logoUrlEdit.trim()
    setSavingLogo(true)
    try {
      if (logoFile) {
        const res = await ownerUploadSettingImage('logo_url', logoFile)
        setLogoUrl(res.url)
        setLogoUrlEdit(res.url)
        setLogoFile(null)
      } else {
        await updateLogoUrl(v)
        setLogoUrl(v)
      }
    } finally {
      setSavingLogo(false)
    }
  }

  function handleCopyWallet() {
    const text = walletLink || walletLinkEdit
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    })
  }

  function statusBadgeClass(status: BalanceRequestStatus) {
    if (status === 'approved') return 'status-approved'
    if (status === 'rejected') return 'status-rejected'
    if (status === 'completed') return 'status-completed'
    return 'status-pending'
  }

  function statusLabel(status: BalanceRequestStatus) {
    if (status === 'approved') return t('wallet_requests_status_approved')
    if (status === 'rejected') return t('wallet_requests_status_rejected')
    if (status === 'completed') return t('wallet_requests_status_completed')
    return t('wallet_requests_status_pending')
  }

  async function refreshBalancesAndRequests() {
    const [summaryRes] = await Promise.all([
      getWithdrawSummaryMy('USDT'),
      refreshWalletSummary(),
    ])
    setWithdrawSummary(summaryRes.summary)
    const locksRes = await getWithdrawLocksMy('USDT')
    setPrincipalLocks(locksRes.items || [])
    const myReq = await getMyBalanceRequests(requestStatusFilter || undefined)
    setDepositRequests(myReq.deposits || [])
    setWithdrawalRequests(myReq.withdrawals || [])
  }

  async function submitDepositRequest() {
    const amount = Number(depositAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      const text = t('wallet_requests_invalid_input')
      setRequestMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'INVALID_AMOUNT', message: text })
      return
    }
    if (!depositMethod || !transferRef.trim()) {
      const text = t('wallet_requests_invalid_input')
      setRequestMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'MISSING_DATA', message: text })
      return
    }
    if (!proofImage) {
      const text = t('wallet_requests_proof_required')
      setRequestMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'MISSING_DATA', message: text })
      return
    }
    setDepositSubmitting(true)
    setRequestMessage(null)
    try {
      const formData = new FormData()
      const effectiveDepositMethod = depositMethod || resolveUsdtDepositMethod(rules)
      formData.append('amount', String(amount))
      formData.append('currency', 'USDT')
      formData.append('method', effectiveDepositMethod)
      formData.append('transferRef', transferRef.trim())
      formData.append('notes', depositNotes.trim())
      formData.append('idempotencyKey', `dep_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)
      if (proofImage) formData.append('proofImage', proofImage)
      await createDepositRequest(formData)
      setDepositAmount('')
      setTransferRef('')
      setDepositNotes('')
      setProofImage(null)
      const text = t('wallet_requests_deposit_submitted')
      setRequestMessage({ type: 'success', text })
      emitToast({ kind: 'success', message: text, durationMs: 3600 })
      await refreshBalancesAndRequests()
    } catch {
      setRequestMessage({ type: 'error', text: t('toast_error_transaction_failed') })
    } finally {
      setDepositSubmitting(false)
    }
  }

  async function submitWithdrawRequest() {
    const amount = Number(withdrawAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      const text = t('wallet_requests_invalid_input')
      setRequestMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'INVALID_AMOUNT', message: text })
      return
    }
    if (!withdrawMethod || !withdrawAccountInfo.trim()) {
      const text = t('wallet_requests_invalid_input')
      setRequestMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'MISSING_DATA', message: text })
      return
    }
    const allowed = Number(withdrawSummary?.withdrawable_balance || 0)
    if (amount > allowed) {
      const text = t('wallet_requests_insufficient_balance')
      setRequestMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'INSUFFICIENT_BALANCE', message: text })
      return
    }
    setWithdrawSubmitting(true)
    setRequestMessage(null)
    try {
      await createWithdrawalRequest({
        amount,
        currency: 'USDT',
        method: withdrawMethod,
        accountInfo: withdrawAccountInfo.trim(),
        notes: withdrawNotes.trim(),
        idempotencyKey: `wd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      })
      setWithdrawAmount('')
      setWithdrawAccountInfo('')
      setWithdrawNotes('')
      const text = t('wallet_requests_withdraw_submitted')
      setRequestMessage({ type: 'success', text })
      emitToast({ kind: 'success', message: text, durationMs: 3600 })
      await refreshBalancesAndRequests()
    } catch {
      setRequestMessage({ type: 'error', text: t('toast_error_transaction_failed') })
    } finally {
      setWithdrawSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="deposit-page page">
        <div className="deposit-loading">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="deposit-page page">
      <button type="button" className="deposit-back" onClick={() => navigate(-1)} aria-label="رجوع">
        ←
      </button>

      <section className="deposit-promo-banner mb-4 app-icon-hero-shell">
        <AdBanner items={depositAds} placement="deposit" />
      </section>

      {(promotionRules.firstDeposit.length > 0 || promotionRules.referral.length > 0) ? (
        <section className="rounded-2xl border border-app-border bg-app-card p-3">
          <div className="mb-2 text-sm font-semibold text-white">العروض الحالية</div>
          <div className="space-y-2 text-xs text-white/85">
            {promotionRules.firstDeposit.map((rule) => (
              <div key={`fd-${rule.id}`} className="rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="font-medium text-brand-blue">مكافأة أول إيداع</div>
                <div className="mt-1">{formatPromotionText(rule)}</div>
              </div>
            ))}
            {promotionRules.referral.map((rule) => (
              <div key={`ref-${rule.id}`} className="rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="font-medium text-emerald-300">مكافأة الإحالة بعد أول إيداع مؤكد</div>
                <div className="mt-1">إذا سجّل صديقك عبر كودك أو رابطك وتم تأكيد أول إيداعه: {formatPromotionText(rule)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="deposit-brand">
        <div className="deposit-logo-wrap">
          {isOwner ? (
            <>
              <img
                src={logoBroken ? '/break-cash-logo-premium.png' : displayLogoUrl}
                alt="BREAK CASH"
                className="deposit-logo"
                onError={() => setLogoBroken(true)}
              />
              <div className="deposit-owner-edit">
                <input
                  type="text"
                  className="deposit-owner-input"
                  placeholder="رابط صورة الشعار"
                  value={logoUrlEdit}
                  onChange={(e) => setLogoUrlEdit(e.target.value)}
                />
                <label className="deposit-owner-save">
                  رفع من الجهاز
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  className="deposit-owner-save"
                  onClick={handleSaveLogo}
                  disabled={savingLogo}
                >
                  {savingLogo ? '...' : 'حفظ'}
                </button>
              </div>
            </>
          ) : (
            <img
              src={logoBroken ? '/break-cash-logo-premium.png' : displayLogoUrl}
              alt="BREAK CASH"
              className="deposit-logo"
              onError={() => setLogoBroken(true)}
            />
          )}
        </div>
        <h1 className="deposit-title">BREAK CASH</h1>
      </div>

      {isDepositPage ? (
        <section className="deposit-section deposit-wallet-section">
        <h2 className="deposit-section-title">محفظة المنصة</h2>
        {isOwner ? (
          <div className="deposit-wallet-edit">
            <input
              type="text"
              className="deposit-wallet-input"
              placeholder="عنوان المحفظة أو الرابط"
              value={walletLinkEdit}
              onChange={(e) => setWalletLinkEdit(e.target.value)}
            />
            <button
              type="button"
              className="deposit-wallet-save"
              onClick={handleSaveWallet}
              disabled={savingWallet}
            >
              {savingWallet ? '...' : 'حفظ'}
            </button>
          </div>
        ) : null}
        <div className="deposit-wallet-display">
          <span className="deposit-wallet-value">{walletLink || walletLinkEdit || '—'}</span>
          <button
            type="button"
            className="deposit-copy-btn"
            onClick={handleCopyWallet}
            disabled={!walletLink && !walletLinkEdit}
          >
            {copyDone ? 'تم النسخ ✓' : 'نسخ'}
          </button>
        </div>
        <div className="deposit-network-note" role="note" aria-label="Deposit network">
          <span className="deposit-network-note-label">Network</span>
          <span className="deposit-network-note-value">USDT BNB Chain</span>
          <span className="deposit-network-note-hint">ÙŠØ±Ø¬Ù‰ Ø§Ù„ØªØ­ÙˆÙŠÙ„ Ø¹Ø¨Ø± Ù‡Ø°Ù‡ Ø§Ù„Ø´Ø¨ÙƒØ© ÙÙ‚Ø· Ù„ØªØ¬Ù†Ø¨ ÙÙ‚Ø¯Ø§Ù† Ø§Ù„Ø¥ÙŠØ¯Ø§Ø¹.</span>
        </div>
        </section>
      ) : null}

      <section className="deposit-section">
        <h2 className="deposit-section-title">
          {isWithdrawPage ? t('wallet_requests_withdraw_title') : t('wallet_requests_deposit_title')}
        </h2>
        <p className="deposit-welcome" style={{ marginTop: 0 }}>
          {t('wallet_requests_balance')}: {walletSummary.mainBalance.toFixed(2)} USDT
          <Link to="/wallet" className="deposit-wallet-link" style={{ marginLeft: 8, fontSize: '0.9em' }}>
            ({t('wallet_overview_link')})
          </Link>
        </p>
        {isWithdrawPage ? (
          <p className="deposit-welcome" style={{ marginTop: -4, fontSize: '0.92rem', opacity: 0.88 }}>
            المتاح للسحب يُحتسب تلقائيًا وفق سياسة السحب الحالية وحالة أصل الإيداع في حسابك.
          </p>
        ) : null}
        {withdrawSummary ? (
          <div className="owner-history-card" style={{ marginBottom: 12 }}>
            <div className="owner-form-row" style={{ marginBottom: 6 }}>
              <span className="owner-hint">{withdrawSummary.status_message}</span>
              <span className="owner-hint">تُحتسب الرسوم والمتاح للسحب تلقائيًا وفق القاعدة الحالية.</span>
            </div>
            <div className="owner-form-row" style={{ marginBottom: 6 }}>
              <span className="owner-hint">{t('wallet_lock_withdrawable')}: {walletSummary.withdrawableBalance.toFixed(2)} USDT</span>
              <span className="owner-hint">هذا هو المبلغ المتاح للسحب فعليًا من حسابك حاليًا.</span>
            </div>
            <div className="owner-form-row" style={{ marginBottom: 0 }}>
              <span className="owner-hint">
                {withdrawSummary.requires_owner_approval
                  ? 'إذا بقي جزء غير متاح الآن، فذلك لأنه ما يزال تحت مراجعة إدارة المخاطر حتى يتم فتحه إداريًا.'
                  : 'إذا بقي جزء غير متاح الآن، فسيظهر تلقائيًا ضمن المتاح للسحب عند تحقق الأهلية.'}
              </span>
              <span className={`request-status-badge ${withdrawSummary.is_principal_unlocked ? 'status-approved' : 'status-pending'}`}>
                {withdrawSummary.is_principal_unlocked ? t('wallet_lock_unlocked') : t('wallet_lock_locked')}
              </span>
            </div>
          </div>
        ) : null}
        <div className="owner-history-card" style={{ marginBottom: 12 }}>
          <h3 className="owner-wallet-heading">{t('wallet_lock_batches_title')}</h3>
          {principalLocks.length === 0 ? (
            <p className="owner-empty">{t('wallet_lock_batches_empty')}</p>
          ) : (
            <ul className="owner-history-list">
              {principalLocks.map((lock) => (
                <li key={`lock-${lock.id}`} className="owner-history-item">
                  <span>#{lock.id}</span>
                  <span>{lock.display_title}</span>
                  <span>{lock.display_message}</span>
                  <span className={`request-status-badge ${lock.lock_status === 'unlocked' ? 'status-approved' : 'status-pending'}`}>
                    {lock.lock_status === 'unlocked' ? t('wallet_lock_unlocked') : t('wallet_lock_locked')}
                  </span>
                  <span className="owner-history-date">{lock.created_at}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {requestMessage ? (
          <div className={`owner-message owner-message-${requestMessage.type}`}>{requestMessage.text}</div>
        ) : null}
        <div className="owner-image-grid">
          {isDepositPage ? (
            <div className="owner-actions-card">
              <h3 className="owner-wallet-heading">{t('wallet_requests_deposit_title')}</h3>
              <p className="owner-hint">{t('wallet_requests_quick_amounts')}</p>
              <div className="wallet-quick-amounts-grid">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={`dep-quick-${v}`}
                    type="button"
                    className={`wallet-action-btn ${Number(depositAmount || 0) === v ? 'wallet-action-deposit' : 'owner-set-btn'}`}
                    onClick={() => setDepositAmount(String(v))}
                  >
                    {v}$
                  </button>
                ))}
              </div>
              <div className="owner-form-row">
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="field-input owner-amount-input wallet-amount-input-lg"
                  placeholder={t('wallet_requests_amount')}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
              <div className="owner-hint" style={{ marginTop: -4, marginBottom: 10 }}>
                {t('wallet_requests_deposit_method_usdt')}
              </div>
              <input
                type="text"
                className="field-input owner-note-input"
                placeholder={t('wallet_requests_transfer_ref')}
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
              />
              <input
                type="text"
                className="field-input owner-note-input"
                placeholder={t('wallet_requests_notes')}
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
              />
              <div className="deposit-proof-row">
                <label className="profile-settings-upload-btn owner-upload-btn">
                  {t('wallet_requests_upload_proof')}
                  <input type="file" accept="image/*" onChange={(e) => setProofImage(e.target.files?.[0] || null)} />
                </label>
                <button
                  type="button"
                  className="deposit-proof-help-btn"
                  onClick={() => setProofExampleOpen(true)}
                  aria-label={t('wallet_requests_proof_example_open')}
                  title={t('wallet_requests_proof_example_open')}
                >
                  ?
                </button>
              </div>
              <div className="owner-form-row" style={{ alignItems: 'center' }}>
                <span className="owner-hint" style={{ margin: 0 }}>
                  {proofImage
                    ? `${t('wallet_requests_proof_selected')}: ${proofImage.name}`
                    : t('wallet_requests_proof_not_selected')}
                </span>
                {proofImage ? (
                  <button
                    type="button"
                    className="wallet-action-btn owner-set-btn"
                    onClick={() => setProofImage(null)}
                  >
                    {t('wallet_requests_clear_proof')}
                  </button>
                ) : null}
              </div>
              <p className="owner-hint">{t('wallet_requests_min_deposit')}: {rules.minDeposit} USDT</p>
              <button
                type="button"
                className="wallet-action-btn wallet-action-deposit owner-image-action"
                onClick={submitDepositRequest}
                disabled={depositSubmitting}
              >
                {depositSubmitting ? t('common_loading') : t('wallet_requests_submit_deposit')}
              </button>
            </div>
          ) : null}

          {isWithdrawPage ? (
            <div className="owner-actions-card">
              <h3 className="owner-wallet-heading">{t('wallet_requests_withdraw_title')}</h3>
              <p className="owner-hint">{t('wallet_requests_quick_amounts')}</p>
              <div className="wallet-quick-amounts-grid">
                {QUICK_AMOUNTS.map((v) => (
                  <button
                    key={`wd-quick-${v}`}
                    type="button"
                    className={`wallet-action-btn ${Number(withdrawAmount || 0) === v ? 'wallet-action-withdraw' : 'owner-set-btn'}`}
                    onClick={() => setWithdrawAmount(String(v))}
                  >
                    {v}$
                  </button>
                ))}
              </div>
              <div className="owner-form-row wallet-withdraw-amount-row">
                <input
                  type="number"
                  min={0}
                  step="any"
                  className="field-input owner-amount-input wallet-amount-input-lg wallet-withdraw-amount-input"
                  placeholder={t('wallet_requests_amount')}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
              <div className="owner-form-row wallet-withdraw-method-row">
                <select
                  className="field-input owner-image-key wallet-withdraw-method-select"
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                >
                  {(rules.withdrawalMethods || []).map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                className="field-input owner-note-input"
                placeholder={t('wallet_requests_account_info')}
                value={withdrawAccountInfo}
                onChange={(e) => setWithdrawAccountInfo(e.target.value)}
              />
              <input
                type="text"
                className="field-input owner-note-input"
                placeholder={t('wallet_requests_notes')}
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
              />
              <p className="owner-hint">
                {t('wallet_requests_min_withdraw')}: {rules.minWithdrawal} USDT
                {rules.withdrawalFeePercent > 0 ? ` | ${t('wallet_requests_withdraw_fee')}: ${rules.withdrawalFeePercent}%` : ''}
              </p>
              <button
                type="button"
                className="wallet-action-btn wallet-action-withdraw owner-image-action"
                onClick={submitWithdrawRequest}
                disabled={withdrawSubmitting}
              >
                {withdrawSubmitting ? t('common_loading') : t('wallet_requests_submit_withdraw')}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="deposit-section">
        <h2 className="deposit-section-title">{t('wallet_requests_history_title')}</h2>
        <div className="owner-form-row">
          <select
            className="field-input owner-image-key"
            value={requestStatusFilter}
            onChange={(e) => setRequestStatusFilter(e.target.value as '' | BalanceRequestStatus)}
          >
            <option value="">{t('wallet_requests_filter_all')}</option>
            <option value="pending">{t('wallet_requests_status_pending')}</option>
            <option value="approved">{t('wallet_requests_status_approved')}</option>
            <option value="rejected">{t('wallet_requests_status_rejected')}</option>
            <option value="completed">{t('wallet_requests_status_completed')}</option>
          </select>
        </div>
        <div className="owner-history-card">
          <h3 className="owner-wallet-heading">
            {isWithdrawPage ? t('wallet_requests_withdraw_title') : t('wallet_requests_deposit_title')}
          </h3>
          {isDepositPage ? (
            depositRequests.length === 0 ? (
              <p className="owner-empty">{t('wallet_requests_empty')}</p>
            ) : (
              <ul className="owner-history-list">
                {depositRequests.map((item) => (
                  <li key={`dep-${item.id}`} className="owner-history-item">
                    <span>#{item.id}</span>
                    <span>{Number(item.amount).toFixed(2)} {item.currency}</span>
                    <span>{item.method}</span>
                    <span className={`request-status-badge ${statusBadgeClass(item.request_status)}`}>
                      {statusLabel(item.request_status)}
                    </span>
                    {item.proof_image_path ? (
                      <a href={item.proof_image_path} target="_blank" rel="noreferrer" className="owner-nav-link">
                        {t('wallet_requests_view_proof')}
                      </a>
                    ) : null}
                    <span className="owner-history-date">{item.created_at}</span>
                    {item.admin_note ? <span className="owner-history-note">{item.admin_note}</span> : null}
                  </li>
                ))}
              </ul>
            )
          ) : withdrawalRequests.length === 0 ? (
            <p className="owner-empty">{t('wallet_requests_empty')}</p>
          ) : (
            <ul className="owner-history-list">
              {withdrawalRequests.map((item) => (
                <li key={`wd-${item.id}`} className="owner-history-item">
                  <span>#{item.id}</span>
                  <span>{Number(item.amount).toFixed(2)} {item.currency}</span>
                  <span>{item.method}</span>
                  <span>
                    {getWithdrawalRequestDetails(item.account_info).map((detail) => (
                      <div key={`${item.id}-${detail}`}>{detail}</div>
                    ))}
                  </span>
                  <span className={`request-status-badge ${statusBadgeClass(item.request_status)}`}>
                    {statusLabel(item.request_status)}
                  </span>
                  <span className="owner-history-date">{item.created_at}</span>
                  {item.user_notes ? <span className="owner-history-note">{item.user_notes}</span> : null}
                  {item.admin_note ? <span className="owner-history-note">{item.admin_note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="deposit-section deposit-tiers">
        <div className="deposit-tier">
          <span className="deposit-tier-label">أقل ترقية</span>
          <span className="deposit-tier-amount">75$</span>
        </div>
        <div className="deposit-tier deposit-tier-popular">
          <span className="deposit-tier-badge">الأكثر رواجاً</span>
          <span className="deposit-tier-amount">499$</span>
        </div>
        <div className="deposit-tier">
          <span className="deposit-tier-label">الترقية</span>
          <span className="deposit-tier-amount">1000$</span>
        </div>
      </section>

      <p className="deposit-welcome">
        مرحباً بك في BREAK CASH. ابدأ بإيداعك وارتقِ بمستواك للاستفادة من الامتيازات الحصرية.
      </p>

      <button
        type="button"
        className="deposit-terms-link"
        onClick={() => setTermsOpen(true)}
      >
        تعرف على الامتيازات والشروط
      </button>

      {termsOpen && (
        <AppModalPortal>
        <div className="deposit-terms-overlay liquid-modal-backdrop" onClick={() => setTermsOpen(false)}>
          <div
            className="deposit-terms-modal liquid-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="امتيازات وشروط الاشتراك"
          >
            <div className="deposit-terms-content">
              {DEPOSIT_TERMS_AR.split('\n\n').map((p, i) => (
                <p key={i} className="deposit-terms-para">
                  {p}
                </p>
              ))}
            </div>
            <button
              type="button"
              className="deposit-terms-close"
              onClick={() => setTermsOpen(false)}
            >
              إغلاق
            </button>
          </div>
        </div>
        </AppModalPortal>
      )}

      {proofExampleOpen ? (
        <AppModalPortal>
        <div className="deposit-terms-overlay liquid-modal-backdrop" onClick={() => setProofExampleOpen(false)}>
          <div
            className="deposit-proof-modal liquid-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('wallet_requests_proof_example_title')}
          >
            <div className="deposit-proof-modal-header">
              <h3 className="deposit-proof-modal-title">{t('wallet_requests_proof_example_title')}</h3>
              <button
                type="button"
                className="deposit-proof-close-icon"
                onClick={() => setProofExampleOpen(false)}
                aria-label={t('wallet_requests_proof_example_close')}
              >
                ×
              </button>
            </div>
            <div className="deposit-proof-content">
              {effectiveProofExampleUrl && !proofExampleBroken ? (
                <img
                  src={effectiveProofExampleUrl}
                  alt={t('wallet_requests_proof_example_title')}
                  className="deposit-proof-image"
                  onError={() => setProofExampleBroken(true)}
                />
              ) : (
                <div className="deposit-proof-placeholder">{t('wallet_requests_proof_example_empty')}</div>
              )}
            </div>
            <button
              type="button"
              className="deposit-terms-close"
              onClick={() => setProofExampleOpen(false)}
            >
              {t('wallet_requests_proof_example_close')}
            </button>
          </div>
        </div>
        </AppModalPortal>
      ) : null}
    </div>
  )
}
