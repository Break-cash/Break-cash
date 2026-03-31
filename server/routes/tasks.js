import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAnyPermission, requireAuth, requirePermission } from '../middleware/auth.js'
import {
  createStrategyTradeOpenDebit,
  createStrategyTradePrincipalReturn,
  createStrategyTradeProfitReward,
  createTaskReward,
  getStrategyTradePurchasePower,
  getTotalMainBalance,
} from '../services/wallet-service.js'
import { fetchBestQuote, sharedMarketFeed } from '../services/marketFeed.js'
import { createLocalizedNotification } from '../services/notifications.js'

const TASK_PERMISSION = 'انشاء مهام'

function normalizeText(value, max = 220) {
  return String(value || '').trim().slice(0, max)
}

function normalizeCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .slice(0, 40)
}

function normalizePercent(value, fallback = 0) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0 || n > 1000) return fallback
  return Number(n.toFixed(4))
}

function normalizeDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString()
}

function normalizeFeatureType(value) {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'promo_bonus' ? 'promo_bonus' : 'trial_trade'
}

function normalizeRewardMode(value) {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'fixed' ? 'fixed' : 'percent'
}

function parseJsonSafe(value, fallback) {
  try {
    if (value == null || value === '') return fallback
    return typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    return fallback
  }
}

async function resolveLiveQuote(symbol) {
  const targetSymbol = String(symbol || 'BTCUSDT').trim().toUpperCase() || 'BTCUSDT'
  const cached = sharedMarketFeed.getPair(targetSymbol)?.pair
  if (cached?.symbol) return cached
  const list = sharedMarketFeed.getQuotes().items || []
  const fromList = list.find((item) => item.symbol === targetSymbol)
  if (fromList) return fromList
  return fetchBestQuote(targetSymbol)
}

const STRATEGY_TRADE_MIN_SETTLE_DELAY_MS = 90 * 1000
const STRATEGY_TRADE_MAX_SETTLE_DELAY_MS = 7 * 60 * 1000

function getStrategyTradeDelayMs() {
  const span = STRATEGY_TRADE_MAX_SETTLE_DELAY_MS - STRATEGY_TRADE_MIN_SETTLE_DELAY_MS
  return STRATEGY_TRADE_MIN_SETTLE_DELAY_MS + Math.floor(Math.random() * (span + 1))
}

async function getStrategyTradePurchaseBase(db, userId, currency = 'USDT') {
  const normalizedCurrency = String(currency || 'USDT').trim().toUpperCase()
  const [funding, lockedRow] = await Promise.all([
    getStrategyTradePurchasePower(db, userId, normalizedCurrency),
    get(
      db,
      `SELECT COALESCE(SUM(principal_amount), 0) AS locked_amount
       FROM user_principal_locks
       WHERE user_id = ? AND currency = ? AND lock_status = 'locked'`,
      [userId, normalizedCurrency],
    ),
  ])
  const lockedAmount = Number(lockedRow?.locked_amount || 0)
  const totalAssets = Number(funding?.totalFundingAssets || 0)
  const mainBalance = Number(funding?.mainBalance || 0)
  const pendingEarnings = Number(funding?.pendingEarnings || 0)
  const eligibleAssets = Number(Math.max(0, totalAssets).toFixed(8))
  return {
    currency: normalizedCurrency,
    totalAssets: Number(totalAssets.toFixed(8)),
    lockedAmount: Number(lockedAmount.toFixed(8)),
    mainBalance: Number(mainBalance.toFixed(8)),
    pendingEarnings: Number(pendingEarnings.toFixed(8)),
    eligibleAssets,
  }
}

function enrichStrategyUsageRow(row) {
  const meta = parseJsonSafe(row?.metadata_json, {})
  const autoSettleAt = typeof meta?.autoSettleAt === 'string' ? meta.autoSettleAt : null
  const settleDelayMs = Number(meta?.settleDelayMs || 0)
  return {
    id: Number(row.usage_id),
    status: String(row.usage_status || 'consumed'),
    selectedSymbol: String(row.selected_symbol || row.asset_symbol || 'BTCUSDT').toUpperCase(),
    balanceSnapshot: Number(row.balance_snapshot || 0),
    totalAssetsSnapshot:
      Number(meta?.totalAssetsSnapshot || 0) > 0
        ? Number(meta?.totalAssetsSnapshot || 0)
        : Number(row.balance_snapshot || 0),
    lockedExcludedAmount: Number(meta?.lockedExcludedAmount || 0),
    purchasePercent:
      Number(row.usage_purchase_percent || row.purchase_percent || meta?.purchasePercent || 50),
    stakeAmount: Number(row.stake_amount || 0),
    entryPrice: row.entry_price == null ? null : Number(row.entry_price),
    exitPrice: row.exit_price == null ? null : Number(row.exit_price),
    rewardValue: Number(row.usage_reward_value || 0),
    tradeReturnPercent: Number(row.usage_trade_return_percent || 0),
    confirmedAt: row.confirmed_at,
    settledAt: row.settled_at,
    usedAt: row.used_at,
    strategyCode: typeof meta?.code === 'string' ? meta.code : '',
    expertName:
      typeof meta?.expertName === 'string' && meta.expertName.trim()
        ? meta.expertName
        : String(row?.expert_name || ''),
    balanceSourceDebits: Array.isArray(meta?.balanceSourceDebits)
      ? meta.balanceSourceDebits
          .map((item) => ({
            sourceType: String(item?.sourceType || 'system').trim().toLowerCase(),
            amount: Number(item?.amount || 0),
          }))
          .filter((item) => item.amount > 0)
      : [],
    autoSettleAt,
    settleDelayMs: Number.isFinite(settleDelayMs) && settleDelayMs > 0 ? settleDelayMs : null,
  }
}

function isStrategyUsageRemovableRecord(usage) {
  const normalizedStatus = String(usage?.status || '').trim().toLowerCase()
  if (normalizedStatus && normalizedStatus !== 'trade_active') return true
  if (usage?.settled_at) return true
  if (usage?.wallet_credit_txn_id != null && Number(usage.wallet_credit_txn_id || 0) > 0) return true
  if (usage?.exit_price != null && Number.isFinite(Number(usage.exit_price))) return true
  return false
}

async function hideStrategyUsageRecord(db, usageId, actorUserId) {
  const attempts = [
    {
      sql: `UPDATE strategy_code_usages
            SET admin_hidden_at = CURRENT_TIMESTAMP,
                admin_hidden_by = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      params: [actorUserId, usageId],
    },
    {
      sql: `UPDATE strategy_code_usages
            SET admin_hidden_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      params: [usageId],
    },
    {
      sql: `UPDATE strategy_code_usages
            SET status = 'admin_deleted',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      params: [usageId],
    },
    {
      sql: `UPDATE strategy_code_usages
            SET status = 'admin_deleted'
            WHERE id = ?`,
      params: [usageId],
    },
  ]

  let lastError = null
  for (const attempt of attempts) {
    try {
      await run(db, attempt.sql, attempt.params)
      return true
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('STRATEGY_USAGE_HIDE_FAILED')
}

const strategyUsageColumnCache = new WeakMap()

async function getStrategyUsageColumns(db) {
  const cached = strategyUsageColumnCache.get(db)
  if (cached) return cached

  let rows = []
  try {
    rows = await all(
      db,
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'strategy_code_usages'`,
    )
  } catch {
    rows = []
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    try {
      rows = await all(db, `PRAGMA table_info(strategy_code_usages)`)
    } catch {
      rows = []
    }
  }

  const columns = new Set(
    (rows || [])
      .map((row) => String(row?.column_name || row?.name || '').trim().toLowerCase())
      .filter(Boolean),
  )
  strategyUsageColumnCache.set(db, columns)
  return columns
}

function hasStrategyUsageColumn(columns, columnName) {
  return columns instanceof Set && columns.has(String(columnName || '').trim().toLowerCase())
}

function buildStrategyUsageVisibilityClause(alias, columns) {
  const normalizedAlias = String(alias || 'scu').trim() || 'scu'
  const conditions = []
  if (hasStrategyUsageColumn(columns, 'admin_hidden_at')) {
    conditions.push(`${normalizedAlias}.admin_hidden_at IS NULL`)
  }
  if (hasStrategyUsageColumn(columns, 'status')) {
    conditions.push(`COALESCE(${normalizedAlias}.status, '') <> 'admin_deleted'`)
  }
  return conditions.length > 0 ? conditions.join(' AND ') : '1=1'
}

async function getStrategyUsageVisibilityClause(db, alias) {
  const columns = await getStrategyUsageColumns(db)
  return buildStrategyUsageVisibilityClause(alias, columns)
}

async function getStrategyUsageAdminRecord(db, usageId) {
  const columns = await getStrategyUsageColumns(db)
  const selectParts = ['id']
  selectParts.push(hasStrategyUsageColumn(columns, 'status') ? 'status' : `'' AS status`)
  selectParts.push(hasStrategyUsageColumn(columns, 'admin_hidden_at') ? 'admin_hidden_at' : `NULL AS admin_hidden_at`)
  selectParts.push(hasStrategyUsageColumn(columns, 'settled_at') ? 'settled_at' : `NULL AS settled_at`)
  selectParts.push(
    hasStrategyUsageColumn(columns, 'wallet_credit_txn_id')
      ? 'wallet_credit_txn_id'
      : `NULL AS wallet_credit_txn_id`,
  )
  selectParts.push(hasStrategyUsageColumn(columns, 'exit_price') ? 'exit_price' : `NULL AS exit_price`)

  return get(
    db,
    `SELECT ${selectParts.join(', ')}
     FROM strategy_code_usages
     WHERE id = ?
     LIMIT 1`,
    [usageId],
  )
}

function getStrategyTradeSourceDebits(usage) {
  const meta = parseJsonSafe(usage?.metadata_json, {})
  const configured = Array.isArray(meta?.balanceSourceDebits)
    ? meta.balanceSourceDebits
        .map((item) => ({
          sourceType: String(item?.sourceType || 'system').trim().toLowerCase(),
          amount: Number(Number(item?.amount || 0).toFixed(8)),
        }))
        .filter((item) => item.amount > 0)
    : []
  if (configured.length > 0) return configured
  const stakeAmount = Number(Number(usage?.stake_amount || 0).toFixed(8))
  return stakeAmount > 0 ? [{ sourceType: 'system', amount: stakeAmount }] : []
}

async function getStrategyTradePrincipalTxnRows(db, usage) {
  const usageId = Number(usage?.id || 0)
  const codeId = Number(usage?.code_id || 0)
  const userId = Number(usage?.user_id || 0)
  if (!usageId || !userId) return []
  return all(
    db,
    `SELECT id, reference_type, amount, metadata
     FROM wallet_transactions
     WHERE user_id = ?
       AND currency = 'USDT'
       AND (
         id = ?
         OR idempotency_key = ?
         OR idempotency_key LIKE ?
         OR (reference_type = 'strategy_trade_settlement' AND reference_id = ?)
         OR (reference_type = 'strategy_trade_principal_return' AND metadata LIKE ?)
         OR (reference_type = 'admin_adjust' AND metadata LIKE ?)
       )
     ORDER BY id DESC
     LIMIT 20`,
    [
      userId,
      Number(usage?.wallet_credit_txn_id || 0),
      `strategy_trade_principal_${usageId}`,
      `strategy_trade_principal_${usageId}_%`,
      codeId,
      `%\"usageId\":${usageId}%`,
      `%usageId=${usageId}%`,
    ],
  )
}

async function settleStrategyTradeUsage(tx, usage, actorUserId) {
  if (!usage) throw new Error('NOT_FOUND')
  if (String(usage.status || '') !== 'trade_active') throw new Error('NOT_ACTIVE')
  if (usage.wallet_credit_txn_id) throw new Error('ALREADY_SETTLED')

  const meta = parseJsonSafe(usage.metadata_json, {})
  const autoSettleAt = typeof meta?.autoSettleAt === 'string' ? Date.parse(meta.autoSettleAt) : Number.NaN
  if (!Number.isNaN(autoSettleAt) && autoSettleAt > Date.now()) {
    const error = new Error('SETTLEMENT_NOT_READY')
    error.availableAt = new Date(autoSettleAt).toISOString()
    throw error
  }

  const liveQuote = await resolveLiveQuote(String(usage.selected_symbol || 'BTCUSDT'))
  const stakeAmount = Number(usage.stake_amount || 0)
  const returnPercent = Number(usage.trade_return_percent || 0)
  const profitAmount = Number(((stakeAmount * returnPercent) / 100).toFixed(8))
  const principalCredit = await createStrategyTradePrincipalReturn(tx, {
    userId: usage.user_id,
    currency: 'USDT',
    usageId: Number(usage.id),
    amount: stakeAmount,
    sourceCredits: getStrategyTradeSourceDebits(usage),
    referenceId: Number(usage.code_id),
    createdBy: actorUserId,
  })
  const profitCredit =
    profitAmount > 0
      ? await createStrategyTradeProfitReward(tx, {
          userId: usage.user_id,
          amount: profitAmount,
          usageId: Number(usage.id),
          currency: 'USDT',
        })
      : null
  const nextMeta = JSON.stringify({
    ...meta,
    autoSettled: true,
    settledBy: actorUserId,
    settledAt: new Date().toISOString(),
  })
  await run(
    tx,
    `UPDATE strategy_code_usages
     SET status = 'trade_settled',
         exit_price = ?,
         reward_value = ?,
         wallet_credit_txn_id = ?,
         metadata_json = ?,
         settled_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [Number(liveQuote.price || 0), profitAmount, principalCredit.walletTxnId, nextMeta, usage.id],
  )
  await createLocalizedNotification(tx, usage.user_id, 'strategy_trade_settled', {
    amount: profitAmount,
    currency: 'USDT',
  })
  return {
    usageId: Number(usage.id || 0),
    status: 'trade_settled',
    exitPrice: Number(liveQuote.price || 0),
    payoutAmount: Number((stakeAmount + profitAmount).toFixed(8)),
    profitAmount,
    balanceAfter: principalCredit.balanceAfter,
    profitLockedUntil: profitCredit?.lockedUntil || null,
  }
}

async function repairSettledStrategyTradeUsage(tx, usage, actorUserId) {
  if (!usage) return { repaired: false, reason: 'NOT_FOUND' }
  if (String(usage.status || '') !== 'trade_settled') return { repaired: false, reason: 'NOT_SETTLED' }

  const usageId = Number(usage.id || 0)
  const codeId = Number(usage.code_id || 0)
  const userId = Number(usage.user_id || 0)
  const stakeAmount = Number(usage.stake_amount || 0)
  const rewardValue = Number(usage.reward_value || 0)
  const returnPercent = Number(usage.trade_return_percent || 0)
  const profitAmount = Number((rewardValue > 0 ? rewardValue : (stakeAmount * returnPercent) / 100).toFixed(8))

  const linkedTxns = await getStrategyTradePrincipalTxnRows(tx, usage)
  const linkedTxn = linkedTxns[0] || null

  const handledByLegacyOrManual =
    linkedTxns.some(
      (row) =>
        String(row?.reference_type || '') === 'strategy_trade_settlement' ||
        String(row?.reference_type || '') === 'admin_adjust',
    )

  const principalCredit =
    handledByLegacyOrManual
      ? { walletTxnId: Number(linkedTxn.id || 0), balanceAfter: await getTotalMainBalance(tx, userId, 'USDT') }
      : stakeAmount > 0
        ? await createStrategyTradePrincipalReturn(tx, {
            userId,
            currency: 'USDT',
            usageId,
            amount: stakeAmount,
            sourceCredits: getStrategyTradeSourceDebits(usage),
            referenceId: codeId,
            createdBy: actorUserId,
          })
        : { walletTxnId: null, balanceAfter: await getTotalMainBalance(tx, userId, 'USDT') }

  let profitCredit = null
  if (!handledByLegacyOrManual && profitAmount > 0) {
    profitCredit = await createStrategyTradeProfitReward(tx, {
      userId,
      amount: profitAmount,
      usageId,
      currency: 'USDT',
    })
  }

  const meta = parseJsonSafe(usage.metadata_json, {})
  const nextMeta = JSON.stringify({
    ...meta,
    settlementRepairCheckedAt: new Date().toISOString(),
    settlementRepairActor: actorUserId,
    settlementRepairMode: handledByLegacyOrManual
      ? String(linkedTxn?.reference_type || 'existing_credit')
      : 'principal_and_profit_rehydrated',
  })

  await run(
    tx,
    `UPDATE strategy_code_usages
     SET reward_value = ?,
         wallet_credit_txn_id = COALESCE(wallet_credit_txn_id, ?),
         metadata_json = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [profitAmount, principalCredit?.walletTxnId || null, nextMeta, usageId],
  )

  return {
    repaired: true,
    principalTxnId: principalCredit?.walletTxnId || null,
    profitLockedUntil: profitCredit?.lockedUntil || null,
    skippedProfitRepair: handledByLegacyOrManual,
  }
}

async function repairSettledStrategyTradeGaps(db, userId, limit = 20) {
  const rows = await all(
    db,
    `SELECT id
     FROM strategy_code_usages
     WHERE user_id = ?
       AND status = 'trade_settled'
     ORDER BY id DESC
     LIMIT ?`,
    [userId, Math.max(1, Math.min(100, Number(limit) || 20))],
  )

  for (const row of rows) {
    try {
      await withTransaction(db, async (tx) => {
        const usage = await get(
          tx,
          `SELECT id, user_id, code_id, status, selected_symbol, stake_amount, reward_value,
                  trade_return_percent, wallet_credit_txn_id, metadata_json
           FROM strategy_code_usages
           WHERE id = ? AND user_id = ?
           LIMIT 1`,
          [row.id, userId],
        )
        if (!usage) return
        const profitEntry = await get(
          tx,
          `SELECT id
           FROM earning_entries
           WHERE source_type = 'tasks'
             AND reference_type = 'strategy_trade_profit'
             AND reference_id = ?
           LIMIT 1`,
          [usage.id],
        )
        const principalTxns = await getStrategyTradePrincipalTxnRows(tx, usage)
        const expectedPrincipalCreditCount = Math.max(1, getStrategyTradeSourceDebits(usage).length)
        const principalCreditAmount = Number(
          principalTxns.reduce((acc, row) => acc + Math.max(0, Number(row?.amount || 0)), 0).toFixed(8),
        )
        const hasLegacyOrManualPrincipal = principalTxns.some(
          (row) =>
            String(row?.reference_type || '') === 'strategy_trade_settlement' ||
            String(row?.reference_type || '') === 'admin_adjust',
        )
        const hasCompletePrincipalRepair =
          hasLegacyOrManualPrincipal ||
          (principalTxns.length >= expectedPrincipalCreditCount &&
            principalCreditAmount + 0.00000001 >= Number(usage.stake_amount || 0))

        const rewardValue = Number(usage.reward_value || 0)
        if (hasCompletePrincipalRepair && (profitEntry || rewardValue <= 0)) return
        await repairSettledStrategyTradeUsage(tx, usage, userId)
      })
    } catch (error) {
      console.warn('[strategy-trade] settlement repair skipped', {
        userId,
        usageId: Number(row.id || 0),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

async function autoSettleDueStrategyTrades(db, userId) {
  const dueUsages = await all(
    db,
    `SELECT id
     FROM strategy_code_usages
     WHERE user_id = ?
       AND status = 'trade_active'
       AND metadata_json IS NOT NULL
       AND (
         metadata_json LIKE '%"autoSettleAt":"%'
       )
     ORDER BY id ASC
     LIMIT 20`,
    [userId],
  )
  for (const row of dueUsages) {
    try {
      await withTransaction(db, async (tx) => {
        const usage = await get(
          tx,
          `SELECT id, user_id, code_id, status, selected_symbol, stake_amount,
                  trade_return_percent, wallet_credit_txn_id, metadata_json
           FROM strategy_code_usages
           WHERE id = ? AND user_id = ?
           LIMIT 1`,
          [row.id, userId],
        )
        const meta = parseJsonSafe(usage?.metadata_json, {})
        const autoSettleAt = typeof meta?.autoSettleAt === 'string' ? Date.parse(meta.autoSettleAt) : Number.NaN
        if (!usage || Number.isNaN(autoSettleAt) || autoSettleAt > Date.now()) return
        await settleStrategyTradeUsage(tx, usage, userId)
      })
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'SETTLEMENT_NOT_READY') {
        console.warn('[strategy-trade] auto settle skipped', { userId, usageId: Number(row.id || 0), error: error instanceof Error ? error.message : String(error) })
      }
    }
  }
}

export async function runDueStrategyTradeSettlementSweep(db, limit = 50) {
  const dueRows = await all(
    db,
    `SELECT id, user_id, metadata_json
     FROM strategy_code_usages
     WHERE status = 'trade_active'
       AND metadata_json IS NOT NULL
       AND metadata_json LIKE '%"autoSettleAt":"%'
     ORDER BY id ASC
     LIMIT ?`,
    [Math.max(1, Math.min(500, Number(limit) || 50))],
  )

  let settledCount = 0
  for (const row of dueRows) {
    try {
      const meta = parseJsonSafe(row?.metadata_json, {})
      const autoSettleAt = typeof meta?.autoSettleAt === 'string' ? Date.parse(meta.autoSettleAt) : Number.NaN
      if (Number.isNaN(autoSettleAt) || autoSettleAt > Date.now()) continue

      await withTransaction(db, async (tx) => {
        const usage = await get(
          tx,
          `SELECT id, user_id, code_id, status, selected_symbol, stake_amount,
                  trade_return_percent, wallet_credit_txn_id, metadata_json
           FROM strategy_code_usages
           WHERE id = ? AND user_id = ?
           LIMIT 1`,
          [row.id, row.user_id],
        )
        if (!usage) return
        await settleStrategyTradeUsage(tx, usage, Number(row.user_id || 0))
        settledCount += 1
      })
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'SETTLEMENT_NOT_READY') {
        console.warn('[strategy-trade] background auto settle skipped', {
          userId: Number(row.user_id || 0),
          usageId: Number(row.id || 0),
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return { checked: dueRows.length, settled: settledCount }
}

function buildStrategyCodeRow(row) {
  return {
    id: Number(row.id),
    code: String(row.code || ''),
    title: String(row.title || ''),
    description: String(row.description || ''),
    expertName: String(row.expert_name || ''),
    featureType: normalizeFeatureType(row.feature_type),
    rewardMode: normalizeRewardMode(row.reward_mode),
    rewardValue: Number(row.reward_value || 0),
    assetSymbol: String(row.asset_symbol || 'BTCUSDT').toUpperCase(),
    purchasePercent: Number(row.purchase_percent || 50),
    tradeReturnPercent: Number(row.trade_return_percent || 0),
    expiresAt: row.expires_at,
    isActive: Number(row.is_active || 0) === 1,
    createdBy: row.created_by == null ? null : Number(row.created_by),
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usageCount: Number(row.usage_count || 0),
    consumedCount: Number(row.consumed_count || 0),
  }
}

function normalizeTiers(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => ({
      minBalance: Number(item?.minBalance || 0),
      maxBalance: item?.maxBalance == null || item?.maxBalance === '' ? null : Number(item.maxBalance),
      percent: Number(item?.percent || 0),
    }))
    .filter((item) => Number.isFinite(item.minBalance) && item.minBalance >= 0 && Number.isFinite(item.percent) && item.percent >= 0)
    .map((item) => ({
      minBalance: Number(item.minBalance.toFixed(8)),
      maxBalance: item.maxBalance != null && Number.isFinite(item.maxBalance) ? Number(item.maxBalance.toFixed(8)) : null,
      percent: Number(item.percent.toFixed(4)),
    }))
    .sort((a, b) => a.minBalance - b.minBalance)
    .slice(0, 24)
}

async function withTransaction(db, fn) {
  if (typeof db.connect === 'function') {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // ignore
      }
      throw error
    } finally {
      client.release()
    }
  }
  await run(db, 'BEGIN')
  try {
    const result = await fn(db)
    await run(db, 'COMMIT')
    return result
  } catch (error) {
    await run(db, 'ROLLBACK')
    throw error
  }
}

function resolveTierPercent(balanceAmount, tiers, fallbackPercent) {
  const balance = Number(balanceAmount || 0)
  for (const tier of tiers) {
    const minOk = balance >= Number(tier.minBalance || 0)
    const maxOk = tier.maxBalance == null ? true : balance <= Number(tier.maxBalance)
    if (minOk && maxOk) return Number(tier.percent || 0)
  }
  return Number(fallbackPercent || 0)
}

export function createTasksRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/codes/my', async (req, res) => {
    const rows = await all(
      db,
      `SELECT tr.id, tr.code, tr.title, tr.description, tr.base_percent, tr.tiers_json, tr.max_reward_amount, tr.is_active,
              tr.created_at, tr.updated_at,
              CASE WHEN rr.id IS NULL THEN 0 ELSE 1 END AS already_used
       FROM task_reward_codes tr
       LEFT JOIN task_reward_redemptions rr ON rr.code_id = tr.id AND rr.user_id = ?
       ORDER BY tr.id DESC
       LIMIT 120`,
      [req.user.id],
    )
    const items = rows.map((row) => {
      let tiers = []
      try {
        tiers = normalizeTiers(JSON.parse(String(row.tiers_json || '[]')))
      } catch {
        tiers = []
      }
      return {
        id: Number(row.id),
        code: String(row.code || ''),
        title: String(row.title || ''),
        description: String(row.description || ''),
        basePercent: Number(row.base_percent || 0),
        tiers,
        maxRewardAmount: Number(row.max_reward_amount || 0),
        isActive: Number(row.is_active || 0) === 1,
        alreadyUsed: Number(row.already_used || 0) === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })
    return res.json({ items })
  })

  router.post('/codes/redeem', async (req, res) => {
    const code = normalizeCode(req.body?.code)
    if (!code) return res.status(400).json({ error: 'INVALID_INPUT' })
    try {
      const payload = await withTransaction(db, async (tx) => {
        const rewardCode = await get(
          tx,
          `SELECT id, code, title, base_percent, tiers_json, max_reward_amount, is_active
           FROM task_reward_codes
           WHERE code = ? LIMIT 1`,
          [code],
        )
        if (!rewardCode || Number(rewardCode.is_active || 0) !== 1) {
          throw new Error('CODE_NOT_FOUND')
        }
        const existing = await get(
          tx,
          `SELECT id FROM task_reward_redemptions WHERE code_id = ? AND user_id = ? LIMIT 1`,
          [rewardCode.id, req.user.id],
        )
        if (existing) throw new Error('CODE_ALREADY_USED')

        const balanceSnapshot = await getTotalMainBalance(tx, req.user.id, 'USDT')
        let tiers = []
        try {
          tiers = normalizeTiers(JSON.parse(String(rewardCode.tiers_json || '[]')))
        } catch {
          tiers = []
        }
        const rewardPercent = resolveTierPercent(balanceSnapshot, tiers, Number(rewardCode.base_percent || 0))
        let rewardAmount = Number(((balanceSnapshot * rewardPercent) / 100).toFixed(8))
        const maxRewardAmount = Number(rewardCode.max_reward_amount || 0)
        if (maxRewardAmount > 0 && rewardAmount > maxRewardAmount) rewardAmount = maxRewardAmount
        if (!Number.isFinite(rewardAmount) || rewardAmount <= 0) {
          throw new Error('INVALID_REWARD_RULE')
        }

        await run(
          tx,
          `INSERT INTO task_reward_redemptions (code_id, user_id, balance_snapshot, reward_percent, reward_amount)
           VALUES (?, ?, ?, ?, ?)`,
          [rewardCode.id, req.user.id, balanceSnapshot, rewardPercent, rewardAmount],
        )
        const redemptionRow = await get(tx, `SELECT id FROM task_reward_redemptions WHERE code_id = ? AND user_id = ? LIMIT 1`, [rewardCode.id, req.user.id])
        const redemptionId = Number(redemptionRow?.id ?? 0)
        if (!redemptionId) throw new Error('REDEMPTION_FAILED')

        await createTaskReward(tx, {
          userId: req.user.id,
          amount: rewardAmount,
          redemptionId,
          currency: 'USDT',
          note: `Redeemed task code ${code}`,
        })
        await createLocalizedNotification(tx, req.user.id, 'task_reward_activated', {
          code,
          amount: rewardAmount,
          currency: 'USDT',
        })
        return { rewardAmount, rewardPercent, balanceSnapshot }
      })
      return res.json({ ok: true, ...payload })
    } catch (error) {
      const codeMap = new Set(['CODE_NOT_FOUND', 'CODE_ALREADY_USED', 'INVALID_REWARD_RULE'])
      if (error instanceof Error && codeMap.has(error.message)) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.get('/admin/codes', requirePermission(db, TASK_PERMISSION), async (_req, res) => {
    const rows = await all(
      db,
      `SELECT id, code, title, description, base_percent, tiers_json, max_reward_amount, is_active, created_by, created_at, updated_at
       FROM task_reward_codes
       ORDER BY id DESC
       LIMIT 220`,
    )
    const items = rows.map((row) => {
      let tiers = []
      try {
        tiers = normalizeTiers(JSON.parse(String(row.tiers_json || '[]')))
      } catch {
        tiers = []
      }
      return {
        id: Number(row.id),
        code: String(row.code || ''),
        title: String(row.title || ''),
        description: String(row.description || ''),
        basePercent: Number(row.base_percent || 0),
        tiers,
        maxRewardAmount: Number(row.max_reward_amount || 0),
        isActive: Number(row.is_active || 0) === 1,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })
    return res.json({ items })
  })

  router.post('/admin/codes', requirePermission(db, TASK_PERMISSION), async (req, res) => {
    const id = Number(req.body?.id || 0)
    const code = normalizeCode(req.body?.code)
    const title = normalizeText(req.body?.title, 90)
    const description = normalizeText(req.body?.description, 220)
    const isActive = req.body?.isActive === false ? 0 : 1
    const basePercent = normalizePercent(req.body?.basePercent, 0)
    const maxRewardAmount = Math.max(0, Number(req.body?.maxRewardAmount || 0))
    const tiers = normalizeTiers(req.body?.tiers)
    if (!code || !title) return res.status(400).json({ error: 'INVALID_INPUT' })

    if (id > 0) {
      await run(
        db,
        `UPDATE task_reward_codes
         SET code = ?, title = ?, description = ?, base_percent = ?, tiers_json = ?, max_reward_amount = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [code, title, description || null, basePercent, JSON.stringify(tiers), maxRewardAmount, isActive, id],
      )
      return res.json({ ok: true, id })
    }
    const inserted = await run(
      db,
      `INSERT INTO task_reward_codes (code, title, description, base_percent, tiers_json, max_reward_amount, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [code, title, description || null, basePercent, JSON.stringify(tiers), maxRewardAmount, isActive, req.user.id],
    )
    return res.json({ ok: true, id: Number(inserted.lastID || inserted.rows?.[0]?.id || 0) })
  })

  router.post('/admin/codes/:id/toggle', requirePermission(db, TASK_PERMISSION), async (req, res) => {
    const id = Number(req.params.id)
    const isActive = req.body?.isActive === false ? 0 : 1
    if (!id) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `UPDATE task_reward_codes SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [isActive, id],
    )
    return res.json({ ok: true })
  })

  router.delete('/admin/codes/:id', requirePermission(db, TASK_PERMISSION), async (req, res) => {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(db, `DELETE FROM task_reward_codes WHERE id = ?`, [id])
    return res.json({ ok: true })
  })

  router.get('/strategy-codes/my', async (req, res) => {
    await repairSettledStrategyTradeGaps(db, req.user.id)
    await autoSettleDueStrategyTrades(db, req.user.id)
    const usageVisibilityClause = await getStrategyUsageVisibilityClause(db, 'scu')
    const codeRows = await all(
      db,
      `SELECT sc.id, sc.code, sc.title, sc.description, sc.feature_type, sc.reward_mode, sc.reward_value,
              sc.asset_symbol, sc.purchase_percent, sc.expert_name, sc.trade_return_percent, sc.expires_at, sc.is_active, sc.created_at, sc.updated_at,
              scu.id AS usage_id, scu.status AS usage_status, scu.selected_symbol, scu.balance_snapshot,
              scu.stake_amount, scu.purchase_percent AS usage_purchase_percent, scu.entry_price, scu.exit_price, scu.reward_value AS usage_reward_value,
              scu.trade_return_percent AS usage_trade_return_percent, scu.confirmed_at, scu.settled_at, scu.created_at AS used_at,
              scu.metadata_json
        FROM strategy_codes sc
        LEFT JOIN strategy_code_usages scu
          ON scu.code_id = sc.id
         AND scu.user_id = ?
         AND ${usageVisibilityClause}
        WHERE sc.feature_type = 'trial_trade'
         ORDER BY sc.id DESC`,
      [req.user.id],
    )
    const items = codeRows.map((row) => ({
      id: Number(row.id),
      code: String(row.code || ''),
      title: String(row.title || ''),
      description: String(row.description || ''),
      expertName: String(row.expert_name || ''),
      featureType: normalizeFeatureType(row.feature_type),
      rewardMode: normalizeRewardMode(row.reward_mode),
      rewardValue: Number(row.reward_value || 0),
      assetSymbol: String(row.asset_symbol || 'BTCUSDT').toUpperCase(),
      purchasePercent: Number(row.purchase_percent || 50),
      tradeReturnPercent: Number(row.trade_return_percent || 0),
      expiresAt: row.expires_at,
      isActive: Number(row.is_active || 0) === 1,
      alreadyUsed: row.usage_id != null,
      usage: row.usage_id == null
        ? null
        : enrichStrategyUsageRow(row),
    }))
    return res.json({ items })
  })

  router.post('/strategy-codes/preview', async (req, res) => {
    const code = normalizeCode(req.body?.code)
    const requestedSymbol = String(req.body?.symbol || '').trim().toUpperCase()
    if (!code) return res.status(400).json({ error: 'INVALID_INPUT' })

    const row = await get(
      db,
      `SELECT id, code, title, description, expert_name, feature_type, reward_mode, reward_value, asset_symbol,
              purchase_percent, trade_return_percent, expires_at, is_active
       FROM strategy_codes
       WHERE code = ?
         AND feature_type = 'trial_trade'
       LIMIT 1`,
      [code],
    )
    if (!row || Number(row.is_active || 0) !== 1) {
      return res.status(404).json({ error: 'CODE_NOT_FOUND' })
    }
    if (row.expires_at && Date.parse(row.expires_at) < Date.now()) {
      return res.status(400).json({ error: 'CODE_EXPIRED' })
    }
    const existing = await get(
      db,
      `SELECT id, status FROM strategy_code_usages WHERE code_id = ? AND user_id = ? LIMIT 1`,
      [row.id, req.user.id],
    )
    if (existing) {
      return res.status(400).json({ error: 'CODE_ALREADY_USED', status: existing.status })
    }
    const featureType = normalizeFeatureType(row.feature_type)
    const configuredSymbol = String(row.asset_symbol || 'BTCUSDT').toUpperCase()
    if (requestedSymbol && requestedSymbol !== configuredSymbol) {
      return res.status(400).json({ error: 'SYMBOL_LOCKED', assetSymbol: configuredSymbol })
    }
    const symbol = configuredSymbol
    const quote = await resolveLiveQuote(symbol).catch(() => null)

    if (featureType === 'trial_trade') {
      const activeTrade = await get(
        db,
        `SELECT id
         FROM strategy_code_usages
         WHERE user_id = ?
           AND status = 'trade_active'
         LIMIT 1`,
        [req.user.id],
      )
      if (activeTrade) {
        return res.status(400).json({ error: 'ACTIVE_TRADE_EXISTS', usageId: Number(activeTrade.id || 0) })
      }
      const purchasePercent = normalizePercent(row.purchase_percent, 50)
      const purchaseBase = await getStrategyTradePurchaseBase(db, req.user.id, 'USDT')
      const stakeAmount = Number(((purchaseBase.eligibleAssets * purchasePercent) / 100).toFixed(8))
      if (stakeAmount <= 0) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })
      return res.json({
        ok: true,
        codeId: Number(row.id),
        title: row.title,
        description: row.description,
        featureType,
        assetSymbol: symbol,
        currentPrice: Number(quote?.price || 0),
        requiresConfirmation: true,
        preview: {
          action: 'trial_trade',
          stakeAmount,
            purchasePercent,
            totalAssets: purchaseBase.totalAssets,
            lockedExcludedAmount: purchaseBase.lockedAmount,
            pendingEarnings: purchaseBase.pendingEarnings,
            eligibleAssetBase: purchaseBase.eligibleAssets,
            tradeReturnPercent: Number(row.trade_return_percent || 0),
            balanceSnapshot: purchaseBase.eligibleAssets,
            confirmationMessage:
              'سيتم خصم النسبة المحددة من إجمالي الأصول المحتسبة للشراء، وتشمل المكتسبات القابلة وغير القابلة للسحب مع استثناء الجزء المقيد فقط، ثم يعود أصل مبلغ الصفقة كاملًا إلى الرصيد عند انتهاء المدة.',
          },
        })
    }

    return res.status(400).json({ error: 'UNSUPPORTED_FEATURE' })
  })

  router.post('/strategy-codes/redeem', async (req, res) => {
    const code = normalizeCode(req.body?.code)
    const requestedSymbol = String(req.body?.symbol || '').trim().toUpperCase()
    const confirmed = req.body?.confirmed === true
    if (!code) return res.status(400).json({ error: 'INVALID_INPUT' })
    if (!confirmed) return res.status(400).json({ error: 'CONFIRMATION_REQUIRED' })

    try {
      const payload = await withTransaction(db, async (tx) => {
        const row = await get(
          tx,
          `SELECT id, code, title, description, expert_name, feature_type, reward_mode, reward_value, asset_symbol,
                  purchase_percent, trade_return_percent, expires_at, is_active
           FROM strategy_codes
           WHERE code = ?
             AND feature_type = 'trial_trade'
           LIMIT 1`,
          [code],
        )
        if (!row || Number(row.is_active || 0) !== 1) throw new Error('CODE_NOT_FOUND')
        if (row.expires_at && Date.parse(row.expires_at) < Date.now()) throw new Error('CODE_EXPIRED')
        const existing = await get(
          tx,
          `SELECT id FROM strategy_code_usages WHERE code_id = ? AND user_id = ? LIMIT 1`,
          [row.id, req.user.id],
        )
        if (existing) throw new Error('CODE_ALREADY_USED')

        const featureType = normalizeFeatureType(row.feature_type)
        const configuredSymbol = String(row.asset_symbol || 'BTCUSDT').toUpperCase()
        if (requestedSymbol && requestedSymbol !== configuredSymbol) throw new Error('SYMBOL_LOCKED')
        const symbol = configuredSymbol
        const liveQuote = await resolveLiveQuote(symbol)
        const purchasePercent = normalizePercent(row.purchase_percent, 50)
        const purchaseBase = await getStrategyTradePurchaseBase(tx, req.user.id, 'USDT')
        const balanceSnapshot = purchaseBase.eligibleAssets

        if (featureType === 'trial_trade') {
          const activeTrade = await get(
            tx,
            `SELECT id
             FROM strategy_code_usages
             WHERE user_id = ?
               AND status = 'trade_active'
             LIMIT 1`,
            [req.user.id],
          )
          if (activeTrade) throw new Error('ACTIVE_TRADE_EXISTS')
          const stakeAmount = Number(((purchaseBase.eligibleAssets * purchasePercent) / 100).toFixed(8))
          if (stakeAmount <= 0) throw new Error('INSUFFICIENT_BALANCE')
          const settleDelayMs = getStrategyTradeDelayMs()
          const autoSettleAt = new Date(Date.now() + settleDelayMs).toISOString()
          const debit = await createStrategyTradeOpenDebit(tx, {
            userId: req.user.id,
            currency: 'USDT',
            amount: stakeAmount,
            referenceType: 'strategy_trade_open',
            referenceId: Number(row.id),
            idempotencyKey: `strategy_trade_open_${row.id}_${req.user.id}`,
            createdBy: req.user.id,
          })
          const inserted = await run(
            tx,
            `INSERT INTO strategy_code_usages (
              code_id, user_id, status, selected_symbol, feature_type, balance_snapshot, stake_amount, purchase_percent,
              reward_value, trade_return_percent, entry_price, wallet_debit_txn_id, metadata_json, confirmed_at
            )
             VALUES (?, ?, 'trade_active', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             RETURNING id`,
            [
              row.id,
              req.user.id,
              symbol,
              featureType,
              balanceSnapshot,
              stakeAmount,
              purchasePercent,
              Number(row.trade_return_percent || 0),
              Number(liveQuote.price || 0),
              debit.walletTxnId,
              JSON.stringify({
                code: row.code,
                title: row.title,
                expertName: String(row.expert_name || ''),
                confirmedByUser: req.user.id,
                balanceSourceDebits: debit.sourceDebits,
                totalAssetsSnapshot: purchaseBase.totalAssets,
                lockedExcludedAmount: purchaseBase.lockedAmount,
                pendingEarnings: purchaseBase.pendingEarnings,
                eligibleAssetBase: purchaseBase.eligibleAssets,
                purchasePercent,
                autoSettleAt,
                settleDelayMs,
              }),
            ],
          )
          const usageId = Number(inserted.rows?.[0]?.id || inserted.lastID || 0)
          await createLocalizedNotification(tx, req.user.id, 'strategy_trade_activated', {
            code: row.code,
            amount: stakeAmount,
            currency: 'USDT',
          })
          return {
            codeId: Number(row.id),
            usageId,
            featureType,
            status: 'trade_active',
            assetSymbol: symbol,
            stakeAmount,
            purchasePercent,
            tradeReturnPercent: Number(row.trade_return_percent || 0),
            entryPrice: Number(liveQuote.price || 0),
            strategyCode: String(row.code || ''),
            expertName: String(row.expert_name || ''),
            balanceAfter: debit.balanceAfter,
            autoSettleAt,
            settleDelayMs,
          }
        }

        throw new Error('UNSUPPORTED_FEATURE')
      })
      return res.json({ ok: true, ...payload })
    } catch (error) {
      const codeMap = new Set([
        'CODE_NOT_FOUND',
        'CODE_EXPIRED',
        'CODE_ALREADY_USED',
        'ACTIVE_TRADE_EXISTS',
        'SYMBOL_LOCKED',
        'INVALID_REWARD_RULE',
        'INSUFFICIENT_BALANCE',
        'QUOTE_UNAVAILABLE',
        'UNSUPPORTED_FEATURE',
      ])
      if (error instanceof Error && codeMap.has(error.message)) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.post('/strategy-codes/:usageId/settle', async (req, res) => {
    const usageId = Number(req.params.usageId || 0)
    if (!usageId) return res.status(400).json({ error: 'INVALID_INPUT' })
    try {
      const payload = await withTransaction(db, async (tx) => {
        const usage = await get(
          tx,
          `SELECT scu.id, scu.user_id, scu.code_id, scu.status, scu.selected_symbol, scu.stake_amount,
                  scu.trade_return_percent, scu.wallet_credit_txn_id, scu.metadata_json
           FROM strategy_code_usages scu
           WHERE scu.id = ? AND scu.user_id = ?
           LIMIT 1`,
          [usageId, req.user.id],
        )
        return settleStrategyTradeUsage(tx, usage, req.user.id)
      })
      return res.json({ ok: true, ...payload })
    } catch (error) {
      const codeMap = new Set(['NOT_FOUND', 'NOT_ACTIVE', 'ALREADY_SETTLED', 'QUOTE_UNAVAILABLE', 'SETTLEMENT_NOT_READY'])
      if (error instanceof Error && codeMap.has(error.message)) {
        return res.status(400).json({
          error: error.message,
          availableAt: error.availableAt || null,
          message:
            error.message === 'SETTLEMENT_NOT_READY'
              ? `سيعود الأصل والربح تلقائيًا عند ${error.availableAt || 'اقتراب الموعد المحدد'}.`
              : undefined,
        })
      }
      throw error
    }
  })

  const requireStrategyCodeManager = requireAnyPermission(db, [TASK_PERMISSION, 'trades.manage'])

  router.get('/admin/strategy-codes', requireStrategyCodeManager, async (_req, res) => {
    const usageVisibilityClause = await getStrategyUsageVisibilityClause(db, 'scu')
    const rows = await all(
      db,
      `SELECT sc.id, sc.code, sc.title, sc.description, sc.feature_type, sc.reward_mode, sc.reward_value,
              sc.asset_symbol, sc.purchase_percent, sc.expert_name, sc.trade_return_percent, sc.expires_at, sc.is_active, sc.created_by, sc.created_at, sc.updated_at,
              creator.display_name AS created_by_name,
              COUNT(scu.id) AS usage_count,
              COUNT(CASE WHEN scu.status IN ('trade_settled', 'trade_active') THEN 1 END) AS consumed_count
       FROM strategy_codes sc
        LEFT JOIN users creator ON creator.id = sc.created_by
        LEFT JOIN strategy_code_usages scu ON scu.code_id = sc.id
         AND ${usageVisibilityClause}
       WHERE sc.feature_type = 'trial_trade'
       GROUP BY sc.id, creator.display_name
       ORDER BY sc.id DESC`,
    )
    const adminUsageVisibilityClause = await getStrategyUsageVisibilityClause(db, 'scu')
    const usages = await all(
      db,
       `SELECT scu.id, scu.code_id, scu.user_id, scu.status, scu.selected_symbol, scu.balance_snapshot,
               scu.stake_amount, scu.purchase_percent, scu.reward_value, scu.trade_return_percent, scu.entry_price, scu.exit_price,
               scu.confirmed_at, scu.settled_at, scu.created_at, sc.expert_name,
                u.display_name, u.email, u.phone
        FROM strategy_code_usages scu
        LEFT JOIN strategy_codes sc ON sc.id = scu.code_id
        LEFT JOIN users u ON u.id = scu.user_id
        WHERE ${adminUsageVisibilityClause}
          AND COALESCE(sc.feature_type, 'trial_trade') = 'trial_trade'
        ORDER BY scu.id DESC
        LIMIT 400`,
    )
    return res.json({
      items: rows.map(buildStrategyCodeRow),
      usages: usages.map((row) => ({
        id: Number(row.id),
        codeId: Number(row.code_id),
        userId: Number(row.user_id),
        userDisplayName: row.display_name || null,
        userEmail: row.email || null,
        userPhone: row.phone || null,
        status: String(row.status || ''),
        selectedSymbol: String(row.selected_symbol || '').toUpperCase(),
        balanceSnapshot: Number(row.balance_snapshot || 0),
        stakeAmount: Number(row.stake_amount || 0),
        purchasePercent: Number(row.purchase_percent || 50),
        rewardValue: Number(row.reward_value || 0),
        tradeReturnPercent: Number(row.trade_return_percent || 0),
        expertName: String(row.expert_name || ''),
        entryPrice: row.entry_price == null ? null : Number(row.entry_price),
        exitPrice: row.exit_price == null ? null : Number(row.exit_price),
        confirmedAt: row.confirmed_at,
        settledAt: row.settled_at,
        usedAt: row.created_at,
      })),
    })
  })

  router.post('/admin/strategy-codes', requireStrategyCodeManager, async (req, res) => {
    const id = Number(req.body?.id || 0)
    const code = normalizeCode(req.body?.code)
    const title = normalizeText(req.body?.title, 90)
    const description = normalizeText(req.body?.description, 220)
    const expertName = normalizeText(req.body?.expertName, 120)
    const assetSymbol = normalizeCode(req.body?.assetSymbol || 'BTCUSDT') || 'BTCUSDT'
    const purchasePercent = normalizePercent(req.body?.purchasePercent, 50)
    const tradeReturnPercent = normalizePercent(req.body?.tradeReturnPercent, 0)
    const expiresAt = normalizeDate(req.body?.expiresAt)
    const isActive = req.body?.isActive === false ? 0 : 1
    if (!code || !title || purchasePercent <= 0) return res.status(400).json({ error: 'INVALID_INPUT' })

    if (id > 0) {
      await run(
        db,
        `UPDATE strategy_codes
         SET code = ?, title = ?, description = ?, feature_type = 'trial_trade', reward_mode = 'percent', reward_value = 0,
             asset_symbol = ?, purchase_percent = ?, expert_name = ?, trade_return_percent = ?, expires_at = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [code, title, description || null, assetSymbol, purchasePercent, expertName || null, tradeReturnPercent, expiresAt, isActive, id],
      )
      return res.json({ ok: true, id })
    }
    const inserted = await run(
      db,
      `INSERT INTO strategy_codes (
        code, title, description, feature_type, reward_mode, reward_value,
        asset_symbol, purchase_percent, expert_name, trade_return_percent, expires_at, is_active, created_by
      )
       VALUES (?, ?, ?, 'trial_trade', 'percent', 0, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [code, title, description || null, assetSymbol, purchasePercent, expertName || null, tradeReturnPercent, expiresAt, isActive, req.user.id],
    )
    return res.json({ ok: true, id: Number(inserted.lastID || inserted.rows?.[0]?.id || 0) })
  })

  router.post('/admin/strategy-codes/:id/toggle', requireStrategyCodeManager, async (req, res) => {
    const id = Number(req.params.id || 0)
    const isActive = req.body?.isActive === false ? 0 : 1
    if (!id) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `UPDATE strategy_codes
       SET is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [isActive, id],
    )
    return res.json({ ok: true })
  })

  router.delete('/admin/strategy-codes/:id', requireStrategyCodeManager, async (req, res) => {
    const id = Number(req.params.id || 0)
    if (!id) return res.status(400).json({ error: 'INVALID_INPUT' })
    const usageRow = await get(
      db,
      `SELECT COUNT(*) AS usage_count
       FROM strategy_code_usages
       WHERE code_id = ?`,
      [id],
    )
    if (Number(usageRow?.usage_count || 0) > 0) {
      return res.status(400).json({
        error: 'CODE_HAS_USAGES',
        message: 'لا يمكن حذف كود الاستراتيجية بعد استخدامه. أوقفه فقط للحفاظ على السجل والصفقات المرتبطة به.',
      })
    }
    await run(db, `DELETE FROM strategy_codes WHERE id = ?`, [id])
    return res.json({ ok: true })
  })

  router.delete('/admin/strategy-usages/:id', requireStrategyCodeManager, async (req, res) => {
    const id = Number(req.params.id || 0)
    if (!id) return res.status(400).json({ error: 'INVALID_INPUT' })

    const usage = await getStrategyUsageAdminRecord(db, id)
    if (!usage) return res.status(404).json({ error: 'NOT_FOUND' })
    if (usage.admin_hidden_at) return res.json({ ok: true })
    if (!isStrategyUsageRemovableRecord(usage)) {
      return res.status(400).json({
        error: 'ONLY_SETTLED_TRADES_CAN_BE_REMOVED',
        message: 'يمكن حذف الصفقات الاستراتيجية المكتملة فقط دون المساس بمنطق الأصل والربح.',
      })
    }

    await hideStrategyUsageRecord(db, id, req.user.id)
    return res.json({ ok: true })
  })

  return router
}
