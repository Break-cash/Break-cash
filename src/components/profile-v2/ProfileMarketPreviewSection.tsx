import { motion } from 'framer-motion'

type MarketAsset = {
  symbol: string
  price_usd: number
  change_24h_percent: number
  balance: number
}

type ProfileMarketPreviewSectionProps = {
  loading: boolean
  assets: MarketAsset[]
  title: string
  marketButtonText: string
  loadingText: string
  emptyText: string
  onOpenMarket: () => void
}

export function ProfileMarketPreviewSection({
  loading,
  assets,
  title,
  marketButtonText,
  loadingText,
  emptyText,
  onOpenMarket,
}: ProfileMarketPreviewSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.33, ease: 'easeOut', delay: 0.08 }}
      className="glass-panel elite-enter rounded-2xl border border-white/10 bg-[linear-gradient(150deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{title}</p>
        <button
          type="button"
          onClick={onOpenMarket}
          className="glass-pill icon-interactive rounded-full px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
        >
          {marketButtonText}
        </button>
      </div>
      {loading ? (
        <div className="py-4 text-sm text-app-muted">{loadingText}</div>
      ) : assets.length === 0 ? (
        <div className="py-4 text-sm text-app-muted">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <motion.div
              key={asset.symbol}
              layout
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="elite-hover-lift glass-panel-soft flex items-center justify-between rounded-xl border border-white/10 bg-[linear-gradient(140deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{asset.symbol}</p>
                <p className="text-xs text-app-muted">${asset.price_usd.toLocaleString()}</p>
              </div>
              <div className="text-end">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{asset.balance.toFixed(4)}</p>
                <p className={`text-xs ${asset.change_24h_percent >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {asset.change_24h_percent >= 0 ? '+' : ''}
                  {asset.change_24h_percent.toFixed(2)}%
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.section>
  )
}

