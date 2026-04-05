import { AdBanner } from '../ads/AdBanner'
import type { AdItem } from '../../api'

type ProfileAdsSectionProps = {
  title: string
  items: AdItem[]
}

export function ProfileAdsSection({ title, items }: ProfileAdsSectionProps) {
  return (
    <section className="glass-panel elite-enter rounded-3xl border border-white/10 bg-[linear-gradient(150deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
      </div>
      <AdBanner items={items} placement="profile" className="my-0 opacity-95" />
    </section>
  )
}

