import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import {
  getMainBalance,
  createEarningEntry,
  transferEarningToMain,
  appendLegacyBalanceTransaction,
} from '../services/wallet-ledger.js'

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

        const balanceSnapshot = await getMainBalance(tx, req.user.id, 'USDT')
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

        const earningResult = await createEarningEntry(tx, {
          userId: req.user.id,
          sourceType: 'tasks',
          referenceType: 'task_redemption',
          referenceId: redemptionId,
          currency: 'USDT',
          amount: rewardAmount,
        })
        const entryId = earningResult?.id ?? (await get(tx, `SELECT id FROM earning_entries WHERE source_type = 'tasks' AND reference_type = 'task_redemption' AND reference_id = ? LIMIT 1`, [redemptionId]))?.id
        if (entryId) {
          await transferEarningToMain(tx, entryId, `task_redemption_${redemptionId}`)
        }
        await appendLegacyBalanceTransaction(tx, {
          userId: req.user.id,
          adminId: null,
          type: 'task_code_bonus',
          currency: 'USDT',
          amount: rewardAmount,
          note: `Redeemed task code ${code}`,
        })
        await run(
          tx,
          `INSERT INTO notifications (user_id, title, body)
           VALUES (?, 'Task reward activated', ?)`,
          [req.user.id, `Code ${code} applied successfully. Bonus +${rewardAmount.toFixed(2)} USDT.`],
        )
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

  return router
}
