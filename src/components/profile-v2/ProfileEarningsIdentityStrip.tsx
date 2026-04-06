import { UserIdentityBadges } from '../user/UserIdentityBadges'
import { useI18n } from '../../i18nCore'
import type { AuthUser } from '../../api'

type ProfileEarningsIdentityStripProps = {
  dailyEarningsSummary: {
    totalAmount: number
    withdrawableAmount: number
    lockedAmount: number
  }
  earningsCurrency: string
  profile: AuthUser | null
}

export function ProfileEarningsIdentityStrip({
  dailyEarningsSummary,
  earningsCurrency,
  profile,
}: ProfileEarningsIdentityStripProps) {
  const { t } = useI18n()

  return (
    <section className="glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-4 py-3">
      <div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{t('home_today_earnings')}</p>
        <p className={`mt-1 text-sm font-semibold ${dailyEarningsSummary.totalAmount >= 0 ? 'text-positive' : 'text-negative'}`}>
          {dailyEarningsSummary.totalAmount.toFixed(2)} {earningsCurrency}
        </p>
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          {dailyEarningsSummary.withdrawableAmount.toFixed(2)} قابل للسحب • {dailyEarningsSummary.lockedAmount.toFixed(2)} غير قابل للسحب
        </p>
      </div>
      {profile ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-white/[0.03] px-2.5 py-1.5">
          <span className="text-xs font-medium text-[var(--text-primary)]">{profile.display_name || `#${profile.id}`}</span>
          <UserIdentityBadges
            badgeColor={profile.badge_color || 'none'}
            vipLevel={profile.vip_level || 0}
            premiumBadge={profile.profile_badge}
            mode="all"
          />
        </div>
      ) : null}
    </section>
  )
}
