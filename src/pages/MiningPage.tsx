import { useEffect, useMemo, useRef, useState } from 'react'
import {
  claimMiningDaily,
  emergencyWithdrawMining,
  getMiningMy,
  getAds,
  subscribeMining,
  subscribeToLiveUpdates,
  type MiningConfig,
  type MiningProfile,
  type AdItem,
} from '../api'
import { AdBanner } from '../components/ads/AdBanner'
import { useI18n } from '../i18nCore'
import { emitToast } from '../toastBus'

type ConfirmAction = 'subscribe' | 'increase' | 'claim' | 'emergency' | null

export function MiningPage() {
  const { t } = useI18n()
  const [config, setConfig] = useState<MiningConfig | null>(null)
  const [profile, setProfile] = useState<MiningProfile | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [miningAds, setMiningAds] = useState<AdItem[]>([])
  const subscribeSectionRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    getAds('mining')
      .then((res) => setMiningAds(res.items || []))
      .catch(() => setMiningAds([]))
  }, [])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (event.type === 'home_content_updated') {
        getAds('mining').then((res) => setMiningAds(res.items || [])).catch(() => {})
      }
    })
    return unsub
  }, [])

  async function loadMining() {
    try {
      const res = await getMiningMy()
      setConfig(res.config)
      setProfile(res.profile)
    } catch {
      setConfig(null)
      setProfile(null)
    }
  }

  useEffect(() => {
    loadMining().catch(() => {})
  }, [])

  const amountToUse = useMemo(() => {
    if (selectedAmount && selectedAmount > 0) return selectedAmount
    const typed = Number(customAmount || 0)
    return Number.isFinite(typed) ? typed : 0
  }, [selectedAmount, customAmount])

  const hasActiveSubscription = Boolean(profile && profile.status === 'active')

  function openConfirm(action: ConfirmAction) {
    setConfirmAction(action)
  }

  function handlePrimaryMiningAction() {
    const minimumAmount = Number(config?.minSubscription || 500)
    if (amountToUse < minimumAmount) {
      setSelectedAmount(minimumAmount)
      setCustomAmount('')
      const text = t('mining_min_subscription_error')
      setMessage({ type: 'error', text })
      emitToast({ kind: 'error', errorCode: 'INVALID_AMOUNT', message: text })
      subscribeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    openConfirm(hasActiveSubscription ? 'increase' : 'subscribe')
  }

  async function performConfirmedAction() {
    if (!confirmAction) return
    setSubmitting(true)
    setMessage(null)
    try {
      if (confirmAction === 'subscribe' || confirmAction === 'increase') {
        const res = await subscribeMining(amountToUse)
        const text =
          confirmAction === 'increase' || res.action === 'increase'
            ? t('mining_increase_success')
            : t('mining_subscribe_success')
        setMessage({ type: 'success', text })
        emitToast({ kind: 'success', message: text, durationMs: 3600 })
      } else if (confirmAction === 'claim') {
        await claimMiningDaily()
        const text = t('mining_claim_success')
        setMessage({ type: 'success', text })
        emitToast({ kind: 'success', message: text, durationMs: 3200 })
      } else if (confirmAction === 'emergency') {
        await emergencyWithdrawMining()
        const text = t('mining_emergency_success')
        setMessage({ type: 'success', text })
        emitToast({ kind: 'success', message: text, durationMs: 4200 })
      }
      setConfirmAction(null)
      await loadMining()
    } catch {
      setMessage({ type: 'error', text: t('toast_error_transaction_failed') })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page space-y-3">
      <h1 className="page-title">{t('mining_title')}</h1>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <h2 className="mb-2 text-sm font-semibold text-white">{t('home_announcement_board')}</h2>
        <AdBanner items={miningAds} placement="mining" className="my-0" />
      </section>

      <section id="subscribe" ref={subscribeSectionRef} className="rounded-2xl border border-app-border bg-app-card p-3">
        <h2 className="text-sm font-semibold text-white">
          {hasActiveSubscription ? t('mining_increase_title') : t('mining_subscribe_title')}
        </h2>
        <p className="mt-1 text-xs text-app-muted">
          {hasActiveSubscription ? t('mining_increase_hint') : t('mining_subscribe_hint')} {config?.minSubscription || 500}$
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(config?.planOptions || [500, 1000, 3000]).map((value) => (
            <button
              key={value}
              type="button"
              className={`wallet-action-btn ${selectedAmount === value ? 'wallet-action-deposit' : 'owner-set-btn'}`}
              onClick={() => {
                setSelectedAmount(value)
                setCustomAmount('')
              }}
            >
              {value}$
            </button>
          ))}
        </div>
        <div className="mt-2">
          <input
            type="number"
            min={config?.minSubscription || 500}
            className="field-input"
            placeholder={t('mining_custom_amount')}
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value)
              setSelectedAmount(null)
            }}
          />
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-xl border border-brand-blue/40 bg-brand-blue px-4 py-2 text-sm font-semibold text-white"
          onClick={handlePrimaryMiningAction}
          disabled={submitting}
        >
          {hasActiveSubscription ? t('mining_increase_subscription') : t('mining_subscribe_button')}
        </button>
      </section>

      {profile ? (
        <section className="rounded-2xl border border-app-border bg-app-card p-3">
          <h2 className="text-sm font-semibold text-white">{t('mining_wallet_title')}</h2>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-app-muted">{t('mining_wallet_balance')}</span>
              <span className="font-semibold text-white">{Number(profile.principal_amount || 0).toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-muted">{t('mining_daily_profit')}</span>
              <span className="font-semibold text-positive">{Number(profile.daily_claimable || 0).toFixed(4)} USDT</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-muted">{t('mining_monthly_profit')}</span>
              <span className="font-semibold text-brand-blue">{Number(profile.monthly_accrued_live || 0).toFixed(4)} USDT</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="wallet-action-btn wallet-action-deposit"
              onClick={() => openConfirm('claim')}
              disabled={submitting || Number(profile.daily_claimable || 0) <= 0}
            >
              {t('mining_claim_daily')}
            </button>
            <button
              type="button"
              className="wallet-action-btn wallet-action-withdraw"
              onClick={() => openConfirm('emergency')}
              disabled={submitting || profile.status === 'inactive'}
            >
              {t('mining_emergency_withdraw')}
            </button>
          </div>
        </section>
      ) : null}

      {message ? (
        <div className={`rounded-xl px-3 py-2 text-sm ${message.type === 'success' ? 'owner-message-success' : 'owner-message-error'}`}>
          {message.text}
        </div>
      ) : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-card p-4">
            <h3 className="text-base font-semibold text-white">{t('mining_confirm_title')}</h3>
            <p className="mt-2 text-sm text-app-muted">
              {confirmAction === 'subscribe'
                ? `${t('mining_confirm_subscribe')} ${amountToUse.toFixed(2)} USDT`
                : confirmAction === 'increase'
                  ? `${t('mining_confirm_increase')} ${amountToUse.toFixed(2)} USDT`
                : confirmAction === 'claim'
                  ? t('mining_confirm_claim')
                  : t('mining_confirm_emergency')}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-app-border bg-app-elevated px-3 py-2 text-sm text-white/80"
                onClick={() => setConfirmAction(null)}
                disabled={submitting}
              >
                {t('common_cancel')}
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white"
                onClick={performConfirmedAction}
                disabled={submitting}
              >
                {submitting ? '...' : t('common_confirm')}
              </button>
            </div>
          </div>
      </div>
      ) : null}
    </div>
  )
}
