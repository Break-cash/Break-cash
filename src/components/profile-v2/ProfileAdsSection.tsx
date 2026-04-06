import { AdBanner } from '../ads/AdBanner'
import type { AdItem } from '../../api'

type ProfileAdsSectionProps = {
  title: string
  items: AdItem[]
}

export function ProfileAdsSection({ title, items }: ProfileAdsSectionProps) {
  return (
    <section className="glass-panel elite-enter rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.2),transparent_35%),radial-gradient(circle_at_top_left,rgba(139,92,246,0.16),transparent_30%),linear-gradient(150deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100">
          لوحة مميزة
        </span>
      </div>
      <AdBanner items={items} placement="profile" className="my-0 min-h-[240px] opacity-95" />
    </section>
  )
}
