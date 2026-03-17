import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Crown, Gem, ShieldCheck, TrendingUp } from 'lucide-react'
import { getMyVipSummary, subscribeToLiveUpdates, type UserVipSummary } from '../api'
import { useI18n } from '../i18nCore'

function resolveFallbackBenefits(level: number, t: (key: string) => string) {
  const map: Record<number, string[]> = {
    1: [t('vip_benefit_level_1_a'), t('vip_benefit_level_1_b')],
    2: [t('vip_benefit_level_2_a'), t('vip_benefit_level_2_b')],
    3: [t('vip_benefit_level_3_a'), t('vip_benefit_level_3_b')],
    4: [t('vip_benefit_level_4_a'), t('vip_benefit_level_4_b')],
    5: [t('vip_benefit_level_5_a'), t('vip_benefit_level_5_b')],
  }
  return map[level] || [t('vip_benefit_default')]
}

export function VipPage() {
  const { t } = useI18n()
  const [data, setData] = useState<UserVipSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refreshTimerRef = useRef<number | null>(null)

  const loadVipSummary = useCallback(async (withLoading = false) => {
    if (withLoading) setLoading(true)
    try {
      const res = await getMyVipSummary()
      setData(res)
      setError('')
    } catch {
      setError(t('vip_load_failed'))
    } finally {
      if (withLoading) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadVipSummary(true).catch(() => {})
  }, [loadVipSummary])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (event.type !== 'balance_updated') return
      const source = String(event.source || '').trim().toLowerCase()
      if (source && !source.startsWith('deposit_')) return
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current)
      }
      refreshTimerRef.current = window.setTimeout(() => {
        loadVipSummary(false).catch(() => {})
      }, 140)
    })
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current)
      }
      unsub()
    }
  }, [loadVipSummary])

  const progressPct = useMemo(() => Number(data?.progressPct || 0), [data?.progressPct])

  return (
    <div className="page space-y-3">
      <section className="overflow-hidden rounded-2xl border border-app-border">
        <img src="/ads/vip.jpeg" alt={t('home_action_vip_benefits')} className="w-full object-cover" loading="eager" />
      </section>
      <section className="elite-panel p-4">
        <div className="flex items-center gap-2">
          <Crown size={18} className="text-brand-blue" />
          <h1 className="text-lg font-semibold text-white">{t('vip_page_title')}</h1>
        </div>
        <p className="mt-1 text-sm text-app-muted">{t('vip_page_subtitle')}</p>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-app-border bg-app-card p-4 text-sm text-app-muted">
          {t('common_loading')}
        </section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4">
          <p className="text-sm text-rose-200">{error}</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-brand-blue/40 bg-brand-blue/20 px-4 py-2 text-sm font-medium text-white"
            onClick={() => loadVipSummary(true)}
          >
            {t('common_retry')}
          </button>
        </section>
      ) : data ? (
        <>
          <section className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-app-border bg-app-card p-3">
              <p className="text-[11px] text-app-muted">{t('vip_current_level')}</p>
              <p className="mt-1 text-xl font-semibold text-white">VIP {data.currentVipLevel}</p>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-card p-3">
              <p className="text-[11px] text-app-muted">{t('vip_next_level')}</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {data.nextLevel ? `VIP ${data.nextLevel}` : t('vip_top_level')}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-app-border bg-app-card p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-app-muted">
              <span>{t('vip_progress_to_next')}</span>
              <span>{progressPct.toFixed(2)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-app-elevated">
              <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-2 grid gap-2 text-xs text-app-muted sm:grid-cols-2">
              <div className="inline-flex items-center gap-1">
                <Gem size={13} className="text-brand-blue" />
                <span>{t('vip_total_deposit_value')}: ${Number(data.totalDeposit || 0).toFixed(2)}</span>
              </div>
              <div className="inline-flex items-center gap-1">
                <TrendingUp size={13} className="text-brand-blue" />
                <span>
                  {t('vip_next_target')}:{' '}
                  {data.nextMinDeposit != null ? `$${Number(data.nextMinDeposit).toFixed(2)}` : t('vip_no_next_target')}
                </span>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            {(data.tiers || [])
              .filter((tier) => tier && tier.level >= 1 && tier.level <= 5)
              .map((tier) => {
                const isCurrent = tier.level === data.currentVipLevel
                const isUnlocked = tier.level <= data.currentVipLevel
                const benefits = (tier.perks?.length ?? 0) > 0 ? tier.perks : resolveFallbackBenefits(tier.level, t)
                return (
                  <div
                    key={tier.level}
                    className={`rounded-2xl border p-3 ${
                      isCurrent
                        ? 'border-brand-blue/50 bg-brand-blue/10'
                        : isUnlocked
                          ? 'border-emerald-400/30 bg-emerald-500/10'
                          : 'border-app-border bg-app-card'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2">
                        <ShieldCheck size={14} className={isUnlocked ? 'text-emerald-300' : 'text-app-muted'} />
                        <p className="text-sm font-semibold text-white">
                          VIP {tier.level} - {tier.title}
                        </p>
                      </div>
                      <span className="text-xs text-app-muted">${Number(tier.min_deposit || 0).toFixed(2)}</span>
                    </div>
                    <div className="mb-2 text-xs text-brand-blue">
                      {t('vip_referral_bonus')}: {Number(tier.referral_percent || 0).toFixed(2)}%
                    </div>
                    <ul className="space-y-1 text-xs text-white/85">
                      {benefits.map((benefit) => (
                        <li key={`${tier.level}-${benefit}`}>- {benefit}</li>
                      ))}
                    </ul>
                  </div>
                )
              })}
          </section>
        </>
      ) : null}
    </div>
  )
}

