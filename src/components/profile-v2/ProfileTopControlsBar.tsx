import { BellDot, Sparkles } from 'lucide-react'

type ProfileTopControlsBarProps = {
  title: string
  subtitle: string
}

export function ProfileTopControlsBar({ title, subtitle }: ProfileTopControlsBarProps) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_35%),linear-gradient(160deg,rgba(8,12,22,0.96),rgba(11,18,32,0.94))] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100">
            <Sparkles size={13} />
            <span>واجهة تنفيذ مميزة</span>
          </div>
          <p className="truncate text-lg font-semibold text-white">{title}</p>
          <p className="text-xs text-white/60">{subtitle}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/80">
          <BellDot size={18} />
        </div>
      </div>
    </section>
  )
}
