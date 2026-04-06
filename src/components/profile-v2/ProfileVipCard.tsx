type ProfileVipCardProps = {
  loading: boolean
  currentLevel: number
  nextLevel: number | null
  progressPct: number
  nextPerk: string | null
}

export function ProfileVipCard({
  loading,
  currentLevel,
  nextLevel,
  progressPct,
  nextPerk,
}: ProfileVipCardProps) {
  if (loading) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(18,18,34,0.95),rgba(11,17,30,0.95))] p-4">
        <p className="text-sm text-white/80">جاري تحميل بيانات VIP...</p>
      </section>
    )
  }

  return (
    <section className="rounded-[28px] border border-violet-400/20 bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.22),transparent_34%),linear-gradient(160deg,rgba(19,18,38,0.96),rgba(10,16,29,0.98))] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.3)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-500/12 px-3 py-1.5 text-xs font-semibold text-violet-100">
          <span>VIP {Math.max(0, Math.min(5, currentLevel))}</span>
          <span className="text-violet-200/70">|</span>
          <span>{nextLevel ? `التالي VIP ${nextLevel}` : 'أعلى مستوى'}</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 flex items-center justify-between text-xs text-white/70">
            <span>التقدم للمستوى التالي</span>
            <span>{Number(progressPct || 0).toFixed(2)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,rgba(139,92,246,0.95),rgba(56,189,248,0.92))]"
              style={{ width: `${Math.max(0, Math.min(100, Number(progressPct || 0)))}%` }}
            />
          </div>
          <div className="mt-3 rounded-xl border border-white/8 bg-black/15 px-3 py-3">
            <p className="text-[11px] text-white/55">ميزة المستوى القادم</p>
            <p className="mt-1 text-sm text-white/90">{nextPerk || 'لا توجد ميزة متاحة حاليا.'}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
