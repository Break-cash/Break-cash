import { Bell, Crown, Ticket, Trophy } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import '../arena/arena.css'
import { useArenaHomeData } from '../arena/hooks'
import { type Language, useI18n } from '../i18nCore'

function formatSeconds(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getRemainingSeconds(startsAt: string, endsAt: string) {
  const now = Date.now()
  const starts = Date.parse(startsAt)
  const ends = Date.parse(endsAt)
  if (!Number.isNaN(starts) && now < starts) return Math.max(0, Math.floor((starts - now) / 1000))
  if (!Number.isNaN(ends)) return Math.max(0, Math.floor((ends - now) / 1000))
  return 0
}

function buildMiniChart(startPrice: number, currentPrice: number) {
  const midpoint = (startPrice + currentPrice) / 2
  return [startPrice, startPrice * 0.998, midpoint, midpoint * 0.999, currentPrice * 0.997, currentPrice]
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

function getArenaHomeCopy(language: Language) {
  if (language === 'en') {
    return {
      loading: 'Preparing Prediction Arena...',
      failed: 'Unable to load Prediction Arena right now.',
      title: 'Prediction Arena',
      subtitle: 'Predict the direction. Win rewards.',
      live: 'Live',
      currentRound: 'Current round',
      participant: 'participant',
      currentPrice: 'Current price',
      roundEndsIn: 'Round ends in',
      roundReward: 'Round reward',
      question: 'Will the price finish above or below the start price when the round ends?',
      down: 'Down',
      downSub: 'Price will fall',
      up: 'Up',
      upSub: 'Price will rise',
      chooseNow: 'Choose your prediction now',
      activeRounds: 'Active rounds',
      viewAll: 'View all',
      leadersToday: 'Top today',
      winStreak: 'Win streak',
      bonusPoints: '+30% bonus points',
      quickEntry: 'Quick entry',
      roundsToday: 'rounds available today',
      buyTickets: 'Buy tickets to enter now',
      notifications: 'Notifications',
    }
  }

  if (language === 'tr') {
    return {
      loading: 'Tahmin Arenas\u0131 haz\u0131rlan\u0131yor...',
      failed: 'Tahmin Arenas\u0131 \u015fu anda y\u00fcklenemedi.',
      title: 'Tahmin Arenas\u0131',
      subtitle: 'Y\u00f6n\u00fc tahmin et. \u00d6d\u00fcl kazan.',
      live: 'Canl\u0131',
      currentRound: 'Mevcut tur',
      participant: 'kat\u0131l\u0131mc\u0131',
      currentPrice: 'G\u00fcncel fiyat',
      roundEndsIn: 'Tur biti\u015fi',
      roundReward: 'Tur \u00f6d\u00fcl\u00fc',
      question: 'Tur bitti\u011finde fiyat ba\u015flang\u0131\u00e7 seviyesinin \u00fcst\u00fcnde mi alt\u0131nda m\u0131 olacak?',
      down: 'D\u00fc\u015f\u00fc\u015f',
      downSub: 'Fiyat d\u00fc\u015fecek',
      up: 'Y\u00fckseli\u015f',
      upSub: 'Fiyat y\u00fckselecek',
      chooseNow: 'Tahminini \u015fimdi se\u00e7',
      activeRounds: 'Aktif turlar',
      viewAll: 'T\u00fcm\u00fcn\u00fc g\u00f6r',
      leadersToday: 'Bug\u00fcn\u00fcn liderleri',
      winStreak: 'Kazanma serisi',
      bonusPoints: '+%30 ek puan',
      quickEntry: 'H\u0131zl\u0131 giri\u015f',
      roundsToday: 'bug\u00fcn kullan\u0131labilir tur',
      buyTickets: '\u015eimdi girmek i\u00e7in bilet sat\u0131n al',
      notifications: 'Bildirimler',
    }
  }

  return {
    loading: '\u062c\u0627\u0631\u064a \u062a\u062c\u0647\u064a\u0632 \u0633\u0627\u062d\u0629 \u0627\u0644\u062a\u0648\u0642\u0639\u0627\u062a...',
    failed: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0633\u0627\u062d\u0629 \u0627\u0644\u062a\u0648\u0642\u0639\u0627\u062a \u0627\u0644\u0622\u0646.',
    title: '\u0633\u0627\u062d\u0629 \u0627\u0644\u062a\u0648\u0642\u0639\u0627\u062a',
    subtitle: '\u062a\u0648\u0642\u0639 \u0627\u0644\u0627\u062a\u062c\u0627\u0647. \u0627\u0631\u0628\u062d \u0627\u0644\u062c\u0648\u0627\u0626\u0632',
    live: '\u0645\u0628\u0627\u0634\u0631',
    currentRound: '\u0627\u0644\u062c\u0648\u0644\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629',
    participant: '\u0645\u0634\u0627\u0631\u0643',
    currentPrice: '\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0622\u0646',
    roundEndsIn: '\u062a\u0646\u062a\u0647\u064a \u0627\u0644\u062c\u0648\u0644\u0629 \u062e\u0644\u0627\u0644',
    roundReward: '\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u062c\u0648\u0644\u0629',
    question: '\u0647\u0644 \u0633\u064a\u0643\u0648\u0646 \u0627\u0644\u0633\u0639\u0631 \u0623\u0639\u0644\u0649 \u0623\u0645 \u0623\u0642\u0644 \u0645\u0646 \u0633\u0639\u0631 \u0627\u0644\u0628\u062f\u0627\u064a\u0629 \u0639\u0646\u062f \u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u062c\u0648\u0644\u0629\u061f',
    down: '\u0647\u0627\u0628\u0637',
    downSub: '\u0627\u0644\u0633\u0639\u0631 \u0633\u064a\u0646\u062e\u0641\u0636',
    up: '\u0635\u0627\u0639\u062f',
    upSub: '\u0627\u0644\u0633\u0639\u0631 \u0633\u064a\u0631\u062a\u0641\u0639',
    chooseNow: '\u0627\u062e\u062a\u0631 \u062a\u0648\u0642\u0639\u0643 \u0627\u0644\u0622\u0646',
    activeRounds: '\u0627\u0644\u062c\u0648\u0644\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629',
    viewAll: '\u0639\u0631\u0636 \u0627\u0644\u0643\u0644',
    leadersToday: '\u0627\u0644\u0645\u062a\u0635\u062f\u0631\u0648\u0646 \u0627\u0644\u064a\u0648\u0645',
    winStreak: '\u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0641\u0648\u0632',
    bonusPoints: '+30% \u0646\u0642\u0627\u0637 \u0625\u0636\u0627\u0641\u064a\u0629',
    quickEntry: '\u062f\u062e\u0648\u0644 \u0633\u0631\u064a\u0639',
    roundsToday: '\u062c\u0648\u0644\u0627\u062a \u0645\u062a\u0627\u062d\u0629 \u0627\u0644\u064a\u0648\u0645',
    buyTickets: '\u0627\u0634\u062a\u0631\u0650 \u062a\u0630\u0627\u0643\u0631 \u0644\u0644\u062f\u062e\u0648\u0644 \u0627\u0644\u0622\u0646',
    notifications: '\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a',
  }
}

export function ArenaHomePage() {
  const navigate = useNavigate()
  const { language } = useI18n()
  const copy = getArenaHomeCopy(language)
  const locale = language === 'ar' ? 'ar' : language === 'tr' ? 'tr-TR' : 'en-US'
  const { walletSummary, heroRound, rounds, leaderboard, entryBalance, loading, error } = useArenaHomeData()

  if (loading) {
    return (
      <div className="page arena-page app-secondary-page">
        <div className="arena-page__frame">
          <div className="arena-card arena-empty">{copy.loading}</div>
        </div>
      </div>
    )
  }

  if (error || !walletSummary || !heroRound) {
    return (
      <div className="page arena-page app-secondary-page">
        <div className="arena-page__frame">
          <div className="arena-card arena-error">{copy.failed}</div>
        </div>
      </div>
    )
  }

  const visibleRounds = rounds.slice(0, 3)
  const secondsRemaining = formatSeconds(getRemainingSeconds(heroRound.startsAt, heroRound.endsAt))
  const performance = (((heroRound.currentPrice - heroRound.startPrice) / heroRound.startPrice) * 100).toFixed(2)
  const chartPoints = buildMiniChart(heroRound.startPrice, heroRound.currentPrice)
  const chartPolyline = buildPolyline(chartPoints, 300, 92)
  const chartFill = chartPolyline ? `0,92 ${chartPolyline} 300,92` : ''

  return (
    <div className="page arena-page app-secondary-page arena-page--reference">
      <div className="arena-page__frame">
        <div className="arena-page__topbar arena-page__topbar--reference">
          <div className="arena-page__topbar-left">
            <div className="arena-page__summary arena-page__summary--avatar-only">
              <span className="arena-avatar">{walletSummary.avatarText}</span>
            </div>
            <div className="arena-chip arena-chip--metric">
              <Crown size={15} />
              <span>{walletSummary.participationPoints.toLocaleString(locale)}</span>
            </div>
            <div className="arena-chip arena-chip--metric">
              <Ticket size={15} />
              <span>{walletSummary.ticketBalance}</span>
            </div>
          </div>

          <Link to="/notifications" className="arena-page__icon-btn" aria-label={copy.notifications}>
            <Bell size={18} />
            {walletSummary.notificationCount > 0 ? (
              <span className="arena-page__icon-badge">{walletSummary.notificationCount > 9 ? '9+' : walletSummary.notificationCount}</span>
            ) : null}
          </Link>
        </div>

        <div className="arena-page__title arena-page__title--reference">
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>

        <section className="arena-card arena-reference-hero">
          <div className="arena-reference-hero__header">
            <span className="arena-badge arena-badge--live">{copy.live}</span>
            <strong>{copy.currentRound}</strong>
            <span className="arena-muted-meta">
              {heroRound.participantsCount.toLocaleString(locale)} {copy.participant}
            </span>
          </div>

          <div className="arena-reference-hero__asset">
            <div className="arena-reference-hero__asset-main">
              <span className={`arena-asset-icon arena-asset-icon--${heroRound.asset.iconTone}`}>{heroRound.asset.iconText}</span>
              <div className="arena-asset-copy">
                <strong>{heroRound.asset.pair}</strong>
                <span>{copy.currentPrice}</span>
                <bdi className="arena-reference-hero__price">{heroRound.currentPrice.toFixed(heroRound.asset.pricePrecision)}</bdi>
                <span className={Number(performance) >= 0 ? 'arena-text-up' : 'arena-text-down'}>
                  {Number(performance) >= 0 ? '+' : ''}
                  {performance}%
                </span>
              </div>
            </div>
            <div className="arena-reference-hero__stats">
              <div>
                <span>{copy.roundEndsIn}</span>
                <strong className="arena-reference-hero__countdown">{secondsRemaining}</strong>
              </div>
              <div>
                <span>{copy.roundReward}</span>
                <strong className="arena-reference-hero__reward-value">{heroRound.rewardPreviewMax.toLocaleString(locale)}</strong>
              </div>
            </div>
          </div>

          <div className="arena-reference-chart">
            <svg viewBox="0 0 300 92" role="img" aria-label={copy.currentRound}>
              <defs>
                <linearGradient id="arenaReferenceFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(18, 217, 122, 0.18)" />
                  <stop offset="100%" stopColor="rgba(18, 217, 122, 0.01)" />
                </linearGradient>
              </defs>
              <line className="arena-reference-chart__baseline" x1="0" y1="64" x2="300" y2="64" />
              {chartFill ? <polygon className="arena-reference-chart__fill" points={chartFill} /> : null}
              {chartPolyline ? <polyline className="arena-reference-chart__line" points={chartPolyline} /> : null}
              <text x="300" y="60" textAnchor="end" className="arena-reference-chart__label">
                {heroRound.startPrice.toFixed(heroRound.asset.pricePrecision)}
              </text>
            </svg>
          </div>

          <div className="arena-reference-question">{copy.question}</div>

          <div className="arena-reference-actions">
            <button type="button" className="arena-reference-action arena-reference-action--down" onClick={() => navigate(`/arena/round/${heroRound.id}`)}>
              <span className="arena-reference-action__icon"></span>
              <div>
                <strong>{copy.down}</strong>
                <span>{copy.downSub}</span>
              </div>
            </button>
            <button type="button" className="arena-reference-action arena-reference-action--up" onClick={() => navigate(`/arena/round/${heroRound.id}`)}>
              <span className="arena-reference-action__icon"></span>
              <div>
                <strong>{copy.up}</strong>
                <span>{copy.upSub}</span>
              </div>
            </button>
          </div>

          <div className="arena-reference-hero__footnote">{copy.chooseNow}</div>
        </section>

        <section className="arena-card arena-reference-section">
          <div className="arena-section__head">
            <h2>{copy.activeRounds}</h2>
            <button type="button" className="arena-link-btn" onClick={() => navigate('/arena')}>
              {copy.viewAll}
            </button>
          </div>
          <div className="arena-reference-rounds">
            {visibleRounds.map((round) => {
              const itemPerformance = (((round.currentPrice - round.startPrice) / round.startPrice) * 100).toFixed(2)
              return (
                <button key={round.id} type="button" className="arena-reference-round" onClick={() => navigate(`/arena/round/${round.id}`)}>
                  <div className="arena-reference-round__top">
                    <span className={`arena-asset-icon arena-asset-icon--${round.asset.iconTone}`} style={{ width: 28, height: 28, borderRadius: 10 }}>
                      {round.asset.iconText}
                    </span>
                    <strong>{round.asset.pair}</strong>
                  </div>
                  <span className={Number(itemPerformance) >= 0 ? 'arena-text-up' : 'arena-text-down'}>
                    {Number(itemPerformance) >= 0 ? '+' : ''}
                    {itemPerformance}%
                  </span>
                  <span className="arena-chip--timer">{formatSeconds(getRemainingSeconds(round.startsAt, round.endsAt))}</span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="arena-reference-grid">
          <section className="arena-card arena-reference-sidecard">
            <div className="arena-section__head">
              <h2>{copy.leadersToday}</h2>
            </div>
            <div className="arena-reference-leaderboard">
              {leaderboard.slice(0, 3).map((entry) => (
                <div key={entry.userId} className="arena-reference-leaderboard__row">
                  <span className="arena-rank arena-rank--badge">{entry.rank}</span>
                  <div className="arena-reference-leaderboard__user">
                    <strong>{entry.username}</strong>
                    <span>{entry.score.toLocaleString(locale)}</span>
                  </div>
                  <Trophy size={14} />
                </div>
              ))}
            </div>
          </section>

          <section className="arena-card arena-reference-sidecard arena-reference-sidecard--streak">
            <div className="arena-section__head">
              <h2>{copy.winStreak}</h2>
            </div>
            <div className="arena-reference-streak">
              <div className="arena-reference-streak__flames">    </div>
              <div className="arena-reference-streak__count">4</div>
            </div>
            <div className="arena-reference-streak__bonus">{copy.bonusPoints}</div>
          </section>
        </div>

        <button
          type="button"
          className="arena-primary-btn arena-primary-btn--purple"
          onClick={() => navigate(entryBalance?.ticketBalance ? `/arena/round/${heroRound.id}` : '/deposit')}
        >
          {copy.quickEntry}
          <span className="arena-primary-btn__sub arena-primary-btn__sub--light">
            {entryBalance?.ticketBalance
              ? `${entryBalance.ticketBalance}/${entryBalance.ticketBalance} ${copy.roundsToday}`
              : copy.buyTickets}
          </span>
        </button>
      </div>
    </div>
  )
}
