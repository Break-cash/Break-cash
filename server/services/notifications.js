import { get, run } from '../db.js'
import { publishLiveUpdate } from './live-updates.js'

function normalizeLanguage(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw.startsWith('ar')) return 'ar'
  if (raw.startsWith('tr')) return 'tr'
  return 'en'
}

function formatAmount(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '0'
  return amount.toFixed(2)
}

const notificationTemplates = {
  referral_reward: {
    en: {
      title: 'Referral Reward',
      body: ({ amount, currency }) => `You earned ${formatAmount(amount)} ${currency} from a referral first deposit.`,
    },
    ar: {
      title: 'مكافأة إحالة',
      body: ({ amount, currency }) => `ربحت ${formatAmount(amount)} ${currency} من أول إيداع للإحالة.`,
    },
    tr: {
      title: 'Referans Odulu',
      body: ({ amount, currency }) => `Referansinizin ilk yatirimindan ${formatAmount(amount)} ${currency} kazandiniz.`,
    },
  },
  deposit_approved: {
    en: {
      title: 'Deposit Approved',
      body: ({ requestId }) => `Your deposit request #${requestId} has been approved.`,
    },
    ar: {
      title: 'تمت الموافقة على الإيداع',
      body: ({ requestId }) => `تمت الموافقة على طلب الإيداع رقم #${requestId}.`,
    },
    tr: {
      title: 'Yatirim Onaylandi',
      body: ({ requestId }) => `#${requestId} numarali yatirim talebiniz onaylandi.`,
    },
  },
  withdrawal_approved: {
    en: {
      title: 'Withdrawal Approved',
      body: ({ requestId }) => `Your withdrawal request #${requestId} has been approved.`,
    },
    ar: {
      title: 'تمت الموافقة على السحب',
      body: ({ requestId }) => `تمت الموافقة على طلب السحب رقم #${requestId}.`,
    },
    tr: {
      title: 'Cekim Onaylandi',
      body: ({ requestId }) => `#${requestId} numarali cekim talebiniz onaylandi.`,
    },
  },
  withdrawal_completed: {
    en: {
      title: 'Withdrawal Completed',
      body: ({ requestId }) => `Your withdrawal request #${requestId} has been completed.`,
    },
    ar: {
      title: 'اكتمل السحب',
      body: ({ requestId }) => `اكتمل تنفيذ طلب السحب رقم #${requestId}.`,
    },
    tr: {
      title: 'Cekim Tamamlandi',
      body: ({ requestId }) => `#${requestId} numarali cekim talebiniz tamamlandi.`,
    },
  },
  balance_adjusted: {
    en: {
      title: 'Balance Updated',
      body: ({ currency, amount, operation }) => `Your ${currency} balance was ${operation} by ${formatAmount(amount)}.`,
    },
    ar: {
      title: 'تم تحديث الرصيد',
      body: ({ currency, amount, operation }) =>
        operation === 'deducted'
          ? `تم خصم ${formatAmount(amount)} ${currency} من رصيدك.`
          : `تمت إضافة ${formatAmount(amount)} ${currency} إلى رصيدك.`,
    },
    tr: {
      title: 'Bakiye Guncellendi',
      body: ({ currency, amount, operation }) =>
        operation === 'deducted'
          ? `Bakiyenizden ${formatAmount(amount)} ${currency} dusuldu.`
          : `Bakiyenize ${formatAmount(amount)} ${currency} eklendi.`,
    },
  },
  balance_set: {
    en: {
      title: 'Balance Updated',
      body: ({ currency, amount }) => `Your ${currency} balance was set to ${formatAmount(amount)}.`,
    },
    ar: {
      title: 'تم تحديث الرصيد',
      body: ({ currency, amount }) => `تم ضبط رصيدك من ${currency} إلى ${formatAmount(amount)}.`,
    },
    tr: {
      title: 'Bakiye Guncellendi',
      body: ({ currency, amount }) => `${currency} bakiyeniz ${formatAmount(amount)} olarak ayarlandi.`,
    },
  },
  mining_subscription_active: {
    en: {
      title: 'Mining Subscription Active',
      body: ({ amount, currency }) => `Your mining subscription is active with ${formatAmount(amount)} ${currency}.`,
    },
    ar: {
      title: 'تم تفعيل اشتراك التعدين',
      body: ({ amount, currency }) => `تم تفعيل اشتراك التعدين بمبلغ ${formatAmount(amount)} ${currency}.`,
    },
    tr: {
      title: 'Madencilik Aboneligi Aktif',
      body: ({ amount, currency }) => `Madencilik aboneliginiz ${formatAmount(amount)} ${currency} ile aktif edildi.`,
    },
  },
  task_reward_activated: {
    en: {
      title: 'Task Reward Activated',
      body: ({ code, amount, currency }) => `Code ${code} applied successfully. Bonus +${formatAmount(amount)} ${currency}.`,
    },
    ar: {
      title: 'تم تفعيل مكافأة المهام',
      body: ({ code, amount, currency }) => `تم تفعيل الكود ${code} بنجاح. أضيفت مكافأة +${formatAmount(amount)} ${currency}.`,
    },
    tr: {
      title: 'Gorev Odulu Etkinlestirildi',
      body: ({ code, amount, currency }) => `${code} kodu basariyla uygulandi. Bonus +${formatAmount(amount)} ${currency}.`,
    },
  },
  strategy_trade_activated: {
    en: {
      title: 'Strategy Trade Activated',
      body: ({ code, amount, currency }) => `Code ${code} activated. ${formatAmount(amount)} ${currency} was reserved for your strategy trade.`,
    },
    ar: {
      title: 'تم تفعيل صفقة الاستراتيجية',
      body: ({ code, amount, currency }) => `تم تفعيل الكود ${code}. تم حجز ${formatAmount(amount)} ${currency} لصفقة الاستراتيجية الخاصة بك.`,
    },
    tr: {
      title: 'Strateji Islemi Etkinlestirildi',
      body: ({ code, amount, currency }) => `${code} kodu etkinlestirildi. Strateji isleminiz icin ${formatAmount(amount)} ${currency} ayrildi.`,
    },
  },
  strategy_bonus_activated: {
    en: {
      title: 'Strategy Bonus Activated',
      body: ({ code, amount, currency }) => `Code ${code} applied successfully. Promotional bonus +${formatAmount(amount)} ${currency}.`,
    },
    ar: {
      title: 'تم تفعيل مكافأة الاستراتيجية',
      body: ({ code, amount, currency }) => `تم تفعيل الكود ${code} بنجاح. أضيفت مكافأة ترويجية +${formatAmount(amount)} ${currency}.`,
    },
    tr: {
      title: 'Strateji Bonusu Etkinlestirildi',
      body: ({ code, amount, currency }) => `${code} kodu basariyla uygulandi. Promosyon bonunuz +${formatAmount(amount)} ${currency}.`,
    },
  },
  strategy_trade_settled: {
    en: {
      title: 'Strategy Trade Settled',
      body: ({ amount, currency }) => `Your strategy trade closed successfully. Returned ${formatAmount(amount)} ${currency}.`,
    },
    ar: {
      title: 'أغلقت صفقة الاستراتيجية',
      body: ({ amount, currency }) => `أغلقت صفقة الاستراتيجية بنجاح. تمت إعادة ${formatAmount(amount)} ${currency} إلى رصيدك.`,
    },
    tr: {
      title: 'Strateji Islemi Sonuclandi',
      body: ({ amount, currency }) => `Strateji isleminiz basariyla kapandi. ${formatAmount(amount)} ${currency} bakiyenize iade edildi.`,
    },
  },
  first_deposit_bonus: {
    en: {
      title: 'First Deposit Bonus',
      body: ({ amount, currency }) => `Your first deposit bonus has been added: +${formatAmount(amount)} ${currency}.`,
    },
    ar: {
      title: 'مكافأة أول إيداع',
      body: ({ amount, currency }) => `تمت إضافة مكافأة أول إيداع إلى حسابك: +${formatAmount(amount)} ${currency}.`,
    },
    tr: {
      title: 'Ilk Yatirim Bonusu',
      body: ({ amount, currency }) => `Ilk yatirim bonusunuz hesabınıza eklendi: +${formatAmount(amount)} ${currency}.`,
    },
  },
}

async function getUserNotificationLanguage(db, userId) {
  const row = await get(db, `SELECT preferred_language FROM users WHERE id = ? LIMIT 1`, [userId])
  return normalizeLanguage(row?.preferred_language)
}

export async function createLocalizedNotification(db, userId, key, variables = {}) {
  const template = notificationTemplates[key]
  if (!template) throw new Error(`UNKNOWN_NOTIFICATION_TEMPLATE:${key}`)
  const language = await getUserNotificationLanguage(db, userId)
  const localized = template[language] || template.en
  const title = String(localized.title || '').trim()
  const body = String(typeof localized.body === 'function' ? localized.body(variables) : localized.body || '').trim()
  await run(db, `INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)`, [userId, title, body])
  publishLiveUpdate({
    type: 'notification_created',
    scope: 'user',
    userId,
    source: 'notifications',
    key,
    title,
    body,
  })
  return { title, body, key }
}
