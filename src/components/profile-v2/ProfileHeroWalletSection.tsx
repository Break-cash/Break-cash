import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Eye, EyeOff, Zap } from 'lucide-react'
import { UserIdentityBadges } from '../user/UserIdentityBadges'
import { useAssetVisibility } from '../../hooks/useAssetVisibility'
import type { AuthUser } from '../../api'
import type { WalletSummary } from '../../walletSummary'

type ProfileHeroWalletSectionProps = {
  summary: WalletSummary
  isSummaryLoading: boolean
  premiumProfileColorClass: string
  depositText: string
  withdrawText: string
  dailyEarningsSummary: {
    totalAmount: number
    withdrawableAmount: number
    lockedAmount: number
  }
  earningsCurrency: string
  profile: AuthUser | null
  primaryCtaText: string
  secondaryCtaText: string
  onOpenWallet: () => void
  onOpenDeposit: () => void
  onOpenWithdraw: () => void
  onPrimaryCtaClick: () => void
  onSecondaryCtaClick: () => void
}

function formatAmount(value: number, currency: string, hidden: boolean, loading: boolean) {
  if (loading) return '...'
  if (hidden) return `•••••• ${currency}`
  return `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function ProfileHeroWalletSection({
  summary,
  isSummaryLoading,
  premiumProfileColorClass,
  depositText,
  withdrawText,
  dailyEarningsSummary,
  earningsCurrency,
  profile,
  primaryCtaText,
  secondaryCtaText,
  onOpenWallet,
  onOpenDeposit,
  onOpenWithdraw,
  onPrimaryCtaClick,
  onSecondaryCtaClick,
}: ProfileHeroWalletSectionProps) {
  const { isHidden, toggleHidden } = useAssetVisibility()

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={`elite-enter ${premiumProfileColorClass}`}
    >
      <div className="wallet-main-card-cinematic relative overflow-hidden rounded-[34px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_28%),radial-gradient(circle_at_100%_0%,rgba(59,130,246,0.24),transparent_32%),linear-gradient(160deg,rgba(7,12,23,0.98),rgba(10,16,30,0.96))] p-4 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
        {/* Full-card cinematic waves behind content */}
        <span className="wallet-main-card-waves" aria-hidden="true">
          <span className="wallet-main-wave wallet-main-wave-a" />
          <span className="wallet-main-wave wallet-main-wave-b" />
          <span className="wallet-main-wave wallet-main-wave-c" />
          {/* Soft mesh-like wave lines for clearly visible cinematic motion */}
          <svg className="wallet-main-wave-lines wallet-main-wave-lines-a" viewBox="0 0 1200 400" preserveAspectRatio="none">
            <path d="M0 260 C 130 230, 250 320, 390 280 C 520 240, 640 190, 780 230 C 920 270, 1060 320, 1200 260" />
            <path d="M0 300 C 140 260, 280 340, 430 305 C 570 270, 720 220, 860 255 C 1000 290, 1100 335, 1200 305" />
          </svg>
          <svg className="wallet-main-wave-lines wallet-main-wave-lines-b" viewBox="0 0 1200 400" preserveAspectRatio="none">
            <path d="M0 220 C 150 200, 280 280, 430 245 C 580 210, 700 165, 860 205 C 1010 245, 1090 295, 1200 250" />
          </svg>
        </span>
        <span className="wallet-main-card-overlay" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.04),transparent)]" />
        <div className="relative z-[2] grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.95fr)]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-cyan-100">
                  <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                  <span>المركز المالي الرئيسي</span>
                </div>
                <button
                  type="button"
                  onClick={onOpenWallet}
                  className="text-start"
                >
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">Total Assets</p>
                  <p className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
                    {formatAmount(summary.totalAssets, 'USDT', isHidden, isSummaryLoading)}
                  </p>
                </button>
              </div>
              <button
                type="button"
                onClick={toggleHidden}
                className="icon-interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/80"
                aria-label={isHidden ? 'show assets' : 'hide assets'}
              >
                {isHidden ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 backdrop-blur-sm">
                <p className="text-[11px] text-white/55">الرصيد الرئيسي</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {formatAmount(summary.mainBalance, 'USDT', isHidden, isSummaryLoading)}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-3 backdrop-blur-sm">
                <p className="text-[11px] text-amber-100/75">الرصيد المقفل</p>
                <p className="mt-2 text-sm font-semibold text-amber-200">
                  {formatAmount(summary.lockedBalance, 'USDT', isHidden, isSummaryLoading)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-3 backdrop-blur-sm">
                <p className="text-[11px] text-emerald-100/75">المتاح للسحب</p>
                <p className="mt-2 text-sm font-semibold text-emerald-200">
                  {formatAmount(summary.withdrawableBalance, 'USDT', isHidden, isSummaryLoading)}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onPrimaryCtaClick}
                className="icon-interactive elite-hover-lift flex min-h-[60px] items-center justify-between rounded-2xl border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(6,182,212,0.2),rgba(59,130,246,0.16))] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(6,182,212,0.16)]"
              >
                <span>{primaryCtaText}</span>
                <ArrowLeft size={18} />
              </button>
              <button
                type="button"
                onClick={onSecondaryCtaClick}
                className="icon-interactive elite-hover-lift flex min-h-[60px] items-center justify-between rounded-2xl border border-violet-400/25 bg-[linear-gradient(135deg,rgba(99,102,241,0.14),rgba(168,85,247,0.12))] px-4 py-3 text-sm font-semibold text-white/95"
              >
                <span>{secondaryCtaText}</span>
                <Zap size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenDeposit}
                className="action-button action-button-deposit icon-interactive flex min-h-[54px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                <ArrowDownLeft size={18} />
                <span>{depositText}</span>
              </button>
              <button
                type="button"
                onClick={onOpenWithdraw}
                className="action-button action-button-withdraw icon-interactive flex min-h-[54px] items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                <ArrowUpRight size={18} />
                <span>{withdrawText}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-4 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">Today Earnings</p>
                  <p className={`mt-2 text-2xl font-bold ${dailyEarningsSummary.totalAmount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {dailyEarningsSummary.totalAmount.toFixed(2)} {earningsCurrency}
                  </p>
                </div>
                {profile ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                    <span className="max-w-[120px] truncate text-xs text-white/90">
                      {profile.display_name || `#${profile.id}`}
                    </span>
                    <UserIdentityBadges
                      badgeColor={profile.badge_color || 'none'}
                      vipLevel={profile.vip_level || 0}
                      premiumBadge={profile.profile_badge}
                      mode="all"
                    />
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2">
                <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-xs">
                  <span className="text-white/60">قابل للسحب</span>
                  <span className="font-semibold text-emerald-200">
                    {dailyEarningsSummary.withdrawableAmount.toFixed(2)} {earningsCurrency}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 px-3 py-2 text-xs">
                  <span className="text-white/60">غير قابل للسحب</span>
                  <span className="font-semibold text-amber-200">
                    {dailyEarningsSummary.lockedAmount.toFixed(2)} {earningsCurrency}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenWallet}
              className="icon-interactive elite-hover-lift flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/80"
            >
              <span>فتح المحفظة الكاملة</span>
              <ArrowLeft size={18} />
            </button>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
