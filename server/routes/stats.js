import { Router } from 'express'
import { all, get } from '../db.js'
import { requireAuth, requirePermission } from '../middleware/auth.js'
import { getPlatformWalletTotals, getTransactionStats } from '../services/wallet-reads.js'

export function createStatsRouter(db) {
  const router = Router()
  router.use(requireAuth(db), requirePermission(db, 'view_reports'))

  router.get('/balanceStats', async (_req, res) => {
    const totals = await getPlatformWalletTotals(db)
    return res.json({
      balancesCount: totals.balancesCount,
      totalAmount: totals.totalAmount,
      transactionsCount: totals.transactionsCount,
    })
  })

  router.get('/userStats', async (_req, res) => {
    const rows = await get(
      db,
      `SELECT
        COUNT(*) AS totalUsers,
        SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) AS approvedUsers,
        SUM(CASE WHEN is_approved = 0 THEN 1 ELSE 0 END) AS pendingUsers,
        SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) AS bannedUsers
      FROM users`,
    )
    return res.json(rows)
  })

  router.get('/transactionStats', async (_req, res) => {
    const rows = await getTransactionStats(db)
    return res.json({
      depositsTotal: rows.depositsTotal,
      withdrawTotal: rows.withdrawTotal,
    })
  })

  router.get('/topUsers', async (_req, res) => {
    const rows = await all(
      db,
      `SELECT u.id, u.email, COUNT(t.id) AS txCount
       FROM users u
       LEFT JOIN transactions t ON t.user_id = u.id
       GROUP BY u.id
       ORDER BY txCount DESC
       LIMIT 10`,
    )
    return res.json({ users: rows })
  })

  return router
}
