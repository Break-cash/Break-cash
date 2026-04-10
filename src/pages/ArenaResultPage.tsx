import { ArrowRight, Crown, Gift, Share2, Trophy, Wallet } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import '../arena/arena.css'
import { useArenaResult } from '../arena/hooks'
import { type Language, useI18n } from '../i18nCore'

function formatSigned(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}

function getArenaResultCopy(language: Language) {
  if (language === 'en') {
    return {
      back: 'Back',
      share: 'Share',
      title: 'Round Result',
      pending: 'Round is still running',
      restarted: 'Round restarted',
      won: 'Your prediction was correct',
      lost: 'This round did not go your way',
      pendingDesc: 'Your prediction is recorded. Final settlement will appear after the round closes.',
      restartedDesc: 'Start and end prices matched, so the round restarted and your ticket was refunded.',
      upDesc: 'The price closed above the starting price.',
      downDesc: 'The price closed below the starting price.',
      startPrice: 'Start price',
      endPrice: 'End price',
      change: 'Change',
      awaiting: 'Pending settlement',
      rewards: 'Rewards',
      settlement: 'Current settlement',
      pendingSettlement: 'Pending settlement',
      bonusReward: 'Bonus reward',
      participationPoints: 'Participation points',
      tickets: 'Tickets',
      bonusStatus: 'Bonus status',
      bonusPending: 'Bonus status will be determined after settlement and eligibility checks.',
      bonusLocked: 'The reward is stored as locked bonus until VIP status is activated.',
      bonusTransfer: 'You can now request a transfer for this reward.',
      bonusRequested: 'Transfer request sent and waiting for review.',
      bonusNone: 'There is no transferable reward in this round.',
      requestTransfer: 'Request bonus transfer',
      activateVip: 'Activate VIP',
      wallet: 'Wallet',
      ranking: 'Your ranking',
      rankingPending: 'Final ranking will appear after settlement.',
      participants: 'participants in this round',
      followRound: 'Follow the round',
      nextRound: 'Next round',
      followRoundSub: 'Return to the current round to follow the live timer and price.',
      nextRoundSub: 'Open a new round and continue from the arena flow.',
      rewardLedger: 'Reward ledger',
      latestItems: 'Latest 3 items',
      loading: 'Calculating round result...',
      failed: 'Unable to load round result.',
      nonVip: 'Non-VIP',
    }
  }

  if (language === 'tr') {
    return {
      back: 'Geri',
      share: 'Payla\u015f',
      title: 'Tur Sonucu',
      pending: 'Tur h\u00e2l\u00e2 devam ediyor',
      restarted: 'Tur yeniden ba\u015flat\u0131ld\u0131',
      won: 'Tahminin do\u011fru \u00e7\u0131kt\u0131',
      lost: 'Bu tur senin lehine sonu\u00e7lanmad\u0131',
      pendingDesc: 'Tahminin kaydedildi. Nihai sonu\u00e7 tur kapand\u0131ktan sonra g\u00f6r\u00fcnecek.',
      restartedDesc: 'Ba\u015flang\u0131\u00e7 ve biti\u015f fiyat\u0131 e\u015fit kald\u0131, bu y\u00fczden tur yeniden ba\u015flad\u0131 ve biletin iade edildi.',
      upDesc: 'Fiyat ba\u015flang\u0131\u00e7 fiyat\u0131n\u0131n \u00fczerinde kapand\u0131.',
      downDesc: 'Fiyat ba\u015flang\u0131\u00e7 fiyat\u0131n\u0131n alt\u0131nda kapand\u0131.',
      startPrice: 'Ba\u015flang\u0131\u00e7 fiyat\u0131',
      endPrice: 'Biti\u015f fiyat\u0131',
      change: 'De\u011fi\u015fim',
      awaiting: 'Sonu\u00e7 bekleniyor',
      rewards: '\u00d6d\u00fcller',
      settlement: 'Mevcut mutabakat',
      pendingSettlement: 'Mutabakat bekleniyor',
      bonusReward: 'Bonus \u00f6d\u00fcl\u00fc',
      participationPoints: 'Kat\u0131l\u0131m puanlar\u0131',
      tickets: 'Biletler',
      bonusStatus: 'Bonus durumu',
      bonusPending: 'Bonus durumu, mutabakattan ve uygunluk kontrol\u00fcnden sonra belirlenecek.',
      bonusLocked: '\u00d6d\u00fcl, VIP etkinle\u015fene kadar kilitli bonus olarak tutulur.',
      bonusTransfer: 'Bu \u00f6d\u00fcl i\u00e7in \u015fimdi transfer talebi g\u00f6nderebilirsin.',
      bonusRequested: 'Transfer talebi g\u00f6nderildi ve inceleme bekliyor.',
      bonusNone: 'Bu turda aktar\u0131labilir \u00f6d\u00fcl yok.',
      requestTransfer: 'Bonus transfer talebi',
      activateVip: 'VIP etkinle\u015ftir',
      wallet: 'C\u00fczdan',
      ranking: 'S\u0131ralaman',
      rankingPending: 'Nihai s\u0131ralama mutabakattan sonra g\u00f6r\u00fcnecek.',
      participants: 'kat\u0131l\u0131mc\u0131',
      followRound: 'Turu takip et',
      nextRound: 'Sonraki tur',
      followRoundSub: 'Canl\u0131 s\u00fcreyi ve fiyat\u0131 g\u00f6rmek i\u00e7in mevcut tura d\u00f6n.',
      nextRoundSub: 'Yeni tur a\u00e7 ve arena ak\u0131\u015f\u0131na devam et.',
      rewardLedger: '\u00d6d\u00fcl kayd\u0131',
      latestItems: 'Son 3 kay\u0131t',
      loading: 'Tur sonucu hesaplan\u0131yor...',
      failed: 'Tur sonucu y\u00fcklenemedi.',
      nonVip: 'VIP de\u011fil',
    }
  }

  return {
    back: '\u0639\u0648\u062f\u0629',
    share: '\u0645\u0634\u0627\u0631\u0643\u0629',
    title: '\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u062c\u0648\u0644\u0629',
    pending: '\u0627\u0644\u062c\u0648\u0644\u0629 \u0645\u0627 \u0632\u0627\u0644\u062a \u062c\u0627\u0631\u064a\u0629',
    restarted: '\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062c\u0648\u0644\u0629',
    won: '\u062a\u0648\u0642\u0639\u0643 \u0643\u0627\u0646 \u0635\u062d\u064a\u062d\u064b\u0627',
    lost: '\u0647\u0630\u0647 \u0627\u0644\u062c\u0648\u0644\u0629 \u0644\u0645 \u062a\u0643\u0646 \u0644\u0635\u0627\u0644\u062d\u0643',
    pendingDesc: '\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u062a\u0648\u0642\u0639\u0643. \u0633\u062a\u0638\u0647\u0631 \u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0646\u0647\u0627\u0626\u064a\u0629 \u0628\u0639\u062f \u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u062c\u0648\u0644\u0629 \u0648\u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u0633\u0639\u0631.',
    restartedDesc: '\u062a\u0633\u0627\u0648\u0649 \u0633\u0639\u0631 \u0627\u0644\u0628\u062f\u0627\u064a\u0629 \u0648\u0627\u0644\u0646\u0647\u0627\u064a\u0629\u060c \u0644\u0630\u0644\u0643 \u0623\u064f\u0639\u064a\u062f\u062a \u0627\u0644\u062c\u0648\u0644\u0629 \u0648\u062a\u0645 \u0631\u062f \u0627\u0644\u062a\u0630\u0643\u0631\u0629.',
    upDesc: '\u0623\u063a\u0644\u0642 \u0627\u0644\u0633\u0639\u0631 \u0623\u0639\u0644\u0649 \u0645\u0646 \u0633\u0639\u0631 \u0627\u0644\u0628\u062f\u0627\u064a\u0629.',
    downDesc: '\u0623\u063a\u0644\u0642 \u0627\u0644\u0633\u0639\u0631 \u0623\u062f\u0646\u0649 \u0645\u0646 \u0633\u0639\u0631 \u0627\u0644\u0628\u062f\u0627\u064a\u0629.',
    startPrice: '\u0633\u0639\u0631 \u0627\u0644\u0628\u062f\u0627\u064a\u0629',
    endPrice: '\u0633\u0639\u0631 \u0627\u0644\u0646\u0647\u0627\u064a\u0629',
    change: '\u0627\u0644\u062a\u063a\u064a\u0631',
    awaiting: '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u062a\u0633\u0648\u064a\u0629',
    rewards: '\u0627\u0644\u0645\u0643\u0627\u0641\u0622\u062a',
    settlement: '\u0627\u0644\u062a\u0633\u0648\u064a\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629',
    pendingSettlement: '\u0642\u064a\u062f \u0627\u0644\u062a\u0633\u0648\u064a\u0629',
    bonusReward: '\u0645\u0643\u0627\u0641\u0623\u0629 \u0627\u0644\u0628\u0648\u0646\u0635',
    participationPoints: '\u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629',
    tickets: '\u0627\u0644\u062a\u0630\u0627\u0643\u0631',
    bonusStatus: '\u062d\u0627\u0644\u0629 \u0627\u0644\u0628\u0648\u0646\u0635',
    bonusPending: '\u0633\u064a\u062a\u0645 \u062a\u062d\u062f\u064a\u062f \u062d\u0627\u0644\u0629 \u0627\u0644\u0628\u0648\u0646\u0635 \u0628\u0639\u062f \u0627\u0644\u062a\u0633\u0648\u064a\u0629 \u0648\u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0623\u0647\u0644\u064a\u0629.',
    bonusLocked: '\u0627\u0644\u0645\u0643\u0627\u0641\u0623\u0629 \u0645\u062d\u0641\u0648\u0638\u0629 \u0643\u0628\u0648\u0646\u0635 \u0645\u0642\u0641\u0644 \u062d\u062a\u0649 \u062a\u0641\u0639\u064a\u0644 \u062d\u0627\u0644\u0629 VIP.',
    bonusTransfer: '\u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u062a\u062d\u0648\u064a\u0644 \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0643\u0627\u0641\u0623\u0629.',
    bonusRequested: '\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u062a\u062d\u0648\u064a\u0644 \u0648\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629.',
    bonusNone: '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0643\u0627\u0641\u0623\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u062d\u0648\u064a\u0644 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u062c\u0648\u0644\u0629.',
    requestTransfer: '\u0637\u0644\u0628 \u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0628\u0648\u0646\u0635',
    activateVip: '\u062a\u0641\u0639\u064a\u0644 VIP',
    wallet: '\u0627\u0644\u0645\u062d\u0641\u0638\u0629',
    ranking: '\u062a\u0631\u062a\u064a\u0628\u0643',
    rankingPending: '\u0633\u064a\u0638\u0647\u0631 \u062a\u0631\u062a\u064a\u0628\u0643 \u0627\u0644\u0646\u0647\u0627\u0626\u064a \u0628\u0639\u062f \u0627\u0644\u062a\u0633\u0648\u064a\u0629.',
    participants: '\u0645\u0634\u0627\u0631\u0643\u064b\u0627 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u062c\u0648\u0644\u0629',
    followRound: '\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u062c\u0648\u0644\u0629',
    nextRound: '\u0627\u0644\u062c\u0648\u0644\u0629 \u0627\u0644\u062a\u0627\u0644\u064a\u0629',
    followRoundSub: '\u0627\u0631\u062c\u0639 \u0625\u0644\u0649 \u0627\u0644\u062c\u0648\u0644\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u0648\u0642\u062a \u0627\u0644\u0645\u062a\u0628\u0642\u064a \u0648\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062d\u064a.',
    nextRoundSub: '\u0627\u0641\u062a\u062d \u062c\u0648\u0644\u0629 \u062c\u062f\u064a\u062f\u0629 \u0648\u0648\u0627\u0635\u0644 \u0645\u0646 \u0646\u0641\u0633 \u0645\u0633\u0627\u0631 \u0627\u0644\u0633\u0627\u062d\u0629.',
    rewardLedger: '\u0633\u062c\u0644 \u0627\u0644\u0645\u0643\u0627\u0641\u0622\u062a',
    latestItems: '\u0622\u062e\u0631 3 \u0639\u0646\u0627\u0635\u0631',
    loading: '\u062c\u0627\u0631\u064a \u0627\u062d\u062a\u0633\u0627\u0628 \u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u062c\u0648\u0644\u0629...',
    failed: '\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u062c\u0648\u0644\u0629.',
    nonVip: '\u063a\u064a\u0631 VIP',
  }
}

export function ArenaResultPage() {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const { language } = useI18n()
  const copy = getArenaResultCopy(language)
  const { result, rewards, walletSummary, loading, error, requestTransfer, financeRoutes } = useArenaResult(roundId)

  if (loading) {
    return (
      <div className="page arena-page app-secondary-page">
        <div className="arena-page__frame">
          <div className="arena-card arena-empty">{copy.loading}</div>
        </div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="page arena-page app-secondary-page">
        <div className="arena-page__frame">
          <div className="arena-card arena-error">{copy.failed}</div>
        </div>
      </div>
    )
  }

  const isPendingResult = result.status !== 'SETTLED' && result.status !== 'RESTARTED'
  const canRequestTransfer = result.bonusReward?.status === 'ELIGIBLE_VIP'
  const isLockedBonus = result.bonusReward?.status === 'LOCKED_NON_VIP'

  return (
    <div className="page arena-page app-secondary-page">
      <div className="arena-page__frame">
        <div className="arena-screen__header">
          <button type="button" className="arena-screen__icon-btn" onClick={() => navigate('/arena')} aria-label={copy.back}>
            <ArrowRight size={18} />
          </button>
          <h1>{copy.title}</h1>
          <span />
          <button type="button" className="arena-screen__icon-btn arena-screen__icon-btn--sm" aria-label={copy.share}>
            <Share2 size={16} />
          </button>
        </div>

        <section className="arena-card arena-result-card">
          <span className="arena-result-card__icon">
            <Trophy size={28} />
          </span>
          <div className="arena-result-card__headline">
            <strong>
              {isPendingResult
                ? copy.pending
                : result.status === 'RESTARTED'
                  ? copy.restarted
                  : result.userWon
                    ? copy.won
                    : copy.lost}
            </strong>
            <span>
              {isPendingResult
                ? copy.pendingDesc
                : result.status === 'RESTARTED'
                  ? copy.restartedDesc
                  : result.outcome === 'UP'
                    ? copy.upDesc
                    : copy.downDesc}
            </span>
          </div>

          <div className="arena-result-grid">
            <div className="arena-result-grid__item">
              <span>{copy.startPrice}</span>
              <strong>{result.startPrice.toFixed(2)}</strong>
            </div>
            <div className="arena-result-grid__item">
              <span>{copy.endPrice}</span>
              <strong>{result.endPrice.toFixed(2)}</strong>
            </div>
            <div className="arena-result-grid__item">
              <span>{copy.change}</span>
              <strong>{isPendingResult ? copy.awaiting : `${formatSigned(result.absoluteChange)} / ${formatSigned(result.percentChange)}%`}</strong>
            </div>
          </div>
        </section>

        <section className="arena-card arena-reward-card">
          <div className="arena-section__head">
            <h2>{copy.rewards}</h2>
            <span className="arena-badge">
              <Gift size={14} />
              {isPendingResult ? copy.pendingSettlement : copy.settlement}
            </span>
          </div>

          <div className="arena-result-grid" style={{ marginTop: 16 }}>
            <div className="arena-result-grid__item">
              <span>{copy.bonusReward}</span>
              <strong>{isPendingResult ? copy.awaiting : result.bonusReward ? `${result.bonusReward.amount} USDT` : '0 USDT'}</strong>
            </div>
            <div className="arena-result-grid__item">
              <span>{copy.participationPoints}</span>
              <strong>{isPendingResult ? copy.awaiting : result.participationPointsAwarded}</strong>
            </div>
            <div className="arena-result-grid__item">
              <span>{copy.tickets}</span>
              <strong>{walletSummary?.ticketBalance || 0}</strong>
            </div>
          </div>
        </section>

        <section className="arena-card arena-rank-card">
          <div className="arena-section__head">
            <div>
              <strong style={{ color: '#f5f7fb', fontSize: 18 }}>{copy.bonusStatus}</strong>
              <span className="arena-caption">
                {isPendingResult
                  ? copy.bonusPending
                  : isLockedBonus
                    ? copy.bonusLocked
                    : canRequestTransfer
                      ? copy.bonusTransfer
                      : result.bonusReward?.status === 'TRANSFER_REQUESTED'
                        ? copy.bonusRequested
                        : copy.bonusNone}
              </span>
            </div>
            <span className="arena-badge">
              <Crown size={14} />
              {walletSummary?.vipLabel || copy.nonVip}
            </span>
          </div>

          <div className="arena-wallet-card__actions" style={{ marginTop: 16 }}>
            {canRequestTransfer && !isPendingResult ? (
              <button type="button" className="arena-ghost-btn" onClick={() => { requestTransfer(result.bonusReward).catch(() => {}) }}>
                {copy.requestTransfer}
              </button>
            ) : null}
            {isLockedBonus && !isPendingResult ? (
              <button type="button" className="arena-ghost-btn" onClick={() => navigate(financeRoutes.vip)}>
                {copy.activateVip}
              </button>
            ) : null}
            <button type="button" className="arena-ghost-btn" onClick={() => navigate(financeRoutes.wallet)}>
              <Wallet size={14} />
              {copy.wallet}
            </button>
          </div>
        </section>

        <section className="arena-card arena-rank-card">
          <div className="arena-section__head">
            <div>
              <strong style={{ color: '#f5f7fb', fontSize: 18 }}>{copy.ranking}</strong>
              <span className="arena-caption">
                {isPendingResult ? copy.rankingPending : `${result.totalParticipants} ${copy.participants}`}
              </span>
            </div>
            <strong style={{ fontSize: 24, color: '#f4c54c' }}>{isPendingResult ? '...' : `#${result.rank}`}</strong>
          </div>
        </section>

        <button type="button" className="arena-primary-btn" onClick={() => navigate(isPendingResult ? `/arena/round/${result.roundId}` : '/arena')}>
          {isPendingResult ? copy.followRound : copy.nextRound}
          <span className="arena-primary-btn__sub">
            {isPendingResult ? copy.followRoundSub : copy.nextRoundSub}
          </span>
        </button>

        <section className="arena-card arena-chat-preview">
          <div className="arena-section__head">
            <h2>{copy.rewardLedger}</h2>
            <span className="arena-muted-meta">{copy.latestItems}</span>
          </div>
          <div className="arena-list-compact" style={{ marginTop: 16 }}>
            {rewards.slice(0, 3).map((reward) => (
              <div key={reward.id} className="arena-list-compact__row">
                <span>{reward.title}</span>
                <strong style={{ color: '#f5f7fb' }}>
                  {reward.amount
                    ? `${reward.amount} ${reward.currency || ''}`.trim()
                    : reward.points
                      ? `${reward.points}`
                      : reward.tickets
                        ? `${reward.tickets}`
                        : '-'}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
