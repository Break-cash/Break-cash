import { apiFetch } from '../api'
import { ARENA_TICKET_PACKAGES } from './mock'
import type {
  ArenaBonusReward,
  ArenaEntryBalance,
  ArenaLeaderboardEntry,
  ArenaLeaderboardPeriod,
  ArenaMission,
  ArenaRewardLedgerEntry,
  ArenaRound,
  ArenaRoundDetails,
  ArenaTicketPackage,
  ArenaWalletSummary,
  PredictionDirection,
  PredictionEntry,
  RoundResult,
} from './types'

export async function getArenaWalletSummary(): Promise<ArenaWalletSummary> {
  return apiFetch('/api/arena/wallet-summary') as Promise<ArenaWalletSummary>
}

export async function getVipStatus() {
  const summary = await getArenaWalletSummary()
  return {
    isVip: summary.isVip,
    vipLabel: summary.vipLabel,
  }
}

export async function getWalletSummary() {
  return await getArenaWalletSummary()
}

export async function getArenaEntryBalance(): Promise<ArenaEntryBalance> {
  return apiFetch('/api/arena/entry-balance') as Promise<ArenaEntryBalance>
}

export async function getArenaRounds(): Promise<ArenaRound[]> {
  const response = await apiFetch('/api/arena/rounds') as { items: ArenaRound[] }
  return response.items || []
}

export async function getArenaRoundDetails(roundId: string): Promise<ArenaRoundDetails> {
  return apiFetch(`/api/arena/rounds/${encodeURIComponent(roundId)}`) as Promise<ArenaRoundDetails>
}

export async function convertParticipationPoints() {
  return apiFetch('/api/arena/convert-points', {
    method: 'POST',
    body: JSON.stringify({}),
  }) as Promise<{ ticketBalance: number; participationPoints: number }>
}

export async function purchaseArenaTickets(packageId: string) {
  return apiFetch('/api/arena/tickets/purchase', {
    method: 'POST',
    body: JSON.stringify({ packageId }),
  }) as Promise<{
    package: ArenaTicketPackage
    route: string
    ticketBalance: number
    walletTxnId: number | null
    balanceAfter: number
  }>
}

export async function submitPrediction(roundId: string, assetId: string, direction: PredictionDirection): Promise<PredictionEntry> {
  const response = await apiFetch(`/api/arena/rounds/${encodeURIComponent(roundId)}/predict`, {
    method: 'POST',
    body: JSON.stringify({ assetId, direction }),
  }) as { entry: PredictionEntry }
  return response.entry
}

export async function settleArenaRound(roundId: string): Promise<RoundResult> {
  return getArenaResult(roundId)
}

export async function getArenaResult(roundId: string): Promise<RoundResult> {
  return apiFetch(`/api/arena/results/${encodeURIComponent(roundId)}`) as Promise<RoundResult>
}

export async function getArenaLeaderboard(period: ArenaLeaderboardPeriod): Promise<ArenaLeaderboardEntry[]> {
  const response = await apiFetch(`/api/arena/leaderboard?period=${encodeURIComponent(period)}`) as {
    items: ArenaLeaderboardEntry[]
  }
  return response.items || []
}

export async function getArenaMissions(): Promise<ArenaMission[]> {
  const response = await apiFetch('/api/arena/missions') as { items: ArenaMission[] }
  return response.items || []
}

export async function getArenaRewardHistory(): Promise<ArenaRewardLedgerEntry[]> {
  const response = await apiFetch('/api/arena/reward-history') as { items: ArenaRewardLedgerEntry[] }
  return response.items || []
}

export async function requestBonusTransfer(rewardId: string) {
  const response = await apiFetch(`/api/arena/rewards/${encodeURIComponent(rewardId)}/transfer`, {
    method: 'POST',
    body: JSON.stringify({}),
  }) as { reward: ArenaBonusReward | null }
  return response.reward || null
}

export function openFinancialRoute(
  routeName:
    | 'wallet'
    | 'tickets_purchase'
    | 'bonus_history'
    | 'rewards_history'
    | 'bonus_transfer'
    | 'vip',
) {
  const map = {
    wallet: '/wallet',
    tickets_purchase: '/deposit',
    bonus_history: '/wallet',
    rewards_history: '/wallet',
    bonus_transfer: '/wallet',
    vip: '/vip',
  } as const
  return map[routeName]
}

export function getArenaTicketPackages(): ArenaTicketPackage[] {
  return ARENA_TICKET_PACKAGES
}
