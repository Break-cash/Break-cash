import { useI18n } from '../i18nCore'

export type OwnerAuditItem = {
  id: string | number
  actor: string
  actorRole: string
  action: string
  section: string
  target?: string
  createdAt: string
  metaSummary?: string
}

type OwnerAuditTableProps = {
  items: OwnerAuditItem[]
}

export function OwnerAuditTable({ items }: OwnerAuditTableProps) {
  const { t } = useI18n()
  if (!items.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/60">
        {t('owner_audit_empty')}
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <table className="min-w-full divide-y divide-white/10 text-left text-xs">
        <thead className="bg-white/[0.02] text-white/60">
          <tr>
            <th className="px-3 py-2 font-medium">{t('owner_audit_col_time')}</th>
            <th className="px-3 py-2 font-medium">{t('owner_audit_col_actor')}</th>
            <th className="px-3 py-2 font-medium">{t('owner_audit_col_action')}</th>
            <th className="px-3 py-2 font-medium">{t('owner_audit_col_section')}</th>
            <th className="px-3 py-2 font-medium">{t('owner_audit_col_target')}</th>
            <th className="px-3 py-2 font-medium">{t('owner_audit_col_meta')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-white/80">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="whitespace-nowrap px-3 py-2 text-[11px] text-white/60">{item.createdAt}</td>
              <td className="max-w-[140px] truncate px-3 py-2 text-[11px]">
                {item.actor} <span className="text-white/40">({item.actorRole})</span>
              </td>
              <td className="max-w-[140px] truncate px-3 py-2 text-[11px]">{item.action}</td>
              <td className="max-w-[100px] truncate px-3 py-2 text-[11px]">{item.section}</td>
              <td className="max-w-[140px] truncate px-3 py-2 text-[11px]">{item.target || '-'}</td>
              <td className="max-w-[200px] truncate px-3 py-2 text-[11px] text-white/60">
                {item.metaSummary || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

