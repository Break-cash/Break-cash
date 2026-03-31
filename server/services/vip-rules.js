const UNRESTRICTED_DAILY_WITHDRAWAL_LIMIT = 1000000000

const VIP_RULES = Object.freeze({
  0: Object.freeze({
    level: 0,
    title: 'Base',
    minDeposit: 0,
    minReferrals: 0,
    minTeamVolume: 0,
    referralPercent: 20,
    dailyMiningPercent: 1.0,
    miningSpeedPercent: 0,
    dailyWithdrawalLimit: UNRESTRICTED_DAILY_WITHDRAWAL_LIMIT,
    processingHoursMin: 0,
    processingHoursMax: 0,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 0,
    level2ReferralPercent: 0,
    level3ReferralPercent: 0,
    profitMultiplier: 1,
    autoReinvest: false,
    dailyBonus: false,
    perks: [
      'عائد تعدين أساسي.',
      'رسوم السحب 10٪.',
    ],
  }),
  1: Object.freeze({
    level: 1,
    title: 'Starter',
    minDeposit: 500,
    minReferrals: 0,
    minTeamVolume: 0,
    referralPercent: 20,
    dailyMiningPercent: 1.2,
    miningSpeedPercent: 0,
    dailyWithdrawalLimit: UNRESTRICTED_DAILY_WITHDRAWAL_LIMIT,
    processingHoursMin: 0,
    processingHoursMax: 0,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 0,
    level2ReferralPercent: 0,
    level3ReferralPercent: 0,
    profitMultiplier: 1,
    autoReinvest: false,
    dailyBonus: false,
    perks: [
      'عائد التعدين 1.2٪ يوميًا بسرعة أساسية.',
      'نسبة الإحالة المباشرة 4٪.',
      'حد السحب اليومي 200$.',
      'مدة المعالجة 72 ساعة.',
      'رسوم السحب 10٪ مع 5٪ إضافية عند وجود تعدين أو صفقة نشطة.',
      'مستوى البداية.',
    ],
  }),
  2: Object.freeze({
    level: 2,
    title: 'Advanced',
    minDeposit: 1500,
    minReferrals: 5,
    minTeamVolume: 2000,
    referralPercent: 20,
    dailyMiningPercent: 1.4,
    miningSpeedPercent: 15,
    dailyWithdrawalLimit: UNRESTRICTED_DAILY_WITHDRAWAL_LIMIT,
    processingHoursMin: 0,
    processingHoursMax: 0,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 0,
    level2ReferralPercent: 0,
    level3ReferralPercent: 0,
    profitMultiplier: 1,
    autoReinvest: false,
    dailyBonus: false,
    perks: [
      'عائد التعدين 1.4٪ يوميًا وسرعة +15٪.',
      'نسبة الإحالة المباشرة 5٪.',
      'المطلوب 5 محالين وحجم فريق 2000$.',
      'حد السحب اليومي 400$.',
      'مدة المعالجة 48 - 72 ساعة.',
      'أرباح أعلى وسيولة أفضل.',
    ],
  }),
  3: Object.freeze({
    level: 3,
    title: 'Pro Investor',
    minDeposit: 3000,
    minReferrals: 15,
    minTeamVolume: 7000,
    referralPercent: 20,
    dailyMiningPercent: 1.7,
    miningSpeedPercent: 30,
    dailyWithdrawalLimit: UNRESTRICTED_DAILY_WITHDRAWAL_LIMIT,
    processingHoursMin: 0,
    processingHoursMax: 0,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 0,
    level2ReferralPercent: 2,
    level3ReferralPercent: 0,
    profitMultiplier: 1,
    autoReinvest: true,
    dailyBonus: false,
    perks: [
      'عائد التعدين 1.7٪ يوميًا وسرعة +30٪.',
      'نسبة الإحالة المباشرة 6٪ وعمولة مستوى ثانٍ 2٪.',
      'المطلوب 15 محالًا وحجم فريق 7000$.',
      'حد السحب اليومي 700$.',
      'مدة المعالجة 36 - 48 ساعة.',
      'إعادة استثمار تلقائي وبداية تضاعف الأرباح.',
    ],
  }),
  4: Object.freeze({
    level: 4,
    title: 'Elite',
    minDeposit: 7000,
    minReferrals: 40,
    minTeamVolume: 20000,
    referralPercent: 20,
    dailyMiningPercent: 2.0,
    miningSpeedPercent: 45,
    dailyWithdrawalLimit: UNRESTRICTED_DAILY_WITHDRAWAL_LIMIT,
    processingHoursMin: 0,
    processingHoursMax: 0,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 0,
    level2ReferralPercent: 3,
    level3ReferralPercent: 1,
    profitMultiplier: 1,
    autoReinvest: false,
    dailyBonus: false,
    perks: [
      'عائد التعدين 2.0٪ يوميًا وسرعة +45٪.',
      'نسبة الإحالة المباشرة 7٪ وعمولة مستوى ثانٍ 3٪ ومستوى ثالث 1٪.',
      'المطلوب 40 محالًا وحجم فريق 20000$.',
      'حد السحب اليومي 1100$.',
      'مدة المعالجة 24 - 36 ساعة مع سحب سريع.',
      'مدير حساب وسيطرة أكبر على الأرباح.',
    ],
  }),
  5: Object.freeze({
    level: 5,
    title: 'Ultimate',
    minDeposit: 15000,
    minReferrals: 100,
    minTeamVolume: 50000,
    referralPercent: 20,
    dailyMiningPercent: 2.5,
    miningSpeedPercent: 60,
    dailyWithdrawalLimit: UNRESTRICTED_DAILY_WITHDRAWAL_LIMIT,
    processingHoursMin: 0,
    processingHoursMax: 0,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 0,
    level2ReferralPercent: 4,
    level3ReferralPercent: 2,
    profitMultiplier: 1.5,
    autoReinvest: false,
    dailyBonus: true,
    perks: [
      'عائد التعدين 2.5٪ يوميًا وسرعة +60٪.',
      'نسبة الإحالة المباشرة 8٪ وعمولة مستوى ثانٍ 4٪ ومستوى ثالث 2٪.',
      'المطلوب 100+ محال وحجم فريق 50000$.',
      'حد السحب اليومي 2000$.',
      'مدة المعالجة 12 - 24 ساعة وسحب سريع جدًا.',
      'بونص يومي ومضاعف أرباح ×1.5.',
    ],
  }),
})

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === 1 || value === '1' || value === 'true') return true
  if (value === 0 || value === '0' || value === 'false') return false
  return fallback
}

function parseRawConfig(value) {
  if (value == null || value === '') return {}
  if (Array.isArray(value)) return { perks: value }
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? { perks: parsed } : parsed || {}
  } catch {
    return {}
  }
}

export function getVipRuntimeRules(level) {
  const safeLevel = Math.max(0, Math.min(5, Number(level || 0)))
  return VIP_RULES[safeLevel] || VIP_RULES[0]
}

export function normalizeVipTierConfig(level, raw) {
  const base = getVipRuntimeRules(level)
  const parsed = parseRawConfig(raw)
  const perks = Array.isArray(parsed.perks)
    ? parsed.perks.map((item) => String(item || '').trim()).filter(Boolean)
    : Array.isArray(raw)
      ? raw.map((item) => String(item || '').trim()).filter(Boolean)
      : [...base.perks]

  return {
    level: base.level,
    title: String(parsed.title || base.title).trim() || base.title,
    minDeposit: toNumber(parsed.minDeposit ?? parsed.min_deposit, base.minDeposit),
    minReferrals: toNumber(parsed.minReferrals ?? parsed.referralMultiplier ?? parsed.referral_multiplier, base.minReferrals),
    minTeamVolume: toNumber(parsed.minTeamVolume ?? parsed.minTradeVolume ?? parsed.min_trade_volume, base.minTeamVolume),
    referralPercent: clampNumber(parsed.referralPercent ?? parsed.referral_percent, 0, 100, base.referralPercent),
    dailyMiningPercent: clampNumber(parsed.dailyMiningPercent, 0, 100, base.dailyMiningPercent),
    miningSpeedPercent: clampNumber(parsed.miningSpeedPercent, 0, 1000, base.miningSpeedPercent),
    dailyWithdrawalLimit: clampNumber(parsed.dailyWithdrawalLimit, 0, 1000000000, base.dailyWithdrawalLimit),
    processingHoursMin: clampNumber(parsed.processingHoursMin, 0, 720, base.processingHoursMin),
    processingHoursMax: clampNumber(parsed.processingHoursMax, 0, 720, base.processingHoursMax),
    withdrawalFeePercent: clampNumber(parsed.withdrawalFeePercent, 0, 100, base.withdrawalFeePercent),
    activeExtraFeePercent: clampNumber(parsed.activeExtraFeePercent, 0, 100, base.activeExtraFeePercent),
    level2ReferralPercent: clampNumber(parsed.level2ReferralPercent, 0, 100, base.level2ReferralPercent),
    level3ReferralPercent: clampNumber(parsed.level3ReferralPercent, 0, 100, base.level3ReferralPercent),
    profitMultiplier: clampNumber(parsed.profitMultiplier, 0, 100, base.profitMultiplier),
    autoReinvest: toBoolean(parsed.autoReinvest, base.autoReinvest),
    dailyBonus: toBoolean(parsed.dailyBonus, base.dailyBonus),
    perks: perks.length > 0 ? perks : [...base.perks],
  }
}

export function toVipTierStoragePayload(input) {
  const normalized = normalizeVipTierConfig(input?.level || 0, input)
  return {
    title: normalized.title,
    minDeposit: normalized.minDeposit,
    minReferrals: normalized.minReferrals,
    minTeamVolume: normalized.minTeamVolume,
    referralPercent: normalized.referralPercent,
    dailyMiningPercent: normalized.dailyMiningPercent,
    miningSpeedPercent: normalized.miningSpeedPercent,
    dailyWithdrawalLimit: normalized.dailyWithdrawalLimit,
    processingHoursMin: normalized.processingHoursMin,
    processingHoursMax: normalized.processingHoursMax,
    withdrawalFeePercent: normalized.withdrawalFeePercent,
    activeExtraFeePercent: normalized.activeExtraFeePercent,
    level2ReferralPercent: normalized.level2ReferralPercent,
    level3ReferralPercent: normalized.level3ReferralPercent,
    profitMultiplier: normalized.profitMultiplier,
    autoReinvest: normalized.autoReinvest,
    dailyBonus: normalized.dailyBonus,
    perks: normalized.perks,
  }
}

export function getDefaultVipTierRows() {
  return [1, 2, 3, 4, 5].map((level) => {
    const tier = normalizeVipTierConfig(level, {})
    return {
      level: tier.level,
      title: tier.title,
      minDeposit: tier.minDeposit,
      minTeamVolume: tier.minTeamVolume,
      minReferrals: tier.minReferrals,
      referralPercent: tier.referralPercent,
      dailyMiningPercent: tier.dailyMiningPercent,
      miningSpeedPercent: tier.miningSpeedPercent,
      dailyWithdrawalLimit: tier.dailyWithdrawalLimit,
      processingHoursMin: tier.processingHoursMin,
      processingHoursMax: tier.processingHoursMax,
      withdrawalFeePercent: tier.withdrawalFeePercent,
      activeExtraFeePercent: tier.activeExtraFeePercent,
      level2ReferralPercent: tier.level2ReferralPercent,
      level3ReferralPercent: tier.level3ReferralPercent,
      profitMultiplier: tier.profitMultiplier,
      autoReinvest: tier.autoReinvest,
      dailyBonus: tier.dailyBonus,
      perks: [...tier.perks],
    }
  })
}

export function resolveVipMetricsProgress(current, target) {
  const currentValue = Math.max(0, toNumber(current, 0))
  const targetValue = Math.max(0, toNumber(target, 0))
  if (targetValue <= 0) return 100
  return Math.max(0, Math.min(100, Number(((currentValue / targetValue) * 100).toFixed(2))))
}
