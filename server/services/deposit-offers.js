import { all, get, run } from '../db.js'
import { createDepositOfferBonusReward } from './wallet-service.js'
import { createLocalizedNotification } from './notifications.js'

const OFFER_ROTATION_WINDOW_MS = 24 * 60 * 60 * 1000

const DEFAULT_OFFER_DEFINITIONS = [
  { key: 'flash-500-10', title: 'مكافأة بداية سريعة', teaser: 'لفترة قصيرة فقط على أول شريحة إيداع قوية.', headline: 'افتح مكافأة بداية سريعة الآن', urgency: 'العرض النشط ينتهي قريبًا. ثبّت إيداعك قبل انتهاء العد التنازلي.', min: 500, max: 999.99, percent: 10, maxReward: 100, order: 1 },
  { key: 'prime-750-12', title: 'حافز النخبة 12%', teaser: 'ارفع إيداعك إلى مستوى أعلى مع مكافأة مضاعفة.', headline: 'ترقية فورية بإيداع 750 USD', urgency: 'هذه النافذة الترويجية محدودة وتغلق تلقائيًا.', min: 750, max: 1499.99, percent: 12, maxReward: 180, order: 2 },
  { key: 'velocity-1000-15', title: 'دفعة سرعة 15%', teaser: 'أضف سيولة إضافية واحصل على تعزيز مباشر.', headline: 'إيداع 1000 USD يمنحك 15% فور التأكيد', urgency: 'ينتهي العرض خلال ساعات قليلة فقط.', min: 1000, max: 1999.99, percent: 15, maxReward: 300, order: 3 },
  { key: 'focus-1250-18', title: 'عرض تركيز السوق', teaser: 'ضاعف جاهزيتك بمكافأة مرتفعة على الشريحة المتوسطة.', headline: 'أودع 1250 USD واحصل على 18% إضافية', urgency: 'العرض محدود للمستخدمين المؤهلين الآن فقط.', min: 1250, max: 2499.99, percent: 18, maxReward: 450, order: 4 },
  { key: 'surge-1500-20', title: 'دفعة سيولة 20%', teaser: 'عرض سريع للمستخدمين الجادين في التوسّع.', headline: 'إيداع 1500 USD يفتح لك مكافأة 20%', urgency: 'كل دقيقة مؤثرة قبل إغلاق النافذة الحالية.', min: 1500, max: 2999.99, percent: 20, maxReward: 600, order: 5 },
  { key: 'power-2000-25', title: 'تعزيز القوة 25%', teaser: 'ارفع رصيدك التشغيلي بمكافأة أكثر سخاءً.', headline: 'مكافأة 25% على إيداعات 2000 USD+', urgency: 'العرض فعال الآن وقد يُغلق في أي تحديث لاحق.', min: 2000, max: 3999.99, percent: 25, maxReward: 900, order: 6 },
  { key: 'alpha-2500-30', title: 'عرض ألفا 30%', teaser: 'زيادة ملحوظة على الشريحة المتقدمة من الإيداع.', headline: 'إيداع 2500 USD يمنحك 30% مكافأة', urgency: 'ثبّت العملية قبل أن ينتهي هذا العرض الممتاز.', min: 2500, max: 4999.99, percent: 30, maxReward: 1500, order: 7 },
  { key: 'elite-3000-35', title: 'حافز النخبة 35%', teaser: 'عرض مخصص للمستخدمين ذوي السيولة الأعلى.', headline: '35% مكافأة على إيداعات 3000 USD+', urgency: 'عدد المطالبات محدود والزمن قصير.', min: 3000, max: 5999.99, percent: 35, maxReward: 2100, order: 8 },
  { key: 'summit-4000-40', title: 'قمة العوائد 40%', teaser: 'واحد من أقوى عروض الإيداع النشطة الآن.', headline: 'إيداع 4000 USD يفعّل مكافأة 40%', urgency: 'العرض مرتفع القيمة ولن يبقى طويلًا.', min: 4000, max: 7999.99, percent: 40, maxReward: 3200, order: 9 },
  { key: 'royal-5000-45', title: 'العرض الملكي 45%', teaser: 'مكافأة فاخرة للمستخدمين الراغبين في التوسّع بقوة.', headline: 'اربط 5000 USD بمكافأة 45% قبل الإغلاق', urgency: 'صلاحية هذا العرض قصيرة جدًا مقارنة ببقية الشرائح.', min: 5000, max: 9999.99, percent: 45, maxReward: 4500, order: 10 },
  { key: 'crown-7000-50', title: 'التعزيز الأقصى 50%', teaser: 'أعلى نسبة متاحة ضمن العروض النشطة المحدودة.', headline: 'حتى 50% مكافأة على إيداع 7000 USD+', urgency: 'هذا العرض الأعلى قيمة وقد ينتهي دون إشعار.', min: 7000, max: 14999.99, percent: 50, maxReward: 7000, order: 11 },
  { key: 'select-9000-30', title: 'عرض سيولة مختار', teaser: 'مسار متزن بين القيمة والمرونة للمبالغ الكبيرة.', headline: 'إيداع 9000 USD يضيف 30% بشكل فوري بعد التأكيد', urgency: 'النافذة الحالية نشطة الآن فقط.', min: 9000, max: 19999.99, percent: 30, maxReward: 5000, order: 12 },
  { key: 'platinum-12000-35', title: 'بلاتينيوم خاص', teaser: 'عرض شبه حصري للعملاء ذوي الإيداعات الكبيرة.', headline: 'بلاتينيوم: 35% مكافأة على 12000 USD+', urgency: 'المطالبة مؤهلة مرة واحدة فقط لكل حساب.', min: 12000, max: 24999.99, percent: 35, maxReward: 8750, order: 13 },
  { key: 'vault-15000-40', title: 'خزنة السيولة 40%', teaser: 'تعزيز قوي للحسابات التي تريد رفع المستوى بسرعة.', headline: 'أودع 15000 USD وخذ 40% وفق شروط العرض', urgency: 'فترة هذا العرض أقصر من المعتاد.', min: 15000, max: null, percent: 40, maxReward: 12000, order: 14 },
]

function normalizeDate(date) {
  return new Date(date).toISOString()
}

function buildSeedOffers() {
  return DEFAULT_OFFER_DEFINITIONS.map((offer, index) => {
    return {
      offerKey: offer.key,
      title: offer.title,
      teaserText: offer.teaser,
      headline: offer.headline,
      urgencyText: offer.urgency,
      minimumDeposit: offer.min,
      maximumDeposit: offer.max,
      rewardPercentage: offer.percent,
      rewardType: 'deposit_bonus',
      startsAt: null,
      endsAt: null,
      isActive: 1,
      claimRule: 'one_time',
      maxClaimsPerUser: 1,
      maxRewardAmount: offer.maxReward,
      sortOrder: offer.order,
      eligibilityJson: JSON.stringify({
        currency: 'USDT',
        minimumDeposit: offer.min,
        maximumDeposit: offer.max,
        claimRule: 'one_time',
      }),
    }
  })
}

export async function ensureDepositOffersSeeded(db) {
  const offers = buildSeedOffers()
  for (const offer of offers) {
    await run(
      db,
      `INSERT INTO deposit_offers (
        offer_key, title, teaser_text, headline, urgency_text,
        minimum_deposit, maximum_deposit, reward_percentage, reward_type,
        starts_at, ends_at, is_active, claim_rule, max_claims_per_user,
        max_reward_amount, sort_order, eligibility_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(offer_key) DO UPDATE SET
        title = excluded.title,
        teaser_text = excluded.teaser_text,
        headline = excluded.headline,
        urgency_text = excluded.urgency_text,
        minimum_deposit = excluded.minimum_deposit,
        maximum_deposit = excluded.maximum_deposit,
        reward_percentage = excluded.reward_percentage,
        reward_type = excluded.reward_type,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        is_active = excluded.is_active,
        claim_rule = excluded.claim_rule,
        max_claims_per_user = excluded.max_claims_per_user,
        max_reward_amount = excluded.max_reward_amount,
        sort_order = excluded.sort_order,
        eligibility_json = excluded.eligibility_json,
        updated_at = CURRENT_TIMESTAMP`,
      [
        offer.offerKey,
        offer.title,
        offer.teaserText,
        offer.headline,
        offer.urgencyText,
        offer.minimumDeposit,
        offer.maximumDeposit,
        offer.rewardPercentage,
        offer.rewardType,
        offer.startsAt,
        offer.endsAt,
        offer.isActive,
        offer.claimRule,
        offer.maxClaimsPerUser,
        offer.maxRewardAmount,
        offer.sortOrder,
        offer.eligibilityJson,
      ],
    )
  }
}

function getOfferRotationWindow(now = new Date()) {
  const nowMs = now.getTime()
  const startMs = Math.floor(nowMs / OFFER_ROTATION_WINDOW_MS) * OFFER_ROTATION_WINDOW_MS
  const endMs = startMs + OFFER_ROTATION_WINDOW_MS
  return {
    startMs,
    endMs,
    startsAt: normalizeDate(startMs),
    endsAt: normalizeDate(endMs),
  }
}

function buildDeterministicHash(input) {
  let hash = 0
  const text = String(input || '')
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash
}

function pickDailyFeaturedOffer(offers, now = new Date()) {
  const available = offers
    .filter((offer) => Number(offer?.is_active || 0) === 1)
    .sort((left, right) => Number(left.id || 0) - Number(right.id || 0))
  if (available.length === 0) return null
  const window = getOfferRotationWindow(now)
  const index = buildDeterministicHash(`deposit-offer:${window.startMs}`) % available.length
  return available[index] || available[0]
}

function toOfferState(offer, userClaims, now = new Date()) {
  const nowMs = now.getTime()
  const endsAtMs = offer.ends_at ? Date.parse(String(offer.ends_at)) : Number.NaN
  const startsAtMs = offer.starts_at ? Date.parse(String(offer.starts_at)) : Number.NaN
  const totalClaims = Number(userClaims?.totalClaims || 0)
  const awardedClaims = Number(userClaims?.awardedClaims || 0)
  const pendingClaims = Number(userClaims?.pendingClaims || 0)
  const maxClaims = Number(offer.max_claims_per_user || 0)
  const oneTime = String(offer.claim_rule || 'one_time') === 'one_time'
  if (offer.is_active !== 1) return 'expired'
  if (Number.isFinite(endsAtMs) && endsAtMs <= nowMs) return 'expired'
  if (oneTime && (awardedClaims > 0 || pendingClaims > 0 || (maxClaims > 0 && totalClaims >= maxClaims))) return 'claimed'
  if (maxClaims > 0 && totalClaims >= maxClaims) return 'claimed'
  if (Number.isFinite(startsAtMs) && startsAtMs > nowMs) return 'upcoming'
  return 'active'
}

function mapOfferRow(row, userClaims, now = new Date(), windowOverride = null) {
  const startsAtValue = windowOverride?.startsAt ?? row.starts_at ?? null
  const endsAtValue = windowOverride?.endsAt ?? row.ends_at ?? null
  const effectiveRow = {
    ...row,
    starts_at: startsAtValue,
    ends_at: endsAtValue,
  }
  const endsAtMs = endsAtValue ? Date.parse(String(endsAtValue)) : Number.NaN
  const remainingSeconds = Number.isFinite(endsAtMs) ? Math.max(0, Math.floor((endsAtMs - now.getTime()) / 1000)) : null
  return {
    id: Number(row.id || 0),
    offerId: Number(row.id || 0),
    offerKey: String(row.offer_key || ''),
    title: String(row.title || ''),
    teaserText: String(row.teaser_text || ''),
    headline: String(row.headline || ''),
    urgencyText: String(row.urgency_text || ''),
    minimumDeposit: Number(row.minimum_deposit || 0),
    maximumDeposit: row.maximum_deposit == null ? null : Number(row.maximum_deposit),
    rewardPercentage: Number(row.reward_percentage || 0),
    rewardType: String(row.reward_type || 'deposit_bonus'),
    startsAt: startsAtValue,
    endsAt: endsAtValue,
    remainingSeconds,
    isActive: Number(row.is_active || 0) === 1,
    claimRule: String(row.claim_rule || 'one_time'),
    maxClaimsPerUser: row.max_claims_per_user == null ? null : Number(row.max_claims_per_user),
    maxRewardAmount: row.max_reward_amount == null ? null : Number(row.max_reward_amount),
    sortOrder: Number(row.sort_order || 0),
    state: toOfferState(effectiveRow, userClaims, now),
    userClaimCount: Number(userClaims?.totalClaims || 0),
    awardedClaimCount: Number(userClaims?.awardedClaims || 0),
    pendingClaimCount: Number(userClaims?.pendingClaims || 0),
  }
}

export async function listDepositOffers(db, userId) {
  await ensureDepositOffersSeeded(db)
  const [offers, claimRows] = await Promise.all([
    all(
      db,
      `SELECT *
       FROM deposit_offers
       ORDER BY sort_order ASC, reward_percentage DESC, minimum_deposit ASC, id ASC`,
    ),
    all(
      db,
      `SELECT offer_id,
              COUNT(*) AS total_claims,
              SUM(CASE WHEN claim_status = 'awarded' THEN 1 ELSE 0 END) AS awarded_claims,
              SUM(CASE WHEN claim_status = 'pending' THEN 1 ELSE 0 END) AS pending_claims
       FROM deposit_offer_claims
       WHERE user_id = ?
       GROUP BY offer_id`,
      [userId],
    ),
  ])
  const claimMap = new Map(claimRows.map((row) => [Number(row.offer_id || 0), row]))
  const now = new Date()
  const featuredOffer = pickDailyFeaturedOffer(offers, now)
  if (!featuredOffer) return []
  const rotationWindow = getOfferRotationWindow(now)
  return [mapOfferRow(featuredOffer, claimMap.get(Number(featuredOffer.id || 0)), now, rotationWindow)]
}

export async function getDepositOfferById(db, offerId) {
  await ensureDepositOffersSeeded(db)
  if (!offerId) return null
  return get(db, `SELECT * FROM deposit_offers WHERE id = ? LIMIT 1`, [offerId])
}

export async function validateDepositOfferEligibility(db, { userId, offerId, depositAmount, now = new Date() }) {
  await ensureDepositOffersSeeded(db)
  const allOffers = await all(
    db,
    `SELECT *
     FROM deposit_offers
     ORDER BY sort_order ASC, reward_percentage DESC, minimum_deposit ASC, id ASC`,
  )
  const featuredOffer = pickDailyFeaturedOffer(allOffers, now)
  const offer = await getDepositOfferById(db, offerId)
  if (!offer) return { eligible: false, code: 'offer_not_found', offer: null }
  if (!featuredOffer || Number(featuredOffer.id || 0) !== Number(offer.id || 0)) {
    return { eligible: false, code: 'not_current_offer', offer }
  }
  const claimsRow = await get(
    db,
    `SELECT COUNT(*) AS total_claims,
            SUM(CASE WHEN claim_status = 'awarded' THEN 1 ELSE 0 END) AS awarded_claims,
            SUM(CASE WHEN claim_status = 'pending' THEN 1 ELSE 0 END) AS pending_claims
     FROM deposit_offer_claims
     WHERE user_id = ? AND offer_id = ?`,
    [userId, offerId],
  )
  const rotationWindow = getOfferRotationWindow(now)
  const effectiveOffer = {
    ...offer,
    starts_at: rotationWindow.startsAt,
    ends_at: rotationWindow.endsAt,
  }
  const state = toOfferState(effectiveOffer, claimsRow, now)
  if (state === 'expired') return { eligible: false, code: 'expired', offer }
  if (state === 'claimed') return { eligible: false, code: 'already_claimed', offer }
  if (state === 'upcoming') return { eligible: false, code: 'not_started', offer }
  const amount = Number(depositAmount || 0)
  if (!Number.isFinite(amount) || amount <= 0) return { eligible: false, code: 'invalid_amount', offer }
  const minDeposit = Number(offer.minimum_deposit || 0)
  if (amount < minDeposit) return { eligible: false, code: 'minimum_not_met', offer }
  const maxDeposit = offer.maximum_deposit == null ? null : Number(offer.maximum_deposit)
  if (maxDeposit != null && amount > maxDeposit) return { eligible: false, code: 'maximum_exceeded', offer }
  return { eligible: true, code: 'eligible', offer }
}

export function calculateDepositOfferReward(offer, depositAmount) {
  const amount = Number(depositAmount || 0)
  const percent = Number(offer?.reward_percentage || 0)
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(percent) || percent <= 0) return 0
  const raw = Number(((amount * percent) / 100).toFixed(8))
  const maxReward = offer?.max_reward_amount == null ? null : Number(offer.max_reward_amount)
  if (maxReward != null && Number.isFinite(maxReward) && maxReward > 0) {
    return Number(Math.min(raw, maxReward).toFixed(8))
  }
  return raw
}

function mapClaimStatusFromEligibility(code) {
  if (code === 'expired') return 'expired'
  if (code === 'already_claimed' || code === 'maximum_exceeded' || code === 'minimum_not_met' || code === 'not_started' || code === 'not_current_offer') return 'rejected'
  return 'rejected'
}

export async function applyDepositOfferRewardAfterDeposit(
  db,
  { userId, depositRequestId, walletTransactionId = null, offerId, depositAmount, currency = 'USDT' },
) {
  if (!offerId) return { applied: false, reason: 'no_offer' }
  const existing = await get(
    db,
    `SELECT * FROM deposit_offer_claims WHERE user_id = ? AND offer_id = ? AND deposit_request_id = ? LIMIT 1`,
    [userId, offerId, depositRequestId],
  )
  if (existing) {
    return {
      applied: String(existing.claim_status || '') === 'awarded',
      reason: String(existing.eligibility_code || 'already_processed'),
      claimId: Number(existing.id || 0),
      rewardAmount: Number(existing.reward_amount || 0),
    }
  }

  const validation = await validateDepositOfferEligibility(db, {
    userId,
    offerId,
    depositAmount,
    now: new Date(),
  })
  const offer = validation.offer
  if (!validation.eligible || !offer) {
    const insertRes = await run(
      db,
      `INSERT INTO deposit_offer_claims (
        user_id, offer_id, deposit_request_id, wallet_transaction_id, reward_amount,
        reward_percentage, deposit_amount, claim_status, eligibility_code, reward_status,
        linked_transaction_id, linked_deposit_id, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 'none', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id`,
      [
        userId,
        offerId,
        depositRequestId,
        walletTransactionId,
        Number(offer?.reward_percentage || 0),
        Number(depositAmount || 0),
        mapClaimStatusFromEligibility(validation.code),
        validation.code,
        walletTransactionId,
        depositRequestId,
      ],
    )
    return {
      applied: false,
      reason: validation.code,
      claimId: Number(insertRes.lastID || insertRes.rows?.[0]?.id || 0),
      rewardAmount: 0,
    }
  }

  const rewardAmount = calculateDepositOfferReward(offer, depositAmount)
  const insertRes = await run(
    db,
    `INSERT INTO deposit_offer_claims (
      user_id, offer_id, deposit_request_id, wallet_transaction_id, reward_amount,
      reward_percentage, deposit_amount, claim_status, eligibility_code, reward_status,
      linked_transaction_id, linked_deposit_id, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'eligible', 'pending', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id`,
    [
      userId,
      offerId,
      depositRequestId,
      walletTransactionId,
      rewardAmount,
      Number(offer.reward_percentage || 0),
      Number(depositAmount || 0),
      walletTransactionId,
      depositRequestId,
    ],
  )
  const claimId = Number(insertRes.lastID || insertRes.rows?.[0]?.id || 0)
  if (!claimId || rewardAmount <= 0) {
    await run(
      db,
      `UPDATE deposit_offer_claims
       SET claim_status = 'rejected', eligibility_code = 'reward_zero', reward_status = 'none', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [claimId],
    )
    return { applied: false, reason: 'reward_zero', claimId, rewardAmount: 0 }
  }

  const rewardRes = await createDepositOfferBonusReward(db, {
    userId,
    amount: rewardAmount,
    claimId,
    currency,
  })
  await run(
    db,
    `UPDATE deposit_offer_claims
     SET claim_status = 'awarded',
         reward_status = ?,
         reward_entry_id = ?,
         wallet_transaction_id = COALESCE(?, wallet_transaction_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      String(rewardRes?.payoutMode || 'bonus_locked'),
      Number(rewardRes?.earningEntryId || 0) || null,
      rewardRes?.walletTxnId || null,
      claimId,
    ],
  )
  await createLocalizedNotification(db, userId, 'deposit_offer_bonus', {
    amount: rewardAmount,
    currency,
    percentage: Number(offer.reward_percentage || 0),
  })
  return {
    applied: true,
    reason: 'awarded',
    claimId,
    rewardAmount,
    payoutMode: rewardRes?.payoutMode || 'bonus_locked',
  }
}

export async function getDepositOfferHistory(db, userId) {
  await ensureDepositOffersSeeded(db)
  return all(
    db,
    `SELECT doc.id,
            doc.offer_id,
            doc.deposit_request_id,
            doc.wallet_transaction_id,
            doc.reward_entry_id,
            doc.reward_amount,
            doc.reward_percentage,
            doc.deposit_amount,
            doc.claim_status,
            doc.eligibility_code,
            doc.reward_status,
            doc.created_at,
            doc.updated_at,
            dof.title AS offer_title,
            dof.headline AS offer_headline,
            dof.minimum_deposit,
            dof.maximum_deposit,
            dr.request_status AS deposit_status
     FROM deposit_offer_claims doc
     JOIN deposit_offers dof ON dof.id = doc.offer_id
     LEFT JOIN deposit_requests dr ON dr.id = doc.deposit_request_id
     WHERE doc.user_id = ?
     ORDER BY doc.id DESC
     LIMIT 200`,
    [userId],
  )
}
