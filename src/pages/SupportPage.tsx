import { useEffect, useState, type FormEvent } from 'react'
import { createSupportTicket, getMySupportTickets, type SupportTicketItem } from '../api'
import { useI18n } from '../i18nCore'

const SUPPORT_EMAIL = 'support@breakcash.cash'

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
      <section className="elite-panel p-4">
        <h1 className="page-title mb-2">{t('support_page_title')}</h1>
        <p className="text-sm text-app-muted">{t('support_page_subtitle')}</p>
        <p className="mt-2 text-xs text-brand-blue">{SUPPORT_EMAIL}</p>
      </section>

      <section className="elite-panel p-4">
        <div className="mb-3 text-sm font-semibold text-white">{t('support_new_ticket')}</div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            className="field-input"
            placeholder={t('support_subject')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={160}
          />
          <textarea
            className="field-input min-h-[140px] resize-y"
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

      <section className="elite-panel p-4">
        <div className="mb-3 text-sm font-semibold text-white">{t('support_my_tickets')}</div>
        {loading ? (
          <div className="text-sm text-app-muted">{t('common_loading')}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-app-muted">{t('support_empty')}</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-app-border bg-app-elevated p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{item.subject}</div>
                  <span className="rounded-full border border-brand-blue/30 bg-brand-blue/10 px-2.5 py-1 text-[11px] text-brand-blue">
                    {statusLabel(item.status)}
                  </span>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-white/85">{item.message}</div>
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
