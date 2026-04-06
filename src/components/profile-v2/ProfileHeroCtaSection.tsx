import { ArrowLeft, Zap } from 'lucide-react'

type ProfileHeroCtaSectionProps = {
  primaryText: string
  secondaryText: string
  onPrimaryClick: () => void
  onSecondaryClick: () => void
}

export function ProfileHeroCtaSection({
  primaryText,
  secondaryText,
  onPrimaryClick,
  onSecondaryClick,
}: ProfileHeroCtaSectionProps) {
  return (
    <section className="glass-panel elite-enter rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(25,35,62,0.92),rgba(12,18,34,0.96))] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onPrimaryClick}
          className="icon-interactive elite-hover-lift flex items-center justify-between rounded-2xl border border-cyan-400/35 bg-[linear-gradient(135deg,rgba(6,182,212,0.28),rgba(37,99,235,0.2))] px-4 py-3 text-sm font-semibold text-white"
        >
          <span>{primaryText}</span>
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={onSecondaryClick}
          className="icon-interactive elite-hover-lift flex items-center justify-between rounded-2xl border border-violet-400/30 bg-[linear-gradient(135deg,rgba(139,92,246,0.22),rgba(59,130,246,0.16))] px-4 py-3 text-sm font-semibold text-white/95"
        >
          <span>{secondaryText}</span>
          <Zap size={18} />
        </button>
      </div>
    </section>
  )
}
