import { BadgeCheck, Clock3, ShieldAlert } from 'lucide-react'

type VerificationStatusNoteProps = {
  status?: string | null
  className?: string
}

export function VerificationStatusNote({
  status,
  className = '',
}: VerificationStatusNoteProps) {
  const normalized = String(status || '').trim().toLowerCase()
  const state =
    normalized === 'verified'
      ? 'verified'
      : normalized === 'pending'
        ? 'pending'
        : 'unverified'

  const Icon = state === 'verified' ? BadgeCheck : state === 'pending' ? Clock3 : ShieldAlert
  const valueLabel =
    state === 'verified'
      ? 'التحقق معتمد'
      : state === 'pending'
        ? 'التحقق قيد المراجعة'
        : 'التحقق غير معتمد'

  return (
    <div className={`verification-status-note verification-status-note-${state} ${className}`.trim()}>
      <span className="verification-status-note-icon">
        <Icon size={14} />
      </span>
      <span className="verification-status-note-label">حالة الاعتماد</span>
      <span className="verification-status-note-separator" />
      <span className="verification-status-note-value">{valueLabel}</span>
    </div>
  )
}
