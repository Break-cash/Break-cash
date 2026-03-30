import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BadgeCheck, Clock3, Headset, ImagePlus, LifeBuoy, Mail, MessageSquareText, Paperclip, ShieldCheck, Trash2 } from 'lucide-react'
import {
  archiveSupportTicket,
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketDetail,
  sendSupportTicketMessage,
  type SupportMessageAttachment,
  type SupportTicketDetail,
  type SupportTicketItem,
} from '../api'
import { useI18n } from '../i18nCore'

const SUPPORT_EMAIL = 'support@breakcash.cash'

function statusTone(status: string) {
  if (status === 'resolved' || status === 'closed') return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
  if (status === 'in_progress') return 'border-amber-400/30 bg-amber-500/10 text-amber-200'
  return 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue'
}

function formatLocalDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function fileSizeLabel(bytes?: number) {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return ''
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  if (value >= 1024) return `${Math.round(value / 1024)} KB`
  return `${value} B`
}

function AttachmentList({ attachments }: { attachments: SupportMessageAttachment[] }) {
  if (!attachments.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((file) => {
        const isImage = String(file.mime_type || '').startsWith('image/')
        return (
          <a
            key={file.id}
            href={file.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 transition hover:bg-white/10"
          >
            {isImage ? <ImagePlus size={14} /> : <Paperclip size={14} />}
            <span>{file.original_name || 'attachment'}</span>
            <span className="text-white/45">{fileSizeLabel(file.byte_size)}</span>
          </a>
        )
      })}
    </div>
  )
}

export function SupportPage() {
  const { t } = useI18n()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [reply, setReply] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [items, setItems] = useState<SupportTicketItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<SupportTicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingReply, setSendingReply] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadTickets(preferredId?: number | null) {
    setLoading(true)
    try {
      const res = await getMySupportTickets()
      const nextItems = res.items || []
      setItems(nextItems)
      const targetId = preferredId ?? selectedId ?? nextItems[0]?.id ?? null
      setSelectedId(targetId)
      if (targetId) {
        await loadTicketDetail(targetId)
      } else {
        setSelected(null)
      }
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : t('support_load_failed') })
      setItems([])
      setSelected(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadTicketDetail(ticketId: number) {
    setDetailLoading(true)
    try {
      const res = await getSupportTicketDetail(ticketId)
      setSelected(res.item || null)
    } catch (e) {
      setSelected(null)
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : t('support_load_failed') })
    } finally {
      setDetailLoading(false)
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
      const res = await createSupportTicket({ subject, message, attachments: files })
      setSubject('')
      setMessage('')
      setFiles([])
      setFeedback({ type: 'success', text: 'تم إرسال طلب المساعدة ووصل إلى فريق الدعم.' })
      await loadTickets(res.item?.id || null)
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : t('support_submit_failed') })
    } finally {
      setSaving(false)
    }
  }

  async function handleReplySubmit(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) return
    setSendingReply(true)
    setFeedback(null)
    try {
      const res = await sendSupportTicketMessage({ ticketId: selectedId, message: reply, attachments: replyFiles })
      setReply('')
      setReplyFiles([])
      setSelected(res.item)
      await loadTickets(selectedId)
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'تعذر إرسال الرسالة إلى الدعم.' })
    } finally {
      setSendingReply(false)
    }
  }

  async function handleArchive() {
    if (!selectedId) return
    setArchiving(true)
    setFeedback(null)
    try {
      await archiveSupportTicket(selectedId)
      setSelected(null)
      setSelectedId(null)
      setFeedback({ type: 'success', text: 'تمت إزالة المحادثة من واجهتك مع بقائها مؤرشفة لدى النظام.' })
      await loadTickets(null)
    } catch (e) {
      setFeedback({ type: 'error', text: e instanceof Error ? e.message : 'تعذر أرشفة المحادثة.' })
    } finally {
      setArchiving(false)
    }
  }

  const selectedSummary = useMemo(
    () => items.find((item) => Number(item.id) === Number(selectedId || 0)) || null,
    [items, selectedId],
  )

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
            <h1 className="text-3xl font-black tracking-tight text-white">مركز المساعدة</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
              أرسل طلب مساعدة مع صور أو مرفقات، وسيصل مباشرة إلى المشرفين والمالك. بعد اعتماد الرد تُفتح محادثة محفوظة بينك وبين فريق الدعم.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
              <Mail size={14} />
              <span>{SUPPORT_EMAIL}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <Headset size={14} />
                <span>مراسلة مباشرة</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">طلب دعم مع مرفقات</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <ShieldCheck size={14} />
                <span>اعتماد الرد</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">المحادثة تُفتح بعد موافقة المشرف</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <LifeBuoy size={14} />
                <span>السجل</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">{items.length} طلب محفوظ</div>
            </div>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className={feedback.type === 'success' ? 'login-success' : 'login-error'}>
          {feedback.text}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="elite-panel rounded-[24px] p-4">
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200">
                <MessageSquareText size={18} />
              </span>
              <div>
                <div className="text-sm font-semibold text-white">مراسلة الدعم</div>
                <div className="text-xs text-app-muted">يمكنك إرفاق صور للمشكلة أو مستندات مساعدة مع الطلب.</div>
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
              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.05]">
                <Paperclip size={16} />
                <span>إضافة صور أو مرفقات</span>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 4))}
                />
              </label>
              {files.length > 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-app-muted">
                  {files.map((file) => (
                    <div key={`${file.name}-${file.size}`}>{file.name}</div>
                  ))}
                </div>
              ) : null}
              <button className="login-submit h-11 px-5" type="submit" disabled={saving || !subject.trim() || !message.trim()}>
                {saving ? t('common_loading') : 'إرسال طلب المساعدة'}
              </button>
            </form>
          </section>

          <section className="elite-panel rounded-[24px] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">طلباتك</div>
              <div className="text-xs text-app-muted">{loading ? t('common_loading') : `${items.length} تذكرة`}</div>
            </div>
            {loading ? (
              <div className="text-sm text-app-muted">{t('common_loading')}</div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-sm text-app-muted">{t('support_empty')}</div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id)
                      loadTicketDetail(item.id).catch(() => {})
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      Number(selectedId) === Number(item.id)
                        ? 'border-brand-blue/40 bg-brand-blue/10'
                        : 'border-app-border bg-app-elevated hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{item.subject}</div>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-app-muted">
                      #{item.id} • {formatLocalDate(item.latest_message_at || item.created_at)}
                    </div>
                    <div className="mt-2 text-xs text-white/65">
                      {item.conversation_enabled ? 'المحادثة مفتوحة' : 'بانتظار اعتماد الرد من الدعم'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="elite-panel rounded-[24px] p-4">
          {!selectedId && !selectedSummary ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-sm text-app-muted">
              اختر طلب دعم من القائمة أو أنشئ طلبًا جديدًا لبدء المتابعة.
            </div>
          ) : detailLoading ? (
            <div className="text-sm text-app-muted">{t('common_loading')}</div>
          ) : !selected ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-sm text-app-muted">
              تعذر تحميل تفاصيل المحادثة.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{selected.subject}</div>
                  <div className="mt-1 text-xs text-app-muted">
                    #{selected.id} • {formatLocalDate(selected.created_at)}
                  </div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(selected.status)}`}>
                  {statusLabel(selected.status)}
                </span>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                {selected.conversation_enabled ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-300">
                    <BadgeCheck size={16} />
                    <span>تم اعتماد المحادثة ويمكنك الآن مراسلة الدعم مباشرة.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-200">
                    <Clock3 size={16} />
                    <span>تم إرسال طلبك إلى المشرفين والمالك. ستفتح المحادثة بعد اعتماد الرد.</span>
                  </div>
                )}
                {selected.archive_eligible_at ? (
                  <div className="mt-2 text-xs text-app-muted">
                    يمكن أرشفة المحادثة من جهتك بعد: {formatLocalDate(selected.archive_eligible_at)}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3">
                {selected.messages.map((item) => {
                  const isUser = item.sender_role === 'user'
                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-4 ${
                        isUser
                          ? 'ml-auto border-brand-blue/25 bg-brand-blue/10'
                          : 'mr-auto border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-white/75">
                          {isUser ? 'أنت' : item.sender_display_name || 'الدعم'}
                        </div>
                        <div className="text-[11px] text-white/45">{formatLocalDate(item.created_at)}</div>
                      </div>
                      {item.body ? (
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/90">{item.body}</div>
                      ) : null}
                      <AttachmentList attachments={item.attachments || []} />
                    </div>
                  )
                })}
              </div>

              {selected.conversation_enabled ? (
                <form className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4" onSubmit={handleReplySubmit}>
                  <div className="text-sm font-semibold text-white">مراسلة الدعم</div>
                  <textarea
                    className="field-input min-h-[140px] resize-y"
                    placeholder="اكتب تفاصيلك الإضافية هنا..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    maxLength={6000}
                  />
                  <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.05]">
                    <Paperclip size={16} />
                    <span>إرفاق ملفات مع الرد</span>
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => setReplyFiles(Array.from(e.target.files || []).slice(0, 4))}
                    />
                  </label>
                  {replyFiles.length > 0 ? (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-app-muted">
                      {replyFiles.map((file) => (
                        <div key={`${file.name}-${file.size}`}>{file.name}</div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="login-submit h-11 px-5" type="submit" disabled={sendingReply || (!reply.trim() && replyFiles.length === 0)}>
                      {sendingReply ? t('common_loading') : 'إرسال الرسالة'}
                    </button>
                    {selected.can_user_archive ? (
                      <button
                        type="button"
                        onClick={handleArchive}
                        disabled={archiving}
                        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white/85 transition hover:bg-white/[0.06]"
                      >
                        <Trash2 size={15} />
                        <span>{archiving ? t('common_loading') : 'حذف من جهتي'}</span>
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : null}
            </div>
          )}
        </section>
      </section>
    </div>
  )
}
