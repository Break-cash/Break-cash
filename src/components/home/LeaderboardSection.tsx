import { useState } from 'react'
import { ChevronDown, Crown, Medal, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import { getPublicFriendProfile, type FriendUser, type HomeLeaderboardCompetitor, type HomeLeaderboardConfig } from '../../api'
import { AppModalPortal } from '../ui/AppModalPortal'
import { UserIdentityBadges } from '../user/UserIdentityBadges'

export const defaultHomeLeaderboardConfig: HomeLeaderboardConfig = {
  enabled: false,
  badge: 'أعلى المودعين',
  title: 'أعلى 3 مودعين لهذا الشهر',
  description: 'عرض مبسط للمتصدرين لهذا الشهر.',
  summaryLabel: 'إجمالي إيداعات الشهر',
  summaryValue: '184,520 USDT',
  podiumLabels: ['المركز الأول', 'المركز الثاني', 'المركز الثالث'],
  detailsTitle: 'تفاصيل المتصدرين',
  detailsSubtitle: 'اضغط على أي مركز لعرض التفاصيل الخاصة به.',
  detailsHint: 'تُعدل هذه البيانات من لوحة المالك',
  noteLabel: 'الوصف',
  tierLabel: 'اللقب',
  growthLabel: 'نمو الشهر',
  depositsLabel: 'الإيداعات',
  competitors: [
    {
      id: 1,
      name: 'زيوس ألماس',
      username: '@zeus',
      avatar: null,
      totalDeposits: 24850,
      monthlyGrowth: '+18.4%',
      tierLabel: 'حوت النخبة',
      spotlight: 'أعلى إيداع خلال الشهر الحالي.',
      ctaLabel: 'عرض التفاصيل',
    },
    {
      id: 2,
      name: 'لينا كراون',
      username: '@lina',
      avatar: null,
      totalDeposits: 22410,
      monthlyGrowth: '+14.9%',
      tierLabel: 'جامع مميز',
      spotlight: 'ثبات قوي في الإيداعات طوال الشهر.',
      ctaLabel: 'عرض التفاصيل',
    },
    {
      id: 3,
      name: 'مازن فلوكس',
      username: '@mazen',
      avatar: null,
      totalDeposits: 21790,
      monthlyGrowth: '+12.7%',
      tierLabel: 'صاعد سريع',
      spotlight: 'حسم المركز الثالث في نهاية الشهر.',
      ctaLabel: 'عرض التفاصيل',
    },
  ],
}

const podiumStyles = [
  {
    place: 1,
    orderClass: 'order-2',
    wrapper: 'sm:pt-3 lg:-translate-y-4 lg:scale-[1.03]',
    cardClass:
      'border-yellow-300/35 bg-[linear-gradient(180deg,rgba(250,204,21,0.2),rgba(30,41,59,0.96)_34%,rgba(15,23,42,0.98))] shadow-[0_0_40px_rgba(250,204,21,0.18)]',
    icon: Crown,
    accentClass: 'text-yellow-200',
    ringClass: 'ring-yellow-300/40',
  },
  {
    place: 2,
    orderClass: 'order-1',
    wrapper: 'sm:translate-y-2 lg:translate-y-5',
    cardClass:
      'border-slate-300/25 bg-[linear-gradient(180deg,rgba(226,232,240,0.15),rgba(30,41,59,0.96)_34%,rgba(15,23,42,0.98))] shadow-[0_0_24px_rgba(148,163,184,0.12)]',
    icon: Medal,
    accentClass: 'text-slate-200',
    ringClass: 'ring-slate-300/30',
  },
  {
    place: 3,
    orderClass: 'order-3',
    wrapper: 'sm:translate-y-4 lg:translate-y-8',
    cardClass:
      'border-orange-300/25 bg-[linear-gradient(180deg,rgba(251,146,60,0.16),rgba(30,41,59,0.96)_34%,rgba(15,23,42,0.98))] shadow-[0_0_24px_rgba(251,146,60,0.12)]',
    icon: Medal,
    accentClass: 'text-orange-200',
    ringClass: 'ring-orange-300/30',
  },
]

function normalizeCompetitors(input?: HomeLeaderboardCompetitor[] | null) {
  const incoming = Array.isArray(input) ? input : []
  return defaultHomeLeaderboardConfig.competitors.map((fallback, index) => {
    const candidate = incoming[index]
    if (!candidate) return fallback
    return {
      ...fallback,
      ...candidate,
      id: Number(candidate.id || fallback.id),
      totalDeposits: Number.isFinite(Number(candidate.totalDeposits))
        ? Number(candidate.totalDeposits)
        : fallback.totalDeposits,
    }
  })
}

function resolveLeaderboardConfig(config?: HomeLeaderboardConfig | null): HomeLeaderboardConfig {
  return {
    ...defaultHomeLeaderboardConfig,
    ...(config || {}),
    podiumLabels:
      Array.isArray(config?.podiumLabels) && config.podiumLabels.length >= 3
        ? config.podiumLabels.slice(0, 3)
        : defaultHomeLeaderboardConfig.podiumLabels,
    competitors: normalizeCompetitors(config?.competitors),
  }
}

function formatDeposits(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
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

function Avatar({
  name,
  avatar,
  className = 'h-20 w-20 text-xl',
}: {
  name: string
  avatar?: string | null
  className?: string
}) {
  return (
    <div className={`inline-flex items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 font-semibold text-white/90 ${className}`}>
      {avatar ? (
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{name.slice(0, 2).toUpperCase()}</span>
      )}
    </div>
  )
}

type LeaderboardSectionProps = {
  config?: HomeLeaderboardConfig | null
  previewMode?: boolean
}

export function LeaderboardSection({ config, previewMode = false }: LeaderboardSectionProps) {
  const leaderboard = resolveLeaderboardConfig(config)
  const rankedCompetitors = leaderboard.competitors.slice(0, 3)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [selectedUser, setSelectedUser] = useState<FriendUser | null>(null)
  const [selectedUserLoadingId, setSelectedUserLoadingId] = useState<number | null>(null)
  const [selectedUserError, setSelectedUserError] = useState<string | null>(null)

  if (!previewMode && !leaderboard.enabled) return null

  async function handleOpenCompetitorProfile(competitor: HomeLeaderboardCompetitor) {
    const userId = Number(competitor.id || 0)
    if (!userId || previewMode) return
    setSelectedUserError(null)
    setSelectedUserLoadingId(userId)
    try {
      const res = await getPublicFriendProfile(userId)
      setSelectedUser(res.user)
    } catch {
      setSelectedUserError('تعذر تحميل بطاقة البروفايل الآن.')
    } finally {
      setSelectedUserLoadingId(null)
    }
  }

  function getCountryFlagEmoji(value?: string | null) {
    const raw = String(value || '').trim()
    if (!raw) return ''
    const lower = raw.toLowerCase()
    const code = /^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : COUNTRY_FLAG_ALIASES[lower] || ''
    if (!code) return ''
    return String.fromCodePoint(...code.split('').map((char) => 127397 + char.charCodeAt(0)))
  }

  const selectedBadgeColor =
    selectedUser && Number(selectedUser.blueBadge || 0) === 1
      ? 'blue'
      : selectedUser?.verificationStatus === 'verified'
        ? 'gold'
        : 'none'
  const selectedVerified = selectedUser?.verificationStatus === 'verified'
  const selectedHasPublicTitles = Boolean(
    selectedUser &&
      ((selectedUser.vipLevel || 0) > 0 ||
        selectedUser.verificationStatus === 'verified' ||
        Number(selectedUser.blueBadge || 0) === 1),
  )

  const podium = [
    { competitor: rankedCompetitors[1], style: podiumStyles[1] },
    { competitor: rankedCompetitors[0], style: podiumStyles[0] },
    { competitor: rankedCompetitors[2], style: podiumStyles[2] },
  ].filter((entry) => Boolean(entry.competitor))

  return (
    <section className="mb-6 lg:mb-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.97),rgba(2,6,23,0.98))] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:p-6"
      >
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-sky-200">
              <Trophy size={13} />
              {leaderboard.badge}
            </div>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white lg:text-3xl">{leaderboard.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{leaderboard.description}</p>
          </div>
          <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 backdrop-blur lg:w-auto">
            <div className="text-xs tracking-[0.2em] text-slate-400">{leaderboard.summaryLabel}</div>
            <div className="mt-1 text-xl font-bold text-white">{leaderboard.summaryValue}</div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:p-5">
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 lg:items-end">
            {podium.map(({ competitor, style }, index) => {
              const Icon = style.icon
              return (
                <motion.div
                  key={competitor.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.08 * index, ease: 'easeOut' }}
                  className={`${style.orderClass} ${style.wrapper} mx-auto w-full min-w-0 max-w-none`}
                  whileHover={{ scale: 1.03 }}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenCompetitorProfile(competitor)}
                    className={`flex min-h-[9.75rem] w-full flex-col items-center justify-center rounded-[1.2rem] border px-2 py-3 text-center sm:min-h-[12rem] sm:rounded-[1.5rem] sm:px-4 sm:py-5 ${style.cardClass}`}
                  >
                    <div className={`mb-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-white/15 bg-slate-950/80 px-2 text-white ring-4 sm:mb-3 sm:h-11 sm:min-w-11 sm:px-3 ${style.ringClass}`}>
                      <Icon size={16} className={style.accentClass} />
                    </div>
                    <div className="text-[10px] font-semibold leading-4 text-white/75 sm:text-sm">{leaderboard.podiumLabels[style.place - 1]}</div>
                    <div className="mt-2 sm:mt-3">
                      <Avatar
                        name={competitor.name}
                        avatar={competitor.avatar}
                        className="h-14 w-14 text-base sm:h-20 sm:w-20 sm:text-xl"
                      />
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm font-black leading-5 text-white sm:mt-4 sm:text-lg">
                      {competitor.name}
                    </div>
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.24, ease: 'easeOut' }}
          className="mt-5 rounded-[1.75rem] border border-white/8 bg-white/[0.035] p-3 lg:p-5"
        >
          {selectedUserError ? (
            <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {selectedUserError}
            </div>
          ) : null}
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white">{leaderboard.detailsTitle}</h3>
            <p className="text-sm text-slate-400">{leaderboard.detailsSubtitle}</p>
          </div>

          <div className="space-y-3">
            {rankedCompetitors.map((competitor, index) => {
              const isExpanded = expandedId === competitor.id
              return (
                <motion.div
                  key={competitor.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.34, delay: 0.03 * index, ease: 'easeOut' }}
                  className="overflow-hidden rounded-[1.3rem] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.76))]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => (current === competitor.id ? null : competitor.id))}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-slate-200">
                        #{index + 1}
                      </div>
                      <div className="text-sm font-semibold text-white">{competitor.name}</div>
                    </div>
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                      <ChevronDown size={18} />
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-white/8 px-4 pb-4 pt-3">
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">
                          <div className="text-[11px] text-slate-500">{leaderboard.depositsLabel}</div>
                          <div className="mt-1 font-semibold text-white">{formatDeposits(competitor.totalDeposits)} USDT</div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">
                          <div className="text-[11px] text-slate-500">{leaderboard.tierLabel}</div>
                          <div className="mt-1 font-semibold text-white">{competitor.tierLabel}</div>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm text-slate-200">
                          <div className="text-[11px] text-slate-500">{leaderboard.growthLabel}</div>
                          <div className="mt-1 font-semibold text-white">{competitor.monthlyGrowth}</div>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm leading-6 text-slate-200">
                        {competitor.spotlight}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenCompetitorProfile(competitor)}
                          className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-400/16"
                        >
                          {selectedUserLoadingId === competitor.id ? 'جارٍ تحميل البروفايل...' : 'عرض بطاقة البروفايل'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </motion.div>

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
                {selectedUser.avatarUrl ? (
                  <img src={selectedUser.avatarUrl} alt={selectedUser.displayName} />
                ) : (
                  <span>{String(selectedUser.id).slice(-2)}</span>
                )}
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
                    mode="verified"
                  />
                </div>
                {selectedHasPublicTitles ? (
                  <div className="friends-profile-public-titles">
                    <UserIdentityBadges
                      badgeColor={selectedBadgeColor}
                      vipLevel={selectedUser.vipLevel || 0}
                      mode="secondary"
                    />
                  </div>
                ) : null}
                <div className="friends-profile-id">ID: {selectedUser.id}</div>
              </div>
            </div>

            <div className="friends-profile-bio">
              {selectedUser.bio?.trim() || 'لا يوجد وصف عام لهذا الحساب بعد.'}
            </div>

            <div className="friends-profile-status-row">
              <span className={`friends-verify-dot ${selectedVerified ? 'verified' : 'unverified'}`} />
              <span className="friends-verify-text">
                {selectedVerified ? 'حساب موثّق' : 'الحساب غير موثّق'}
              </span>
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
