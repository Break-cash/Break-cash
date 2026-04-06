import { useState } from 'react'
import { Crown, Medal } from 'lucide-react'
import { getPublicFriendProfile, type FriendUser, type HomeLeaderboardConfig } from '../../api'
import { AppModalPortal } from '../ui/AppModalPortal'
import { SafeAvatar } from '../ui/SafeAvatar'
import { UserIdentityBadges, resolveIdentityBadgeColor } from '../user/UserIdentityBadges'
import { VerificationStatusNote } from '../user/VerificationStatusNote'

type ProfileTopDepositorsCardProps = {
  config: HomeLeaderboardConfig
}

function formatDeposits(value: number) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0))
}

const COUNTRY_FLAG_ALIASES: Record<string, string> = {
  tr: 'TR',
  turkey: 'TR',
  turkiye: 'TR',
  sa: 'SA',
  'saudi arabia': 'SA',
  saudi: 'SA',
  eg: 'EG',
  egypt: 'EG',
  ae: 'AE',
  uae: 'AE',
  iq: 'IQ',
  iraq: 'IQ',
  sy: 'SY',
  syria: 'SY',
  jo: 'JO',
  jordan: 'JO',
  lb: 'LB',
  lebanon: 'LB',
  kw: 'KW',
  kuwait: 'KW',
  qa: 'QA',
  qatar: 'QA',
  bh: 'BH',
  bahrain: 'BH',
  om: 'OM',
  oman: 'OM',
  ye: 'YE',
  yemen: 'YE',
  ma: 'MA',
  morocco: 'MA',
  dz: 'DZ',
  algeria: 'DZ',
  tn: 'TN',
  tunisia: 'TN',
  ly: 'LY',
  libya: 'LY',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  america: 'US',
  gb: 'GB',
  uk: 'GB',
  britain: 'GB',
  england: 'GB',
  fr: 'FR',
  france: 'FR',
  de: 'DE',
  germany: 'DE',
}

function getCountryFlagEmoji(value?: string | null) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const lower = raw.toLowerCase()
  const code = /^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : COUNTRY_FLAG_ALIASES[lower] || ''
  if (!code) return ''
  return String.fromCodePoint(...code.split('').map((char) => 127397 + char.charCodeAt(0)))
}

export function ProfileTopDepositorsCard({ config }: ProfileTopDepositorsCardProps) {
  const rows = (config.competitors || []).slice(0, 3)
  const [selectedUser, setSelectedUser] = useState<FriendUser | null>(null)
  const [selectedUserLoadingId, setSelectedUserLoadingId] = useState<number | null>(null)
  const [selectedUserError, setSelectedUserError] = useState<string | null>(null)

  if (rows.length === 0) return null

  async function handleOpenDepositorProfile(userId: number) {
    if (!userId) return
    setSelectedUserError(null)
    setSelectedUserLoadingId(userId)
    try {
      const res = await getPublicFriendProfile(userId)
      setSelectedUser(res.user)
    } catch {
      setSelectedUserError('تعذر تحميل بروفايل المودع الآن.')
    } finally {
      setSelectedUserLoadingId(null)
    }
  }

  const selectedBadgeColor = resolveIdentityBadgeColor(
    selectedUser?.badgeColor,
    selectedUser?.blueBadge,
  )

  return (
    <section className="glass-panel elite-enter rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(56,189,248,0.08),rgba(255,255,255,0.01))] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--text-primary)]">أعلى 3 مودعين</div>
        <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200">
          هذا الشهر
        </span>
      </div>

      {selectedUserError ? (
        <div className="mb-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {selectedUserError}
        </div>
      ) : null}

      <div className="space-y-2">
        {rows.map((item, index) => (
          <button
            key={item.id || `${item.name}-${index}`}
            type="button"
            onClick={() => handleOpenDepositorProfile(Number(item.id || 0))}
            className="glass-panel-soft flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-start transition hover:border-sky-400/35 hover:bg-sky-500/[0.06]"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[var(--bg-elevated)] text-white/80">
                {index === 0 ? <Crown size={14} className="text-amber-300" /> : <Medal size={14} className="text-slate-300" />}
              </span>
              <div>
                <div className="text-sm font-semibold text-white">
                  {selectedUserLoadingId === item.id ? 'جاري التحميل...' : item.name}
                </div>
                <div className="text-[11px] text-white/55">{item.username || `#${item.id}`}</div>
              </div>
            </div>
            <div className="text-sm font-bold text-emerald-300">{formatDeposits(item.totalDeposits)} USDT</div>
          </button>
        ))}
      </div>

      {selectedUser ? (
        <AppModalPortal>
          <div className="friends-profile-overlay" onClick={() => setSelectedUser(null)}>
            <div className="friends-profile-popup" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="friends-profile-close"
                onClick={() => setSelectedUser(null)}
                aria-label="إغلاق"
              >
                ×
              </button>
              <div className="friends-profile-header">
                <div className="friends-profile-avatar">
                  <SafeAvatar
                    src={selectedUser.avatarUrl}
                    name={selectedUser.displayName}
                    fallbackText={String(selectedUser.id).slice(-2)}
                    className="h-full w-full border-0"
                    textClassName="text-xl"
                    alt={selectedUser.displayName}
                  />
                </div>
                <div className="friends-profile-title-wrap">
                  <div className="friends-profile-title-row">
                    <span className="friends-profile-name">{selectedUser.displayName}</span>
                    {getCountryFlagEmoji(selectedUser.country) ? (
                      <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/8 px-1.5 text-base leading-5">
                        {getCountryFlagEmoji(selectedUser.country)}
                      </span>
                    ) : null}
                    <UserIdentityBadges
                      badgeColor={selectedBadgeColor}
                      vipLevel={selectedUser.vipLevel || 0}
                      premiumBadge={selectedUser.premiumBadge}
                      mode="all"
                    />
                  </div>
                  <div className="friends-profile-id">ID: {selectedUser.id}</div>
                </div>
              </div>

              <div className="friends-profile-bio">
                {selectedUser.bio?.trim() || 'لا يوجد وصف عام لهذا الحساب بعد.'}
              </div>

              <div className="friends-profile-status-row">
                <VerificationStatusNote status={selectedUser.verificationStatus} />
              </div>

              <div className="friends-profile-balance">
                <span>رصيد التداول</span>
                <strong>
                  {selectedUser.depositPrivacyEnabled || selectedUser.tradingBalance == null
                    ? 'مخفي'
                    : `${Number(selectedUser.tradingBalance || 0).toFixed(2)} USDT`}
                </strong>
              </div>
            </div>
          </div>
        </AppModalPortal>
      ) : null}
    </section>
  )
}
