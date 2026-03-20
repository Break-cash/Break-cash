const VIP_RULES = Object.freeze({
  0: Object.freeze({
    level: 0,
    title: 'Base',
    minDeposit: 0,
    minReferrals: 0,
    minTeamVolume: 0,
    referralPercent: 3,
    dailyMiningPercent: 1.0,
    miningSpeedPercent: 0,
    dailyWithdrawalLimit: 100,
    processingHoursMin: 72,
    processingHoursMax: 72,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 5,
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
    referralPercent: 4,
    dailyMiningPercent: 1.2,
    miningSpeedPercent: 0,
    dailyWithdrawalLimit: 200,
    processingHoursMin: 72,
    processingHoursMax: 72,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 5,
    level2ReferralPercent: 0,
    level3ReferralPercent: 0,
    profitMultiplier: 1,
    autoReinvest: false,
    dailyBonus: false,
    perks: [
      'عائد التعدين 1.2٪ يومياً بسرعة أساسية.',
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
    referralPercent: 5,
    dailyMiningPercent: 1.4,
    miningSpeedPercent: 15,
    dailyWithdrawalLimit: 400,
    processingHoursMin: 48,
    processingHoursMax: 72,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 5,
    level2ReferralPercent: 0,
    level3ReferralPercent: 0,
    profitMultiplier: 1,
    autoReinvest: false,
    dailyBonus: false,
    perks: [
      'عائد التعدين 1.4٪ يومياً وسرعة +15٪.',
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
    referralPercent: 6,
    dailyMiningPercent: 1.7,
    miningSpeedPercent: 30,
    dailyWithdrawalLimit: 700,
    processingHoursMin: 36,
    processingHoursMax: 48,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 5,
    level2ReferralPercent: 2,
    level3ReferralPercent: 0,
    profitMultiplier: 1,
    autoReinvest: true,
    dailyBonus: false,
    perks: [
      'عائد التعدين 1.7٪ يومياً وسرعة +30٪.',
      'نسبة الإحالة المباشرة 6٪ وعمولة مستوى ثانٍ 2٪.',
      'المطلوب 15 محالاً وحجم فريق 7000$.',
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
    referralPercent: 7,
    dailyMiningPercent: 2.0,
    miningSpeedPercent: 45,
    dailyWithdrawalLimit: 1100,
    processingHoursMin: 24,
    processingHoursMax: 36,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 5,
    level2ReferralPercent: 3,
    level3ReferralPercent: 1,
    profitMultiplier: 1,
    autoReinvest: false,
    dailyBonus: false,
    perks: [
      'عائد التعدين 2.0٪ يومياً وسرعة +45٪.',
      'نسبة الإحالة المباشرة 7٪ وعمولة مستوى ثانٍ 3٪ ومستوى ثالث 1٪.',
      'المطلوب 40 محالاً وحجم فريق 20000$.',
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
    referralPercent: 8,
    dailyMiningPercent: 2.5,
    miningSpeedPercent: 60,
    dailyWithdrawalLimit: 2000,
    processingHoursMin: 12,
    processingHoursMax: 24,
    withdrawalFeePercent: 10,
    activeExtraFeePercent: 5,
    level2ReferralPercent: 4,
    level3ReferralPercent: 2,
    profitMultiplier: 1.5,
    autoReinvest: false,
    dailyBonus: true,
    perks: [
      'عائد التعدين 2.5٪ يومياً وسرعة +60٪.',
      'نسبة الإحالة المباشرة 8٪ وعمولة مستوى ثانٍ 4٪ ومستوى ثالث 2٪.',
      'المطلوب 100+ محال وحجم فريق 50000$.',
      'حد السحب اليومي 2000$.',
      'مدة المعالجة 12 - 24 ساعة وسحب سريع جداً.',
      'بونص يومي ومضاعف أرباح ×1.5.',
    ],
  }),
})

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function getVipRuntimeRules(level) {
  const safeLevel = Math.max(0, Math.min(5, Number(level || 0)))
  return VIP_RULES[safeLevel] || VIP_RULES[0]
}

export function getDefaultVipTierRows() {
  return [1, 2, 3, 4, 5].map((level) => {
    const tier = getVipRuntimeRules(level)
    return {
      level: tier.level,
      title: tier.title,
      minDeposit: tier.minDeposit,
      minTeamVolume: tier.minTeamVolume,
      minReferrals: tier.minReferrals,
      referralPercent: tier.referralPercent,
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
