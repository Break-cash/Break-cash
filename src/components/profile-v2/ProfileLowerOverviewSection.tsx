import { LeaderboardSection } from '../home/LeaderboardSection'
import { ProfileMarketPreviewSection } from './ProfileMarketPreviewSection'
import { ProfilePushSettingsCard } from './ProfilePushSettingsCard'
import type { HomeLeaderboardConfig } from '../../api'

type MarketAsset = {
  symbol: string
  price_usd: number
  change_24h_percent: number
  balance: number
}

type ProfileLowerOverviewSectionProps = {
  pushSupported: boolean
  pushPermission: 'default' | 'denied' | 'granted'
  pushSubscribed: boolean
  pushBusy: boolean
  onTogglePush: () => void
  onSendPushPreview: () => void
  loading: boolean
  assets: MarketAsset[]
  marketTitle: string
  marketButtonText: string
  loadingText: string
  emptyText: string
  onOpenMarket: () => void
  leaderboardConfig: HomeLeaderboardConfig
}

export function ProfileLowerOverviewSection({
  pushSupported,
  pushPermission,
  pushSubscribed,
  pushBusy,
  onTogglePush,
  onSendPushPreview,
  loading,
  assets,
  marketTitle,
  marketButtonText,
  loadingText,
  emptyText,
  onOpenMarket,
  leaderboardConfig,
}: ProfileLowerOverviewSectionProps) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,12,22,0.94),rgba(11,17,30,0.92))] p-4 shadow-[0_22px_60px_rgba(0,0,0,0.3)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-white">مركز المتابعة</h2>
          <p className="text-xs text-white/55">نظرة مجمعة على الحساب والتنبيهات والسوق</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <ProfilePushSettingsCard
            pushSupported={pushSupported}
            pushPermission={pushPermission}
            pushSubscribed={pushSubscribed}
            pushBusy={pushBusy}
            onTogglePush={onTogglePush}
            onSendPushPreview={onSendPushPreview}
          />
        </div>

        <div className="space-y-4">
          <ProfileMarketPreviewSection
            loading={loading}
            assets={assets}
            title={marketTitle}
            marketButtonText={marketButtonText}
            loadingText={loadingText}
            emptyText={emptyText}
            onOpenMarket={onOpenMarket}
          />
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <LeaderboardSection config={leaderboardConfig} />
          </div>
        </div>
      </div>
    </section>
  )
}
