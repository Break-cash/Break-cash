import { useEffect, useMemo, useState } from 'react'
import {
  addInternalUserNote,
  adjustBalance,
  applyUserBonus,
  banUserTemporary,
  getAdminUserProfile,
  getAdminUsersList,
  getPremiumIdentityOptions,
  resetUserPasswordByOwner,
  reviewUserVerification,
  sendPrivateNotification,
  updateUserApproval,
  updateUserBan,
  updateUserBadgeStyle,
  updateUserFreeze,
  updateUserPremiumIdentity,
  updateUserVipLevel,
  type AdminUserProfilePayload,
  type PremiumIdentityOptions,
  type AdminUserRow,
} from '../../api'
import type { PremiumProfileBadge, PremiumProfileColor } from '../../premiumIdentity'
import { useI18n } from '../../i18nCore'
import { AdminUserKycDepositsPanel } from '../../components/admin/AdminUserKycDepositsPanel'

type ToggleFilter = '' | '1' | '0'

export function AdminUsersPage() {
  const { t } = useI18n()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selected, setSelected] = useState<AdminUserProfilePayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string>('')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<ToggleFilter>('')
  const [verifiedFilter, setVerifiedFilter] = useState<ToggleFilter>('')
  const [vipFilter, setVipFilter] = useState<ToggleFilter>('')
  const [depositedFilter, setDepositedFilter] = useState<ToggleFilter>('')
  const [pendingWithdrawFilter, setPendingWithdrawFilter] = useState<ToggleFilter>('')
  const [countryFilter, setCountryFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [manualAmount, setManualAmount] = useState('')
  const [manualCurrency, setManualCurrency] = useState('USDT')
  const [bonusAmount, setBonusAmount] = useState('')
  const [vipLevel, setVipLevel] = useState('0')
  const [tempPassword, setTempPassword] = useState('')
  const [note, setNote] = useState('')
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyBody, setNotifyBody] = useState('')
  const [tempBanDays, setTempBanDays] = useState('3')
  const [premiumIdentityOptions, setPremiumIdentityOptions] = useState<PremiumIdentityOptions>({
    profileColors: [],
    profileBadges: [],
  })
  const [selectedProfileColor, setSelectedProfileColor] = useState<PremiumProfileColor | ''>('')
  const [selectedProfileBadge, setSelectedProfileBadge] = useState<PremiumProfileBadge | ''>('')

  async function loadUsers() {
    setLoading(true)
    setMessage('')
    try {
      const res = await getAdminUsersList({
        q,
        isApproved: statusFilter,
        isVerified: verifiedFilter,
        isVip: vipFilter,
        hasDeposit: depositedFilter,
        hasPendingWithdrawal: pendingWithdrawFilter,
        country: countryFilter,
        language: languageFilter,
        currency: currencyFilter,
        sortBy,
        sortDir,
      })
      setUsers(res.users || [])
    } catch (e) {
      setUsers([])
      setMessage(e instanceof Error ? e.message : t('admin_users_load_failed'))
    } finally {
      setLoading(false)
    }
  }

  async function openUserProfile(userId: number) {
    setSelectedUserId(userId)
    setSelected(null)
    try {
      const profile = await getAdminUserProfile(userId)
      setSelected(profile)
      setSelectedProfileColor((profile.user.profile_color || '') as PremiumProfileColor | '')
      setSelectedProfileBadge((profile.user.profile_badge || '') as PremiumProfileBadge | '')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('admin_users_profile_failed'))
    }
  }

  async function runAction(action: () => Promise<unknown>, successText: string) {
    if (!selectedUserId) return
    setSaving(true)
    setMessage('')
    try {
      await action()
      setMessage(successText)
      await Promise.all([loadUsers(), openUserProfile(selectedUserId)])
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('admin_users_action_failed'))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadUsers().catch(() => {})
  }, [])

  useEffect(() => {
    getPremiumIdentityOptions()
      .then((res) => setPremiumIdentityOptions(res))
      .catch(() => setPremiumIdentityOptions({ profileColors: [], profileBadges: [] }))
  }, [])

  useEffect(() => {
    if (!selected?.user) return
    setVipLevel(String(selected.user.vip_level || 0))
  }, [selected?.user?.id, selected?.user?.vip_level])

  const selectedUser = selected?.user || null
  const accountNumber = useMemo(
    () => (selectedUser ? `BC-${String(selectedUser.id).padStart(8, '0')}` : ''),
    [selectedUser],
  )

  return (
    <div className="page">
      <h1 className="page-title">{t('admin_users_title')}</h1>
      <div className="card space-y-2">
        <div className="captcha-row">
          <input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin_users_search_ph')} />
          <select className="field-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ToggleFilter)}>
            <option value="">{t('admin_users_filter_active_inactive')}</option>
            <option value="1">{t('admin_users_status_active')}</option>
            <option value="0">{t('admin_users_status_inactive')}</option>
          </select>
          <select className="field-input" value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value as ToggleFilter)}>
            <option value="">{t('admin_users_filter_verified')}</option>
            <option value="1">{t('admin_users_verified')}</option>
            <option value="0">{t('admin_users_unverified')}</option>
          </select>
          <select className="field-input" value={vipFilter} onChange={(e) => setVipFilter(e.target.value as ToggleFilter)}>
            <option value="">{t('admin_users_filter_vip')}</option>
            <option value="1">VIP</option>
            <option value="0">{t('admin_users_normal')}</option>
          </select>
        </div>
        <div className="captcha-row">
          <select className="field-input" value={depositedFilter} onChange={(e) => setDepositedFilter(e.target.value as ToggleFilter)}>
            <option value="">{t('admin_users_filter_deposited')}</option>
            <option value="1">{t('admin_users_deposited')}</option>
            <option value="0">{t('admin_users_not_deposited')}</option>
          </select>
          <select className="field-input" value={pendingWithdrawFilter} onChange={(e) => setPendingWithdrawFilter(e.target.value as ToggleFilter)}>
            <option value="">{t('admin_users_filter_pending_withdraw')}</option>
            <option value="1">{t('admin_users_has_pending')}</option>
            <option value="0">{t('admin_users_no_pending')}</option>
          </select>
          <input className="field-input" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} placeholder={t('admin_users_country')} />
          <input className="field-input" value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)} placeholder={t('admin_users_language')} />
          <input className="field-input" value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value.toUpperCase())} placeholder={t('admin_users_currency')} />
          <select className="field-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="created_at">{t('admin_users_sort_created')}</option>
            <option value="wallet_balance">{t('admin_users_sort_wallet')}</option>
            <option value="deposits_total">{t('admin_users_sort_deposits')}</option>
            <option value="vip_level">{t('admin_users_sort_vip')}</option>
            <option value="last_login_at">{t('admin_users_sort_last_login')}</option>
          </select>
          <select className="field-input" value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
            <option value="desc">{t('admin_users_desc')}</option>
            <option value="asc">{t('admin_users_asc')}</option>
          </select>
          <button className="invite-copy-btn" type="button" onClick={() => loadUsers()} disabled={loading}>
            {loading ? '...' : t('admin_users_apply')}
          </button>
        </div>
      </div>

      {message ? <div className="login-success mt-2">{message}</div> : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="table-card">
          <div className="table-head">
            <span>{t('admin_users_col_user')}</span>
            <span>{t('admin_users_col_status')}</span>
            <span>{t('admin_users_col_wallet')}</span>
          </div>
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              className={`table-row w-full text-start ${selectedUserId === user.id ? 'market-row-active' : ''}`}
              onClick={() => openUserProfile(user.id)}
            >
              <span>{user.display_name || user.email || user.phone || `#${user.id}`}</span>
              <span>
                {Number(user.is_banned) === 1 ? t('admin_users_status_banned') : Number(user.is_approved) === 1 ? t('admin_users_status_active') : t('admin_users_status_inactive')}
                {Number(user.is_frozen) === 1 ? ` / ${t('admin_users_status_frozen')}` : ''}
              </span>
              <span>{Number(user.wallet_balance || 0).toFixed(2)}</span>
            </button>
          ))}
        </div>

        <div className="card">
          {!selectedUser ? (
            <div className="text-sm text-app-muted">{t('admin_users_select_hint')}</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-app-border bg-app-elevated p-2">
                <div className="text-sm font-semibold">{selectedUser.display_name || `#${selectedUser.id}`}</div>
                <div className="text-xs text-app-muted">{t('admin_users_account')}: {accountNumber}</div>
                <div className="text-xs text-app-muted">{t('admin_users_email')}: {selectedUser.email || '—'}</div>
                <div className="text-xs text-app-muted">{t('admin_users_phone')}: {selectedUser.phone || '—'}</div>
                <div className="text-xs text-app-muted">{t('admin_users_wallet')}: {Number(selectedUser.wallet_balance || 0).toFixed(2)}</div>
                <div className="text-xs text-app-muted">{t('admin_users_deposits')}: {Number(selectedUser.deposits_total || 0).toFixed(2)}</div>
                <div className="text-xs text-app-muted">{t('admin_users_withdrawals')}: {Number(selectedUser.withdrawals_total || 0).toFixed(2)}</div>
                <div className="text-xs text-app-muted">{t('admin_users_profits')}: {Math.max(0, Number(selectedUser.deposits_total || 0) - Number(selectedUser.withdrawals_total || 0)).toFixed(2)}</div>
                <div className="text-xs text-app-muted">{t('admin_users_losses')}: {Math.max(0, Number(selectedUser.withdrawals_total || 0) - Number(selectedUser.deposits_total || 0)).toFixed(2)}</div>
                <div className="text-xs text-app-muted">KYC: {selectedUser.verification_status || t('admin_users_unverified')}</div>
                <div className="text-xs text-app-muted">{t('admin_users_country_language_currency')}: {selectedUser.country || '—'} / {selectedUser.preferred_language || '—'} / {selectedUser.preferred_currency || '—'}</div>
                <div className="text-xs text-app-muted">{t('admin_users_referral_code')}: {selectedUser.referral_code || '—'}</div>
                <div className="text-xs text-app-muted">{t('admin_users_invites')}: {Number(selectedUser.referrals_count || 0)} | {t('admin_users_referral_earnings')}: {Number(selectedUser.referrals_earnings || 0).toFixed(2)}</div>
                <div className="text-xs text-app-muted">{t('admin_users_last_login')}: {selectedUser.last_login_at || '—'}</div>
                <div className="text-xs text-app-muted">{t('admin_users_last_ip')}: {selectedUser.last_ip || '—'}</div>
                <div className="text-xs text-app-muted">{t('admin_users_device')}: {selectedUser.last_user_agent || '—'}</div>
              </div>

              <AdminUserKycDepositsPanel
                kycSubmissions={selected?.kyc_submissions}
                depositRequests={selected?.deposit_requests}
              />

              <div className="owner-buttons">
                <button className="wallet-action-btn owner-set-btn" type="button" disabled={saving} onClick={() => runAction(() => updateUserFreeze(selectedUser.id, Number(selectedUser.is_frozen) !== 1), t('admin_users_msg_freeze_updated'))}>
                  {Number(selectedUser.is_frozen) === 1 ? t('admin_users_unfreeze') : t('admin_users_freeze')}
                </button>
                <button className="wallet-action-btn owner-set-btn" type="button" disabled={saving} onClick={() => runAction(() => updateUserApproval(selectedUser.id, Number(selectedUser.is_approved) !== 1), t('admin_users_msg_activation_updated'))}>
                  {Number(selectedUser.is_approved) === 1 ? t('admin_users_disable') : t('admin_users_activate')}
                </button>
                <button className="wallet-action-btn wallet-action-withdraw" type="button" disabled={saving} onClick={() => runAction(() => updateUserBan(selectedUser.id, Number(selectedUser.is_banned) !== 1), t('admin_users_msg_ban_updated'))}>
                  {Number(selectedUser.is_banned) === 1 ? t('admin_users_unban') : t('admin_users_ban')}
                </button>
              </div>

              <div className="owner-buttons">
                <button
                  className="wallet-action-btn wallet-action-deposit"
                  type="button"
                  disabled={saving}
                  onClick={() => runAction(() => reviewUserVerification(selectedUser.id, 'approve'), 'تم اعتماد التحقق بنجاح.')}
                >
                  اعتماد التحقق
                </button>
                <button
                  className="wallet-action-btn wallet-action-withdraw"
                  type="button"
                  disabled={saving}
                  onClick={() => runAction(() => reviewUserVerification(selectedUser.id, 'reject'), 'تم رفض التحقق بنجاح.')}
                >
                  رفض التحقق
                </button>
              </div>

              <div className="captcha-row">
                <input className="field-input" value={tempBanDays} onChange={(e) => setTempBanDays(e.target.value)} placeholder={t('admin_users_temp_ban_days')} />
                <button className="wallet-action-btn wallet-action-withdraw" type="button" disabled={saving} onClick={() => runAction(() => banUserTemporary(selectedUser.id, Number(tempBanDays || 1)), t('admin_users_msg_temp_ban_applied'))}>
                  {t('admin_users_temp_ban')}
                </button>
              </div>

              <div className="captcha-row">
                <input className="field-input" value={manualCurrency} onChange={(e) => setManualCurrency(e.target.value.toUpperCase())} placeholder={t('admin_users_currency')} />
                <input className="field-input" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} placeholder={t('admin_users_amount')} />
                <button className="wallet-action-btn wallet-action-deposit" type="button" disabled={saving} onClick={() => runAction(() => adjustBalance({ userId: selectedUser.id, currency: manualCurrency, amount: Number(manualAmount || 0), type: 'add', note: 'owner-manual-add' }), t('admin_users_msg_balance_added'))}>
                  {t('admin_users_add')}
                </button>
                <button className="wallet-action-btn wallet-action-withdraw" type="button" disabled={saving} onClick={() => runAction(() => adjustBalance({ userId: selectedUser.id, currency: manualCurrency, amount: Number(manualAmount || 0), type: 'deduct', note: 'owner-manual-deduct' }), t('admin_users_msg_balance_deducted'))}>
                  {t('admin_users_deduct')}
                </button>
              </div>

              <div className="captcha-row">
                <input className="field-input" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} placeholder={t('admin_users_bonus_amount')} />
                <button className="wallet-action-btn wallet-action-deposit" type="button" disabled={saving} onClick={() => runAction(() => applyUserBonus({ userId: selectedUser.id, currency: manualCurrency, amount: Number(bonusAmount || 0), type: 'add' }), t('admin_users_msg_bonus_added'))}>
                  Bonus +
                </button>
                <button className="wallet-action-btn wallet-action-withdraw" type="button" disabled={saving} onClick={() => runAction(() => applyUserBonus({ userId: selectedUser.id, currency: manualCurrency, amount: Number(bonusAmount || 0), type: 'deduct' }), t('admin_users_msg_bonus_deducted'))}>
                  Bonus -
                </button>
              </div>

              <div className="captcha-row">
                <select className="field-input" value={vipLevel} onChange={(e) => setVipLevel(e.target.value)}>
                  <option value={0}>VIP 0</option>
                  <option value={1}>VIP 1</option>
                  <option value={2}>VIP 2</option>
                  <option value={3}>VIP 3</option>
                  <option value={4}>VIP 4</option>
                  <option value={5}>VIP 5</option>
                </select>
                <button className="wallet-action-btn owner-set-btn" type="button" disabled={saving} onClick={() => runAction(() => updateUserVipLevel(selectedUser.id, Number(vipLevel || 0)), t('admin_users_msg_vip_updated'))}>
                  {t('admin_users_update_vip')}
                </button>
                <button className="wallet-action-btn owner-set-btn" type="button" disabled={saving} onClick={() => runAction(() => updateUserBadgeStyle(selectedUser.id, 'gold'), t('admin_users_msg_gold_applied'))}>
                  {t('admin_users_gold_verify')}
                </button>
                <button className="wallet-action-btn owner-set-btn" type="button" disabled={saving} onClick={() => runAction(() => updateUserBadgeStyle(selectedUser.id, 'blue'), t('admin_users_msg_blue_applied'))}>
                  {t('admin_users_blue_verify')}
                </button>
              </div>

              <div className="owner-actions-card">
                <h3 className="owner-wallet-heading">{t('admin_users_premium_identity_title')}</h3>
                <p className="owner-hint">{t('admin_users_premium_identity_hint')}</p>
                <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                  <p className="text-[11px] text-app-muted">{t('admin_users_premium_preview')}</p>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#232934] px-3 py-1.5 text-sm text-white">
                    <span>{selectedUser.display_name || `#${selectedUser.id}`}</span>
                    {selectedProfileBadge ? (
                      <span className="identity-premium-badge">{selectedProfileBadge}</span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <select
                    className="field-input"
                    value={selectedProfileColor}
                    onChange={(e) => setSelectedProfileColor(e.target.value as PremiumProfileColor | '')}
                  >
                    <option value="">{t('admin_users_premium_none')}</option>
                    {(premiumIdentityOptions.profileColors || []).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field-input"
                    value={selectedProfileBadge}
                    onChange={(e) => setSelectedProfileBadge(e.target.value as PremiumProfileBadge | '')}
                  >
                    <option value="">{t('admin_users_premium_none')}</option>
                    {(premiumIdentityOptions.profileBadges || []).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="wallet-action-btn owner-set-btn"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      runAction(
                        () =>
                          updateUserPremiumIdentity({
                            userId: selectedUser.id,
                            profileColor: (selectedProfileColor || null) as PremiumProfileColor | null,
                            profileBadge: (selectedProfileBadge || null) as PremiumProfileBadge | null,
                          }),
                        t('admin_users_msg_premium_identity_updated'),
                      )
                    }
                  >
                    {t('admin_users_premium_save')}
                  </button>
                  <button
                    className="wallet-action-btn"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setSelectedProfileColor('')
                      setSelectedProfileBadge('')
                      runAction(
                        () =>
                          updateUserPremiumIdentity({
                            userId: selectedUser.id,
                            profileColor: null,
                            profileBadge: null,
                          }),
                        t('admin_users_msg_premium_identity_cleared'),
                      )
                    }}
                  >
                    {t('admin_users_premium_clear')}
                  </button>
                </div>
              </div>

              <div className="captcha-row">
                <input className="field-input" placeholder={t('admin_users_temp_password')} value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
                <button className="wallet-action-btn owner-set-btn" type="button" disabled={saving} onClick={() => runAction(() => resetUserPasswordByOwner(selectedUser.id, tempPassword), t('admin_users_msg_password_reset'))}>
                  {t('admin_users_reset_password')}
                </button>
              </div>

              <div className="space-y-2">
                <input className="field-input" value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} placeholder={t('admin_users_notification_title')} />
                <textarea className="field-input" value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} placeholder={t('admin_users_notification_body')} />
                <button className="wallet-action-btn owner-set-btn" type="button" disabled={saving} onClick={() => runAction(() => sendPrivateNotification({ userId: selectedUser.id, title: notifyTitle, body: notifyBody }), t('admin_users_msg_notification_sent'))}>
                  {t('admin_users_send_private_notification')}
                </button>
              </div>

              <div className="space-y-2">
                <textarea className="field-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('admin_users_internal_note')} />
                <button className="wallet-action-btn owner-set-btn" type="button" disabled={saving} onClick={() => runAction(() => addInternalUserNote({ userId: selectedUser.id, note }), t('admin_users_msg_note_saved'))}>
                  {t('admin_users_save_internal_note')}
                </button>
              </div>

              <div className="rounded-xl border border-app-border bg-app-elevated p-2">
                <div className="mb-1 text-xs text-app-muted">{t('admin_users_recent_activity')}</div>
                <div className="space-y-1">
                  {(selected?.activity || []).slice(0, 6).map((row) => (
                    <div key={row.id} className="text-xs text-white/80">
                      {row.action} - {row.created_at}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
