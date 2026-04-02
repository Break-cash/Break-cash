import type { AdminDepositRequestRow, AdminKycSubmissionRow } from '../../api'

type Props = {
  kycSubmissions?: AdminKycSubmissionRow[] | null
  depositRequests?: AdminDepositRequestRow[] | null
}

export function AdminUserKycDepositsPanel({ kycSubmissions, depositRequests }: Props) {
  const kyc = kycSubmissions ?? []
  const deps = depositRequests ?? []

  return (
    <div className="space-y-3 rounded-xl border border-app-border bg-app-elevated p-3">
      <h3 className="text-sm font-semibold">سجلات التحقق (KYC)</h3>
      {kyc.length === 0 ? (
        <p className="text-xs text-app-muted">لا توجد طلبات تحقق مسجّلة لهذا الحساب.</p>
      ) : (
        <ul className="space-y-2">
          {kyc.map((row) => {
            const idPath = String(row.id_document_path || '').trim()
            const selfiePath = String(row.selfie_path || '').trim()
            return (
              <li key={row.id} className="rounded-lg border border-app-border/60 p-2 text-xs">
                <div className="font-medium">
                  طلب #{row.id} — {row.review_status}
                  {row.purged_at ? ' (ملفات محذوفة وفق الاحتفاظ)' : ''}
                </div>
                <div className="mt-1 text-app-muted">
                  {row.created_at ? `أُرسل: ${row.created_at}` : ''}
                  {row.reviewed_at ? ` · رُاجع: ${row.reviewed_at}` : ''}
                </div>
                {row.rejection_reason ? (
                  <div className="mt-1 text-amber-200/90">سبب الرفض: {row.rejection_reason}</div>
                ) : null}
                {row.purged_reason ? (
                  <div className="mt-1 text-app-muted">سبب التنظيف: {row.purged_reason}</div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  <div>
                    <div className="mb-0.5 text-app-muted">الهوية</div>
                    {idPath ? (
                      <a href={idPath} target="_blank" rel="noreferrer" className="inline-block">
                        <img
                          src={idPath}
                          alt=""
                          className="max-h-24 max-w-[140px] rounded border border-app-border object-contain"
                        />
                      </a>
                    ) : (
                      <span className="text-app-muted">لا ملف</span>
                    )}
                  </div>
                  <div>
                    <div className="mb-0.5 text-app-muted">السيلفي</div>
                    {selfiePath ? (
                      <a href={selfiePath} target="_blank" rel="noreferrer" className="inline-block">
                        <img
                          src={selfiePath}
                          alt=""
                          className="max-h-24 max-w-[140px] rounded border border-app-border object-contain"
                        />
                      </a>
                    ) : (
                      <span className="text-app-muted">لا ملف</span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <h3 className="text-sm font-semibold pt-1">آخر طلبات الإيداع والمرفقات</h3>
      {deps.length === 0 ? (
        <p className="text-xs text-app-muted">لا توجد طلبات إيداع مسجّلة.</p>
      ) : (
        <ul className="space-y-2">
          {deps.map((d) => {
            const proof = String(d.proof_image_path || '').trim()
            return (
              <li key={d.id} className="rounded-lg border border-app-border/60 p-2 text-xs">
                <div>
                  #{d.id} · {Number(d.amount).toFixed(2)} {d.currency} · {d.method} · الحالة: {d.request_status}
                </div>
                <div className="mt-0.5 text-app-muted">
                  مرجع: {d.transfer_ref || '—'}
                  {d.created_at ? ` · ${d.created_at}` : ''}
                </div>
                {d.user_notes ? <div className="mt-1">{d.user_notes}</div> : null}
                <div className="mt-2">
                  <span className="text-app-muted">إثبات التحويل: </span>
                  {proof ? (
                    <a href={proof} target="_blank" rel="noreferrer" className="mt-1 inline-block align-top">
                      <img
                        src={proof}
                        alt=""
                        className="max-h-24 max-w-[140px] rounded border border-app-border object-contain"
                      />
                    </a>
                  ) : (
                    <span className="text-app-muted">لا مرفق</span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
