import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import {
  apiFetch,
  completeAdminWithdrawalRequest,
  getAdminUnlockOverride,
  getAdminDepositRequests,
  getAdminWithdrawalRequests,
  getAdminUserWallet,
  getBalanceRules,
  reviewAdminDepositRequest,
  reviewAdminWithdrawalRequest,
  upsertAdminUnlockOverride,
  type BalanceRequestStatus,
  type BalanceRules,
  type DepositRequestItem,
  type WithdrawalSummary,
  type WithdrawalRequestItem,
  updateBalanceRules,
} from '../../api'
import { useI18n } from '../../i18nCore'
import { getWithdrawalRequestDetails } from '../../utils/withdrawRequestDetails'

function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="admin-trace-copy"
      title={label || t('admin_copy_id')}
      aria-label={t('admin_copy_id')}
    >
      <Copy size={14} />
      {copied ? <span className="admin-trace-copied"> {t('admin_copied')}</span> : null}
    </button>
  )
}

export function AdminBalancesPage() {
  const { t } = useI18n()
  const [userId, setUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
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
  const [statusFilter, setStatusFilter] = useState<'' | BalanceRequestStatus>('pending')
  const [depositItems, setDepositItems] = useState<DepositRequestItem[]>([])
  const [withdrawItems, setWithdrawItems] = useState<WithdrawalRequestItem[]>([])
  const [adminNoteById, setAdminNoteById] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [rulesSaving, setRulesSaving] = useState(false)
  const [overrideUserId, setOverrideUserId] = useState('')
  const [overrideLoading, setOverrideLoading] = useState(false)
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [overrideForceUnlock, setOverrideForceUnlock] = useState(false)
  const [overrideCustomRatio, setOverrideCustomRatio] = useState('')
  const [overrideCustomMinProfit, setOverrideCustomMinProfit] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [overrideSummary, setOverrideSummary] = useState<WithdrawalSummary | null>(null)
  const [traceUserId, setTraceUserId] = useState('')
  const [traceLoading, setTraceLoading] = useState(false)
  const [traceData, setTraceData] = useState<Awaited<ReturnType<typeof getAdminUserWallet>> | null>(null)

  async function adjust(type: 'add' | 'deduct') {
    setMessage(null)
    try {
      await apiFetch('/api/balance/adjust', {
        method: 'POST',
        body: JSON.stringify({
          userId: Number(userId),
          amount: Number(amount),
          currency: 'USDT',
          type,
          note,
        }),
      })
      setNote('')
      setMessage({ type: 'success', text: t('admin_wallet_adjust_success') })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
    }
  }

  async function loadRequests() {
    setLoadingRequests(true)
    try {
      const [depRes, wdRes] = await Promise.all([
        getAdminDepositRequests(statusFilter || undefined),
        getAdminWithdrawalRequests(statusFilter || undefined),
      ])
      setDepositItems(depRes.items || [])
      setWithdrawItems(wdRes.items || [])
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
    } finally {
      setLoadingRequests(false)
    }
  }

  useEffect(() => {
    getBalanceRules()
      .then((res) => setRules(res.rules))
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadRequests().catch(() => {})
  }, [statusFilter])

  function getStatusLabel(status: BalanceRequestStatus) {
    if (status === 'approved') return t('wallet_requests_status_approved')
    if (status === 'rejected') return t('wallet_requests_status_rejected')
    if (status === 'completed') return t('wallet_requests_status_completed')
    return t('wallet_requests_status_pending')
  }

  function statusClass(status: BalanceRequestStatus) {
    if (status === 'approved') return 'status-approved'
    if (status === 'rejected') return 'status-rejected'
    if (status === 'completed') return 'status-completed'
    return 'status-pending'
  }

  async function saveRules() {
    setRulesSaving(true)
    setMessage(null)
    try {
      const cleaned: BalanceRules = {
        ...rules,
        minDeposit: Number(rules.minDeposit || 0),
        minWithdrawal: Number(rules.minWithdrawal || 0),
        withdrawalFeePercent: Number(rules.withdrawalFeePercent || 0),
        minimumProfitToUnlock: Number(rules.minimumProfitToUnlock || 0),
        defaultUnlockRatio: Number(rules.defaultUnlockRatio || 0),
        depositMethods: rules.depositMethods.map((x) => x.trim()).filter(Boolean),
        withdrawalMethods: rules.withdrawalMethods.map((x) => x.trim()).filter(Boolean),
      }
      if (cleaned.depositMethods.length === 0) cleaned.depositMethods = ['USDT TRC20']
      if (cleaned.withdrawalMethods.length === 0) cleaned.withdrawalMethods = ['USDT TRC20']
      const res = await updateBalanceRules(cleaned)
      setRules(res.rules)
      setMessage({ type: 'success', text: t('admin_wallet_rules_saved') })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
    } finally {
      setRulesSaving(false)
    }
  }

  async function reviewDeposit(requestId: number, action: 'approve' | 'reject') {
    setMessage(null)
    try {
      await reviewAdminDepositRequest({
        requestId,
        action,
        adminNote: adminNoteById[`dep_${requestId}`] || '',
      })
      setMessage({ type: 'success', text: t('admin_wallet_request_updated') })
      await loadRequests()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
    }
  }

  async function reviewWithdrawal(requestId: number, action: 'approve' | 'reject') {
    setMessage(null)
    try {
      await reviewAdminWithdrawalRequest({
        requestId,
        action,
        adminNote: adminNoteById[`wd_${requestId}`] || '',
      })
      setMessage({ type: 'success', text: t('admin_wallet_request_updated') })
      await loadRequests()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
    }
  }

  async function completeWithdrawal(requestId: number) {
    setMessage(null)
    try {
      await completeAdminWithdrawalRequest(requestId, adminNoteById[`wd_${requestId}`] || '')
      setMessage({ type: 'success', text: t('admin_wallet_request_updated') })
      await loadRequests()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
    }
  }

  async function loadOverride() {
    const uid = Number(overrideUserId)
    if (!uid || !Number.isFinite(uid)) {
      setMessage({ type: 'error', text: t('wallet_requests_invalid_input') })
      return
    }
    setOverrideLoading(true)
    setMessage(null)
    try {
      const res = await getAdminUnlockOverride(uid)
      setOverrideForceUnlock(Number(res.override.force_unlock_principal || 0) === 1)
      setOverrideCustomRatio(
        res.override.custom_unlock_ratio == null ? '' : String(Number(res.override.custom_unlock_ratio)),
      )
      setOverrideCustomMinProfit(
        res.override.custom_min_profit == null ? '' : String(Number(res.override.custom_min_profit)),
      )
      setOverrideNote(String(res.override.note || ''))
      setOverrideSummary(res.summary || null)
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
    } finally {
      setOverrideLoading(false)
    }
  }

  async function saveOverride() {
    const uid = Number(overrideUserId)
    if (!uid || !Number.isFinite(uid)) {
      setMessage({ type: 'error', text: t('wallet_requests_invalid_input') })
      return
    }
    setOverrideSaving(true)
    setMessage(null)
    try {
      const res = await upsertAdminUnlockOverride({
        userId: uid,
        forceUnlockPrincipal: overrideForceUnlock,
        customUnlockRatio: overrideCustomRatio === '' ? null : Number(overrideCustomRatio),
        customMinProfit: overrideCustomMinProfit === '' ? null : Number(overrideCustomMinProfit),
        note: overrideNote,
      })
      setOverrideSummary(res.summary || null)
      setMessage({ type: 'success', text: t('admin_wallet_rules_saved') })
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
    } finally {
      setOverrideSaving(false)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('admin_wallet_title')}</h1>
      {message ? <div className={`owner-message owner-message-${message.type}`}>{message.text}</div> : null}

      <div className="card login-form">
        <h3 className="owner-wallet-heading">{t('admin_wallet_adjust_title')}</h3>
        <input
          className="field-input"
          placeholder={t('admin_wallet_user_id')}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          className="field-input"
          placeholder={t('admin_wallet_amount')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="field-input"
          placeholder={t('admin_wallet_note')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="wallet-actions">
          <button className="wallet-action-btn wallet-action-deposit" type="button" onClick={() => adjust('add')}>
            {t('admin_wallet_add')}
          </button>
          <button className="wallet-action-btn wallet-action-withdraw" type="button" onClick={() => adjust('deduct')}>
            {t('admin_wallet_deduct')}
          </button>
        </div>
      </div>

      <div className="card login-form">
        <h3 className="owner-wallet-heading">{t('admin_wallet_rules_title')}</h3>
        <p className="owner-hint">
          هذه القواعد مرتبطة مباشرة بالنظام المالي الجديد فقط، وتُطبَّق على طلبات الإيداع والسحب الجديدة فور الحفظ.
        </p>
        <div className="owner-history-card" style={{ marginBottom: 14 }}>
          <h4 className="owner-wallet-heading">شرح الأدوات</h4>
          <div className="owner-hint" style={{ marginTop: 0 }}>
            <div>1. `الحد الأدنى للإيداع`: أقل مبلغ يستطيع المستخدم إرسال طلب إيداع به.</div>
            <div>2. `طرق الإيداع`: الشبكات أو الطرق المقبولة، وتُكتب مفصولة بفاصلة.</div>
            <div>3. `الحد الأدنى للسحب`: أقل مبلغ مسموح للمستخدم بطلب سحبه.</div>
            <div>4. `رسوم السحب`: نسبة مئوية تخصم عند تنفيذ السحب في النظام المالي الجديد.</div>
            <div>5. `مراجعة يدوية`: إذا كانت مفعلة تبقى الطلبات بحاجة لاعتماد إداري قبل الإتمام.</div>
            <div>6. `الحد الأدنى للربح لفك الأصل`: يحدد مقدار الربح المطلوب قبل السماح بسحب أصل الإيداع.</div>
            <div>7. `نسبة الفتح الافتراضية`: نسبة الربح المطلوبة مقارنة بأصل الإيداع إذا لم يوجد تخصيص حسب VIP.</div>
            <div>8. `نسب VIP`: تسمح لك بتخفيف أو تشديد شرط فك أصل الإيداع حسب مستوى المستخدم.</div>
          </div>
        </div>
        <div className="owner-history-card" style={{ marginBottom: 14 }}>
          <h4 className="owner-wallet-heading">قواعد الإيداع</h4>
          <p className="owner-hint" style={{ marginTop: 0 }}>
            حدّد أقل مبلغ إيداع والطرق المقبولة لإنشاء طلبات الإيداع.
          </p>
          <div className="owner-form-row">
            <input
              className="field-input"
              type="number"
              min={0}
              step="any"
              placeholder={t('wallet_requests_min_deposit')}
              value={String(rules.minDeposit)}
              onChange={(e) => setRules((prev) => ({ ...prev, minDeposit: Number(e.target.value || 0) }))}
            />
            <input
              className="field-input"
              placeholder={t('admin_wallet_deposit_methods')}
              value={rules.depositMethods.join(', ')}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  depositMethods: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
                }))
              }
            />
          </div>
        </div>
        <div className="owner-history-card" style={{ marginBottom: 14 }}>
          <h4 className="owner-wallet-heading">قواعد السحب</h4>
          <p className="owner-hint" style={{ marginTop: 0 }}>
            حدّد الحد الأدنى والرسوم وطرق السحب المسموح بها. الرسوم تُحتسب عند تنفيذ السحب في النظام المالي الجديد.
          </p>
          <div className="owner-form-row">
            <input
              className="field-input"
              type="number"
              min={0}
              step="any"
              placeholder={t('wallet_requests_min_withdraw')}
              value={String(rules.minWithdrawal)}
              onChange={(e) => setRules((prev) => ({ ...prev, minWithdrawal: Number(e.target.value || 0) }))}
            />
            <input
              className="field-input"
              type="number"
              min={0}
              step="any"
              placeholder={t('wallet_requests_withdraw_fee')}
              value={String(rules.withdrawalFeePercent)}
              onChange={(e) => setRules((prev) => ({ ...prev, withdrawalFeePercent: Number(e.target.value || 0) }))}
            />
          </div>
          <input
            className="field-input"
            placeholder={t('admin_wallet_withdraw_methods')}
            value={rules.withdrawalMethods.join(', ')}
            onChange={(e) =>
              setRules((prev) => ({
                ...prev,
                withdrawalMethods: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
              }))
            }
          />
          <label className="owner-hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={rules.manualReview}
              onChange={(e) => setRules((prev) => ({ ...prev, manualReview: e.target.checked }))}
            />
            {t('admin_wallet_manual_review')}
          </label>
        </div>
        <div className="owner-history-card" style={{ marginBottom: 14 }}>
          <h4 className="owner-wallet-heading">قواعد فتح أصل الإيداع</h4>
          <p className="owner-hint" style={{ marginTop: 0 }}>
            هذه القواعد تضبط متى يصبح أصل الإيداع قابلاً للسحب بحسب الربح ونسبة الفتح الافتراضية أو حسب مستوى VIP.
          </p>
          <div className="owner-unlock-grid">
            <div className="owner-unlock-field">
              <label className="owner-unlock-label">الربح المطلوب قبل سحب أصل الإيداع</label>
              <p className="owner-unlock-help">
                اكتب مقدار الربح الذي يجب أن يحققه المستخدم أولًا قبل السماح له بسحب أصل الإيداع.
              </p>
              <input
                className="field-input"
                type="number"
                min={0}
                step="any"
                placeholder={t('wallet_lock_min_profit_to_unlock')}
                value={String(rules.minimumProfitToUnlock)}
                onChange={(e) => setRules((prev) => ({ ...prev, minimumProfitToUnlock: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="owner-unlock-field">
              <label className="owner-unlock-label">النسبة الافتراضية لفتح أصل الإيداع</label>
              <p className="owner-unlock-help">
                هذه النسبة تُستخدم لجميع المستخدمين ما لم يكن هناك تخصيص مختلف حسب مستوى VIP.
              </p>
              <input
                className="field-input"
                type="number"
                min={0}
                step="any"
                placeholder={t('wallet_lock_default_unlock_ratio')}
                value={String(rules.defaultUnlockRatio)}
                onChange={(e) => setRules((prev) => ({ ...prev, defaultUnlockRatio: Number(e.target.value || 0) }))}
              />
            </div>
          </div>
          <div className="owner-unlock-vip-head">
            <strong>نسب الفتح حسب مستويات VIP</strong>
            <span className="owner-unlock-help">
              خصص نسبة مختلفة لكل مستوى VIP إذا كنت لا تريد الاعتماد على النسبة الافتراضية.
            </span>
          </div>
          <div className="owner-unlock-vip-grid">
            {[0, 1, 2, 3, 4, 5].map((lvl) => (
              <div key={lvl} className="owner-unlock-vip-card">
                <label className="owner-unlock-label">{lvl === 0 ? 'مستخدم عادي' : `VIP ${lvl}`}</label>
                <input
                  className="field-input"
                  type="number"
                  min={0}
                  step="any"
                  placeholder={`${t('wallet_lock_level_ratio')} VIP ${lvl}`}
                  value={String(Number(rules.unlockRatioByLevel?.[String(lvl)] ?? rules.defaultUnlockRatio))}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      unlockRatioByLevel: {
                        ...(prev.unlockRatioByLevel || {}),
                        [String(lvl)]: Number(e.target.value || 0),
                      },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div className="owner-hint" style={{ marginBottom: 12 }}>
          طريقة الاستخدام: افصل طرق الإيداع أو السحب بفاصلة مثل <span dir="ltr">USDT TRC20, Bank Transfer</span> ثم احفظ القواعد لتُطبَّق على الطلبات الجديدة فقط.
        </div>
        <button className="wallet-action-btn owner-set-btn" type="button" onClick={saveRules} disabled={rulesSaving}>
          {rulesSaving ? t('common_loading') : t('admin_wallet_save_rules')}
        </button>
      </div>

      <div className="card login-form">
        <h3 className="owner-wallet-heading">{t('wallet_lock_user_override_title')}</h3>
        <div className="owner-form-row">
          <input
            className="field-input"
            placeholder={t('admin_wallet_user_id')}
            value={overrideUserId}
            onChange={(e) => setOverrideUserId(e.target.value)}
          />
          <button type="button" className="wallet-action-btn owner-set-btn" onClick={loadOverride} disabled={overrideLoading}>
            {overrideLoading ? t('common_loading') : t('admin_wallet_reload')}
          </button>
        </div>
        <label className="owner-hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={overrideForceUnlock} onChange={(e) => setOverrideForceUnlock(e.target.checked)} />
          {t('wallet_lock_force_unlock')}
        </label>
        <div className="owner-form-row">
          <input
            className="field-input"
            type="number"
            min={0}
            step="any"
            placeholder={t('wallet_lock_custom_ratio')}
            value={overrideCustomRatio}
            onChange={(e) => setOverrideCustomRatio(e.target.value)}
          />
          <input
            className="field-input"
            type="number"
            min={0}
            step="any"
            placeholder={t('wallet_lock_custom_min_profit')}
            value={overrideCustomMinProfit}
            onChange={(e) => setOverrideCustomMinProfit(e.target.value)}
          />
        </div>
        <input
          className="field-input"
          placeholder={t('admin_wallet_admin_note')}
          value={overrideNote}
          onChange={(e) => setOverrideNote(e.target.value)}
        />
        {overrideSummary ? (
          <p className="owner-hint">
            {t('wallet_lock_withdrawable')}: {overrideSummary.withdrawable_balance.toFixed(2)} USDT | {t('wallet_lock_principal')}:{' '}
            {overrideSummary.locked_balance.toFixed(2)} USDT | {t('wallet_lock_unlock_progress')}: {overrideSummary.unlock_progress_pct.toFixed(2)}%
          </p>
        ) : null}
        <button type="button" className="wallet-action-btn owner-set-btn" onClick={saveOverride} disabled={overrideSaving}>
          {overrideSaving ? t('common_loading') : t('admin_wallet_save_rules')}
        </button>
      </div>

      <div className="card login-form">
        <h3 className="owner-wallet-heading">{t('admin_wallet_trace_title')}</h3>
        <p className="owner-hint">{t('admin_wallet_trace_links')}</p>
        <div className="owner-form-row">
          <input
            className="field-input"
            placeholder={t('admin_wallet_trace_user_id')}
            value={traceUserId}
            onChange={(e) => setTraceUserId(e.target.value)}
          />
          <button
            type="button"
            className="wallet-action-btn owner-set-btn"
            onClick={async () => {
              const uid = Number(traceUserId)
              if (!uid || !Number.isFinite(uid)) {
                setMessage({ type: 'error', text: t('wallet_requests_invalid_input') })
                return
              }
              setTraceLoading(true)
              setMessage(null)
              try {
                const data = await getAdminUserWallet(uid)
                setTraceData(data)
              } catch (e) {
                setMessage({ type: 'error', text: e instanceof Error ? e.message : t('admin_wallet_action_failed') })
                setTraceData(null)
              } finally {
                setTraceLoading(false)
              }
            }}
            disabled={traceLoading}
          >
            {traceLoading ? t('common_loading') : t('admin_wallet_trace_load')}
          </button>
        </div>
        {traceData ? (
          <div className="admin-trace-result">
            <div className="admin-trace-overview">
              <p className="admin-trace-user">
                {traceData.user?.display_name || traceData.user?.email || traceData.user?.phone || `User #${traceData.user?.id}`}
              </p>
              <div className="admin-trace-balances">
                <span>Main: {traceData.overview.main_balance.toFixed(2)} USDT</span>
                <span>Locked: {traceData.overview.locked_balance.toFixed(2)}</span>
                <span>Withdrawable: {traceData.overview.withdrawable_balance.toFixed(2)}</span>
              </div>
            </div>
            <div className="admin-trace-section">
              <h4>Wallet Transactions ({traceData.transactions.length})</h4>
              <p className="admin-trace-hint">{t('admin_wallet_trace_links')}</p>
              <ul className="admin-trace-list">
                {traceData.transactions.map((tx) => (
                  <li key={tx.id} className="admin-trace-item">
                    <span className="admin-trace-id">
                      #{tx.id}
                      <CopyButton value={String(tx.id)} />
                    </span>
                    <span>{tx.transaction_type}</span>
                    <span>{tx.source_type}</span>
                    <span className="admin-trace-ref">
                      {tx.reference_type}#{tx.reference_id ?? '—'}
                      {(tx.reference_type || tx.reference_id) && (
                        <CopyButton value={`${tx.reference_type || ''}#${tx.reference_id ?? ''}`} />
                      )}
                    </span>
                    <span className={tx.net_amount >= 0 ? 'admin-trace-pos' : 'admin-trace-neg'}>
                      {tx.net_amount} {tx.currency}
                    </span>
                    <span className="admin-trace-date">{new Date(tx.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="admin-trace-section">
              <h4>Earning Entries ({traceData.earning_entries.length})</h4>
              <p className="admin-trace-hint">{t('admin_wallet_trace_earning_hint')}</p>
              <ul className="admin-trace-list">
                {traceData.earning_entries.map((e) => (
                  <li key={e.id} className="admin-trace-item">
                    <span className="admin-trace-id">
                      #{e.id}
                      <CopyButton value={String(e.id)} />
                    </span>
                    <span>{e.source_type}</span>
                    <span className="admin-trace-ref">
                      {e.reference_type}#{e.reference_id}
                      <CopyButton value={`${e.reference_type}#${e.reference_id}`} />
                    </span>
                    <span>{e.amount} {e.currency}</span>
                    <span className={e.status === 'transferred' ? 'admin-trace-transferred' : 'admin-trace-pending'}>
                      {e.status}
                    </span>
                    {e.transferred_wallet_txn_id ? (
                      <span className="admin-trace-link">
                        → txn#{e.transferred_wallet_txn_id}
                        <CopyButton value={String(e.transferred_wallet_txn_id)} />
                      </span>
                    ) : (
                      <span className="admin-trace-nolink">—</span>
                    )}
                    <span className="admin-trace-date">{new Date(e.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="card login-form">
        <h3 className="owner-wallet-heading">{t('admin_wallet_requests_title')}</h3>
        <div className="owner-form-row">
          <select
            className="field-input owner-image-key"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | BalanceRequestStatus)}
          >
            <option value="">{t('wallet_requests_filter_all')}</option>
            <option value="pending">{t('wallet_requests_status_pending')}</option>
            <option value="approved">{t('wallet_requests_status_approved')}</option>
            <option value="rejected">{t('wallet_requests_status_rejected')}</option>
            <option value="completed">{t('wallet_requests_status_completed')}</option>
          </select>
          <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => loadRequests()}>
            {t('admin_wallet_reload')}
          </button>
        </div>
        {loadingRequests ? <p className="owner-empty">{t('common_loading')}</p> : null}
      </div>

      <div className="card login-form">
        <h3 className="owner-wallet-heading">{t('wallet_requests_deposit_title')}</h3>
        {depositItems.length === 0 ? (
          <p className="owner-empty">{t('wallet_requests_empty')}</p>
        ) : (
          <ul className="owner-history-list">
            {depositItems.map((item) => (
              <li key={`dep-${item.id}`} className="owner-history-item">
                <span>#{item.id}</span>
                <span>{item.user_display_name || item.user_email || item.user_phone || `#${item.user_id}`}</span>
                <span>{Number(item.amount).toFixed(2)} {item.currency}</span>
                <span>{item.method}</span>
                <span className={`request-status-badge ${statusClass(item.request_status)}`}>{getStatusLabel(item.request_status)}</span>
                <input
                  className="field-input"
                  placeholder={t('admin_wallet_admin_note')}
                  value={adminNoteById[`dep_${item.id}`] || ''}
                  onChange={(e) => setAdminNoteById((prev) => ({ ...prev, [`dep_${item.id}`]: e.target.value }))}
                />
                {item.proof_image_path ? (
                  <a href={item.proof_image_path} target="_blank" rel="noreferrer" className="owner-nav-link">
                    {t('wallet_requests_view_proof')}
                  </a>
                ) : null}
                {item.request_status === 'pending' ? (
                  <div className="owner-buttons">
                    <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={() => reviewDeposit(item.id, 'approve')}>
                      {t('admin_wallet_approve')}
                    </button>
                    <button type="button" className="wallet-action-btn wallet-action-withdraw" onClick={() => reviewDeposit(item.id, 'reject')}>
                      {t('admin_wallet_reject')}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card login-form">
        <h3 className="owner-wallet-heading">{t('wallet_requests_withdraw_title')}</h3>
        {withdrawItems.length === 0 ? (
          <p className="owner-empty">{t('wallet_requests_empty')}</p>
        ) : (
          <ul className="owner-history-list">
            {withdrawItems.map((item) => (
              <li key={`wd-${item.id}`} className="owner-history-item">
                <span>#{item.id}</span>
                <span>{item.user_display_name || item.user_email || item.user_phone || `#${item.user_id}`}</span>
                <span>{Number(item.amount).toFixed(2)} {item.currency}</span>
                <span>{item.method}</span>
                <span>
                  {getWithdrawalRequestDetails(item.account_info).map((detail) => (
                    <div key={`${item.id}-${detail}`}>{detail}</div>
                  ))}
                </span>
                <span className={`request-status-badge ${statusClass(item.request_status)}`}>{getStatusLabel(item.request_status)}</span>
                <input
                  className="field-input"
                  placeholder={t('admin_wallet_admin_note')}
                  value={adminNoteById[`wd_${item.id}`] || ''}
                  onChange={(e) => setAdminNoteById((prev) => ({ ...prev, [`wd_${item.id}`]: e.target.value }))}
                />
                {item.user_notes ? <span className="owner-history-note">{item.user_notes}</span> : null}
                {item.request_status === 'pending' ? (
                  <div className="owner-buttons">
                    <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={() => reviewWithdrawal(item.id, 'approve')}>
                      {t('admin_wallet_approve')}
                    </button>
                    <button type="button" className="wallet-action-btn wallet-action-withdraw" onClick={() => reviewWithdrawal(item.id, 'reject')}>
                      {t('admin_wallet_reject')}
                    </button>
                  </div>
                ) : null}
                {item.request_status === 'approved' ? (
                  <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => completeWithdrawal(item.id)}>
                    {t('admin_wallet_complete')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
