import type { LucideIcon } from 'lucide-react'

type QuickActionItem = {
  key: string
  label: string
  to: string
  icon: LucideIcon
  external?: boolean
}

type ProfileQuickActionsGridProps = {
  title: string
  actions: QuickActionItem[]
  onActionClick: (item: QuickActionItem) => void
}

export function ProfileQuickActionsGrid({
  title,
  actions,
  onActionClick,
}: ProfileQuickActionsGridProps) {
  return (
    <section className="glass-panel elite-enter rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        <span className="rounded-full border border-white/15 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/75">
          {actions.length} خدمات
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onActionClick(item)}
              className="icon-interactive elite-hover-lift glass-panel-soft flex min-h-[88px] items-center gap-3 rounded-xl border border-white/10 bg-[linear-gradient(140deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] px-3 py-3 text-start"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-soft)] bg-[var(--bg-elevated)]">
                <Icon size={20} className="text-[var(--accent-blue-soft)]" />
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)]">{item.label}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
