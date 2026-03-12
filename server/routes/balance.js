import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireAuth, requirePermission, requireRole } from '../middleware/auth.js'

export function createBalanceRouter(db) {
  const router = Router()
  router.use(requireAuth(db))

  router.get('/my', async (req, res) => {
    const rows = await all(db, `SELECT currency, amount, updated_at FROM balances WHERE user_id = ?`, [
      req.user.id,
    ])
    return res.json({ balances: rows })
  })

  router.get('/getUser', requirePermission(db, 'manage_balances'), async (req, res) => {
    const userId = Number(req.query.userId)
    const rows = await all(db, `SELECT currency, amount, updated_at FROM balances WHERE user_id = ?`, [
      userId,
    ])
    return res.json({ userId, balances: rows })
  })

  router.get('/history', requirePermission(db, 'manage_balances'), async (req, res) => {
    const userId = Number(req.query.userId || 0)
    const rows = userId
      ? await all(
          db,
          `SELECT id, user_id, admin_id, type, currency, amount, note, created_at
           FROM balance_transactions WHERE user_id = ? ORDER BY id DESC`,
          [userId],
        )
      : await all(
          db,
          `SELECT id, user_id, admin_id, type, currency, amount, note, created_at
           FROM balance_transactions ORDER BY id DESC LIMIT 200`,
        )
    return res.json({ history: rows })
  })

  router.post('/adjust', requirePermission(db, 'manage_balances'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const currency = String(req.body?.currency || 'USDC').toUpperCase()
    const amount = Number(req.body?.amount || 0)
    const type = String(req.body?.type || 'add')
    const note = String(req.body?.note || '')
    if (!userId || !amount || !['add', 'deduct'].includes(type)) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    const existing = await get(
      db,
      `SELECT id, amount FROM balances WHERE user_id = ? AND currency = ? LIMIT 1`,
      [userId, currency],
    )
    const delta = type === 'deduct' ? -Math.abs(amount) : Math.abs(amount)
    const nextAmount = Number((Number(existing?.amount || 0) + delta).toFixed(8))
    if (nextAmount < 0) return res.status(400).json({ error: 'INSUFFICIENT_BALANCE' })

    if (existing) {
      await run(
        db,
        `UPDATE balances SET amount = ?, updated_at = datetime('now') WHERE id = ?`,
        [nextAmount, existing.id],
      )
    } else {
      await run(
        db,
        `INSERT INTO balances (user_id, currency, amount) VALUES (?, ?, ?)`,
        [userId, currency, nextAmount],
      )
    }

    await run(
      db,
      `INSERT INTO balance_transactions (user_id, admin_id, type, currency, amount, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, req.user.id, type, currency, Math.abs(amount), note],
    )
    await run(
      db,
      `INSERT INTO notifications (user_id, title, body)
       VALUES (?, 'Balance Updated', ?)`,
      [userId, `Your ${currency} balance was ${type}ed by ${Math.abs(amount)}.`],
    )
    return res.json({ ok: true, balance: { userId, currency, amount: nextAmount } })
  })

  router.post('/set', requireRole('owner'), async (req, res) => {
    const userId = Number(req.body?.userId)
    const currency = String(req.body?.currency || 'USDC').toUpperCase()
    const amount = Number(req.body?.amount ?? 0)
    const note = String(req.body?.note || '')
    if (!userId || amount < 0) return res.status(400).json({ error: 'INVALID_INPUT' })
    const fixedAmount = Number(amount.toFixed(8))
    const existing = await get(
      db,
      `SELECT id, amount FROM balances WHERE user_id = ? AND currency = ? LIMIT 1`,
      [userId, currency],
    )
    const prevAmount = Number(existing?.amount || 0)
    if (existing) {
      await run(
        db,
        `UPDATE balances SET amount = ?, updated_at = datetime('now') WHERE id = ?`,
        [fixedAmount, existing.id],
      )
    } else {
      await run(
        db,
        `INSERT INTO balances (user_id, currency, amount) VALUES (?, ?, ?)`,
        [userId, currency, fixedAmount],
      )
    }
    const type = fixedAmount >= prevAmount ? 'add' : 'deduct'
    await run(
      db,
      `INSERT INTO balance_transactions (user_id, admin_id, type, currency, amount, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, req.user.id, type, currency, Math.abs(fixedAmount - prevAmount), note || 'Set by owner'],
    )
    await run(
      db,
      `INSERT INTO notifications (user_id, title, body)
       VALUES (?, 'Balance Updated', ?)`,
      [userId, `Your ${currency} balance was set to ${fixedAmount}.`],
    )
    return res.json({ ok: true, balance: { userId, currency, amount: fixedAmount } })
  })

  return router
}
