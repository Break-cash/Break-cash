import { Crown, Trophy, User } from 'lucide-react'
import { motion } from 'framer-motion'
import type { HomeLeaderboardCompetitor, HomeLeaderboardConfig } from '../../api'

export const defaultHomeLeaderboardConfig: HomeLeaderboardConfig = {
  enabled: false,
  badge: 'أعلى المودعين',
  title: 'أعلى 3 مودعين لهذا الشهر',
  description: 'معاينة فاخرة لأعلى المستخدمين في إجمالي الإيداعات الشهرية. يمكنك تعبئة هذه البيانات من لوحة المالك ثم تفعيل القسم عند الجاهزية.',
  summaryLabel: 'إجمالي إيداعات الشهر',
  summaryValue: '184,520 USDT',
  podiumLabels: ['الأول هذا الشهر', 'الثاني هذا الشهر', 'الثالث هذا الشهر'],
  detailsTitle: 'تفاصيل المتصدرين',
  detailsSubtitle: 'بطاقات تعريف قابلة للتعديل تخص أصحاب المراكز الثلاثة فقط',
  detailsHint: 'يمكن تعديل هذه البيانات من لوحة المالك قبل إظهار القسم للعامة',
  noteLabel: 'الوصف التعريفي',
  tierLabel: 'التصنيف',
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
      spotlight: 'حقق أعلى حجم إيداع شهري مع نشاط تمويل قوي ومستمر على مدار الشهر بالكامل.',
      ctaLabel: 'عرض ملف المتصدر',
    },
    {
      id: 2,
      name: 'لينا كراون',
      username: '@lina',
      avatar: null,
      totalDeposits: 22410,
      monthlyGrowth: '+14.9%',
      tierLabel: 'جامع مميز',
      spotlight: 'حافظت على مركز قوي في المرتبة الثانية عبر إيداعات ثابتة ونمط احتفاظ مرتفع طوال دورة الترتيب.',
      ctaLabel: 'عرض ملف الوصيف',
    },
    {
      id: 3,
      name: 'مازن فلوكس',
      username: '@mazen',
      avatar: null,
      totalDeposits: 21790,
      monthlyGrowth: '+12.7%',
      tierLabel: 'صاعد سريع',
      spotlight: 'أنهى الشهر بإيداعات متسارعة في الأيام الأخيرة وحسم المركز الثالث قبل الإغلاق.',
      ctaLabel: 'عرض ملف المركز الثالث',
    },
  ],
}

const podiumOrder = [1, 0, 2]

const podiumStyles = [
  {
    place: 1,
    height: 'lg:min-h-[23rem]',
    wrapper: 'lg:-translate-y-5 lg:scale-[1.04]',
    panel:
      'border-yellow-300/35 bg-[linear-gradient(180deg,rgba(250,204,21,0.24),rgba(30,41,59,0.94)_30%,rgba(15,23,42,0.96))] shadow-[0_0_45px_rgba(250,204,21,0.22)]',
    accent: 'from-yellow-200 via-yellow-400 to-amber-600',
    ring: 'ring-yellow-300/45',
    points: 'bg-yellow-400/15 text-yellow-100 border-yellow-300/25',
    icon: Crown,
    iconClass: 'text-yellow-200',
  },
  {
    place: 2,
    height: 'lg:min-h-[19rem]',
    wrapper: 'lg:translate-y-7',
    panel:
      'border-slate-300/25 bg-[linear-gradient(180deg,rgba(226,232,240,0.18),rgba(30,41,59,0.94)_26%,rgba(15,23,42,0.96))] shadow-[0_0_24px_rgba(148,163,184,0.16)]',
    accent: 'from-slate-200 via-slate-300 to-slate-500',
    ring: 'ring-slate-300/30',
    points: 'bg-slate-200/10 text-slate-100 border-slate-300/20',
    icon: Trophy,
    iconClass: 'text-slate-200',
  },
  {
    place: 3,
    height: 'lg:min-h-[17.5rem]',
    wrapper: 'lg:translate-y-10',
    panel:
      'border-orange-400/25 bg-[linear-gradient(180deg,rgba(251,146,60,0.18),rgba(30,41,59,0.94)_26%,rgba(15,23,42,0.96))] shadow-[0_0_24px_rgba(251,146,60,0.14)]',
    accent: 'from-orange-200 via-orange-400 to-amber-700',
    ring: 'ring-orange-300/25',
    points: 'bg-orange-400/12 text-orange-100 border-orange-300/20',
    icon: Trophy,
    iconClass: 'text-orange-200',
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
      Array.isArray(config?.podiumLabels) && config?.podiumLabels.length >= 3
        ? config.podiumLabels.slice(0, 3)
        : defaultHomeLeaderboardConfig.podiumLabels,
    competitors: normalizeCompetitors(config?.competitors),
  }
}

function formatDeposits(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function Avatar({ name, avatar, size = 'md' }: { name: string; avatar?: string | null; size?: 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-20 w-20 text-xl' : 'h-11 w-11 text-sm'
  return (
    <div
      className={`inline-flex ${sizeClass} items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5 font-semibold text-white/90`}
    >
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
  if (!previewMode && !leaderboard.enabled) return null

  const podium = podiumOrder.map((index) => leaderboard.competitors[index]).filter(Boolean)

  return (
    <section className="mb-6 lg:mb-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:p-6"
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
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 backdrop-blur">
            <div className="text-xs tracking-[0.2em] text-slate-400">{leaderboard.summaryLabel}</div>
            <div className="mt-1 text-xl font-bold text-white">{leaderboard.summaryValue}</div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:p-5">
          <div className="grid gap-4 lg:grid-cols-3 lg:items-end">
            {podium.map((competitor, index) => {
              const style = podiumStyles[index]
              const Icon = style.icon
              return (
                <motion.div
                  key={competitor.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.08 * index, ease: 'easeOut' }}
                  className={`${style.wrapper} ${style.height}`}
                  whileHover={{ scale: 1.03 }}
                >
                  <div
                    className={`group relative flex h-full flex-col items-center rounded-[1.6rem] border p-5 text-center transition-transform duration-300 ${style.panel}`}
                  >
                    <div className={`absolute inset-x-6 top-0 h-px bg-gradient-to-r ${style.accent} opacity-80`} />
                    <div className={`absolute -top-5 inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-white/15 bg-slate-950/80 px-3 font-black text-white ring-4 ${style.ring}`}>
                      #{style.place}
                    </div>
                    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold text-white/80">
                      <Icon size={14} className={style.iconClass} />
                      {leaderboard.podiumLabels[style.place - 1]}
                    </div>
                    <div className="mt-5">
                      <Avatar name={competitor.name} avatar={competitor.avatar} size="lg" />
                    </div>
                    <div className="mt-4 text-lg font-bold text-white">{competitor.name}</div>
                    <div className="mt-1 text-sm text-slate-300">{competitor.username}</div>
                    <div className={`mt-5 inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${style.points}`}>
                      {formatDeposits(competitor.totalDeposits)} USDT
                    </div>
                    <div className="mt-4 h-1 w-20 rounded-full bg-white/10">
                      <div className={`h-full rounded-full bg-gradient-to-r ${style.accent}`} />
                    </div>
                  </div>
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
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{leaderboard.detailsTitle}</h3>
              <p className="text-sm text-slate-400">{leaderboard.detailsSubtitle}</p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 lg:inline-flex">
              <User size={12} />
              {leaderboard.detailsHint}
            </div>
          </div>

          <div className="max-h-[28rem] space-y-3 overflow-y-auto pe-1">
            {podium.map((competitor, index) => (
              <motion.div
                key={competitor.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.34, delay: 0.03 * index, ease: 'easeOut' }}
                whileHover={{ scale: 1.01 }}
                className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(15,23,42,0.76))] p-4 text-left shadow-[0_14px_34px_rgba(2,6,23,0.34)] transition-all hover:border-sky-400/25 hover:bg-[linear-gradient(180deg,rgba(30,41,59,0.96),rgba(15,23,42,0.84))] lg:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-black text-slate-200">
                      #{index + 1}
                    </div>
                    <Avatar name={competitor.name} avatar={competitor.avatar} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white lg:text-base">{competitor.name}</div>
                      <div className="truncate text-xs text-slate-400">{competitor.username}</div>
                    </div>
                  </div>

                  <div className="grid flex-1 gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <div className="text-[11px] tracking-[0.2em] text-slate-500">{leaderboard.noteLabel}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-200">{competitor.spotlight}</div>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] tracking-[0.2em] text-slate-500">{leaderboard.tierLabel}</span>
                        <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-2.5 py-1 text-xs font-semibold text-fuchsia-200">
                          {competitor.tierLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] tracking-[0.2em] text-slate-500">{leaderboard.growthLabel}</span>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                          {competitor.monthlyGrowth}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] tracking-[0.2em] text-slate-500">{leaderboard.depositsLabel}</span>
                        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2.5 py-1 text-xs font-semibold text-sky-200">
                          {formatDeposits(competitor.totalDeposits)} USDT
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-200">
                    {competitor.ctaLabel}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
