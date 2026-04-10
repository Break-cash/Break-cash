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
      live: 'Canl\u0131',
      closed: 'Kilitli',
      startPrice: 'Ba\u015flang\u0131\u00e7 fiyat\u0131',
      liveNow: '\u015eu an canl\u0131',
      startingSoon: 'Yak\u0131nda ba\u015fl\u0131yor',
      timeRemaining: 'Kalan s\u00fcre',
      participants: 'Kat\u0131l\u0131mc\u0131lar',
      reward: '\u00d6d\u00fcl',
      question: 'Tur bitti\u011finde fiyat ba\u015flang\u0131\u00e7 seviyesinin \u00fcst\u00fcnde mi alt\u0131nda m\u0131 olacak?',
      liveReactions: 'Canl\u0131 tepkiler',
      mvp: 'MVP',
      up: 'Y\u00fckseli\u015f',
      upSub: 'Fiyat y\u00fckselecek',
      down: 'D\u00fc\u015f\u00fc\u015f',
      downSub: 'Fiyat d\u00fc\u015fecek',
      entryCost: 'Giri\u015f maliyeti',
      tickets: 'bilet',
      points: 'puan',
      roundFinanceTitle: 'Tur finans durumu',
      roundLocked: 'Bu tur kilitlendi. Giri\u015f sadece son 5 saniyeye kadar a\u00e7\u0131k kal\u0131r.',
      roundOpen: 'Giri\u015f \u015fimdi a\u00e7\u0131k ve yaln\u0131zca bir bilet kullan\u0131r.',
      roundSubmitted: 'Tahminin kaydedildi ve art\u0131k de\u011fi\u015ftirilemez.',
      buyTicket: 'Bilet sat\u0131n al',
      convertPoints: 'Puanlar\u0131 \u00e7evir',
      openWallet: 'C\u00fczdan\u0131 a\u00e7',
      loading: 'Mevcut tur y\u00fckleniyor...',
      failed: 'Tur verileri y\u00fcklenemedi.',
      noTickets: 'Yeterli biletin yok. \u00d6nce yeni bir bilet al veya kat\u0131l\u0131m puanlar\u0131n\u0131 \u00e7evir.',
      lockedMessage: 'Bu tur i\u00e7in giri\u015f kapand\u0131. Sonraki turu bekle.',
      duplicateMessage: 'Tahminin bu tur i\u00e7in zaten kaydedildi ve de\u011fi\u015ftirilemez.',
      submitFailed: 'Tahmin \u015fu anda kaydedilemedi. K\u0131sa s\u00fcre sonra tekrar dene.',
      quickTicketAdded: 'Arena bakiyene yeni bir bilet eklendi.',
      pointsConverted: 'Kullan\u0131labilir kat\u0131l\u0131m puanlar\u0131 yeni bir bilete \u00e7evrildi.',
      pointsFailed: 'Puanlar \u015fu anda \u00e7evrilemedi.',
    }
  }

  return {
    back: '\u0639\u0648\u062f\u0629',
    title: '\u0627\u0644\u062c\u0648\u0644\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629',
    info: '\u0645\u0639\u0644\u0648\u0645\u0627\u062a',
    live: '\u0645\u0628\u0627\u0634\u0631',
    closed: '\u0645\u063a\u0644\u0642\u0629',
    startPrice: '\u0633\u0639\u0631 \u0627\u0644\u0628\u062f\u0627\u064a\u0629',
    liveNow: '\u062d\u064a \u0627\u0644\u0622\u0646',
    startingSoon: '\u062a\u0628\u062f\u0623 \u0642\u0631\u064a\u0628\u064b\u0627',
    timeRemaining: '\u0627\u0644\u0648\u0642\u062a \u0627\u0644\u0645\u062a\u0628\u0642\u064a',
    participants: '\u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0648\u0646',
    reward: '\u0627\u0644\u0645\u0643\u0627\u0641\u0623\u0629',
    question: '\u0647\u0644 \u0633\u064a\u0643\u0648\u0646 \u0627\u0644\u0633\u0639\u0631 \u0623\u0639\u0644\u0649 \u0623\u0645 \u0623\u0642\u0644 \u0645\u0646 \u0633\u0639\u0631 \u0627\u0644\u0628\u062f\u0627\u064a\u0629 \u0639\u0646\u062f \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u062c\u0648\u0644\u0629\u061f',
    liveReactions: '\u0627\u0644\u062a\u0641\u0627\u0639\u0644 \u0627\u0644\u062d\u064a',
    mvp: 'MVP',
    up: '\u0635\u0627\u0639\u062f',
    upSub: '\u0627\u0644\u0633\u0639\u0631 \u0633\u064a\u0631\u062a\u0641\u0639',
    down: '\u0647\u0627\u0628\u0637',
    downSub: '\u0627\u0644\u0633\u0639\u0631 \u0633\u064a\u0646\u062e\u0641\u0636',
    entryCost: '\u062a\u0643\u0644\u0641\u0629 \u0627\u0644\u062f\u062e\u0648\u0644',
    tickets: '\u062a\u0630\u0627\u0643\u0631',
    points: '\u0646\u0642\u0637\u0629',
    roundFinanceTitle: '\u0627\u0644\u062d\u0627\u0644\u0629 \u0627\u0644\u0645\u0627\u0644\u064a\u0629 \u0644\u0644\u062c\u0648\u0644\u0629',
    roundLocked: '\u062a\u0645 \u0642\u0641\u0644 \u0647\u0630\u0647 \u0627\u0644\u062c\u0648\u0644\u0629. \u064a\u0628\u0642\u0649 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u062a\u0627\u062d\u064b\u0627 \u0641\u0642\u0637 \u062d\u062a\u0649 \u0622\u062e\u0631 5 \u062b\u0648\u0627\u0646\u064d.',
    roundOpen: '\u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0641\u062a\u0648\u062d \u0627\u0644\u0622\u0646 \u0628\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u062a\u0630\u0643\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u0641\u0642\u0637.',
    roundSubmitted: '\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u062a\u0648\u0642\u0639\u0643 \u0628\u0627\u0644\u0641\u0639\u0644 \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644\u0647.',
    buyTicket: '\u0634\u0631\u0627\u0621 \u062a\u0630\u0643\u0631\u0629',
    convertPoints: '\u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0646\u0642\u0627\u0637',
    openWallet: '\u0641\u062a\u062d \u0627\u0644\u0645\u062d\u0641\u0638\u0629',
    loading: '\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u062c\u0648\u0644\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629...',
    failed: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062c\u0648\u0644\u0629.',
    noTickets: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0644\u062f\u064a\u0643 \u062a\u0630\u0627\u0643\u0631 \u0643\u0627\u0641\u064a\u0629. \u0627\u0634\u062a\u0631\u0650 \u062a\u0630\u0643\u0631\u0629 \u062c\u062f\u064a\u062f\u0629 \u0623\u0648 \u062d\u0648\u0651\u0644 \u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0623\u0648\u0644\u064b\u0627.',
    lockedMessage: '\u062a\u0645 \u0625\u063a\u0644\u0627\u0642 \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u062f\u062e\u0648\u0644 \u0644\u0647\u0630\u0647 \u0627\u0644\u062c\u0648\u0644\u0629. \u0627\u0646\u062a\u0638\u0631 \u0627\u0644\u062c\u0648\u0644\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629.',
    duplicateMessage: '\u0644\u0642\u062f \u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u062a\u0648\u0642\u0639\u0643 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u062c\u0648\u0644\u0629 \u0628\u0627\u0644\u0641\u0639\u0644 \u0648\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u063a\u064a\u064a\u0631\u0647.',
    submitFailed: '\u062a\u0639\u0630\u0631 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062a\u0648\u0642\u0639 \u0627\u0644\u0622\u0646. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649 \u0628\u0639\u062f \u0644\u062d\u0638\u0627\u062a.',
    quickTicketAdded: '\u062a\u0645\u062a \u0625\u0636\u0627\u0641\u0629 \u062a\u0630\u0643\u0631\u0629 \u062c\u062f\u064a\u062f\u0629 \u0625\u0644\u0649 \u0631\u0635\u064a\u062f\u0643 \u0641\u064a \u0627\u0644\u0633\u0627\u062d\u0629.',
    pointsConverted: '\u062a\u0645 \u062a\u062d\u0648\u064a\u0644 \u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0627\u0644\u0645\u062a\u0627\u062d\u0629 \u0625\u0644\u0649 \u062a\u0630\u0643\u0631\u0629 \u062c\u062f\u064a\u062f\u0629.',
    pointsFailed: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u0622\u0646.',
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
