import { motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { WalletSummaryPanel } from '../wallet/WalletSummaryPanel'
import type { WalletSummary } from '../../walletSummary'

type ProfileHeroWalletSectionProps = {
  summary: WalletSummary
  isSummaryLoading: boolean
  premiumProfileColorClass: string
  depositText: string
  withdrawText: string
  onOpenWallet: () => void
  onOpenDeposit: () => void
  onOpenWithdraw: () => void
}

export function ProfileHeroWalletSection({
  summary,
  isSummaryLoading,
  premiumProfileColorClass,
  depositText,
  withdrawText,
  onOpenWallet,
  onOpenDeposit,
  onOpenWithdraw,
}: ProfileHeroWalletSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={`elite-enter w-full max-w-full space-y-4 ${premiumProfileColorClass}`}
    >
      <div className="glass-panel overflow-hidden rounded-[28px] border border-brand-blue/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_30%),linear-gradient(140deg,rgba(7,13,24,0.98),rgba(10,18,34,0.94))] p-3 shadow-[0_24px_52px_rgba(2,8,20,0.38)]">
        <WalletSummaryPanel
          summary={summary}
          currency="USDT"
          isLoading={isSummaryLoading}
          cardVariant="hero"
          onCardClick={onOpenWallet}
          actionsSlot={
            <div className="grid min-w-0 grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onOpenDeposit}
                className="action-button action-button-deposit icon-interactive flex min-h-[56px] min-w-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_14px_28px_rgba(34,197,94,0.2)] transition active:scale-[0.98]"
              >
                <ArrowDownLeft size={20} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{depositText}</span>
              </button>
              <button
                type="button"
                onClick={onOpenWithdraw}
                className="action-button action-button-withdraw icon-interactive flex min-h-[56px] min-w-0 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_14px_28px_rgba(251,146,60,0.18)] transition active:scale-[0.98]"
              >
                <ArrowUpRight size={20} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{withdrawText}</span>
              </button>
            </div>
          }
        />
      </div>
    </motion.section>
  )
}

