import { useEffect, useMemo, useState } from 'react'
import {
  apiFetch,
  getMyStrategyCodes,
  getPushPublicKey,
  getPushSubscriptionStatus,
  getStrategyTradeDisplayConfig,
  redeemStrategyCode,
  removePushSubscription,
  savePushSubscription,
  sendPushTest,
  settleStrategyTrade,
  type StrategyCodeItem,
  type StrategyTradeDisplayConfig,
} from '../api'
import { playFeedbackSound } from '../appFeedback'
import { LiveCandlesChart } from '../components/market/LiveCandlesChart'
import { useMarketBoard } from '../hooks/useMarketBoard'
import { useI18n } from '../i18nCore'

type Candle = { time: number; open: number; high: number; low: number; close: number }
type StrategyTradeUsage = NonNullable<StrategyCodeItem['usage']>
type StrategyTradeView = StrategyTradeUsage & {
  codeId: number
  title: string
  description: string
  assetSymbol: string
  expertNameLabel: string
}

const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'] as const

function formatClock(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function isStrategyCodeExpired(expiresAt?: string | null) {
  const raw = String(expiresAt || '').trim()
  if (!raw) return false
  const parsed = Date.parse(raw)
  return !Number.isNaN(parsed) && parsed < Date.now()
}

function formatMoney(value: number, digits = 0) {
  return `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}$`
}

function formatSignedMoney(value: number, digits = 0) {
  const amount = Number(value || 0)
  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${prefix}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}$`
}

function formatSignedPercent(value: number, digits = 2) {
  const amount = Number(value || 0)
  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : ''
  return `${prefix}${Math.abs(amount).toFixed(digits)}%`
}

function formatCountdown(value?: string | null) {
  if (!value) return null
  const target = Date.parse(value)
  if (Number.isNaN(target)) return null
  const remainingMs = target - Date.now()
  if (remainingMs <= 0) return '00:00:00'
  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function getRiskLabel(purchasePercent?: number) {
  const value = Number(purchasePercent || 0)
  if (value >= 70) return 'مرتفع'
  if (value >= 40) return 'متوسط'
  return 'منخفض'
}

function toTradeView(item: StrategyCodeItem): StrategyTradeView | null {
  if (!item.usage) return null
  return {
    ...item.usage,
    codeId: item.id,
    title: String(item.title || 'صفقة استراتيجية').trim() || 'صفقة استراتيجية',
    description: String(item.description || '').trim(),
    assetSymbol: String(item.assetSymbol || item.usage.selectedSymbol || 'BTCUSDT').trim().toUpperCase(),
    expertNameLabel: String(item.expertName || item.usage.expertName || 'المشرف أو المالك').trim() || 'المشرف أو المالك',
  }
}

function TradeMetric({ label, value, hint, tone = 'text-white' }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-card px-3 py-2">
      <div className="text-[11px] text-app-muted">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${tone}`}>{value}</div>
      {hint ? <div className="mt-1 text-[10px] text-app-muted">{hint}</div> : null}
    </div>
  )
}

export function FuturesPage() {
  const { t } = useI18n()
  const { quotes, loading: quotesLoading, usingFallback } = useMarketBoard(3000)
  const [selected, setSelected] = useState('BTCUSDT')
  const [selectedInterval, setSelectedInterval] = useState<(typeof intervals)[number]>('5m')
  const [candles, setCandles] = useState<Candle[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [codes, setCodes] = useState<StrategyCodeItem[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushPermission, setPushPermission] = useState<'default' | 'denied' | 'granted'>('default')
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [tradeDisplayConfig, setTradeDisplayConfig] = useState<StrategyTradeDisplayConfig>({
    preview_notice: 'سيتم فتح الصفقة الاستراتيجية بعد التأكيد وفق آلية المعالجة الداخلية للنظام.',
    active_notice: 'يتم تحديث الأرقام المعروضة حسب بيانات الصفقة المنشورة وسعر السوق الحالي.',
    settled_notice: 'تمت تسوية الصفقة الاستراتيجية واعتماد نتيجة الإغلاق النهائية.',
  })

  const current = useMemo(() => quotes.find((item) => item.symbol === selected) || quotes[0], [quotes, selected])
  const quoteMap = useMemo(() => new Map(quotes.map((item) => [String(item.symbol || '').toUpperCase(), item])), [quotes])
  const activeTrades = useMemo(() => codes.map((item) => toTradeView(item)).filter((item): item is StrategyTradeView => Boolean(item)).filter((item) => item.status === 'trade_active'), [codes])
  const publishedStrategyTrades = useMemo(() => codes.filter((item) => item.featureType === 'trial_trade' && item.isActive && !item.alreadyUsed && !isStrategyCodeExpired(item.expiresAt)), [codes])
  const latestSettledTrade = useMemo(() => codes.map((item) => toTradeView(item)).filter((item): item is StrategyTradeView => Boolean(item)).filter((item) => item.status === 'trade_settled').sort((a, b) => (Date.parse(b.settledAt || '') || 0) - (Date.parse(a.settledAt || '') || 0))[0] || null, [codes])

  useEffect(() => {
    if (quotes.length > 0 && !quotes.find((item) => item.symbol === selected)) setSelected(quotes[0].symbol)
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
      const res = (await apiFetch(`/api/market/candles?symbol=${encodeURIComponent(selected)}&interval=${selectedInterval}&limit=120`)) as { candles: Candle[] }
      if (active) setCandles(Array.isArray(res.candles) ? res.candles : [])
    }
    loadCandles().catch(() => setCandles([]))
    const id = window.setInterval(() => loadCandles().catch(() => {}), 5000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [selected, selectedInterval])

  useEffect(() => {
    getStrategyTradeDisplayConfig().then((res) => setTradeDisplayConfig(res.config)).catch(() => {})
  }, [])

  useEffect(() => {
    const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
    setPushSupported(supported)
    if (!supported) return
    setPushPermission(Notification.permission)
    getPushSubscriptionStatus().then((res) => setPushSubscribed(Boolean(res.subscribed))).catch(() => setPushSubscribed(false))
  }, [])

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const rawData = window.atob(`${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(rawData, (character) => character.charCodeAt(0))
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

  async function executeStrategyRedeem(code: string) {
    const normalizedCode = code.trim()
    if (!normalizedCode) {
      setMessage({ type: 'error', text: 'أدخل كود الاستراتيجية أولًا.' })
      return
    }
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await redeemStrategyCode({ code: normalizedCode, symbol: selected, confirmed: true })
      await refreshCodes()
      playFeedbackSound(res.featureType === 'trial_trade' ? 'strategicApproval' : 'strategyCode').catch(() => {})
      setMessage({
        type: 'success',
        text: res.featureType === 'trial_trade' ? `تم اعتماد الصفقة الاستراتيجية بنجاح. ${tradeDisplayConfig.active_notice}` : 'تم تفعيل المكافأة الترويجية بنجاح.',
      })
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
      await settleStrategyTrade(usageId)
      await refreshCodes()
      setMessage({ type: 'success', text: tradeDisplayConfig.settled_notice })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر إغلاق الصفقة الاستراتيجية.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page futures-page ku-mobile-page space-y-3">
      <h1 className="page-title">لوحة الصفقة الاستراتيجية</h1>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-white">الأصل المحدد</div>
            <div className="text-xs text-app-muted">{usingFallback ? 'Fallback واضح' : 'سعر حي أو شبه حي'} • {selected}</div>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${Number(current?.change24h || 0) >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
            {Number(current?.change24h || 0) >= 0 ? '+' : ''}{Number(current?.change24h || 0).toFixed(2)}%
          </div>
        </div>
        <div className="futures-chart rounded-xl border border-app-border bg-app-elevated p-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-app-muted">{selected}</span>
            <div className="elite-scroll-row">
              {intervals.map((interval) => (
                <button key={interval} type="button" className={selectedInterval === interval ? 'market-itv-btn active elite-chip' : 'market-itv-btn elite-chip'} onClick={() => setSelectedInterval(interval)}>
                  {interval}
                </button>
              ))}
            </div>
          </div>
          <LiveCandlesChart candles={candles} />
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
            <button key={item.symbol} type="button" onClick={() => setSelected(item.symbol)} className={`table-row w-full text-start ${selected === item.symbol ? 'market-row-active' : ''}`}>
              <span className="inline-flex items-center gap-1.5"><span className="text-xs font-semibold text-white">{item.symbol}</span><span className="text-[10px] text-app-muted">Live</span></span>
              <span>{Number(item.price).toLocaleString()}</span>
              <span className={item.change24h >= 0 ? 'text-positive' : 'text-negative'}>{item.change24h >= 0 ? '+' : ''}{Number(item.change24h).toFixed(2)}%</span>
            </button>
          ))
        )}
      </section>

      <section className="rounded-2xl border border-app-border bg-app-card p-3">
        <div className="rounded-2xl border border-brand-blue/15 bg-app-elevated p-3">
          <div className="text-sm font-semibold text-white">الإشعارات الخارجية للصفقات</div>
          <p className="mt-1 text-xs text-app-muted">فعّلها من هنا ليصلك إشعار فعلي عند اقتراب الإغلاق أو اكتمال نتيجة الصفقة.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pushSupported ? (
              <>
                <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => { if (pushSubscribed) disablePushNotifications().catch(() => {}) ; else enablePushNotifications(true).catch(() => {}) }} disabled={pushBusy}>
                  {pushBusy ? '...' : pushSubscribed ? 'إيقاف الإشعارات الخارجية' : 'تفعيل الإشعارات الخارجية'}
                </button>
                <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={() => { sendPushPreview().catch(() => {}) }} disabled={pushBusy || (!pushSubscribed && pushPermission === 'denied')}>
                  {pushBusy ? '...' : 'إرسال إشعار تجريبي'}
                </button>
              </>
            ) : <div className="text-xs text-app-muted">هذا المتصفح أو الجهاز لا يدعم Web Push.</div>}
          </div>
        </div>

        {publishedStrategyTrades.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {publishedStrategyTrades.map((item) => (
              <div key={item.id} className="rounded-2xl border border-amber-500/20 bg-app-elevated p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-white">{item.title || 'صفقة استراتيجية'}</div>
                    <div className="text-xs text-app-muted">{item.description || tradeDisplayConfig.preview_notice}</div>
                  </div>
                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-200">منشورة وجاهزة للاعتماد</span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <TradeMetric label="الأصل" value={item.assetSymbol} />
                  <TradeMetric label="العائد الأساسي" value={`${Number(item.tradeReturnPercent || 0).toFixed(2)}%`} />
                  <TradeMetric label="مستوى المخاطرة" value={getRiskLabel(item.purchasePercent)} />
                  <TradeMetric label="الخبير المعتمد" value={item.expertName || 'المشرف أو المالك'} />
                </div>
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                  <div className="text-[11px] text-amber-100/80">اعتماد الصفقة</div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <div className="field-input flex-1 text-sm text-white/85">اضغط على الزر لاعتماد الصفقة المنشورة وفتحها مباشرة من نفس البطاقة.</div>
                    <button type="button" className="wallet-action-btn wallet-action-deposit whitespace-nowrap" onClick={() => { executeStrategyRedeem(item.code).catch(() => {}) }} disabled={submitting}>
                      {submitting ? '...' : 'اعتماد الصفقة الآن'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {message ? <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${message.type === 'success' ? 'owner-message-success' : 'owner-message-error'}`}>{message.text}</div> : null}
      </section>

      {activeTrades.length > 0 ? (
        <section className="rounded-2xl border border-brand-blue/25 bg-app-card p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">الصفقات الاستراتيجية النشطة</h2>
              <p className="text-xs text-app-muted">{tradeDisplayConfig.active_notice}</p>
            </div>
            <div className="rounded-full border border-brand-blue/20 bg-app-elevated px-3 py-1 text-[11px] font-semibold text-white">
              {activeTrades.length === 1 ? 'صفقة نشطة واحدة' : `${activeTrades.length} صفقات نشطة`}
            </div>
          </div>
          <div className="space-y-3">
            {activeTrades.map((trade) => {
              const liveQuote = quoteMap.get(String(trade.selectedSymbol || trade.assetSymbol || '').toUpperCase())
              const entryPrice = Number(trade.entryPrice || 0)
              const currentPrice = Number(liveQuote?.price || entryPrice || 0)
              const livePnl = entryPrice > 0 ? currentPrice - entryPrice : 0
              const livePerformance = entryPrice > 0 ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0
              const baseReturn = Number(trade.rewardValue || trade.stakeAmount || 0) * (Number(trade.tradeReturnPercent || 0) / 100)
              const liveDelta = entryPrice > 0 ? Number(trade.rewardValue || trade.stakeAmount || 0) * ((currentPrice - entryPrice) / entryPrice) : 0
              const currentExpectedReturn = baseReturn + liveDelta
              const countdown = formatCountdown(trade.autoSettleAt)
              const readyToClose = !trade.autoSettleAt || (Date.parse(trade.autoSettleAt) || 0) <= Date.now()
              return (
                <div key={trade.id} className="rounded-2xl border border-brand-blue/20 bg-app-elevated p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{trade.title}</div>
                      <div className="mt-1 text-sm text-app-muted">{readyToClose ? 'نشطة • جاهزة للإغلاق' : 'نشطة • بانتظار موعد الإغلاق'}</div>
                      {countdown ? <div className="mt-1 text-sm text-amber-200">ينتهي خلال {countdown}</div> : null}
                    </div>
                    <button type="button" className="wallet-action-btn owner-set-btn" onClick={() => { handleSettleTrade(trade.id).catch(() => {}) }} disabled={submitting || !readyToClose}>
                      {submitting ? '...' : readyToClose ? 'إغلاق الصفقة الآن' : 'بانتظار موعد الإغلاق'}
                    </button>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <TradeMetric label="قيمة الدخول" value={formatMoney(entryPrice)} />
                    <TradeMetric label="القيمة الحالية" value={formatMoney(currentPrice)} />
                    <TradeMetric label="الربح/الخسارة" value={formatSignedMoney(livePnl)} tone={livePnl >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
                    <TradeMetric label="الأداء" value={formatSignedPercent(livePerformance)} tone={livePerformance >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
                    <TradeMetric label="العائد المتوقع" value={formatMoney(currentExpectedReturn)} hint="Current Expected Return = Base Return + Live Delta" />
                    <TradeMetric label="مستوى المخاطرة" value={getRiskLabel(trade.purchasePercent)} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="wallet-action-btn owner-set-btn whitespace-nowrap">عرض التفاصيل</button>
                    <button type="button" className="wallet-action-btn wallet-action-deposit whitespace-nowrap" onClick={() => { enablePushNotifications(true).catch(() => {}) }} disabled={pushBusy}>
                      {pushBusy ? '...' : 'تنبيه قبل الإغلاق'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {latestSettledTrade ? (
        <section className="rounded-2xl border border-amber-500/25 bg-app-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{latestSettledTrade.title}</h2>
              <p className="mt-1 text-sm text-app-muted">أغلقت • ربح محقق</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <TradeMetric label="قيمة الدخول" value={formatMoney(Number(latestSettledTrade.entryPrice || 0))} />
            <TradeMetric label="قيمة الإغلاق" value={formatMoney(Number(latestSettledTrade.exitPrice || 0))} />
            <TradeMetric label="الربح النهائي" value={formatSignedMoney(Number(latestSettledTrade.exitPrice || 0) - Number(latestSettledTrade.entryPrice || 0))} tone={Number(latestSettledTrade.exitPrice || 0) >= Number(latestSettledTrade.entryPrice || 0) ? 'text-emerald-300' : 'text-rose-300'} />
            <TradeMetric label="الأداء النهائي" value={formatSignedPercent(Number(latestSettledTrade.entryPrice || 0) > 0 ? ((Number(latestSettledTrade.exitPrice || 0) - Number(latestSettledTrade.entryPrice || 0)) / Number(latestSettledTrade.entryPrice || 1)) * 100 : Number(latestSettledTrade.tradeReturnPercent || 0))} tone={Number(latestSettledTrade.exitPrice || 0) >= Number(latestSettledTrade.entryPrice || 0) ? 'text-emerald-300' : 'text-rose-300'} />
            <TradeMetric label="العائد النهائي" value={formatMoney(Number(latestSettledTrade.exitPrice || 0) - Number(latestSettledTrade.entryPrice || 0))} hint="Final Payout = locked close result based on closing conditions" />
            <TradeMetric label="وقت الإغلاق" value={formatClock(latestSettledTrade.settledAt)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="wallet-action-btn owner-set-btn whitespace-nowrap">عرض النتيجة</button>
            <button type="button" className="wallet-action-btn wallet-action-deposit whitespace-nowrap">عرض السجل</button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
