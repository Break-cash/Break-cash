import { Router } from 'express'
import { all, get, run } from '../db.js'
import { requireApproved, requireAuth } from '../middleware/auth.js'

export function createPortfolioRouter(db) {
  const router = Router()
  router.use(requireAuth(db), requireApproved())

  router.get('/holdings', async (req, res) => {
    const rows = await all(
      db,
      `SELECT id, symbol, quantity, avg_price, updated_at FROM portfolio_holdings WHERE user_id = ? ORDER BY id DESC`,
      [req.user.id],
    )
    return res.json({ holdings: rows })
  })

  router.post('/holdings', async (req, res) => {
    const symbol = String(req.body?.symbol || '').toUpperCase().trim()
    const quantity = Number(req.body?.quantity || 0)
    const avgPrice = Number(req.body?.avgPrice || 0)
    if (!symbol || quantity <= 0 || avgPrice <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    await run(
      db,
      `INSERT INTO portfolio_holdings (user_id, symbol, quantity, avg_price)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, symbol) DO UPDATE SET quantity=excluded.quantity, avg_price=excluded.avg_price, updated_at=datetime('now')`,
      [req.user.id, symbol, quantity, avgPrice],
    )
    return res.json({ ok: true })
  })

  router.delete('/holdings/:id', async (req, res) => {
    await run(db, `DELETE FROM portfolio_holdings WHERE id = ? AND user_id = ?`, [
      Number(req.params.id),
      req.user.id,
    ])
    return res.json({ ok: true })
  })

  router.get('/watchlist', async (req, res) => {
    const rows = await all(
      db,
      `SELECT id, symbol, market_type, created_at FROM watchlist WHERE user_id = ? ORDER BY id DESC`,
      [req.user.id],
    )
    return res.json({ watchlist: rows })
  })

  router.post('/watchlist', async (req, res) => {
    const symbol = String(req.body?.symbol || '').toUpperCase().trim()
    const marketType = String(req.body?.marketType || 'crypto')
    if (!symbol) return res.status(400).json({ error: 'INVALID_INPUT' })
    await run(
      db,
      `INSERT INTO watchlist (user_id, symbol, market_type)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, symbol) DO NOTHING`,
      [req.user.id, symbol, marketType],
    )
    return res.json({ ok: true })
  })

  router.delete('/watchlist/:id', async (req, res) => {
    await run(db, `DELETE FROM watchlist WHERE id = ? AND user_id = ?`, [
      Number(req.params.id),
      req.user.id,
    ])
    return res.json({ ok: true })
  })

  router.get('/transactions', async (req, res) => {
    const rows = await all(
      db,
      `SELECT id, symbol, side, quantity, price, fee, status, created_at
       FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 200`,
      [req.user.id],
    )
    return res.json({ transactions: rows })
  })

  router.post('/transactions', async (req, res) => {
    const symbol = String(req.body?.symbol || '').toUpperCase().trim()
    const side = String(req.body?.side || '').toLowerCase()
    const quantity = Number(req.body?.quantity || 0)
    const price = Number(req.body?.price || 0)
    const fee = Number(req.body?.fee || 0)
    if (!symbol || !['buy', 'sell'].includes(side) || quantity <= 0 || price <= 0) {
      return res.status(400).json({ error: 'INVALID_INPUT' })
    }
    await run(
      db,
      `INSERT INTO transactions (user_id, symbol, side, quantity, price, fee) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, symbol, side, quantity, price, fee],
    )

    const existing = await get(
      db,
      `SELECT id, quantity, avg_price FROM portfolio_holdings WHERE user_id = ? AND symbol = ? LIMIT 1`,
      [req.user.id, symbol],
    )
    if (side === 'buy') {
      if (!existing) {
        await run(
          db,
          `INSERT INTO portfolio_holdings (user_id, symbol, quantity, avg_price) VALUES (?, ?, ?, ?)`,
          [req.user.id, symbol, quantity, price],
        )
      } else {
        const nextQty = existing.quantity + quantity
        const weighted = (existing.quantity * existing.avg_price + quantity * price) / nextQty
        await run(
          db,
          `UPDATE portfolio_holdings SET quantity = ?, avg_price = ?, updated_at = datetime('now') WHERE id = ?`,
          [nextQty, weighted, existing.id],
        )
      }
    } else if (existing) {
      const nextQty = Math.max(0, existing.quantity - quantity)
      if (nextQty === 0) {
        await run(db, `DELETE FROM portfolio_holdings WHERE id = ?`, [existing.id])
      } else {
        await run(
          db,
          `UPDATE portfolio_holdings SET quantity = ?, updated_at = datetime('now') WHERE id = ?`,
          [nextQty, existing.id],
        )
      }
    }
    return res.status(201).json({ ok: true })
  })

  return router
}
