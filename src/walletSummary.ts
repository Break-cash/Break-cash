export type WalletSummary = {
  totalAssets: number
  mainBalance: number
  lockedBalance: number
  withdrawableBalance: number
}

function coerceNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  if (typeof value === 'string') {
    const n = Number(value.trim())
    return Number.isFinite(n) ? n : 0
  }
  if (value == null) {
    return 0
  }
  const n = Number(value as unknown as number)
  return Number.isFinite(n) ? n : 0
}

type WalletOverviewLike = {
  total_assets?: unknown
  main_balance?: unknown
  locked_balance?: unknown
  withdrawable_balance?: unknown
} | null | undefined

export function mapWalletApiToSummary(overview: WalletOverviewLike): WalletSummary {
  if (!overview) {
    return {
      totalAssets: 0,
      mainBalance: 0,
      lockedBalance: 0,
      withdrawableBalance: 0,
    }
  }
  return {
    totalAssets: coerceNumber(overview.total_assets),
    mainBalance: coerceNumber(overview.main_balance),
    lockedBalance: coerceNumber(overview.locked_balance),
    withdrawableBalance: coerceNumber(overview.withdrawable_balance),
  }
}

