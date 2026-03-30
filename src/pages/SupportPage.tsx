import { useEffect, useState, type FormEvent } from 'react'
import { BadgeCheck, Headset, LifeBuoy, Mail, MessageSquareText, ShieldCheck } from 'lucide-react'
import { createSupportTicket, getMySupportTickets, type SupportTicketItem } from '../api'
import { useI18n } from '../i18nCore'

const SUPPORT_EMAIL = 'support@breakcash.cash'

function statusTone(status: string) {
  if (status === 'resolved' || status === 'closed') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'in_progress') return 'border-amber-400/30 bg-amber-500/10 text-amber-200'
  return 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue'
}

export function SupportPage() {
  const { t } = useI18n()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [items, setItems] = useState<SupportTicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadTickets() {
    setLoading(true)
    try {
      const res = await getMySupportTickets()
      setItems(res.items || [])
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : t('support_load_failed') })
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTickets().catch(() => {})
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setFeedback(null)
    try {
      await createSupportTicket({ subject, message })
      setSubject('')
      setMessage('')
      setFeedback({ type: 'success', text: t('support_submit_success') })
      await loadTickets()
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : t('support_submit_failed') })
    } finally {
      setSaving(false)
    }
  }

  function statusLabel(status: string) {
    switch (status) {
      case 'resolved':
        return t('support_status_resolved')
      case 'closed':
        return t('support_status_closed')
      case 'in_progress':
        return t('support_status_in_progress')
      default:
        return t('support_status_open')
    }
  }

  return (
    <div className="page space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-brand-blue/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),linear-gradient(140deg,rgba(6,13,24,0.96),rgba(9,17,30,0.92))] p-5 shadow-[0_22px_52px_rgba(2,8,20,0.32)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
          <BadgeCheck size={14} />
          <span>الدعم الرسمي</span>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_320px] lg:items-start">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">{t('support_page_title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">{t('support_page_subtitle')}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
              <Mail size={14} />
              <span>{SUPPORT_EMAIL}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <Headset size={14} />
                <span>قناة مباشرة</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">مراسلة من داخل التطبيق</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <ShieldCheck size={14} />
                <span>المتابعة</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">حالات واضحة لكل تذكرة</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <LifeBuoy size={14} />
                <span>السجل</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">{items.length} طلب دعم محفوظ</div>
            </div>
          </div>
        </div>
      </section>

      <section className="elite-panel rounded-[24px] p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200">
            <MessageSquareText size={18} />
          </span>
          <div>
            <div className="text-sm font-semibold text-white">{t('support_new_ticket')}</div>
            <div className="text-xs text-app-muted">اكتب موضوعًا واضحًا ورسالة مختصرة لتسريع المتابعة.</div>
          </div>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            className="field-input"
            placeholder={t('support_subject')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={160}
          />
          <textarea
            className="field-input min-h-[160px] resize-y"
            placeholder={t('support_message')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
          />
          <button className="login-submit h-11 px-5" type="submit" disabled={saving || !subject.trim() || !message.trim()}>
            {saving ? t('common_loading') : t('support_send')}
          </button>
        </form>
        {feedback ? (
          <div className={feedback.type === 'success' ? 'login-success mt-3' : 'login-error mt-3'}>
            {feedback.text}
          </div>
        ) : null}
      </section>

      <section className="elite-panel rounded-[24px] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white">{t('support_my_tickets')}</div>
          <div className="text-xs text-app-muted">{loading ? t('common_loading') : `${items.length} تذكرة`}</div>
        </div>
        {loading ? (
          <div className="text-sm text-app-muted">{t('common_loading')}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-sm text-app-muted">{t('support_empty')}</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-app-border bg-app-elevated p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{item.subject}</div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/85">{item.message}</div>
                <div className="mt-3 text-xs text-app-muted">
                  #{item.id} • {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
