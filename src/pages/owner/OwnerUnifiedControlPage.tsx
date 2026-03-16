import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  completeAdminWithdrawalRequest,
  getAdminDepositRequests,
  getAdminWithdrawalRequests,
  reviewAdminDepositRequest,
  reviewAdminWithdrawalRequest,
  type AuthUser,
  type BalanceRequestStatus,
  type DepositRequestItem,
  type WithdrawalRequestItem,
} from '../../api'
import { useI18n } from '../../i18nCore'

type OwnerUnifiedControlPageProps = {
  user: AuthUser | null
}

type FeatureState = 'ready' | 'partial' | 'missing'

type FeatureItem = {
  id: string
  titleKey: string
  descKey: string
  status: FeatureState
  route?: string
}

export function OwnerUnifiedControlPage({ user }: OwnerUnifiedControlPageProps) {
  const { t } = useI18n()
  const [statusFilter, setStatusFilter] = useState<'' | BalanceRequestStatus>('pending')
  const [loading, setLoading] = useState(false)
  const [depositItems, setDepositItems] = useState<DepositRequestItem[]>([])
  const [withdrawItems, setWithdrawItems] = useState<WithdrawalRequestItem[]>([])
  const [adminNoteById, setAdminNoteById] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isOwner = user?.role === 'owner'
  if (user && !isOwner) return <Navigate to="/portfolio" replace />

  const executableFeatures = useMemo<FeatureItem[]>(
    () => [
      {
        id: 'users',
        titleKey: 'owner_unified_feature_users_title',
        descKey: 'owner_unified_feature_users_desc',
        status: 'ready',
        route: '/admin/users',
      },
      {
        id: 'balances',
        titleKey: 'owner_unified_feature_balances_title',
        descKey: 'owner_unified_feature_balances_desc',
        status: 'ready',
        route: '/admin/balances',
      },
      {
        id: 'invites',
        titleKey: 'owner_unified_feature_invites_title',
        descKey: 'owner_unified_feature_invites_desc',
        status: 'ready',
        route: '/admin/invites',
      },
      {
        id: 'premium',
        titleKey: 'owner_unified_feature_premium_title',
        descKey: 'owner_unified_feature_premium_desc',
        status: 'ready',
        route: '/owner/premium',
      },
      {
        id: 'operations',
        titleKey: 'owner_unified_feature_operations_title',
        descKey: 'owner_unified_feature_operations_desc',
        status: 'ready',
        route: '/owner/operations',
      },
      {
        id: 'permissions-view',
        titleKey: 'owner_unified_feature_permissions_title',
        descKey: 'owner_unified_feature_permissions_desc',
        status: 'ready',
        route: '/admin/permissions',
      },
    ],
    [],
  )

  const coverageGaps = useMemo<FeatureItem[]>(
    () => [
      {
        id: 'permissions-editor',
        titleKey: 'owner_unified_gap_permissions_editor_title',
        descKey: 'owner_unified_gap_permissions_editor_desc',
        status: 'partial',
      },
      {
        id: 'invites-revoke',
        titleKey: 'owner_unified_gap_invites_revoke_title',
        descKey: 'owner_unified_gap_invites_revoke_desc',
        status: 'partial',
      },
      {
        id: 'premium-placeholders',
        titleKey: 'owner_unified_gap_premium_sections_title',
        descKey: 'owner_unified_gap_premium_sections_desc',
        status: 'partial',
      },
      {
        id: 'single-surface',
        titleKey: 'owner_unified_gap_single_surface_title',
        descKey: 'owner_unified_gap_single_surface_desc',
        status: 'missing',
      },
    ],
    [],
  )

  useEffect(() => {
    loadRequests().catch(() => {})
  }, [statusFilter])

  async function loadRequests() {
    setLoading(true)
    setMessage(null)
    try {
      const [depRes, wdRes] = await Promise.all([
        getAdminDepositRequests(statusFilter || undefined),
        getAdminWithdrawalRequests(statusFilter || undefined),
      ])
      setDepositItems(depRes.items || [])
      setWithdrawItems(wdRes.items || [])
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : t('admin_wallet_action_failed'),
      })
    } finally {
      setLoading(false)
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
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : t('admin_wallet_action_failed'),
      })
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
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : t('admin_wallet_action_failed'),
      })
    }
  }

  async function completeWithdrawal(requestId: number) {
    setMessage(null)
    try {
      await completeAdminWithdrawalRequest(requestId, adminNoteById[`wd_${requestId}`] || '')
      setMessage({ type: 'success', text: t('admin_wallet_request_updated') })
      await loadRequests()
    } catch (e) {
      setMessage({
        type: 'error',
        text: e instanceof Error ? e.message : t('admin_wallet_action_failed'),
      })
    }
  }

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

  function featureStatusLabel(status: FeatureState) {
    if (status === 'ready') return t('owner_unified_feature_status_ready')
    if (status === 'partial') return t('owner_unified_feature_status_partial')
    return t('owner_unified_feature_status_missing')
  }

  return (
    <div className="page space-y-3">
      <section className="elite-panel p-4">
        <h1 className="text-lg font-semibold text-white">{t('owner_unified_title')}</h1>
        <p className="mt-1 text-sm text-app-muted">{t('owner_unified_subtitle')}</p>
      </section>

      {message ? (
        <div className={`owner-message owner-message-${message.type}`}>{message.text}</div>
      ) : null}

      <section className="card login-form">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="owner-wallet-heading">{t('owner_unified_finance_title')}</h2>
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
            <button
              type="button"
              className="wallet-action-btn owner-set-btn"
              onClick={() => loadRequests()}
            >
              {t('admin_wallet_reload')}
            </button>
          </div>
        </div>
        <p className="owner-hint">{t('owner_unified_finance_hint')}</p>
        {loading ? <p className="owner-empty">{t('common_loading')}</p> : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-app-border bg-app-elevated p-3">
            <h3 className="mb-2 text-sm font-semibold text-white">{t('wallet_requests_deposit_title')}</h3>
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
                    <span className={`request-status-badge ${statusClass(item.request_status)}`}>
                      {getStatusLabel(item.request_status)}
                    </span>
                    <input
                      className="field-input"
                      placeholder={t('admin_wallet_admin_note')}
                      value={adminNoteById[`dep_${item.id}`] || ''}
                      onChange={(e) =>
                        setAdminNoteById((prev) => ({ ...prev, [`dep_${item.id}`]: e.target.value }))
                      }
                    />
                    {item.proof_image_path ? (
                      <a
                        href={item.proof_image_path}
                        target="_blank"
                        rel="noreferrer"
                        className="owner-nav-link"
                      >
                        {t('wallet_requests_view_proof')}
                      </a>
                    ) : null}
                    {item.request_status === 'pending' ? (
                      <div className="owner-buttons">
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-deposit"
                          onClick={() => reviewDeposit(item.id, 'approve')}
                        >
                          {t('admin_wallet_approve')}
                        </button>
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-withdraw"
                          onClick={() => reviewDeposit(item.id, 'reject')}
                        >
                          {t('admin_wallet_reject')}
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-app-border bg-app-elevated p-3">
            <h3 className="mb-2 text-sm font-semibold text-white">{t('wallet_requests_withdraw_title')}</h3>
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
                    <span className={`request-status-badge ${statusClass(item.request_status)}`}>
                      {getStatusLabel(item.request_status)}
                    </span>
                    <input
                      className="field-input"
                      placeholder={t('admin_wallet_admin_note')}
                      value={adminNoteById[`wd_${item.id}`] || ''}
                      onChange={(e) =>
                        setAdminNoteById((prev) => ({ ...prev, [`wd_${item.id}`]: e.target.value }))
                      }
                    />
                    {item.request_status === 'pending' ? (
                      <div className="owner-buttons">
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-deposit"
                          onClick={() => reviewWithdrawal(item.id, 'approve')}
                        >
                          {t('admin_wallet_approve')}
                        </button>
                        <button
                          type="button"
                          className="wallet-action-btn wallet-action-withdraw"
                          onClick={() => reviewWithdrawal(item.id, 'reject')}
                        >
                          {t('admin_wallet_reject')}
                        </button>
                      </div>
                    ) : null}
                    {item.request_status === 'approved' ? (
                      <button
                        type="button"
                        className="wallet-action-btn owner-set-btn"
                        onClick={() => completeWithdrawal(item.id)}
                      >
                        {t('admin_wallet_complete')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="card login-form">
        <h2 className="owner-wallet-heading">{t('owner_unified_ready_title')}</h2>
        <p className="owner-hint">{t('owner_unified_ready_hint')}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {executableFeatures.map((item) => (
            <div key={item.id} className="rounded-xl border border-app-border bg-app-elevated p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{t(item.titleKey)}</h3>
                <span className="request-status-badge status-approved">{featureStatusLabel(item.status)}</span>
              </div>
              <p className="text-xs text-app-muted">{t(item.descKey)}</p>
              {item.route ? (
                <Link
                  to={item.route}
                  className="owner-nav-link mt-2 inline-flex"
                >
                  {t('owner_unified_open_feature')}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="card login-form">
        <h2 className="owner-wallet-heading">{t('owner_unified_gaps_title')}</h2>
        <p className="owner-hint">{t('owner_unified_gaps_hint')}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {coverageGaps.map((item) => (
            <div key={item.id} className="rounded-xl border border-app-border bg-app-elevated p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{t(item.titleKey)}</h3>
                <span className={`request-status-badge ${item.status === 'missing' ? 'status-rejected' : 'status-pending'}`}>
                  {featureStatusLabel(item.status)}
                </span>
              </div>
              <p className="text-xs text-app-muted">{t(item.descKey)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
