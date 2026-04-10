import type {
  ArenaAsset,
  ArenaLeaderboardEntry,
  ArenaMission,
  ArenaReaction,
  ArenaTicketPackage,
} from './types'

export const ARENA_ROUND_DURATION_SECONDS = 60
export const ARENA_LOCK_SECONDS = 5
export const ARENA_ENTRY_COST_TICKETS = 1
export const ARENA_TICKET_PRICE_USDT = 10
export const ARENA_PARTICIPATION_POINTS_LOSS = 100
export const ARENA_POINTS_PER_TICKET = 1000

export const ARENA_REACTIONS: ArenaReaction[] = ['🔥', '🚀', '👀', '⚡', '💥']

export const ARENA_ASSETS: ArenaAsset[] = [
  {
    id: 'btc',
    symbol: 'BTC',
    pair: 'BTC/USDT',
    name: 'Bitcoin',
    iconText: '₿',
    iconTone: 'gold',
    basePrice: 68452.4,
    pricePrecision: 2,
  },
  {
    id: 'eth',
    symbol: 'ETH',
    pair: 'ETH/USDT',
    name: 'Ethereum',
    iconText: 'Ξ',
    iconTone: 'purple',
    basePrice: 3524.6,
    pricePrecision: 2,
  },
  {
    id: 'sol',
    symbol: 'SOL',
    pair: 'SOL/USDT',
    name: 'Solana',
    iconText: 'S',
    iconTone: 'cyan',
    basePrice: 184.11,
    pricePrecision: 2,
  },
]

export const ARENA_TICKET_PACKAGES: ArenaTicketPackage[] = [
  { id: 'arena-ticket-1', title: 'تذكرة واحدة', tickets: 1, priceUsdt: 10 },
  { id: 'arena-ticket-5', title: 'باقة 5 تذاكر', tickets: 5, priceUsdt: 50 },
  { id: 'arena-ticket-10', title: 'باقة 10 تذاكر', tickets: 10, priceUsdt: 100 },
]

export const ARENA_MOCK_LEADERBOARD: ArenaLeaderboardEntry[] = [
  { rank: 1, userId: 12, username: 'سالم', avatarText: 'س', score: 4820, wins: 18 },
  { rank: 2, userId: 18, username: 'ليان', avatarText: 'ل', score: 4510, wins: 16 },
  { rank: 3, userId: 27, username: 'Mazen', avatarText: 'M', score: 4375, wins: 15 },
]

export const ARENA_MOCK_MISSIONS: ArenaMission[] = [
  {
    id: 'arena-mission-1',
    title: 'شارك في 3 جولات اليوم',
    description: 'أكمل ثلاث مشاركات لفتح مكافأة نقاط إضافية.',
    progress: 1,
    target: 3,
    rewardLabel: '+40 نقطة',
    state: 'AVAILABLE',
  },
  {
    id: 'arena-mission-2',
    title: 'فوزان متتاليان',
    description: 'حقق فوزين لفتح تذكرة مجانية إضافية.',
    progress: 0,
    target: 2,
    rewardLabel: '+1 تذكرة',
    state: 'AVAILABLE',
  },
]
