import { useEffect, useMemo, useRef, useState } from 'react'
import {
  cancelMining,
  claimMiningDaily,
  emergencyWithdrawMining,
  getMiningMy,
  getAds,
  releaseMiningPrincipal,
  subscribeMining,
  subscribeToLiveUpdates,
  type MiningConfig,
  type MiningProfile,
  type AdItem,
} from '../api'
import { AdBanner } from '../components/ads/AdBanner'
import { useI18n } from '../i18nCore'
import { emitToast } from '../toastBus'

type ConfirmAction = 'subscribe' | 'claim' | 'cancel' | 'emergency' | null

const DEFAULT_MINING_MEDIA = [
  {
    id: 'local-mining-ad-video',
    type: 'video' as const,
    url: '/mining-media/mining-ad.mp4',
    title: '',
    enabled: true,
    order: 0,
  },
  {
    id: 'local-mining-ad-image',
    type: 'image' as const,
    url: '/ads/mining-main-banner.jpg',
    title: '',
    enabled: true,
    order: 1,
  },
  {
    id: 'local-mining-ad-video-electric',
    type: 'video' as const,
    url: '/mining-media/mining-electric.mp4',
    title: '',
    enabled: true,
    order: 2,
  },
]

export function MiningPage() {
  const { t } = useI18n()
  const [config, setConfig] = useState<MiningConfig | null>(null)
  const [profile, setProfile] = useState<MiningProfile | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [autoplayOnSubscribe, setAutoplayOnSubscribe] = useState(false)
  const [miningAds, setMiningAds] = useState<AdItem[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)

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
      setActiveMediaIndex(0)
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

  const mediaItems = useMemo(() => {
    const configured = (config?.mediaItems?.filter((item) => item.enabled) || []).slice()
    const existingUrls = new Set(configured.map((item) => String(item.url || '').trim()))
    for (const fallbackItem of DEFAULT_MINING_MEDIA) {
      if (!existingUrls.has(fallbackItem.url)) {
        configured.push(fallbackItem)
      }
    }
    return configured.sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
  }, [config?.mediaItems])
  const activeMedia = mediaItems[activeMediaIndex] || null
  const hasVideoMedia = mediaItems.some((item) => item.type === 'video')

  useEffect(() => {
    if (!mediaItems.length) return
    if (mediaItems[activeMediaIndex]?.type === 'video') return
    const firstVideoIndex = mediaItems.findIndex((item) => item.type === 'video')
    if (firstVideoIndex >= 0) setActiveMediaIndex(firstVideoIndex)
  }, [activeMediaIndex, mediaItems])

  function openConfirm(action: ConfirmAction) {
    setConfirmAction(action)
  }

  async function performConfirmedAction() {
    if (!confirmAction) return
    setSubmitting(true)
    setMessage(null)
    try {
      if (confirmAction === 'subscribe') {
        await subscribeMining(amountToUse)
        setAutoplayOnSubscribe(true)
        const text = t('mining_subscribe_success')
        setMessage({ type: 'success', text })
        emitToast({ kind: 'success', message: text, durationMs: 3600 })
      } else if (confirmAction === 'claim') {
        await claimMiningDaily()
        const text = t('mining_claim_success')
        setMessage({ type: 'success', text })
        emitToast({ kind: 'success', message: text, durationMs: 3200 })
      } else if (confirmAction === 'cancel') {
        await cancelMining()
        const text = t('mining_cancel_success')
        setMessage({ type: 'success', text })
        emitToast({ kind: 'success', message: text, durationMs: 4500 })
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

  useEffect(() => {
    if (!autoplayOnSubscribe || !hasVideoMedia) return
    const firstVideoIndex = mediaItems.findIndex((item) => item.type === 'video')
    if (firstVideoIndex >= 0 && firstVideoIndex !== activeMediaIndex) {
      setActiveMediaIndex(firstVideoIndex)
    }
  }, [activeMediaIndex, autoplayOnSubscribe, hasVideoMedia, mediaItems])

  useEffect(() => {
    if (!activeMedia || activeMedia.type !== 'video') return
    const videoEl = videoRef.current
    if (!videoEl) return
    videoEl.currentTime = 0
    const playPromise = videoEl.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {})
    }
  }, [activeMedia, autoplayOnSubscribe])

  return (
    <div className="page space-y-3">
      <h1 className="page-title">{t('mining_title')}</h1>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <h2 className="mb-2 text-sm font-semibold text-white">{t('home_announcement_board')}</h2>
        <AdBanner items={miningAds} placement="mining" className="my-0" />
      </section>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <h2 className="text-sm font-semibold text-white">{t('mining_media_title')}</h2>
        <p className="mt-1 text-xs text-app-muted">{t('mining_media_hint')}</p>
        {activeMedia ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-app-border bg-app-elevated">
            {activeMedia.type === 'video' ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  src={activeMedia.url}
                  className="h-40 w-full object-cover"
                  controls
                  muted
                  playsInline
                  autoPlay
                  loop
                  preload="metadata"
                />
              </div>
            ) : (
              <img src={activeMedia.url} alt={activeMedia.title || 'mining'} className="h-40 w-full object-cover" />
            )}
            <div className="px-3 py-2 text-xs text-app-muted">{activeMedia.title || t('mining_media_caption')}</div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-app-border bg-app-elevated px-3 py-6 text-center text-xs text-app-muted">
            {t('mining_media_empty')}
          </div>
        )}
        {mediaItems.length > 1 ? (
          <div className="mt-2 flex justify-center gap-1.5">
            {mediaItems.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`h-2 rounded-full ${idx === activeMediaIndex ? 'w-5 bg-brand-blue' : 'w-2 bg-white/35'}`}
                onClick={() => setActiveMediaIndex(idx)}
                aria-label={`${t('promo_go_to')} ${idx + 1}`}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section id="subscribe" className="rounded-2xl border border-app-border bg-app-card p-3">
        <h2 className="text-sm font-semibold text-white">{t('mining_subscribe_title')}</h2>
        <p className="mt-1 text-xs text-app-muted">
          {t('mining_subscribe_hint')} {config?.minSubscription || 500}$
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
          onClick={() => {
            if (amountToUse < Number(config?.minSubscription || 500)) {
              const text = t('mining_min_subscription_error')
              setMessage({ type: 'error', text })
              emitToast({ kind: 'error', errorCode: 'INVALID_AMOUNT', message: text })
              return
            }
            openConfirm('subscribe')
          }}
          disabled={submitting}
        >
          {t('mining_subscribe_button')}
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
              className="wallet-action-btn owner-set-btn"
              onClick={() => openConfirm('cancel')}
              disabled={submitting || profile.status !== 'active'}
            >
              {t('mining_cancel_subscription')}
            </button>
            <button
              type="button"
              className="wallet-action-btn wallet-action-withdraw"
              onClick={() => openConfirm('emergency')}
              disabled={submitting || profile.status === 'inactive'}
            >
              {t('mining_emergency_withdraw')}
            </button>
            <button
              type="button"
              className="wallet-action-btn owner-set-btn"
              onClick={async () => {
                setSubmitting(true)
                setMessage(null)
                try {
                  await releaseMiningPrincipal()
                  const text = t('mining_release_success')
                  setMessage({ type: 'success', text })
                  emitToast({ kind: 'success', message: text, durationMs: 3500 })
                  await loadMining()
                } catch {
                  setMessage({ type: 'error', text: t('toast_error_transaction_failed') })
                } finally {
                  setSubmitting(false)
                }
              }}
              disabled={submitting || !profile.can_release_principal}
            >
              {t('mining_release_principal')}
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
                : confirmAction === 'claim'
                  ? t('mining_confirm_claim')
                  : confirmAction === 'cancel'
                    ? t('mining_confirm_cancel')
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
