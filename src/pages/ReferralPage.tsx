import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Link as LinkIcon, Users, Wallet } from 'lucide-react'
import { getMyReferralSummary, subscribeToLiveUpdates, type ReferralSummary } from '../api'
import { useI18n } from '../i18nCore'

function formatDate(value: string) {
  const ms = Date.parse(String(value || ''))
  if (!Number.isFinite(ms)) return '-'
  return new Date(ms).toLocaleString()
}

export function ReferralPage() {
  const { t } = useI18n()
  const [data, setData] = useState<ReferralSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const refreshTimerRef = useRef<number | null>(null)

  const loadReferralSummary = useCallback(async (withLoading = false) => {
    if (withLoading) setLoading(true)
    try {
      const res = await getMyReferralSummary()
      setData(res)
      setError('')
    } catch {
      setError(t('referral_load_failed'))
    } finally {
      if (withLoading) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadReferralSummary(true).catch(() => {})
  }, [loadReferralSummary])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (event.type !== 'balance_updated') return
      const source = String(event.source || '').trim().toLowerCase()
      if (source && source !== 'referral_reward') return
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current)
      }
      refreshTimerRef.current = window.setTimeout(() => {
        loadReferralSummary(false).catch(() => {})
      }, 140)
    })
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current)
      }
      unsub()
    }
  }, [loadReferralSummary])

  const rows = useMemo(() => data?.rewardHistory || [], [data?.rewardHistory])

  async function copyText(value: string, mode: 'code' | 'link') {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      if (mode === 'code') {
        setCopiedCode(true)
        window.setTimeout(() => setCopiedCode(false), 1200)
      } else {
        setCopiedLink(true)
        window.setTimeout(() => setCopiedLink(false), 1200)
      }
    } catch {
      // no-op
    }
  }

  return (
    <div className="page space-y-3">
      <section className="elite-panel p-4">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-brand-blue" />
          <h1 className="text-lg font-semibold text-white">{t('referral_page_title')}</h1>
        </div>
        <p className="mt-1 text-sm text-app-muted">{t('referral_page_subtitle')}</p>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-app-border bg-app-card p-4 text-sm text-app-muted">
          {t('common_loading')}
        </section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </section>
      ) : data ? (
        <>
          <section className="space-y-2 rounded-2xl border border-app-border bg-app-card p-3">
            <label className="text-xs text-app-muted">{t('referral_code_label')}</label>
            <div className="flex items-center gap-2">
              <div className="min-h-10 flex-1 rounded-xl border border-app-border bg-app-elevated px-3 py-2 font-mono text-sm text-white">
                {data.referralCode || '-'}
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-app-border bg-app-elevated px-3 text-xs text-white/85"
                onClick={() => copyText(data.referralCode, 'code')}
              >
                <Copy size={14} />
                {copiedCode ? t('referral_copied') : t('referral_copy')}
              </button>
            </div>
            <label className="text-xs text-app-muted">{t('referral_link_label')}</label>
            <div className="flex items-center gap-2">
              <div className="min-h-10 flex-1 rounded-xl border border-app-border bg-app-elevated px-3 py-2 text-xs text-white/90">
                {data.referralLink || '-'}
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-1 rounded-xl border border-app-border bg-app-elevated px-3 text-xs text-white/85"
                onClick={() => copyText(data.referralLink, 'link')}
              >
                <LinkIcon size={14} />
                {copiedLink ? t('referral_copied') : t('referral_copy')}
              </button>
            </div>
          </section>

          <section className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-app-border bg-app-card p-3">
              <p className="text-[11px] text-app-muted">{t('referral_bonus_percent_current')}</p>
              <p className="mt-1 text-lg font-semibold text-brand-blue">
                {Number(data.referralPercent || 0).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-card p-3">
              <p className="text-[11px] text-app-muted">{t('referral_total_invited')}</p>
              <p className="mt-1 text-lg font-semibold text-white">{Number(data.totalInvitedUsers || 0)}</p>
            </div>
            <div className="rounded-2xl border border-app-border bg-app-card p-3">
              <p className="text-[11px] text-app-muted">{t('referral_total_earnings')}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-lg font-semibold text-emerald-300">
                <Wallet size={15} />
                {Number(data.totalReferralEarnings || 0).toFixed(2)} USDT
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-app-border bg-app-card p-3">
            <div className="mb-2 text-sm font-semibold text-white">{t('referral_reward_history')}</div>
            {rows.length === 0 ? (
              <div className="py-3 text-sm text-app-muted">{t('referral_history_empty')}</div>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-app-border bg-app-elevated p-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-white/90">
                        {row.referred_display_name || `${t('referral_user_prefix')} #${row.referred_user_id}`}
                      </span>
                      <span className="text-app-muted">{formatDate(row.created_at)}</span>
                    </div>
                    <div className="mt-1 grid gap-1 text-white/85 sm:grid-cols-3">
                      <span>{t('referral_history_source')}: ${Number(row.source_amount || 0).toFixed(2)}</span>
                      <span>{t('referral_history_percent')}: {Number(row.reward_percent || 0).toFixed(2)}%</span>
                      <span className="text-emerald-300">
                        {t('referral_history_reward')}: ${Number(row.reward_amount || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}

