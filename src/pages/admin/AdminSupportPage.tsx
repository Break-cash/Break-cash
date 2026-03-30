import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BadgeCheck, CheckCheck, Clock3, Paperclip, ShieldCheck } from 'lucide-react'
import {
  approveSupportConversation,
  getAdminSupportTicketDetail,
  getAdminSupportTickets,
  sendAdminSupportMessage,
  updateSupportTicketStatus,
  type SupportAdminTicketListItem,
  type SupportTicketDetail,
} from '../../api'

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

export function AdminSupportPage() {
  const [items, setItems] = useState<SupportAdminTicketListItem[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<SupportTicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [savingApproval, setSavingApproval] = useState(false)
  const [savingReply, setSavingReply] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [reply, setReply] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadItems(preferredId?: number | null) {
    setLoading(true)
    try {
      const res = await getAdminSupportTickets()
      const nextItems = res.items || []
      setItems(nextItems)
      const targetId = preferredId ?? selectedId ?? nextItems[0]?.id ?? null
      setSelectedId(targetId)
      if (targetId) {
        await loadDetail(targetId)
      } else {
        setSelected(null)
      }
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تحميل طلبات الدعم.' })
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(ticketId: number) {
    setDetailLoading(true)
    try {
      const res = await getAdminSupportTicketDetail(ticketId)
      setSelected(res.item || null)
    } catch (error) {
      setSelected(null)
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تحميل المحادثة.' })
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    loadItems().catch(() => {})
  }, [])

  const selectedSummary = useMemo(
    () => items.find((item) => Number(item.id) === Number(selectedId || 0)) || null,
    [items, selectedId],
  )

  async function handleApproveConversation() {
    if (!selectedId) return
    setSavingApproval(true)
    setFeedback(null)
    try {
      const res = await approveSupportConversation(selectedId)
      setSelected(res.item)
      setFeedback({ type: 'success', text: 'تم اعتماد فتح المحادثة للمستخدم.' })
      await loadItems(selectedId)
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'تعذر اعتماد المحادثة.' })
    } finally {
      setSavingApproval(false)
    }
  }

  async function handleReplySubmit(event: FormEvent) {
    event.preventDefault()
    if (!selectedId) return
    setSavingReply(true)
    setFeedback(null)
    try {
      const res = await sendAdminSupportMessage({ ticketId: selectedId, message: reply, attachments: replyFiles })
      setReply('')
      setReplyFiles([])
      setSelected(res.item)
      await loadItems(selectedId)
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'تعذر إرسال الرد.' })
    } finally {
      setSavingReply(false)
    }
  }

  async function handleStatusChange(status: string) {
    if (!selectedId) return
    setStatusBusy(true)
    setFeedback(null)
    try {
      await updateSupportTicketStatus(selectedId, status)
      setFeedback({ type: 'success', text: 'تم تحديث حالة طلب الدعم.' })
      await loadItems(selectedId)
    } catch (error) {
      setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تحديث الحالة.' })
    } finally {
      setStatusBusy(false)
    }
  }

  return (
    <div className="page space-y-4">
      <section className="rounded-[28px] border border-brand-blue/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),linear-gradient(140deg,rgba(6,13,24,0.96),rgba(9,17,30,0.92))] p-5 shadow-[0_22px_52px_rgba(2,8,20,0.32)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
          <BadgeCheck size={14} />
          <span>إدارة الدعم</span>
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">محادثات مركز المساعدة</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
          راجع الطلبات الجديدة، اعتمد فتح المحادثة، ثم تابع الحوار مع المستخدم مع إبقاء السجل محفوظًا داخل النظام.
        </p>
      </section>

      {feedback ? (
        <div className={feedback.type === 'success' ? 'login-success' : 'login-error'}>
          {feedback.text}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="elite-panel rounded-[24px] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">الطلبات</div>
            <div className="text-xs text-app-muted">{loading ? '...' : `${items.length} طلب`}</div>
          </div>
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedId(item.id)
                  loadDetail(item.id).catch(() => {})
                }}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  Number(selectedId) === Number(item.id)
                    ? 'border-brand-blue/40 bg-brand-blue/10'
                    : 'border-app-border bg-app-elevated hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">{item.subject}</div>
                    <div className="mt-1 text-xs text-app-muted">
                      {item.display_name || item.email || item.phone || `#${item.user_id}`}
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(item.status)}`}>{item.status}</span>
                </div>
                <div className="mt-2 text-xs text-app-muted">
                  #{item.id} • {formatLocalDate(item.latest_message_at || item.created_at)} • {item.messages_count || 0} رسالة
                </div>
                <div className="mt-2 text-xs text-white/65">
                  {item.conversation_enabled ? 'المحادثة مفعلة' : 'بانتظار اعتماد فتح المحادثة'}
                </div>
              </button>
            ))}
            {!loading && items.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 text-sm text-app-muted">لا توجد طلبات دعم حالية.</div>
            ) : null}
          </div>
        </div>

        <div className="elite-panel rounded-[24px] p-4">
          {!selectedId && !selectedSummary ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-sm text-app-muted">اختر طلبًا من القائمة لعرض التفاصيل.</div>
          ) : detailLoading ? (
            <div className="text-sm text-app-muted">جارٍ تحميل المحادثة...</div>
          ) : !selected ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-sm text-app-muted">تعذر تحميل تفاصيل الطلب.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">{selected.subject}</div>
                  <div className="mt-1 text-xs text-app-muted">
                    #{selected.id} • {selected.user?.display_name || selected.user?.email || selected.user?.phone || `#${selected.user_id}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] ${statusTone(selected.status)}`}>{selected.status}</span>
                  {!selected.conversation_enabled ? (
                    <button type="button" onClick={handleApproveConversation} disabled={savingApproval} className="login-submit h-10 px-4 text-sm">
                      {savingApproval ? '...' : 'اعتماد فتح المحادثة'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['open', 'in_progress', 'resolved', 'closed'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusChange(status)}
                    disabled={statusBusy || selected.status === status}
                    className={`rounded-xl border px-3 py-2 text-xs transition ${
                      selected.status === status
                        ? 'border-brand-blue/40 bg-brand-blue/10 text-brand-blue'
                        : 'border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.05]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-white/85">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-400">
                  <ShieldCheck size={14} />
                  <span>حالة الاعتماد</span>
                </div>
                <div className="mt-2">
                  {selected.conversation_enabled ? (
                    <span className="inline-flex items-center gap-2 text-emerald-300">
                      <CheckCheck size={15} />
                      <span>المحادثة مفعّلة للمستخدم</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-amber-200">
                      <Clock3 size={15} />
                      <span>لم يتم اعتماد فتح المحادثة بعد</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {selected.messages.map((message) => {
                  const isSupport = message.sender_role !== 'user'
                  return (
                    <div
                      key={message.id}
                      className={`rounded-2xl border p-4 ${
                        isSupport ? 'ml-auto border-brand-blue/25 bg-brand-blue/10' : 'mr-auto border-white/10 bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-white/75">
                          {isSupport ? message.sender_display_name || 'فريق الدعم' : selected.user?.display_name || 'المستخدم'}
                        </div>
                        <div className="text-[11px] text-white/45">{formatLocalDate(message.created_at)}</div>
                      </div>
                      {message.body ? <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/90">{message.body}</div> : null}
                      {message.attachments?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {message.attachments.map((file) => (
                            <a key={file.id} href={file.file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85 hover:bg-white/10">
                              <Paperclip size={14} />
                              <span>{file.original_name || 'attachment'}</span>
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {selected.conversation_enabled ? (
                <form className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4" onSubmit={handleReplySubmit}>
                  <div className="text-sm font-semibold text-white">الرد على المستخدم</div>
                  <textarea
                    className="field-input min-h-[140px] resize-y"
                    placeholder="اكتب ردك هنا..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    maxLength={6000}
                  />
                  <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.05]">
                    <Paperclip size={16} />
                    <span>إرفاق ملفات مع الرد</span>
                    <input type="file" multiple className="hidden" onChange={(e) => setReplyFiles(Array.from(e.target.files || []).slice(0, 4))} />
                  </label>
                  {replyFiles.length > 0 ? (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-xs text-app-muted">
                      {replyFiles.map((file) => (
                        <div key={`${file.name}-${file.size}`}>{file.name}</div>
                      ))}
                    </div>
                  ) : null}
                  <button className="login-submit h-11 px-5" type="submit" disabled={savingReply || (!reply.trim() && replyFiles.length === 0)}>
                    {savingReply ? '...' : 'إرسال الرد'}
                  </button>
                </form>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
