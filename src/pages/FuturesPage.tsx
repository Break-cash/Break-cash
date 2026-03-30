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
  apiFetch,
  getStrategyTradeDisplayConfig,
  type StrategyCodeItem,
  type StrategyTradeDisplayConfig,
} from '../api'
import { playFeedbackSound } from '../appFeedback'
import { AppModalPortal } from '../components/ui/AppModalPortal'
import { LiveCandlesChart } from '../components/market/LiveCandlesChart'
import { useMarketBoard } from '../hooks/useMarketBoard'
import { useI18n } from '../i18nCore'

type Candle = { time: number; open: number; high: number; low: number; close: number }
const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
function formatUnlockDate(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('ar', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  const [tradeDisplayConfig, setTradeDisplayConfig] = useState<StrategyTradeDisplayConfig>({
    preview_notice: 'سيتم فتح الصفقة الاستراتيجية بعد التأكيد وفق آلية المعالجة الداخلية للنظام.',
    active_notice: 'يتم حجز قيمة الصفقة من إجمالي الأصول، بما في ذلك الرصيد المقيد بإدارة المخاطر، ويعود أصل الصفقة مع الربح عند الإغلاق.',
    settled_notice: 'تمت تسوية الصفقة الاستراتيجية وإرجاع الأصل مع الربح.',
  })

  const current = useMemo(() => quotes.find((item) => item.symbol === selected) || quotes[0], [quotes, selected])
  const activeTrades = useMemo(
    () =>
      codes
        .map((item) => item.usage)
        .filter((usage): usage is NonNullable<typeof usage> => Boolean(usage))
        .filter((usage) => usage.status === 'trade_active')
        .sort((left, right) => {
          const leftTime = Date.parse(left.confirmedAt || left.usedAt || '') || 0
          const rightTime = Date.parse(right.confirmedAt || right.usedAt || '') || 0
          return rightTime - leftTime
        }),
    [codes],
  )
  const publishedStrategyTrades = useMemo(
    () => codes.filter((item) => item.featureType === 'trial_trade' && item.isActive && !item.alreadyUsed),
    [codes],
  )
  const latestSettledTrade = useMemo(() => {
    const settledUsages = codes
      .map((item) => item.usage)
      .filter((usage): usage is NonNullable<typeof usage> => Boolean(usage))
      .filter((usage) => usage.status === 'trade_settled')
      .sort((left, right) => {
        const leftTime = Date.parse(left.settledAt || left.usedAt || '') || 0
        const rightTime = Date.parse(right.settledAt || right.usedAt || '') || 0
        return rightTime - leftTime
      })
    return settledUsages[0] || null
  }, [codes])
  const latestSettledTradeProfit = useMemo(() => {
    if (!latestSettledTrade) return 0
    return Number(latestSettledTrade.stakeAmount || 0) * (Number(latestSettledTrade.tradeReturnPercent || 0) / 100)
  }, [latestSettledTrade])
  const activeTradesCount = activeTrades.length

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
            text: `\u062a\u0645 \u0641\u062a\u062d \u0627\u0644\u0635\u0641\u0642\u0629 \u0627\u0644\u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0628\u0646\u062c\u0627\u062d. \u062a\u0645 \u062a\u0645\u0648\u064a\u0644 ${Number(res.stakeAmount || 0).toFixed(2)} USDT \u0628\u0646\u0633\u0628\u0629 ${Number(res.purchasePercent || 0).toFixed(0)}% \u0645\u0646 \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0623\u0635\u0648\u0644 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0644\u0644\u062a\u0645\u0648\u064a\u0644\u060c \u0628\u0645\u0627 \u064a\u0634\u0645\u0644 \u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0645\u0642\u064a\u062f \u0648\u0627\u0644\u0645\u0643\u062a\u0633\u0628\u0627\u062a. ${tradeDisplayConfig.active_notice}`, 
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

  async function handleSettleTrade(usageId: number) {
    if (!usageId) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await settleStrategyTrade(usageId)
      await refreshCodes()
      setMessage({
        type: 'success',
        text: `${tradeDisplayConfig.settled_notice} \u062a\u0645 \u0625\u0631\u062c\u0627\u0639 \u0623\u0635\u0644 \u0627\u0644\u0635\u0641\u0642\u0629 \u0641\u0648\u0631\u064b\u0627\u060c \u0648\u0623\u0635\u0628\u062d \u0631\u0628\u062d \u0627\u0644\u0635\u0641\u0642\u0629 ${Number(res.profitAmount || 0).toFixed(2)} USDT \u0642\u0627\u0628\u0644\u064b\u0627 \u0644\u0644\u0633\u062d\u0628 \u0641\u0648\u0631\u064b\u0627.`,
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر إغلاق الصفقة الاستراتيجية.' })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyStrategyCode(strategyCode?: string | null) {
    const codeToCopy = String(strategyCode || '').trim()
    if (!codeToCopy) return
    try {
      await navigator.clipboard.writeText(codeToCopy)
      setMessage({ type: 'success', text: 'تم نسخ كود الاستراتيجية.' })
    } catch {
      setMessage({ type: 'error', text: 'تعذر نسخ كود الاستراتيجية.' })
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
            <div className="mt-1 text-sm font-semibold text-white">{activeTradesCount > 0 ? 'مفتوحة' : 'لا توجد صفقة نشطة'}</div>
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
          يتم التحقق من الكود أولًا، ثم تظهر لك رسالة موافقة واضحة توضح نسبة الشراء من إجمالي الأصول المحتسبة للشراء، وتشمل المكتسبات القابلة وغير القابلة للسحب مع استثناء الجزء المقيد فقط.
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
        {publishedStrategyTrades.length > 0 ? (
          <div className="mt-3 grid gap-3">
            <div className="rounded-2xl border border-brand-blue/20 bg-brand-blue/10 px-3 py-2 text-xs text-brand-blue">
              هذه اللوحات منشورة من الإدارة وتظهر لك للعرض فقط. انسخ الكود من اللوحة المقفولة ثم فعّله من الخانة أعلاه لبدء الصفقة.
            </div>
            {publishedStrategyTrades.map((item) => {
              const isUsed = Boolean(item.alreadyUsed)
              return (
                <div key={item.id} className="rounded-2xl border border-amber-500/20 bg-app-elevated p-3 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.06)]">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{item.title || 'صفقة استراتيجية'}</div>
                      <div className="text-xs text-app-muted">
                        {item.description || 'تم نشر هذه الصفقة من الإدارة وتنتظر نسخ الكود وتفعيله.'}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${isUsed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-200'}`}>
                      {isUsed ? 'تم تفعيلها على الحساب' : 'لوحة مقفولة حتى التفعيل'}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">الأصل</div>
                      <div className="mt-1 text-sm font-semibold text-white">{item.assetSymbol}</div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">العائد المحدد</div>
                      <div className="mt-1 text-sm font-semibold text-white">{Number(item.tradeReturnPercent || 0).toFixed(2)}%</div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">نسبة الشراء</div>
                      <div className="mt-1 text-sm font-semibold text-white">{Number(item.purchasePercent || 0).toFixed(0)}%</div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">الخبير المعتمد</div>
                      <div className="mt-1 text-sm font-semibold text-white">{item.expertName || 'سيحدده المشرف أو المالك'}</div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">حالة اللوحة</div>
                      <div className="mt-1 text-sm font-semibold text-white">{isUsed ? 'مرتبطة بالحساب' : 'جاهزة للنسخ والتفعيل'}</div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                    <div className="text-[11px] text-amber-100/80">كود الاستراتيجية</div>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input className="field-input flex-1" value={item.code} readOnly />
                      <button
                        type="button"
                        className="wallet-action-btn owner-set-btn whitespace-nowrap"
                        onClick={() => {
                          navigator.clipboard.writeText(item.code).then(
                            () => setMessage({ type: 'success', text: 'تم نسخ كود الاستراتيجية.' }),
                            () => setMessage({ type: 'error', text: 'تعذر نسخ كود الاستراتيجية.' }),
                          )
                        }}
                      >
                        نسخ الكود
                      </button>
                      <button
                        type="button"
                        className="wallet-action-btn wallet-action-deposit whitespace-nowrap"
                        onClick={() => setTaskCode(item.code)}
                      >
                        وضعه في الخانة
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
        {message ? (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${message.type === 'success' ? 'owner-message-success' : 'owner-message-error'}`}>
            {message.text}
          </div>
        ) : null}
      </section>

      {activeTrades.length > 0 ? (
        <section className="rounded-2xl border border-brand-blue/25 bg-app-card p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">حالة الصفقة الاستراتيجية</h2>
              <p className="text-xs text-app-muted">{tradeDisplayConfig.active_notice}</p>
            </div>
            <div className="rounded-full border border-brand-blue/20 bg-app-elevated px-3 py-1 text-[11px] font-semibold text-white">
              {activeTradesCount === 1 ? 'صفقة نشطة واحدة' : `${activeTradesCount} صفقات نشطة`}
            </div>
          </div>
          <div className="space-y-3">
            {activeTrades.map((trade) => {
              const tradeAutoSettleAtMs = trade.autoSettleAt ? Date.parse(trade.autoSettleAt) : Number.NaN
              const tradeReadyToSettle = Number.isNaN(tradeAutoSettleAtMs) || tradeAutoSettleAtMs <= Date.now()
              return (
                <div key={trade.id} className="rounded-2xl border border-brand-blue/20 bg-app-elevated p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{trade.selectedSymbol}</div>
                      <div className="text-xs text-app-muted">
                        {String(trade.expertName || '').trim() || 'يظهر هنا الاسم الذي تحدده الإدارة لهذه الصفقة'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="wallet-action-btn owner-set-btn"
                      onClick={() => {
                        handleSettleTrade(trade.id).catch(() => {})
                      }}
                      disabled={submitting || !tradeReadyToSettle}
                    >
                      {submitting ? '...' : tradeReadyToSettle ? 'إغلاق الصفقة الآن' : 'بانتظار موعد الإغلاق'}
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">سعر الدخول</div>
                      <div className="mt-1 text-sm font-semibold text-white">{Number(trade.entryPrice || 0).toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">المبلغ المحجوز</div>
                      <div className="mt-1 text-sm font-semibold text-white">{Number(trade.stakeAmount || 0).toFixed(2)} USDT</div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">نسبة العائد المحددة</div>
                      <div className="mt-1 text-sm font-semibold text-white">{Number(trade.tradeReturnPercent || 0).toFixed(2)}%</div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">نسبة الشراء</div>
                      <div className="mt-1 text-sm font-semibold text-white">{Number(trade.purchasePercent || 0).toFixed(0)}%</div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">موعد الإغلاق</div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {trade.autoSettleAt ? formatUnlockDate(trade.autoSettleAt) : 'جاهزة الآن'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <div className="text-[11px] text-amber-100/80">كود الاستراتيجية</div>
                      <div className="mt-2 flex gap-2">
                        <input
                          className="field-input flex-1"
                          value={String(trade.strategyCode || '')}
                          readOnly
                          placeholder="سيظهر الكود هنا"
                        />
                        <button
                          type="button"
                          className="wallet-action-btn owner-set-btn whitespace-nowrap"
                          onClick={() => {
                            handleCopyStrategyCode(trade.strategyCode).catch(() => {})
                          }}
                          disabled={!String(trade.strategyCode || '').trim()}
                        >
                          نسخ
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
                      <div className="text-[11px] text-app-muted">وصف المعالجة</div>
                      <div className="mt-1 text-sm font-semibold text-white">{tradeDisplayConfig.active_notice}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {latestSettledTrade ? (
        <section className="rounded-2xl border border-amber-500/25 bg-app-card p-3">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{'\u0622\u062e\u0631 \u0635\u0641\u0642\u0629 \u0627\u0633\u062a\u0631\u0627\u062a\u064a\u062c\u064a\u0629 \u0645\u0643\u062a\u0645\u0644\u0629'}</h2>
              <p className="text-xs text-app-muted">{'\u0623\u0635\u0644 \u0627\u0644\u0635\u0641\u0642\u0629 \u0639\u0627\u062f \u0625\u0644\u0649 \u0627\u0644\u0631\u0635\u064a\u062f\u060c \u0648\u0631\u0628\u062d \u0627\u0644\u0635\u0641\u0642\u0629 \u0623\u0635\u0628\u062d \u0645\u062a\u0627\u062d\u064b\u0627 \u0644\u0644\u0633\u062d\u0628 \u0648\u0641\u0642 \u0627\u0644\u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629.'}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
              <div className="text-[11px] text-app-muted">{'\u0627\u0644\u0631\u0645\u0632'}</div>
              <div className="mt-1 text-sm font-semibold text-white">{latestSettledTrade.selectedSymbol || '--'}</div>
            </div>
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
              <div className="text-[11px] text-app-muted">{'\u0633\u0639\u0631 \u0627\u0644\u062f\u062e\u0648\u0644'}</div>
              <div className="mt-1 text-sm font-semibold text-white">{Number(latestSettledTrade.entryPrice || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
              <div className="text-[11px] text-app-muted">{'\u0633\u0639\u0631 \u0627\u0644\u0625\u063a\u0644\u0627\u0642'}</div>
              <div className="mt-1 text-sm font-semibold text-white">{Number(latestSettledTrade.exitPrice || 0).toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
              <div className="text-[11px] text-app-muted">{'\u0631\u0628\u062d \u0627\u0644\u0635\u0641\u0642\u0629'}</div>
              <div className="mt-1 text-sm font-semibold text-white">{latestSettledTradeProfit.toFixed(2)} USDT</div>
            </div>
          </div>
        </section>
      ) : null}

      {preview ? (
        <AppModalPortal>
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
                <div className="text-[11px] text-app-muted">الأصول المحتسبة للشراء</div>
                <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.eligibleAssetBase || preview.preview.balanceSnapshot || 0).toFixed(2)} USDT</div>
              </div>
              <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
                <div className="text-[11px] text-app-muted">إجمالي الأصول المحتسبة</div>
                <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.totalAssets || 0).toFixed(2)} USDT</div>
              </div>
              <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
                <div className="text-[11px] text-app-muted">المكتسبات المضمنة</div>
                <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.pendingEarnings || 0).toFixed(2)} USDT</div>
              </div>
              <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
                <div className="text-[11px] text-app-muted">{'\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0645\u0642\u064a\u062f \u0627\u0644\u0645\u062a\u0627\u062d \u0644\u0644\u062a\u0645\u0648\u064a\u0644'}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.lockedExcludedAmount || 0).toFixed(2)} USDT</div>
              </div>
              <div className="rounded-xl border border-app-border bg-app-elevated px-3 py-2">
                <div className="text-[11px] text-app-muted">نسبة الشراء</div>
                <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.purchasePercent || 0).toFixed(0)}%</div>
              </div>
              {preview.preview.stakeAmount ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 sm:col-span-2">
                  <div className="text-[11px] text-amber-100/80">المبلغ الذي سيُخصم بعد موافقتك</div>
                  <div className="mt-1 text-sm font-semibold text-white">{Number(preview.preview.stakeAmount).toFixed(2)} USDT</div>
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
        </AppModalPortal>
      ) : null}
    </div>
  )
}
