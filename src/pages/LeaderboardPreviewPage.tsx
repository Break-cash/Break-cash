import { LeaderboardSection, defaultHomeLeaderboardConfig } from '../components/home/LeaderboardSection'

export function LeaderboardPreviewPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(30,64,175,0.16),transparent_24%),linear-gradient(180deg,#020617,#0f172a)] px-4 py-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-4 rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200 backdrop-blur">
          Local preview only: Home page placement preview without login
        </div>
        <section className="mb-6 lg:mb-8">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[1.8rem] border border-sky-400/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.16),rgba(15,23,42,0.92),rgba(15,23,42,0.98))] p-5 shadow-[0_18px_48px_rgba(2,6,23,0.42)] lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Total Assets</span>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                  USDT
                </span>
              </div>
              <div className="mt-6 text-4xl font-black text-white lg:text-5xl">128,450.00</div>
              <div className="mt-5 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Today Earnings</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-400">+2,440.00</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Team Earnings</div>
                  <div className="mt-2 text-2xl font-bold text-sky-400">41,220.00</div>
                </div>
              </div>
            </div>
            <div className="rounded-[1.8rem] border border-amber-400/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(15,23,42,0.94),rgba(15,23,42,0.98))] p-5 shadow-[0_18px_48px_rgba(2,6,23,0.42)]">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Funding Account</div>
              <div className="mt-6 text-3xl font-black text-amber-300">64,225.00</div>
              <p className="mt-6 text-sm leading-6 text-slate-400">
                This card previews the existing home summary that appears directly above the leaderboard.
              </p>
            </div>
          </div>
        </section>

        <LeaderboardSection config={{ ...defaultHomeLeaderboardConfig, enabled: true }} previewMode />

        <section className="mt-6 rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 shadow-[0_18px_48px_rgba(2,6,23,0.42)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Most Traded</h3>
              <p className="text-sm text-slate-400">This block previews the section that appears below the leaderboard.</p>
            </div>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">24h Live</span>
          </div>
          <div className="space-y-3">
            {[
              ['BTC/USDT', '$66,809.64', '+0.71%'],
              ['ETH/USDT', '$2,025.22', '+0.03%'],
              ['KCS/USDT', '$10.54', '+1.52%'],
            ].map(([pair, price, change]) => (
              <div
                key={pair}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <div className="font-semibold text-white">{pair}</div>
                <div className="text-slate-300">{price}</div>
                <div className="font-semibold text-emerald-400">{change}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
