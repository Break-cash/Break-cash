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
  const label =
    state === 'verified'
      ? 'تم اعتماد التحقق لهذا الحساب'
      : state === 'pending'
        ? 'طلب التحقق قيد المراجعة والاعتماد'
        : 'لم يتم اعتماد التحقق لهذا الحساب بعد'

  return (
    <div className={`verification-status-note verification-status-note-${state} ${className}`.trim()}>
      <span className="verification-status-note-icon">
        <Icon size={14} />
      </span>
      <span>{label}</span>
    </div>
  )
}
