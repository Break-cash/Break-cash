export type ArenaRoundStatus =
  | 'UPCOMING'
  | 'OPEN'
  | 'LOCKED'
  | 'SETTLING'
  | 'SETTLED'
  | 'RESTARTED'
  | 'CANCELLED'

export type PredictionDirection = 'UP' | 'DOWN'

export type BonusTransferStatus =
  | 'LOCKED_NON_VIP'
  | 'ELIGIBLE_VIP'
  | 'TRANSFER_REQUESTED'
  | 'TRANSFER_APPROVED'
  | 'TRANSFER_REJECTED'

export type ArenaReaction = '🔥' | '🚀' | '👀' | '⚡' | '💥'

export type ArenaAsset = {
  id: string
  symbol: string
  pair: string
  name: string
  iconText: string
  iconTone: 'gold' | 'green' | 'red' | 'purple' | 'cyan'
  basePrice: number
  pricePrecision: number
}

export type ArenaRound = {
  id: string
  assetId: string
  asset: ArenaAsset
  status: ArenaRoundStatus
  roundIndex: number
  startsAt: string
  lockAt: string
  endsAt: string
  durationSeconds: number
  participantsCount: number
  startPrice: number
  currentPrice: number
  endPrice: number | null
  rewardPreviewMin: number
  rewardPreviewMax: number
  entryCostTickets: number
  headline: string
  reactions: Record<ArenaReaction, number>
}

export type PredictionEntry = {
  id: string
  roundId: string
  assetId: string
  direction: PredictionDirection
  submittedAt: string
  entryCostTickets: number
  state: 'SUBMITTED' | 'SETTLED' | 'REFUNDED'
  outcome: 'WIN' | 'LOSS' | 'RESTARTED' | null
}

export type ArenaBonusReward = {
  id: string
  roundId: string
  amount: number
  currency: 'USDT'
  status: BonusTransferStatus
  createdAt: string
  requestedAt?: string
  processedAt?: string
}

export type ArenaRewardLedgerEntry = {
  id: string
  type:
    | 'BONUS_REWARD'
    | 'PARTICIPATION_POINTS'
    | 'TICKET_PURCHASE'
    | 'TICKET_CONVERSION'
    | 'TICKET_REFUND'
    | 'BONUS_TRANSFER'
  title: string
  amount?: number
  currency?: 'USDT'
  points?: number
  tickets?: number
  roundId?: string
  rewardId?: string
  createdAt: string
  status?: BonusTransferStatus | 'COMPLETED'
  note?: string
}

export type ArenaLeaderboardEntry = {
  rank: number
  userId: number
  username: string
  avatarText: string
  score: number
  wins: number
  isCurrentUser?: boolean
}

export type ArenaMission = {
  id: string
  title: string
  description: string
  progress: number
  target: number
  rewardLabel: string
  state: 'AVAILABLE' | 'COMPLETED' | 'CLAIMED'
}

export type ArenaWalletSummary = {
  totalAssets: number
  withdrawableBalance: number
  ticketBalance: number
  bonusBalance: number
  lockedBonusBalance: number
  transferableBonusBalance: number
  participationPoints: number
  isVip: boolean
  vipLabel: string
  notificationCount: number
  displayName: string
  avatarText: string
}

export type ArenaEntryBalance = {
  ticketBalance: number
  participationPoints: number
  quickEntryTickets: number
  canEnter: boolean
  canConvertPoints: boolean
  nextTicketAtPoints: number
}

export type RoundResult = {
  roundId: string
  status: ArenaRoundStatus
  startPrice: number
  endPrice: number
  outcome: PredictionDirection | 'RESTARTED'
  absoluteChange: number
  percentChange: number
  userWon: boolean
  participationPointsAwarded: number
  bonusReward: ArenaBonusReward | null
  rank: number
  totalParticipants: number
  transferStatus: BonusTransferStatus | null
}

export type ArenaLeaderboardPeriod = 'daily' | 'weekly'

export type ArenaTicketPackage = {
  id: string
  title: string
  tickets: number
  priceUsdt: number
}

export type ArenaRoundDetails = {
  round: ArenaRound
  walletSummary: ArenaWalletSummary
  entryBalance: ArenaEntryBalance
  existingEntry: PredictionEntry | null
}

export type ArenaPersistedState = {
  ticketBalance: number
  participationPoints: number
  bonusRewards: ArenaBonusReward[]
  rewardLedger: ArenaRewardLedgerEntry[]
  predictions: PredictionEntry[]
}
