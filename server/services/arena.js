import { all, get, run } from '../db.js'
import { createLocalizedNotification } from './notifications.js'
import { fetchBestQuote, sharedMarketFeed } from './marketFeed.js'
import { adjustBalance } from './wallet-service.js'

export const ARENA_ROUND_DURATION_SECONDS = 60
export const ARENA_LOCK_SECONDS = 5
export const ARENA_ENTRY_COST_TICKETS = 1
export const ARENA_TICKET_PRICE_USDT = 10
export const ARENA_PARTICIPATION_POINTS_LOSS = 100
export const ARENA_POINTS_PER_TICKET = 1000

export const ARENA_REACTIONS = ['🔥', '🚀', '👀', '⚡', '💥']

export const ARENA_ASSETS = [
  { id: 'btc', symbol: 'BTCUSDT', pair: 'BTC/USDT', name: 'Bitcoin', iconText: '₿', iconTone: 'gold', basePrice: 68452.4, pricePrecision: 2 },
  { id: 'eth', symbol: 'ETHUSDT', pair: 'ETH/USDT', name: 'Ethereum', iconText: 'Ξ', iconTone: 'purple', basePrice: 3524.6, pricePrecision: 2 },
  { id: 'sol', symbol: 'SOLUSDT', pair: 'SOL/USDT', name: 'Solana', iconText: 'S', iconTone: 'cyan', basePrice: 184.11, pricePrecision: 2 },
]

export const ARENA_TICKET_PACKAGES = [
  { id: 'arena-ticket-1', title: 'تذكرة واحدة', tickets: 1, priceUsdt: 10 },
  { id: 'arena-ticket-5', title: 'باقة 5 تذاكر', tickets: 5, priceUsdt: 50 },
  { id: 'arena-ticket-10', title: 'باقة 10 تذاكر', tickets: 10, priceUsdt: 100 },
]

function roundNumber(value, precision) {
  return Number(Number(value || 0).toFixed(precision))
}

function seededUnit(seed) {
  const x = Math.sin(seed * 999 + 17.13) * 10000
  return x - Math.floor(x)
}

function normalizeDirection(value) {
  return String(value || '').trim().toUpperCase() === 'DOWN' ? 'DOWN' : 'UP'
}

function parseJsonSafe(value, fallback) {
  try {
    if (value == null || value === '') return fallback
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return fallback
  }
}

function getAssetById(assetId) {
  return ARENA_ASSETS.find((item) => item.id === String(assetId || '').trim().toLowerCase()) || null
}

function getRoundWindow(nowMs, assetIndex) {
  const offsetSeconds = assetIndex * 18
  const offsetMs = offsetSeconds * 1000
  const cycleMs = ARENA_ROUND_DURATION_SECONDS * 1000
  const roundStartMs = Math.floor((nowMs - offsetMs) / cycleMs) * cycleMs + offsetMs
  const lockMs = roundStartMs + (ARENA_ROUND_DURATION_SECONDS - ARENA_LOCK_SECONDS) * 1000
  const roundEndMs = roundStartMs + cycleMs
  return { roundStartMs, lockMs, roundEndMs }
}

function buildRoundId(assetId, roundStartMs) {
  return `${assetId}-${roundStartMs}`
}

function getRoundStatus(nowMs, startMs, lockMs, endMs, persistedStatus = null) {
  if (persistedStatus === 'SETTLED' || persistedStatus === 'RESTARTED' || persistedStatus === 'CANCELLED') return persistedStatus
  if (nowMs < startMs) return 'UPCOMING'
  if (nowMs < lockMs) return 'OPEN'
  if (nowMs < endMs) return 'LOCKED'
  return 'SETTLING'
}

function pickWeightedReward(roundId, userId) {
  const seed = Array.from(`${roundId}:${userId}`).reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0)
  const roll = seededUnit(seed)
  if (roll < 0.72) {
    const values = [5, 10, 15, 20]
    return values[Math.floor(seededUnit(seed + 1) * values.length)]
  }
  if (roll < 0.9) {
    const values = [25, 30, 40, 50]
    return values[Math.floor(seededUnit(seed + 2) * values.length)]
  }
  if (roll < 0.97) {
    const values = [75, 100, 125, 150]
    return values[Math.floor(seededUnit(seed + 3) * values.length)]
  }
  const values = [200, 300, 500, 1000]
  return values[Math.floor(seededUnit(seed + 4) * values.length)]
}

function buildDefaultReactions(roundIndex, assetIndex) {
  const reactionBase = 18 + Math.round(seededUnit(roundIndex + assetIndex * 13) * 40)
  return ARENA_REACTIONS.reduce((acc, reaction, idx) => {
    acc[reaction] = reactionBase - idx * 3 + Math.round(seededUnit(roundIndex + idx * 19) * 8)
    return acc
  }, {})
}

async function resolveLiveQuote(symbol, fallbackPrice) {
  const targetSymbol = String(symbol || 'BTCUSDT').trim().toUpperCase() || 'BTCUSDT'
  const cached = sharedMarketFeed.getPair(targetSymbol)?.pair
  if (cached?.symbol && Number(cached.price) > 0) return Number(cached.price)
  const list = sharedMarketFeed.getQuotes().items || []
  const fromList = list.find((item) => item.symbol === targetSymbol)
  if (fromList?.symbol && Number(fromList.price) > 0) return Number(fromList.price)
  try {
    const quote = await fetchBestQuote(targetSymbol)
    if (quote?.symbol && Number(quote.price) > 0) return Number(quote.price)
  } catch {
    // fallback below
  }
  return Number(fallbackPrice || 0)
}

export async function ensureArenaWallet(db, userId) {
  await run(
    db,
    `INSERT INTO arena_wallets (user_id, ticket_balance, participation_points)
     VALUES (?, 3, 0)
     ON CONFLICT(user_id) DO NOTHING`,
    [userId],
  )
  return await get(db, `SELECT * FROM arena_wallets WHERE user_id = ? LIMIT 1`, [userId])
}

async function updateArenaWallet(db, userId, { ticketsDelta = 0, pointsDelta = 0 }) {
  const wallet = await ensureArenaWallet(db, userId)
  const nextTickets = Math.max(0, Number(wallet?.ticket_balance || 0) + Number(ticketsDelta || 0))
  const nextPoints = Math.max(0, Number(wallet?.participation_points || 0) + Number(pointsDelta || 0))
  await run(
    db,
    `UPDATE arena_wallets
     SET ticket_balance = ?, participation_points = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [nextTickets, nextPoints, userId],
  )
  return await ensureArenaWallet(db, userId)
}

async function addArenaLedger(db, payload) {
  const {
    userId,
    type,
    title,
    amount = null,
    currency = 'USDT',
    points = null,
    tickets = null,
    roundId = null,
    rewardId = null,
    status = 'COMPLETED',
    note = null,
  } = payload
  const result = await run(
    db,
    `INSERT INTO arena_reward_ledger
      (user_id, entry_type, title, amount, currency, points, tickets, round_id, reward_id, status, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [userId, type, title, amount, currency, points, tickets, roundId, rewardId, status, note],
  )
  return result.rows?.[0]?.id ?? result.lastID ?? null
}

async function autoConvertArenaPoints(db, userId, reason = 'auto') {
  const wallet = await ensureArenaWallet(db, userId)
  const currentPoints = Number(wallet?.participation_points || 0)
  const ticketsToGrant = Math.floor(currentPoints / ARENA_POINTS_PER_TICKET)
  if (ticketsToGrant <= 0) return await ensureArenaWallet(db, userId)
  const nextPoints = currentPoints - ticketsToGrant * ARENA_POINTS_PER_TICKET
  const nextTickets = Number(wallet?.ticket_balance || 0) + ticketsToGrant
  await run(
    db,
    `UPDATE arena_wallets
     SET ticket_balance = ?, participation_points = ?, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [nextTickets, nextPoints, userId],
  )
  await addArenaLedger(db, {
    userId,
    type: 'TICKET_CONVERSION',
    title: reason === 'manual' ? 'تحويل نقاط المشاركة إلى تذاكر' : 'تحويل تلقائي للنقاط إلى تذاكر',
    points: ticketsToGrant * ARENA_POINTS_PER_TICKET,
    tickets: ticketsToGrant,
    note: `تم تحويل ${ticketsToGrant * ARENA_POINTS_PER_TICKET} نقطة إلى ${ticketsToGrant} تذكرة`,
  })
  return await ensureArenaWallet(db, userId)
}

async function getUnreadNotificationsCount(db, userId) {
  const row = await get(
    db,
    `SELECT COUNT(*) AS unread_count
     FROM notifications
     WHERE user_id = ? AND is_read = 0`,
    [userId],
  ).catch(() => null)
  return Number(row?.unread_count || 0)
}

async function getCurrentUserRow(db, userId) {
  return await get(
    db,
    `SELECT id, display_name, vip_level, avatar_path
     FROM users WHERE id = ? LIMIT 1`,
    [userId],
  )
}

function serializeAsset(asset) {
  return {
    id: asset.id,
    symbol: asset.symbol.replace('USDT', ''),
    pair: asset.pair,
    name: asset.name,
    iconText: asset.iconText,
    iconTone: asset.iconTone,
    basePrice: asset.basePrice,
    pricePrecision: asset.pricePrecision,
  }
}

function serializeRound(row, asset) {
  return {
    id: row.round_id,
    assetId: asset.id,
    asset: serializeAsset(asset),
    status: String(row.status || 'UPCOMING'),
    roundIndex: Number(row.round_index || 0),
    startsAt: new Date(row.starts_at).toISOString(),
    lockAt: new Date(row.lock_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    durationSeconds: Number(row.duration_seconds || ARENA_ROUND_DURATION_SECONDS),
    participantsCount: Number(row.participants_count || 0),
    startPrice: Number(row.start_price || asset.basePrice),
    currentPrice: Number(row.current_price || row.start_price || asset.basePrice),
    endPrice: row.end_price == null ? null : Number(row.end_price),
    rewardPreviewMin: 5,
    rewardPreviewMax: 1000,
    entryCostTickets: ARENA_ENTRY_COST_TICKETS,
    headline: String(row.headline || 'جولة مباشرة على أصل حي'),
    reactions: parseJsonSafe(row.reactions_json, buildDefaultReactions(Number(row.round_index || 0), ARENA_ASSETS.findIndex((item) => item.id === asset.id))),
  }
}

async function createRoundRecord(db, asset, assetIndex, roundStartMs, lockMs, roundEndMs, roundIndex) {
  const roundId = buildRoundId(asset.id, roundStartMs)
  const startPrice = roundNumber(await resolveLiveQuote(asset.symbol, asset.basePrice), asset.pricePrecision)
  const participantSeed = Math.floor(seededUnit(roundIndex + assetIndex * 7) * 180)
  const participantsCount = 240 + participantSeed + assetIndex * 41
  const reactions = buildDefaultReactions(roundIndex, assetIndex)
  const headlineByAsset = {
    btc: 'جولة سريعة على بيتكوين',
    eth: 'تقلب مباشر على إيثيريوم',
    sol: 'فرصة خفيفة على سولانا',
  }
  await run(
    db,
    `INSERT INTO arena_rounds
      (round_id, asset_id, round_index, starts_at, lock_at, ends_at, duration_seconds, participants_count, start_price, current_price, status, reward_preview_min, reward_preview_max, headline, reactions_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(round_id) DO NOTHING`,
    [
      roundId,
      asset.id,
      roundIndex,
      new Date(roundStartMs).toISOString(),
      new Date(lockMs).toISOString(),
      new Date(roundEndMs).toISOString(),
      ARENA_ROUND_DURATION_SECONDS,
      participantsCount,
      startPrice,
      startPrice,
      'OPEN',
      5,
      1000,
      headlineByAsset[asset.id] || 'جولة مباشرة على أصل حي',
      JSON.stringify(reactions),
    ],
  )
  return await get(db, `SELECT * FROM arena_rounds WHERE round_id = ? LIMIT 1`, [roundId])
}

async function ensureRoundRecord(db, assetIdOrRoundId) {
  const roundIdRaw = String(assetIdOrRoundId || '').trim().toLowerCase()
  let assetId = roundIdRaw
  let requestedStartMs = null
  if (roundIdRaw.includes('-')) {
    const [parsedAssetId, parsedStartMs] = roundIdRaw.split('-')
    assetId = parsedAssetId
    requestedStartMs = Number(parsedStartMs || 0)
  }
  const assetIndex = ARENA_ASSETS.findIndex((item) => item.id === assetId)
  if (assetIndex < 0) return null
  const asset = ARENA_ASSETS[assetIndex]
  const nowMs = Date.now()
  const currentWindow = getRoundWindow(nowMs, assetIndex)
  const roundStartMs = Number.isFinite(requestedStartMs) && requestedStartMs > 0 ? requestedStartMs : currentWindow.roundStartMs
  const cycleMs = ARENA_ROUND_DURATION_SECONDS * 1000
  const roundIndex = Math.floor(roundStartMs / cycleMs)
  const lockMs = roundStartMs + (ARENA_ROUND_DURATION_SECONDS - ARENA_LOCK_SECONDS) * 1000
  const roundEndMs = roundStartMs + cycleMs
  const roundId = buildRoundId(asset.id, roundStartMs)

  let row = await get(db, `SELECT * FROM arena_rounds WHERE round_id = ? LIMIT 1`, [roundId])
  if (!row) {
    row = await createRoundRecord(db, asset, assetIndex, roundStartMs, lockMs, roundEndMs, roundIndex)
  }
  if (!row) return null

  const effectiveStatus = getRoundStatus(nowMs, roundStartMs, lockMs, roundEndMs, row.status)
  if (effectiveStatus === 'SETTLING') {
    return await settleArenaRoundRecord(db, row.round_id)
  }

  const livePrice = roundNumber(await resolveLiveQuote(asset.symbol, row.current_price || row.start_price || asset.basePrice), asset.pricePrecision)
  await run(
    db,
    `UPDATE arena_rounds
     SET current_price = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE round_id = ?`,
    [livePrice, effectiveStatus, row.round_id],
  )
  return await get(db, `SELECT * FROM arena_rounds WHERE round_id = ? LIMIT 1`, [row.round_id])
}

async function settleArenaRoundRecord(db, roundId) {
  const row = await get(db, `SELECT * FROM arena_rounds WHERE round_id = ? LIMIT 1`, [roundId])
  if (!row) return null
  if (['SETTLED', 'RESTARTED', 'CANCELLED'].includes(String(row.status || ''))) return row

  const asset = getAssetById(row.asset_id)
  if (!asset) return row
  const endPrice = roundNumber(await resolveLiveQuote(asset.symbol, row.current_price || row.start_price || asset.basePrice), asset.pricePrecision)
  const startPrice = Number(row.start_price || asset.basePrice)
  const outcome = endPrice > startPrice ? 'UP' : endPrice < startPrice ? 'DOWN' : 'RESTARTED'
  const settledStatus = outcome === 'RESTARTED' ? 'RESTARTED' : 'SETTLED'

  await run(
    db,
    `UPDATE arena_rounds
     SET current_price = ?, end_price = ?, outcome = ?, status = ?, settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE round_id = ?`,
    [endPrice, endPrice, outcome, settledStatus, roundId],
  )

  const pendingEntries = await all(
    db,
    `SELECT p.*, u.vip_level
     FROM arena_predictions p
     JOIN users u ON u.id = p.user_id
     WHERE p.round_id = ? AND p.state = 'SUBMITTED'
     ORDER BY p.id ASC`,
    [roundId],
  )

  for (const entry of pendingEntries) {
    const userId = Number(entry.user_id)
    if (outcome === 'RESTARTED') {
      await updateArenaWallet(db, userId, { ticketsDelta: Number(entry.entry_cost_tickets || ARENA_ENTRY_COST_TICKETS) })
      await run(
        db,
        `UPDATE arena_predictions
         SET state = 'REFUNDED', outcome = 'RESTARTED', settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [entry.id],
      )
      await addArenaLedger(db, {
        userId,
        type: 'TICKET_REFUND',
        title: 'إرجاع تذكرة الجولة',
        tickets: Number(entry.entry_cost_tickets || ARENA_ENTRY_COST_TICKETS),
        roundId,
        note: 'تمت إعادة الجولة بسبب تساوي سعر البداية والنهاية.',
      })
      continue
    }

    const userWon = normalizeDirection(entry.direction) === outcome
    if (userWon) {
      const rewardAmount = pickWeightedReward(roundId, userId)
      const rewardStatus = Number(entry.vip_level || 0) > 0 ? 'ELIGIBLE_VIP' : 'LOCKED_NON_VIP'
      const rewardResult = await run(
        db,
        `INSERT INTO arena_bonus_rewards
          (user_id, round_id, prediction_id, amount, currency, status)
         VALUES (?, ?, ?, ?, 'USDT', ?)
         RETURNING id`,
        [userId, roundId, entry.id, rewardAmount, rewardStatus],
      )
      const rewardId = rewardResult.rows?.[0]?.id ?? rewardResult.lastID ?? null
      await run(
        db,
        `UPDATE arena_predictions
         SET state = 'SETTLED', outcome = 'WIN', settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, reward_id = ?
         WHERE id = ?`,
        [rewardId, entry.id],
      )
      await addArenaLedger(db, {
        userId,
        type: 'BONUS_REWARD',
        title: 'مكافأة ساحة التوقعات',
        amount: rewardAmount,
        currency: 'USDT',
        roundId,
        rewardId,
        status: rewardStatus,
      })
      await createLocalizedNotification(db, {
        userId,
        type: 'deposit_offer_bonus',
        titleAr: 'مكافأة ساحة التوقعات',
        bodyAr: `تمت إضافة مكافأة بقيمة ${rewardAmount} USDT إلى رصيد الساحة.`,
        titleEn: 'Arena bonus reward',
        bodyEn: `A ${rewardAmount} USDT arena reward has been added.`,
      }).catch(() => {})
      continue
    }

    await updateArenaWallet(db, userId, { pointsDelta: ARENA_PARTICIPATION_POINTS_LOSS })
    await autoConvertArenaPoints(db, userId)
    await run(
      db,
      `UPDATE arena_predictions
       SET state = 'SETTLED', outcome = 'LOSS', settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [entry.id],
    )
    await addArenaLedger(db, {
      userId,
      type: 'PARTICIPATION_POINTS',
      title: 'نقاط مشاركة ساحة التوقعات',
      points: ARENA_PARTICIPATION_POINTS_LOSS,
      roundId,
      note: 'تمت إضافة 100 نقطة مشاركة بعد انتهاء الجولة.',
    })
  }

  return await get(db, `SELECT * FROM arena_rounds WHERE round_id = ? LIMIT 1`, [roundId])
}

export async function getArenaRounds(db) {
  const rows = []
  for (const asset of ARENA_ASSETS) {
    const row = await ensureRoundRecord(db, asset.id)
    if (row) rows.push(row)
  }
  return rows
    .map((row) => serializeRound(row, getAssetById(row.asset_id)))
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt))
}

export async function getArenaWalletSummary(db, userId) {
  const wallet = await ensureArenaWallet(db, userId)
  const walletOverviewRow = await get(
    db,
    `SELECT
       COALESCE(SUM(CASE WHEN account_type = 'main' THEN balance_amount ELSE 0 END), 0) AS withdrawable_balance,
       COALESCE(SUM(balance_amount), 0) AS total_assets
     FROM wallet_accounts
     WHERE user_id = ? AND currency = 'USDT'`,
    [userId],
  )
  const user = await getCurrentUserRow(db, userId)
  const unreadCount = await getUnreadNotificationsCount(db, userId)
  const rewardRows = await all(
    db,
    `SELECT amount, status
     FROM arena_bonus_rewards
     WHERE user_id = ?`,
    [userId],
  )
  const bonusBalance = rewardRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const lockedBonusBalance = rewardRows
    .filter((row) => ['LOCKED_NON_VIP', 'TRANSFER_REJECTED'].includes(String(row.status || '')))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const transferableBonusBalance = rewardRows
    .filter((row) => ['ELIGIBLE_VIP', 'TRANSFER_APPROVED'].includes(String(row.status || '')))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0)

  return {
    totalAssets: Number(walletOverviewRow?.total_assets || 0),
    withdrawableBalance: Number(walletOverviewRow?.withdrawable_balance || 0),
    ticketBalance: Number(wallet?.ticket_balance || 0),
    bonusBalance: Number(bonusBalance.toFixed(8)),
    lockedBonusBalance: Number(lockedBonusBalance.toFixed(8)),
    transferableBonusBalance: Number(transferableBonusBalance.toFixed(8)),
    participationPoints: Number(wallet?.participation_points || 0),
    isVip: Number(user?.vip_level || 0) > 0,
    vipLabel: Number(user?.vip_level || 0) > 0 ? `VIP ${user.vip_level}` : 'غير VIP',
    notificationCount: unreadCount,
    displayName: String(user?.display_name || 'مستخدم الساحة').trim() || 'مستخدم الساحة',
    avatarText: (String(user?.display_name || 'س').trim() || 'س').slice(0, 1).toUpperCase(),
  }
}

export async function getArenaEntryBalance(db, userId) {
  const wallet = await ensureArenaWallet(db, userId)
  return {
    ticketBalance: Number(wallet?.ticket_balance || 0),
    participationPoints: Number(wallet?.participation_points || 0),
    quickEntryTickets: ARENA_ENTRY_COST_TICKETS,
    canEnter: Number(wallet?.ticket_balance || 0) >= ARENA_ENTRY_COST_TICKETS,
    canConvertPoints: Number(wallet?.participation_points || 0) >= ARENA_POINTS_PER_TICKET,
    nextTicketAtPoints: Math.max(0, ARENA_POINTS_PER_TICKET - Number(wallet?.participation_points || 0)),
  }
}

export async function getArenaRoundDetails(db, userId, roundId) {
  const row = await ensureRoundRecord(db, roundId)
  if (!row) throw new Error('ARENA_ROUND_NOT_FOUND')
  const asset = getAssetById(row.asset_id)
  const existingEntry = await get(
    db,
    `SELECT id, round_id, asset_id, direction, submitted_at, entry_cost_tickets, state, outcome
     FROM arena_predictions
     WHERE user_id = ? AND round_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId, row.round_id],
  )
  return {
    round: serializeRound(row, asset),
    walletSummary: await getArenaWalletSummary(db, userId),
    entryBalance: await getArenaEntryBalance(db, userId),
    existingEntry: existingEntry
      ? {
          id: String(existingEntry.id),
          roundId: existingEntry.round_id,
          assetId: existingEntry.asset_id,
          direction: existingEntry.direction,
          submittedAt: new Date(existingEntry.submitted_at).toISOString(),
          entryCostTickets: Number(existingEntry.entry_cost_tickets || ARENA_ENTRY_COST_TICKETS),
          state: existingEntry.state,
          outcome: existingEntry.outcome,
        }
      : null,
  }
}

export async function submitArenaPrediction(db, userId, roundId, assetId, direction) {
  const details = await getArenaRoundDetails(db, userId, roundId)
  if (details.round.assetId !== String(assetId || '').trim().toLowerCase()) throw new Error('ARENA_ASSET_MISMATCH')
  if (details.round.status !== 'OPEN') throw new Error('ARENA_ROUND_LOCKED')
  if (details.existingEntry) throw new Error('ARENA_DUPLICATE_ENTRY')
  const wallet = await ensureArenaWallet(db, userId)
  if (Number(wallet?.ticket_balance || 0) < ARENA_ENTRY_COST_TICKETS) throw new Error('ARENA_NO_TICKETS')

  await updateArenaWallet(db, userId, { ticketsDelta: -ARENA_ENTRY_COST_TICKETS })
  const inserted = await run(
    db,
    `INSERT INTO arena_predictions
      (user_id, round_id, asset_id, direction, entry_cost_tickets, state)
     VALUES (?, ?, ?, ?, ?, 'SUBMITTED')
     RETURNING id`,
    [userId, roundId, assetId, normalizeDirection(direction), ARENA_ENTRY_COST_TICKETS],
  )
  const predictionId = inserted.rows?.[0]?.id ?? inserted.lastID ?? null
  await addArenaLedger(db, {
    userId,
    type: 'TICKET_PURCHASE',
    title: 'استخدام تذكرة دخول',
    tickets: -ARENA_ENTRY_COST_TICKETS,
    roundId,
    note: 'تم خصم تذكرة واحدة للدخول إلى الجولة.',
  })
  return {
    id: String(predictionId),
    roundId,
    assetId,
    direction: normalizeDirection(direction),
    submittedAt: new Date().toISOString(),
    entryCostTickets: ARENA_ENTRY_COST_TICKETS,
    state: 'SUBMITTED',
    outcome: null,
  }
}

export async function getArenaResult(db, userId, roundId) {
  const row = await ensureRoundRecord(db, roundId)
  if (!row) throw new Error('ARENA_ROUND_NOT_FOUND')
  const endMs = Date.parse(String(row.ends_at || ''))
  const canSettleNow = Number.isFinite(endMs) && Date.now() >= endMs
  const settled =
    ['SETTLED', 'RESTARTED'].includes(String(row.status || ''))
      ? row
      : canSettleNow
        ? await settleArenaRoundRecord(db, roundId)
        : row
  const entry = await get(
    db,
    `SELECT * FROM arena_predictions
     WHERE user_id = ? AND round_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId, roundId],
  )
  const reward = entry?.reward_id
    ? await get(
        db,
        `SELECT id, round_id, amount, currency, status, created_at, requested_at, processed_at
         FROM arena_bonus_rewards WHERE id = ? LIMIT 1`,
        [entry.reward_id],
      )
    : null
  const rankRow = await get(
    db,
    `SELECT COUNT(*) + 1 AS rank_position
     FROM arena_predictions
     WHERE round_id = ?
       AND settled_at IS NOT NULL
       AND (
         outcome = 'WIN'
         OR (outcome = ? AND id < ?)
       )`,
    [roundId, String(entry?.outcome || ''), Number(entry?.id || 0)],
  )
  const startPrice = Number(settled?.start_price || 0)
  const endPrice = Number(settled?.end_price || settled?.current_price || 0)
  const absoluteChange = roundNumber(endPrice - startPrice, 2)
  const percentChange = startPrice > 0 ? roundNumber((absoluteChange / startPrice) * 100, 2) : 0
  const hasFinalOutcome = ['SETTLED', 'RESTARTED'].includes(String(settled?.status || ''))
  return {
    roundId,
    status: settled?.status || 'CANCELLED',
    startPrice,
    endPrice,
    outcome: hasFinalOutcome ? String(settled?.outcome || 'RESTARTED') : 'RESTARTED',
    absoluteChange: hasFinalOutcome ? absoluteChange : 0,
    percentChange: hasFinalOutcome ? percentChange : 0,
    userWon: hasFinalOutcome ? String(entry?.outcome || '') === 'WIN' : false,
    participationPointsAwarded: hasFinalOutcome && String(entry?.outcome || '') === 'LOSS' ? ARENA_PARTICIPATION_POINTS_LOSS : 0,
    bonusReward: reward
      ? {
          id: String(reward.id),
          roundId: reward.round_id,
          amount: Number(reward.amount || 0),
          currency: 'USDT',
          status: reward.status,
          createdAt: reward.created_at,
          requestedAt: reward.requested_at || undefined,
          processedAt: reward.processed_at || undefined,
        }
      : null,
    rank: hasFinalOutcome ? Number(rankRow?.rank_position || 0) || (entry ? 1 : 0) : 0,
    totalParticipants: Number(settled?.participants_count || 0),
    transferStatus: hasFinalOutcome ? reward?.status || null : null,
  }
}

export async function getArenaLeaderboard(db, userId, period = 'daily') {
  const rangeSql = period === 'weekly' ? `CURRENT_TIMESTAMP - INTERVAL '7 days'` : `CURRENT_TIMESTAMP - INTERVAL '1 day'`
  const rows = await all(
    db,
    `SELECT
       p.user_id,
       COALESCE(NULLIF(u.display_name, ''), CONCAT('User ', u.id)) AS username,
       COUNT(*) FILTER (WHERE p.outcome = 'WIN') AS wins,
       COALESCE(SUM(br.amount), 0) AS score
     FROM arena_predictions p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN arena_bonus_rewards br ON br.prediction_id = p.id
     WHERE p.submitted_at >= ${rangeSql}
     GROUP BY p.user_id, u.display_name, u.id
     ORDER BY score DESC, wins DESC, p.user_id ASC
     LIMIT 3`,
    [],
  ).catch(async () =>
    all(
      db,
      `SELECT
         p.user_id,
         COALESCE(NULLIF(u.display_name, ''), 'User') AS username,
         SUM(CASE WHEN p.outcome = 'WIN' THEN 1 ELSE 0 END) AS wins,
         COALESCE(SUM(br.amount), 0) AS score
       FROM arena_predictions p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN arena_bonus_rewards br ON br.prediction_id = p.id
       GROUP BY p.user_id, u.display_name, u.id
       ORDER BY score DESC, wins DESC, p.user_id ASC
       LIMIT 3`,
      [],
    ),
  )

  return rows.map((row, index) => ({
    rank: index + 1,
    userId: Number(row.user_id),
    username: String(row.username || `User ${row.user_id}`),
    avatarText: String(row.username || 'U').slice(0, 1).toUpperCase(),
    score: Math.round(Number(row.score || 0)),
    wins: Number(row.wins || 0),
    isCurrentUser: Number(row.user_id) === Number(userId),
  }))
}

export async function getArenaMissions(db, userId) {
  const todayRow = await get(
    db,
    `SELECT
       COUNT(*) AS entries_today,
       SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) AS wins_today
     FROM arena_predictions
     WHERE user_id = ? AND submitted_at >= CURRENT_DATE`,
    [userId],
  )
  const entriesToday = Number(todayRow?.entries_today || 0)
  const winsToday = Number(todayRow?.wins_today || 0)
  return [
    {
      id: 'arena-mission-entries',
      title: 'شارك في 3 جولات اليوم',
      description: 'أكمل ثلاث مشاركات لفتح مكافأة نقاط إضافية.',
      progress: Math.min(entriesToday, 3),
      target: 3,
      rewardLabel: '+40 نقطة',
      state: entriesToday >= 3 ? 'COMPLETED' : 'AVAILABLE',
    },
    {
      id: 'arena-mission-wins',
      title: 'فوزان متتاليان',
      description: 'حقق فوزين لفتح تذكرة إضافية.',
      progress: Math.min(winsToday, 2),
      target: 2,
      rewardLabel: '+1 تذكرة',
      state: winsToday >= 2 ? 'COMPLETED' : 'AVAILABLE',
    },
  ]
}

export async function getArenaRewardHistory(db, userId) {
  const rows = await all(
    db,
    `SELECT id, entry_type, title, amount, currency, points, tickets, round_id, reward_id, status, note, created_at
     FROM arena_reward_ledger
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 50`,
    [userId],
  )
  return rows.map((row) => ({
    id: String(row.id),
    type: row.entry_type,
    title: row.title,
    amount: row.amount == null ? undefined : Number(row.amount),
    currency: row.currency || undefined,
    points: row.points == null ? undefined : Number(row.points),
    tickets: row.tickets == null ? undefined : Number(row.tickets),
    roundId: row.round_id || undefined,
    rewardId: row.reward_id == null ? undefined : String(row.reward_id),
    createdAt: row.created_at,
    status: row.status || 'COMPLETED',
    note: row.note || undefined,
  }))
}

export async function requestArenaBonusTransfer(db, userId, rewardId) {
  const reward = await get(
    db,
    `SELECT abr.*, u.vip_level
     FROM arena_bonus_rewards abr
     JOIN users u ON u.id = abr.user_id
     WHERE abr.id = ? AND abr.user_id = ?
     LIMIT 1`,
    [rewardId, userId],
  )
  if (!reward) throw new Error('ARENA_REWARD_NOT_FOUND')
  if (Number(reward.vip_level || 0) <= 0) throw new Error('ARENA_VIP_REQUIRED')
  if (String(reward.status || '') !== 'ELIGIBLE_VIP') throw new Error('ARENA_TRANSFER_NOT_ALLOWED')

  await run(
    db,
    `UPDATE arena_bonus_rewards
     SET status = 'TRANSFER_REQUESTED', requested_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [rewardId],
  )
  await addArenaLedger(db, {
    userId,
    type: 'BONUS_TRANSFER',
    title: 'طلب تحويل مكافأة الساحة',
    rewardId,
    status: 'TRANSFER_REQUESTED',
  })
  return await get(
    db,
    `SELECT id, round_id, amount, currency, status, created_at, requested_at, processed_at
     FROM arena_bonus_rewards
     WHERE id = ? LIMIT 1`,
    [rewardId],
  )
}

export async function convertArenaParticipationPoints(db, userId) {
  const walletBefore = await ensureArenaWallet(db, userId)
  if (Number(walletBefore?.participation_points || 0) < ARENA_POINTS_PER_TICKET) throw new Error('ARENA_POINTS_NOT_ENOUGH')
  const walletAfter = await autoConvertArenaPoints(db, userId, 'manual')
  return {
    ticketBalance: Number(walletAfter?.ticket_balance || 0),
    participationPoints: Number(walletAfter?.participation_points || 0),
  }
}

export async function purchaseArenaTickets(db, userId, packageId) {
  const selectedPackage = ARENA_TICKET_PACKAGES.find((item) => item.id === packageId)
  if (!selectedPackage) throw new Error('ARENA_PACKAGE_NOT_FOUND')
  const ledgerId = await addArenaLedger(db, {
    userId,
    type: 'TICKET_PURCHASE',
    title: `شراء ${selectedPackage.title}`,
    amount: selectedPackage.priceUsdt,
    currency: 'USDT',
    tickets: selectedPackage.tickets,
    status: 'COMPLETED',
  })
  const charge = await adjustBalance(db, {
    userId,
    currency: 'USDT',
    delta: -selectedPackage.priceUsdt,
    referenceType: 'arena_ticket_purchase',
    referenceId: Number(ledgerId || Date.now()),
    idempotencyKey: `arena_ticket_purchase_${userId}_${selectedPackage.id}_${ledgerId || Date.now()}`,
  })
  const wallet = await updateArenaWallet(db, userId, { ticketsDelta: selectedPackage.tickets })
  return {
    package: selectedPackage,
    route: '/deposit',
    ticketBalance: Number(wallet?.ticket_balance || 0),
    walletTxnId: charge.walletTxnId,
    balanceAfter: charge.balanceAfter,
  }
}
