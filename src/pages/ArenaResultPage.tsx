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
      nonVip: 'Non‑VIP',
    }
  }

  if (language === 'tr') {
    return {
      back: 'Geri',
      share: 'Paylaş',
      title: 'Tur Sonucu',
      pending: 'Tur hâlâ devam ediyor',
      restarted: 'Tur yeniden başlatıldı',
      won: 'Tahminin doğru çıktı',
      lost: 'Bu tur senin lehine sonuçlanmadı',
      pendingDesc: 'Tahminin kaydedildi. Nihai sonuç tur kapandıktan sonra görünecek.',
      restartedDesc: 'Başlangıç ve bitiş fiyatı eşit kaldı, bu yüzden tur yeniden başladı ve biletin iade edildi.',
      upDesc: 'Fiyat başlangıç fiyatının üzerinde kapandı.',
      downDesc: 'Fiyat başlangıç fiyatının altında kapandı.',
      startPrice: 'Başlangıç fiyatı',
      endPrice: 'Bitiş fiyatı',
      change: 'Değişim',
      awaiting: 'Sonuç bekleniyor',
      rewards: 'Ödüller',
      settlement: 'Mevcut mutabakat',
      pendingSettlement: 'Mutabakat bekleniyor',
      bonusReward: 'Bonus ödülü',
      participationPoints: 'Katılım puanları',
      tickets: 'Biletler',
      bonusStatus: 'Bonus durumu',
      bonusPending: 'Bonus durumu, mutabakattan ve uygunluk kontrolünden sonra belirlenecek.',
      bonusLocked: 'Ödül, VIP etkinleşene kadar kilitli bonus olarak tutulur.',
      bonusTransfer: 'Bu ödül için şimdi transfer talebi gönderebilirsin.',
      bonusRequested: 'Transfer talebi gönderildi ve inceleme bekliyor.',
      bonusNone: 'Bu turda aktarılabilir ödül yok.',
      requestTransfer: 'Bonus transfer talebi',
      activateVip: 'VIP etkinleştir',
      wallet: 'Cüzdan',
      ranking: 'Sıralaman',
      rankingPending: 'Nihai sıralama mutabakattan sonra görünecek.',
      participants: 'katılımcı',
      followRound: 'Turu takip et',
      nextRound: 'Sonraki tur',
      followRoundSub: 'Canlı süreyi ve fiyatı görmek için mevcut tura dön.',
      nextRoundSub: 'Yeni tur aç ve arena akışına devam et.',
      rewardLedger: 'Ödül kaydı',
      latestItems: 'Son 3 kayıt',
      loading: 'Tur sonucu hesaplanıyor...',
      failed: 'Tur sonucu yüklenemedi.',
      nonVip: 'VIP değil',
    }
  }

  return {
    back: 'عودة',
    share: 'مشاركة',
    title: 'نتيجة الجولة',
    pending: 'الجولة ما زالت جارية',
    restarted: 'تمت إعادة الجولة',
    won: 'توقعك كان صحيحًا',
    lost: 'هذه الجولة لم تكن لصالحك',
    pendingDesc: 'تم تسجيل توقعك. ستظهر النتيجة النهائية بعد إغلاق الجولة وتسوية السعر.',
    restartedDesc: 'تساوى سعر البداية والنهاية، لذلك أُعيدت الجولة وتم رد التذكرة.',
    upDesc: 'أغلق السعر أعلى من سعر البداية.',
    downDesc: 'أغلق السعر أدنى من سعر البداية.',
    startPrice: 'سعر البداية',
    endPrice: 'سعر النهاية',
    change: 'التغير',
    awaiting: 'بانتظار التسوية',
    rewards: 'المكافآت',
    settlement: 'التسوية الحالية',
    pendingSettlement: 'قيد التسوية',
    bonusReward: 'مكافأة البونص',
    participationPoints: 'نقاط المشاركة',
    tickets: 'التذاكر',
    bonusStatus: 'حالة البونص',
    bonusPending: 'سيتم تحديد حالة البونص بعد التسوية والتحقق من الأهلية.',
    bonusLocked: 'المكافأة محفوظة كبونص مقفل حتى تفعيل حالة VIP.',
    bonusTransfer: 'يمكنك الآن إرسال طلب تحويل لهذه المكافأة.',
    bonusRequested: 'تم إرسال طلب التحويل وبانتظار المراجعة.',
    bonusNone: 'لا توجد مكافأة قابلة للتحويل في هذه الجولة.',
    requestTransfer: 'طلب تحويل البونص',
    activateVip: 'تفعيل VIP',
    wallet: 'المحفظة',
    ranking: 'ترتيبك',
    rankingPending: 'سيظهر ترتيبك النهائي بعد التسوية.',
    participants: 'مشاركًا في هذه الجولة',
    followRound: 'متابعة الجولة',
    nextRound: 'الجولة التالية',
    followRoundSub: 'ارجع إلى الجولة الحالية لمتابعة الوقت المتبقي والسعر الحي.',
    nextRoundSub: 'افتح جولة جديدة وواصل من نفس مسار الساحة.',
    rewardLedger: 'سجل المكافآت',
    latestItems: 'آخر 3 عناصر',
    loading: 'جاري احتساب نتيجة الجولة...',
    failed: 'تعذر تحميل نتيجة الجولة.',
    nonVip: 'غير VIP',
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
