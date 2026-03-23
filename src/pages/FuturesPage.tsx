import { useEffect, useMemo, useState } from 'react'
import {
  getMyStrategyCodes,
  getPushPublicKey,
  getPushSubscriptionStatus,
  previewStrategyCode,
  removePushSubscription,
  redeemStrategyCode,
  savePushSubscription,
  sendPushTest,
  settleStrategyTrade,
  updateStrategyTradeDetails,
  apiFetch,
  getStrategyTradeDisplayConfig,
  type StrategyCodeItem,
  type StrategyTradeDisplayConfig,
} from '../api'
import { playFeedbackSound } from '../appFeedback'
import { LiveCandlesChart } from '../components/market/LiveCandlesChart'
import { useMarketBoard } from '../hooks/useMarketBoard'
import { useI18n } from '../i18nCore'

type Candle = { time: number; open: number; high: number; low: number; close: number }
const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

export function FuturesPage() {
  const { t } = useI18n()
  const { quotes, loading: quotesLoading, usingFallback } = useMarketBoard(3000)
  const [selected, setSelected] = useState('BTCUSDT')
  const [selectedInterval, setSelectedInterval] = useState<(typeof intervals)[number]>('5m')
  const [candles, setCandles] = useState<Candle[]>([])
  const [taskCode, setTaskCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [preview, setPreview] = useState<null | Awaited<ReturnType<typeof previewStrategyCode>>>(null)
  const [codes, setCodes] = useState<StrategyCodeItem[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<'default' | 'denied' | 'granted'>('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [expertName, setExpertName] = useState('')
  const [savingTradeDetails, setSavingTradeDetails] = useState(false)
  const [tradeDisplayConfig, setTradeDisplayConfig] = useState<StrategyTradeDisplayConfig>({
    preview_notice: 'سيتم فتح الصفقة الاستراتيجية بعد التأكيد وفق آلية المعالجة الداخلية للنظام.',
    active_notice: 'تتم إعادة أصل الصفقة مع الربح تلقائيًا بعد اكتمال المعالجة الداخلية.',
    settled_notice: 'تمت تسوية الصفقة الاستراتيجية وإرجاع الأصل مع الربح.',
  })

  const current = useMemo(() => quotes.find((item) => item.symbol === selected) || quotes[0], [quotes, selected])
  const activeTrade = useMemo(
    () => codes.map((item) => item.usage).find((usage) => usage?.status === 'trade_active') || null,
    [codes],
  )
  const activeTradeAutoSettleAtMs = activeTrade?.autoSettleAt ? Date.parse(activeTrade.autoSettleAt) : Number.NaN
  const activeTradeReadyToSettle = !!activeTrade && (Number.isNaN(activeTradeAutoSettleAtMs) || activeTradeAutoSettleAtMs <= Date.now())

  useEffect(() => {
    setExpertName(String(activeTrade?.expertName || ''))
  }, [activeTrade?.id, activeTrade?.expertName])

  useEffect(() => {
    if (quotes.length > 0 && !quotes.find((x) => x.symbol === selected)) {
      setSelected(quotes[0].symbol)
    }
  }, [quotes, selected])

  useEffect(() => {
    let active = true
    async function loadCodes() {
      try {
        const res = await getMyStrategyCodes()
        if (active) setCodes(res.items || [])
      } catch {
        if (active) setCodes([])
      }
    }
    loadCodes().catch(() => {})
    const id = window.setInterval(() => loadCodes().catch(() => {}), 5000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    let active = true
    async function loadCandles() {
      const res = (await apiFetch(
        `/api/market/candles?symbol=${encodeURIComponent(selected)}&interval=${selectedInterval}&limit=120`,
      )) as { candles: Candle[] }
      if (!active) return
      setCandles(Array.isArray(res.candles) ? res.candles : [])
    }
    loadCandles().catch(() => setCandles([]))
    const id = window.setInterval(() => {
      loadCandles().catch(() => {})
    }, 5000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [selected, selectedInterval])

  useEffect(() => {
    getStrategyTradeDisplayConfig()
      .then((res) => setTradeDisplayConfig(res.config))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    setPushSupported(supported)
    if (!supported) return
    setPushPermission(Notification.permission)
    getPushSubscriptionStatus()
      .then((res) => setPushSubscribed(Boolean(res.subscribed)))
      .catch(() => setPushSubscribed(false))
  }, [])

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  async function enablePushNotifications(forcePrompt = true) {
    if (pushBusy || !pushSupported) return
    setPushBusy(true)
    try {
      let permission: NotificationPermission = Notification.permission
      if (permission !== 'granted' && forcePrompt) permission = await Notification.requestPermission()
      setPushPermission(permission)
      if (permission !== 'granted') return
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        const { publicKey } = await getPushPublicKey()
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      }
      await savePushSubscription(subscription.toJSON())
      setPushSubscribed(true)
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePushNotifications() {
    if (pushBusy || !pushSupported) return
    setPushBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      const endpoint = subscription?.endpoint || null
      if (subscription) await subscription.unsubscribe().catch(() => {})
      await removePushSubscription(endpoint).catch(() => {})
      setPushSubscribed(false)
    } finally {
      setPushBusy(false)
    }
  }

  async function sendPushPreview() {
    if (pushBusy) return
    setPushBusy(true)
    try {
      await enablePushNotifications(false)
      await sendPushTest()
      setPushSubscribed(true)
    } finally {
      setPushBusy(false)
    }
  }

  async function refreshCodes() {
    const refreshed = await getMyStrategyCodes()
    setCodes(refreshed.items || [])
  }

  async function handlePreviewCode() {
    const code = taskCode.trim()
    if (!code) {
      setMessage({ type: 'error', text: 'أدخل كود الاستراتيجية أولًا.' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await previewStrategyCode(code, selected)
      setPreview(res)
    } catch (error) {
      setPreview(null)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر التحقق من الكود.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmRedeem() {
    if (!preview) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await redeemStrategyCode({ code: taskCode.trim(), symbol: selected, confirmed: true })
      await refreshCodes()
      setPreview(null)
      setTaskCode('')
      playFeedbackSound('strategyCode').catch(() => {})
      if (res.featureType === 'trial_trade') {
        setMessage({
          type: 'success',
          text: `تم فتح الصفقة الاستراتيجية بنجاح. تم خصم ${Number(res.stakeAmount || 0).toFixed(2)} USDT. ${tradeDisplayConfig.active_notice}`,
        })
      } else {
        setMessage({
          type: 'success',
          text: `تم تفعيل المكافأة الترويجية بنجاح وإضافتها عبر النظام المالي الجديد.`,
        })
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تفعيل الكود.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSettleTrade() {
    if (!activeTrade) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await settleStrategyTrade(activeTrade.id)
      await refreshCodes()
      setMessage({
        type: 'success',
        text: `${tradeDisplayConfig.settled_notice} تم إرجاع ${Number(res.payoutAmount || 0).toFixed(2)} USDT إلى رصيدك.`,
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر إغلاق الصفقة الاستراتيجية.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyStrategyCode() {
    const codeToCopy = String(activeTrade?.strategyCode || '').trim()
    if (!codeToCopy) return
    try {
      await navigator.clipboard.writeText(codeToCopy)
      setMessage({ type: 'success', text: 'تم نسخ كود الاستراتيجية.' })
    } catch {
      setMessage({ type: 'error', text: 'تعذر نسخ كود الاستراتيجية.' })
    }
  }

  async function handleSaveTradeDetails() {
    if (!activeTrade) return
    setSavingTradeDetails(true)
    try {
      await updateStrategyTradeDetails({ usageId: activeTrade.id, expertName })
      await refreshCodes()
      setMessage({ type: 'success', text: 'تم حفظ معلومات الصفقة بنجاح.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر حفظ معلومات الصفقة.' })
    } finally {
      setSavingTradeDetails(false)
    }
  }

  return (
    <div className="page futures-page ku-mobile-page space-y-3">
      <h1 className="page-title">لوحة صفقة</h1>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">الأصل المحدد</div>
            <div className="text-xs text-app-muted">
              {usingFallback ? 'Fallback واضح' : 'سعر حي أو شبه حي'} • {selected}
            </div>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${Number(current?.change24h || 0) >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
            {Number(current?.change24h || 0) >= 0 ? '+' : ''}
            {Number(current?.change24h || 0).toFixed(2)}%
          </div>
        </div>

        <div className="futures-chart rounded-xl border border-app-border bg-app-elevated p-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-app-muted">{selected}</span>
            <div className="elite-scroll-row">
              {intervals.map((itv) => (
                <button
                  key={itv}
                  type="button"
                  className={selectedInterval === itv ? 'market-itv-btn active elite-chip' : 'market-itv-btn elite-chip'}
                  onClick={() => setSelectedInterval(itv)}
                >
                  {itv}
                </button>
              ))}
            </div>
          </div>
          <LiveCandlesChart candles={candles} />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
            <div className="text-[11px] text-app-muted">السعر الحالي</div>
            <div className="mt-1 text-lg font-semibold text-white">{Number(current?.price || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
            <div className="text-[11px] text-app-muted">الحجم 24 ساعة</div>
            <div className="mt-1 text-lg font-semibold text-white">{Number(current?.volume || 0).toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
            <div className="text-[11px] text-app-muted">حالة الصفقة</div>
            <div className="mt-1 text-sm font-semibold text-white">{activeTrade ? 'مفتوحة' : 'لا توجد صفقة نشطة'}</div>
          </div>
          <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
            <div className="text-[11px] text-app-muted">الأصل</div>
            <div className="mt-1 text-sm font-semibold text-white">{current?.symbol || '--'}</div>
          </div>
        </div>
      </section>

      <section className="table-card overflow-hidden rounded-2xl border border-app-border">
        <div className="table-head">
          <span>{t('tasks_market_symbol')}</span>
          <span>{t('tasks_market_price')}</span>
          <span>{t('tasks_market_change')}</span>
        </div>
        {quotesLoading && quotes.length === 0 ? (
          <div className="table-row">{t('common_loading')}</div>
        ) : (
          quotes.slice(0, 12).map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => setSelected(item.symbol)}
              className={`table-row w-full text-start ${selected === item.symbol ? 'market-row-active' : ''}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white">{item.symbol}</span>
                <span className="text-[10px] text-app-muted">Live</span>
              </span>
              <span>{Number(item.price).toLocaleString()}</span>
              <span className={item.change24h >= 0 ? 'text-positive' : 'text-negative'}>
                {item.change24h >= 0 ? '+' : ''}
                {Number(item.change24h).toFixed(2)}%
              </span>
            </button>
          ))
        )}
      </section>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <div className="mb-3 rounded-2xl border border-brand-blue/15 bg-app-elevated p-3">
          <div className="text-sm font-semibold text-white">الإشعارات الخارجية للصفقات</div>
          <p className="mt-1 text-xs text-app-muted">
            فعّلها من هنا ليصلك إشعار فعلي عند تفعيل كود الاستراتيجية أو عند إغلاق الصفقة تلقائيًا حتى لو كنت خارج التطبيق.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pushSupported ? (
              <>
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={() => {
                    if (pushSubscribed) disablePushNotifications().catch(() => {})
                    else enablePushNotifications(true).catch(() => {})
                  }}
                  disabled={pushBusy}
                >
                  {pushBusy ? '...' : pushSubscribed ? 'إيقاف الإشعارات الخارجية' : 'تفعيل الإشعارات الخارجية'}
                </button>
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-deposit"
                  onClick={() => {
                    sendPushPreview().catch(() => {})
                  }}
                  disabled={pushBusy || (!pushSubscribed && pushPermission === 'denied')}
                >
                  {pushBusy ? '...' : 'إرسال إشعار تجريبي'}
                </button>
              </>
            ) : (
              <div className="text-xs text-app-muted">هذا المتصفح أو الجهاز لا يدعم Web Push.</div>
            )}
          </div>
          <div className="mt-2 text-xs text-app-muted">
            {pushPermission === 'denied'
              ? 'الإشعارات محظورة من المتصفح أو النظام.'
              : pushSubscribed
                ? 'الإشعارات الخارجية مفعّلة لهذا الجهاز.'
                : 'الإشعارات الخارجية غير مفعّلة بعد على هذا الجهاز.'}
          </div>
        </div>
        <h2 className="text-sm font-semibold text-white">كود فتح الصفقات الاستراتيجية</h2>
        <p className="mt-1 text-xs text-app-muted">
          يتم التحقق من الكود أولًا، ثم تظهر لك رسالة موافقة واضحة قبل أي خصم أو تفعيل.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className="field-input"
            value={taskCode}
            onChange={(e) => setTaskCode(e.target.value)}
            placeholder="أدخل كود الاستراتيجية"
          />
          <button
            type="button"
            className="wallet-action-btn wallet-action-deposit"
            onClick={handlePreviewCode}
            disabled={submitting}
          >
            {submitting ? '...' : 'تحقق من الكود'}
          </button>
        </div>
        {message ? (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${message.type === 'success' ? 'owner-message-success' : 'owner-message-error'}`}>
            {message.text}
          </div>
        ) : null}
      </section>

      {activeTrade ? (
        <section className="rounded-2xl border border-brand-blue/25 bg-app-card p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">حالة الصفقة الاستراتيجية</h2>
              <p className="text-xs text-app-muted">{tradeDisplayConfig.active_notice}</p>
            </div>
            <button
              type="button"
              className="wallet-action-btn owner-set-btn"
              onClick={handleSettleTrade}
              disabled={submitting || !activeTradeReadyToSettle}
            >
              {submitting ? '...' : activeTradeReadyToSettle ? 'إغلاق الصفقة الآن' : 'بانتظار موعد الإغلاق'}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
              <div className="text-[11px] text-app-muted">الرمز</div>
              <div className="mt-1 text-sm font-semibold text-white">{activeTrade.selectedSymbol}</div>
            </div>
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
              <div className="text-[11px] text-app-muted">سعر الدخول</div>
              <div className="mt-1 text-sm font-semibold text-white">{Number(activeTrade.entryPrice || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
              <div className="text-[11px] text-app-muted">المبلغ المحجوز</div>
              <div className="mt-1 text-sm font-semibold text-white">{Number(activeTrade.stakeAmount || 0).toFixed(2)} USDT</div>
            </div>
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
              <div className="text-[11px] text-app-muted">نسبة العائد المحددة</div>
              <div className="mt-1 text-sm font-semibold text-white">{Number(activeTrade.tradeReturnPercent || 0).toFixed(2)}%</div>
            </div>
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2 sm:col-span-2">
              <div className="text-[11px] text-app-muted">وصف المعالجة</div>
              <div className="mt-1 text-sm font-semibold text-white">{tradeDisplayConfig.active_notice}</div>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <div className="text-[11px] text-amber-100/80">كود الاستراتيجية</div>
              <div className="mt-2 flex gap-2">
                <input
                  className="field-input flex-1"
                  value={String(activeTrade.strategyCode || '')}
                  readOnly
                  placeholder="سيظهر الكود هنا"
                />
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn whitespace-nowrap"
                  onClick={() => {
                    handleCopyStrategyCode().catch(() => {})
                  }}
                  disabled={!String(activeTrade.strategyCode || '').trim()}
                >
                  نسخ
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-brand-blue/20 bg-app-elevated p-3">
              <div className="text-[11px] text-app-muted">اسم الخبير المعتمد للصفقة</div>
              <div className="mt-2 flex gap-2">
                <input
                  className="field-input flex-1"
                  value={expertName}
                  onChange={(e) => setExpertName(e.target.value)}
                  placeholder="أدخل اسم الخبير المعتمد"
                />
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-deposit whitespace-nowrap"
                  onClick={() => {
                    handleSaveTradeDetails().catch(() => {})
                  }}
                  disabled={savingTradeDetails}
                >
                  {savingTradeDetails ? '...' : 'حفظ'}
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {preview ? (
        <div className="liquid-modal-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="liquid-modal-card w-full max-w-lg rounded-3xl border border-app-border bg-app-card p-4 shadow-[0_24px_54px_rgba(0,0,0,0.45)]">
            <h3 className="text-base font-semibold text-white">تأكيد تفعيل الكود</h3>
            <p className="mt-2 text-sm text-app-muted">
              {preview.featureType === 'trial_trade' ? tradeDisplayConfig.preview_notice : preview.preview.confirmationMessage}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
                <div className="text-[11px] text-app-muted">نوع الميزة</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {preview.featureType === 'trial_trade' ? 'فتح صفقات استراتيجية' : 'مكافأة ترويجية'}
                </div>
              </div>
              <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
                <div className="text-[11px] text-app-muted">الأصل</div>
                <div className="mt-1 text-sm font-semibold text-white">{preview.assetSymbol}</div>
              </div>
              <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
                <div className="text-[11px] text-app-muted">سعر السوق</div>
                <div className="mt-1 text-sm font-semibold text-white">{Number(preview.currentPrice || 0).toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
                <div className="text-[11px] text-app-muted">الرصيد الحالي</div>
                <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.balanceSnapshot || 0).toFixed(2)} USDT</div>
              </div>
              {preview.preview.stakeAmount ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 sm:col-span-2">
                  <div className="text-[11px] text-amber-100/80">المبلغ الذي سيُخصم بعد موافقتك</div>
                  <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.stakeAmount).toFixed(2)} USDT</div>
                </div>
              ) : null}
              {preview.preview.rewardAmount ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 sm:col-span-2">
                  <div className="text-[11px] text-emerald-100/80">المكافأة المعلنة قبل التأكيد</div>
                  <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.rewardAmount).toFixed(2)} USDT</div>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="wallet-action-btn owner-set-btn"
                onClick={() => setPreview(null)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="wallet-action-btn wallet-action-deposit"
                onClick={handleConfirmRedeem}
                disabled={submitting}
              >
                {submitting ? '...' : 'أوافق وأفعّل الكود'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
