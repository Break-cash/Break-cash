import { ArrowRight, CircleHelp, Ticket, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import '../arena/arena.css'
import { useArenaRound } from '../arena/hooks'
import { type Language, useI18n } from '../i18nCore'
import type { PredictionDirection } from '../arena/types'

function formatSeconds(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function buildPolyline(points: number[], width: number, height: number) {
  if (points.length === 0) return ''
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width
      const y = height - ((point - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')
}

function buildChartPoints(startPrice: number, currentPrice: number) {
  const midpoint = (startPrice + currentPrice) / 2
  const quarter = startPrice + (currentPrice - startPrice) * 0.25
  return [
    startPrice,
    quarter,
    midpoint - (currentPrice - startPrice) * 0.08,
    midpoint,
    midpoint + (currentPrice - startPrice) * 0.11,
    currentPrice,
  ]
}

function getArenaRoundCopy(language: Language) {
  if (language === 'en') {
    return {
      back: 'Back',
      title: 'Current Round',
      info: 'Info',
      live: 'Live',
      closed: 'Locked',
      startPrice: 'Start price',
      liveNow: 'Live now',
      startingSoon: 'Starting soon',
      timeRemaining: 'Time remaining',
      participants: 'Participants',
      reward: 'Reward',
      question: 'Will the price finish above or below the start price when the round ends?',
      liveReactions: 'Live reactions',
      mvp: 'MVP',
      up: 'Up',
      upSub: 'Price will rise',
      down: 'Down',
      downSub: 'Price will fall',
      entryCost: 'Entry cost',
      tickets: 'tickets',
      points: 'points',
      roundFinanceTitle: 'Round financial status',
      roundLocked: 'This round is locked. Entry stays open only until the final 5 seconds.',
      roundOpen: 'Entry is open now using one ticket only.',
      roundSubmitted: 'Your prediction has already been submitted and cannot be edited.',
      buyTicket: 'Buy ticket',
      convertPoints: 'Convert points',
      openWallet: 'Open wallet',
      loading: 'Loading the current round...',
      failed: 'Unable to load round data.',
      noTickets: 'You do not have enough tickets. Buy a new ticket or convert participation points first.',
      lockedMessage: 'Entry is locked for this round. Wait for the next round.',
      duplicateMessage: 'Your prediction is already recorded for this round and cannot be changed.',
      submitFailed: 'Unable to submit the prediction right now. Try again shortly.',
      quickTicketAdded: 'A new ticket was added to your arena balance.',
      pointsConverted: 'Available participation points were converted into a new ticket.',
      pointsFailed: 'Unable to convert points right now.',
    }
  }

  if (language === 'tr') {
    return {
      back: 'Geri',
      title: 'Mevcut Tur',
      info: 'Bilgi',
      live: 'Canlı',
      closed: 'Kilitli',
      startPrice: 'Başlangıç fiyatı',
      liveNow: 'Şu an canlı',
      startingSoon: 'Yakında başlıyor',
      timeRemaining: 'Kalan süre',
      participants: 'Katılımcılar',
      reward: 'Ödül',
      question: 'Tur bittiğinde fiyat başlangıç seviyesinin üstünde mi altında mı olacak?',
      liveReactions: 'Canlı tepkiler',
      mvp: 'MVP',
      up: 'Yükseliş',
      upSub: 'Fiyat yükselecek',
      down: 'Düşüş',
      downSub: 'Fiyat düşecek',
      entryCost: 'Giriş maliyeti',
      tickets: 'bilet',
      points: 'puan',
      roundFinanceTitle: 'Tur finans durumu',
      roundLocked: 'Bu tur kilitlendi. Giriş sadece son 5 saniyeye kadar açık kalır.',
      roundOpen: 'Giriş şimdi açık ve yalnızca bir bilet kullanır.',
      roundSubmitted: 'Tahminin kaydedildi ve artık değiştirilemez.',
      buyTicket: 'Bilet satın al',
      convertPoints: 'Puanları çevir',
      openWallet: 'Cüzdanı aç',
      loading: 'Mevcut tur yükleniyor...',
      failed: 'Tur verileri yüklenemedi.',
      noTickets: 'Yeterli biletin yok. Önce yeni bir bilet al veya katılım puanlarını çevir.',
      lockedMessage: 'Bu tur için giriş kapandı. Sonraki turu bekle.',
      duplicateMessage: 'Tahminin bu tur için zaten kaydedildi ve değiştirilemez.',
      submitFailed: 'Tahmin şu anda kaydedilemedi. Kısa süre sonra tekrar dene.',
      quickTicketAdded: 'Arena bakiyene yeni bir bilet eklendi.',
      pointsConverted: 'Kullanılabilir katılım puanları yeni bir bilete çevrildi.',
      pointsFailed: 'Puanlar şu anda çevrilemedi.',
    }
  }

  return {
    back: 'عودة',
    title: 'الجولة الحالية',
    info: 'معلومات',
    live: 'مباشر',
    closed: 'مغلقة',
    startPrice: 'سعر البداية',
    liveNow: 'حي الآن',
    startingSoon: 'تبدأ قريبًا',
    timeRemaining: 'الوقت المتبقي',
    participants: 'المشاركون',
    reward: 'المكافأة',
    question: 'هل سيكون السعر أعلى أم أقل من سعر البداية عند انتهاء الجولة؟',
    liveReactions: 'التفاعل الحي',
    mvp: 'MVP',
    up: 'صاعد',
    upSub: 'السعر سيرتفع',
    down: 'هابط',
    downSub: 'السعر سينخفض',
    entryCost: 'تكلفة الدخول',
    tickets: 'تذاكر',
    points: 'نقطة',
    roundFinanceTitle: 'الحالة المالية للجولة',
    roundLocked: 'تم قفل هذه الجولة. يبقى الدخول متاحًا فقط حتى آخر 5 ثوانٍ.',
    roundOpen: 'الدخول مفتوح الآن باستخدام تذكرة واحدة فقط.',
    roundSubmitted: 'تم تسجيل توقعك بالفعل ولا يمكن تعديله.',
    buyTicket: 'شراء تذكرة',
    convertPoints: 'تحويل النقاط',
    openWallet: 'فتح المحفظة',
    loading: 'جاري تحميل الجولة الحالية...',
    failed: 'تعذر تحميل بيانات الجولة.',
    noTickets: 'لا توجد لديك تذاكر كافية. اشترِ تذكرة جديدة أو حوّل نقاط المشاركة أولًا.',
    lockedMessage: 'تم إغلاق نافذة الدخول لهذه الجولة. انتظر الجولة التالية.',
    duplicateMessage: 'لقد تم تسجيل توقعك في هذه الجولة بالفعل ولا يمكن تغييره.',
    submitFailed: 'تعذر تسجيل التوقع الآن. حاول مرة أخرى بعد لحظات.',
    quickTicketAdded: 'تمت إضافة تذكرة جديدة إلى رصيدك في الساحة.',
    pointsConverted: 'تم تحويل نقاط المشاركة المتاحة إلى تذكرة جديدة.',
    pointsFailed: 'تعذر تحويل النقاط الآن.',
  }
}

export function ArenaRoundPage() {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const { language } = useI18n()
  const copy = getArenaRoundCopy(language)
  const {
    round,
    walletSummary,
    entryBalance,
    existingEntry,
    secondsRemaining,
    submit,
    submitState,
    loading,
    error,
    buyTickets,
    convertPoints,
    financeRoutes,
    ticketPackages,
  } = useArenaRound(roundId)
  const [message, setMessage] = useState('')

  const chartPoints = useMemo(
    () => buildChartPoints(round?.startPrice || 0, round?.currentPrice || 0),
    [round?.currentPrice, round?.startPrice],
  )
  const chartPolyline = useMemo(() => buildPolyline(chartPoints, 334, 180), [chartPoints])
  const chartFill = useMemo(() => (chartPolyline ? `0,180 ${chartPolyline} 334,180` : ''), [chartPolyline])

  async function handlePredict(direction: PredictionDirection) {
    if (!round) return
    setMessage('')
    try {
      await submit(direction)
      navigate(`/arena/result/${round.id}`)
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : ''
      if (code === 'ARENA_NO_TICKETS') return setMessage(copy.noTickets)
      if (code === 'ARENA_ROUND_LOCKED') return setMessage(copy.lockedMessage)
      if (code === 'ARENA_DUPLICATE_ENTRY') return setMessage(copy.duplicateMessage)
      setMessage(copy.submitFailed)
    }
  }

  async function handleBuyQuickTicket() {
    try {
      await buyTickets(ticketPackages[0]?.id || 'arena-ticket-1')
      setMessage(copy.quickTicketAdded)
    } catch {
      navigate(financeRoutes.deposit)
    }
  }

  async function handleConvertPoints() {
    try {
      await convertPoints()
      setMessage(copy.pointsConverted)
    } catch {
      setMessage(copy.pointsFailed)
    }
  }

  if (loading) {
    return (
      <div className="page arena-page app-secondary-page">
        <div className="arena-page__frame">
          <div className="arena-card arena-empty">{copy.loading}</div>
        </div>
      </div>
    )
  }

  if (error || !round || !entryBalance || !walletSummary) {
    return (
      <div className="page arena-page app-secondary-page">
        <div className="arena-page__frame">
          <div className="arena-card arena-error">{copy.failed}</div>
        </div>
      </div>
    )
  }

  const isLocked = round.status === 'LOCKED' || round.status === 'SETTLING' || round.status === 'SETTLED'
  const canPredict = round.status === 'OPEN' && !existingEntry && entryBalance.ticketBalance > 0

  return (
    <div className="page arena-page app-secondary-page">
      <div className="arena-page__frame">
        <div className="arena-screen__header">
          <button type="button" className="arena-screen__icon-btn" onClick={() => navigate('/arena')} aria-label={copy.back}>
            <ArrowRight size={18} />
          </button>
          <h1>{copy.title}</h1>
          <span className="arena-badge arena-badge--live">{round.status === 'OPEN' ? copy.live : copy.closed}</span>
          <button type="button" className="arena-screen__icon-btn arena-screen__icon-btn--sm" aria-label={copy.info}>
            <CircleHelp size={16} />
          </button>
        </div>

        <section className="arena-card arena-summary-card">
          <span className={`arena-asset-icon arena-asset-icon--${round.asset.iconTone}`} style={{ width: 42, height: 42, borderRadius: 14 }}>
            {round.asset.iconText}
          </span>
          <div className="arena-asset-copy">
            <strong>{round.asset.pair}</strong>
            <span>{copy.startPrice} {round.startPrice.toFixed(round.asset.pricePrecision)}</span>
          </div>
          <div className="arena-price">
            <strong>{round.currentPrice.toFixed(round.asset.pricePrecision)}</strong>
            <span>{round.status === 'UPCOMING' ? copy.startingSoon : copy.liveNow}</span>
          </div>
        </section>

        <section className="arena-card arena-info-strip">
          <div className="arena-info-strip__item">
            <span>{copy.timeRemaining}</span>
            <strong>{formatSeconds(secondsRemaining)}</strong>
          </div>
          <div className="arena-info-strip__item">
            <span>{copy.participants}</span>
            <strong>{round.participantsCount}</strong>
          </div>
          <div className="arena-info-strip__item">
            <span>{copy.reward}</span>
            <strong>{round.rewardPreviewMin} - {round.rewardPreviewMax}</strong>
          </div>
        </section>

        <div className="arena-question">{copy.question}</div>

        <section className="arena-card arena-chart-card">
          <svg viewBox="0 0 334 216" role="img" aria-label={copy.title}>
            <defs>
              <linearGradient id="arenaChartFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(57, 208, 255, 0.28)" />
                <stop offset="100%" stopColor="rgba(57, 208, 255, 0.02)" />
              </linearGradient>
            </defs>
            <g className="arena-chart-grid">
              <line x1="0" y1="36" x2="334" y2="36" />
              <line x1="0" y1="90" x2="334" y2="90" />
              <line x1="0" y1="144" x2="334" y2="144" />
            </g>
            <line className="arena-chart-reference" x1="0" y1="112" x2="334" y2="112" />
            {chartFill ? <polygon className="arena-chart-fill" points={chartFill} /> : null}
            {chartPolyline ? <polyline className="arena-chart-line" points={chartPolyline} /> : null}
          </svg>
        </section>

        <section className="arena-card arena-sentiment">
          <div className="arena-section__head">
            <h2>{copy.liveReactions}</h2>
            <span className="arena-muted-meta">{copy.mvp}</span>
          </div>
          <div className="arena-reactions-row">
            {Object.entries(round.reactions).map(([emoji, value]) => (
              <div key={emoji} className="arena-reaction-pill">
                <span>{emoji}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="arena-prediction-buttons">
          <button
            type="button"
            className="arena-prediction-btn arena-prediction-btn--up"
            onClick={() => handlePredict('UP')}
            disabled={!canPredict || submitState === 'submitting'}
          >
            <span className="arena-prediction-btn__icon">↑</span>
            <div>
              <strong>{copy.up}</strong>
              <span>{copy.upSub}</span>
            </div>
          </button>
          <button
            type="button"
            className="arena-prediction-btn arena-prediction-btn--down"
            onClick={() => handlePredict('DOWN')}
            disabled={!canPredict || submitState === 'submitting'}
          >
            <span className="arena-prediction-btn__icon">↓</span>
            <div>
              <strong>{copy.down}</strong>
              <span>{copy.downSub}</span>
            </div>
          </button>
        </div>

        <div className="arena-inline-note">
          {copy.entryCost}: 1 {copy.tickets}. {entryBalance.ticketBalance} {copy.tickets} / {entryBalance.participationPoints} {copy.points}
        </div>

        <section className="arena-card arena-wallet-card">
          <div className="arena-wallet-card__row">
            <div>
              <strong>{copy.roundFinanceTitle}</strong>
              <span className="arena-caption">
                {existingEntry ? copy.roundSubmitted : isLocked ? copy.roundLocked : copy.roundOpen}
              </span>
            </div>
            <div className="arena-wallet-card__stats">
              <span><Ticket size={14} /> {entryBalance.ticketBalance}</span>
              <span><Wallet size={14} /> {walletSummary.vipLabel}</span>
            </div>
          </div>

          <div className="arena-wallet-card__actions">
            <button type="button" className="arena-ghost-btn" onClick={handleBuyQuickTicket}>
              {copy.buyTicket}
            </button>
            <button type="button" className="arena-ghost-btn" onClick={handleConvertPoints} disabled={!entryBalance.canConvertPoints}>
              {copy.convertPoints}
            </button>
            <button type="button" className="arena-ghost-btn" onClick={() => navigate(financeRoutes.wallet)}>
              {copy.openWallet}
            </button>
          </div>
        </section>

        {message ? <div className="arena-card arena-error">{message}</div> : null}
      </div>
    </div>
  )
}
