import type { AdminUserProfilePayload } from '../../api'

type AdminUserKycDepositsPanelProps = {
  profile: AdminUserProfilePayload | null
  className?: string
}

function formatMetaDate(value?: string | null) {
  if (!value) return '—'
  const parsed = Date.parse(String(value))
  if (Number.isNaN(parsed)) return String(value)
  return new Date(parsed).toLocaleString('ar')
}

export function AdminUserKycDepositsPanel({ profile, className = '' }: AdminUserKycDepositsPanelProps) {
  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <div className="rounded-xl border border-app-border bg-app-elevated p-3">
        <div className="mb-2 text-sm font-semibold text-white">طلبات التحقق الأخيرة</div>
        {(profile?.kyc_submissions || []).length ? (
          <div className="space-y-2">
            {profile!.kyc_submissions.map((row) => (
              <div key={row.id} className="rounded-lg border border-white/8 bg-app-card p-2 text-xs text-white/80">
                <div className="flex flex-wrap items-center gap-2">
                  <span>#{row.id}</span>
                  <span>الحالة: {row.review_status || 'pending'}</span>
                  <span>{formatMetaDate(row.created_at)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-white/60">
                  <span>AML: {row.aml_risk_level || '—'}</span>
                  <span>Face: {row.face_match_score ?? '—'}</span>
                  <span>Name: {row.full_name_match_score ?? '—'}</span>
                </div>
                {row.rejection_reason ? <div className="mt-1 text-rose-300">الرفض: {row.rejection_reason}</div> : null}
                {row.reviewed_note ? <div className="mt-1 text-amber-200">ملاحظة: {row.reviewed_note}</div> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.id_document_url ? (
                    <a className="wallet-action-btn owner-set-btn text-xs" href={row.id_document_url} target="_blank" rel="noreferrer">
                      صورة الهوية
                    </a>
                  ) : null}
                  {row.selfie_url ? (
                    <a className="wallet-action-btn owner-set-btn text-xs" href={row.selfie_url} target="_blank" rel="noreferrer">
                      صورة السيلفي
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-app-muted">لا توجد طلبات تحقق محفوظة لهذا المستخدم.</div>
        )}
      </div>

      <div className="rounded-xl border border-app-border bg-app-elevated p-3">
        <div className="mb-2 text-sm font-semibold text-white">طلبات الإيداع الأخيرة</div>
        {(profile?.deposit_requests || []).length ? (
          <div className="space-y-2">
            {profile!.deposit_requests.map((row) => (
              <div key={row.id} className="rounded-lg border border-white/8 bg-app-card p-2 text-xs text-white/80">
                <div className="flex flex-wrap items-center gap-2">
                  <span>#{row.id}</span>
                  <span>
                    {Number(row.amount || 0).toFixed(2)} {row.currency || 'USDT'}
                  </span>
                  <span>الحالة: {row.request_status || 'pending'}</span>
                  <span>{formatMetaDate(row.created_at)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-white/60">
                  <span>الطريقة: {row.method || '—'}</span>
                  <span>المرجع: {row.transfer_ref || '—'}</span>
                </div>
                {row.user_notes ? <div className="mt-1 text-white/70">ملاحظة المستخدم: {row.user_notes}</div> : null}
                {row.admin_note ? <div className="mt-1 text-amber-200">ملاحظة الإدارة: {row.admin_note}</div> : null}
                {row.proof_image_url ? (
                  <div className="mt-2">
                    <a className="wallet-action-btn owner-set-btn text-xs" href={row.proof_image_url} target="_blank" rel="noreferrer">
                      عرض إثبات الإيداع
                    </a>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-app-muted">لا توجد طلبات إيداع محفوظة لهذا المستخدم.</div>
        )}
      </div>
    </div>
  )
}
