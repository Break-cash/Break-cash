import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import {
  ARENA_TICKET_PACKAGES,
  convertArenaParticipationPoints,
  getArenaEntryBalance,
  getArenaLeaderboard,
  getArenaMissions,
  getArenaResult,
  getArenaRewardHistory,
  getArenaRoundDetails,
  getArenaRounds,
  getArenaWalletSummary,
  purchaseArenaTickets,
  requestArenaBonusTransfer,
  submitArenaPrediction,
} from '../services/arena.js'

export function createArenaRouter(db) {
  const router = Router()

  router.use(requireAuth(db))

  router.get('/wallet-summary', async (req, res) => {
    const summary = await getArenaWalletSummary(db, req.user.id)
    return res.json(summary)
  })

  router.get('/entry-balance', async (req, res) => {
    const balance = await getArenaEntryBalance(db, req.user.id)
    return res.json(balance)
  })

  router.get('/rounds', async (_req, res) => {
    const items = await getArenaRounds(db)
    return res.json({ items })
  })

  router.get('/rounds/:roundId', async (req, res) => {
    try {
      const details = await getArenaRoundDetails(db, req.user.id, req.params.roundId)
      return res.json(details)
    } catch (error) {
      if (error instanceof Error && error.message === 'ARENA_ROUND_NOT_FOUND') {
        return res.status(404).json({ error: 'ARENA_ROUND_NOT_FOUND' })
      }
      throw error
    }
  })

  router.post('/rounds/:roundId/predict', async (req, res) => {
    try {
      const entry = await submitArenaPrediction(
        db,
        req.user.id,
        req.params.roundId,
        String(req.body?.assetId || ''),
        String(req.body?.direction || ''),
      )
      return res.json({ entry })
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.get('/results/:roundId', async (req, res) => {
    try {
      const result = await getArenaResult(db, req.user.id, req.params.roundId)
      return res.json(result)
    } catch (error) {
      if (error instanceof Error && error.message === 'ARENA_ROUND_NOT_FOUND') {
        return res.status(404).json({ error: 'ARENA_ROUND_NOT_FOUND' })
      }
      throw error
    }
  })

  router.get('/leaderboard', async (req, res) => {
    const period = String(req.query.period || 'daily').trim().toLowerCase() === 'weekly' ? 'weekly' : 'daily'
    const items = await getArenaLeaderboard(db, req.user.id, period)
    return res.json({ items })
  })

  router.get('/missions', async (req, res) => {
    const items = await getArenaMissions(db, req.user.id)
    return res.json({ items })
  })

  router.get('/reward-history', async (req, res) => {
    const items = await getArenaRewardHistory(db, req.user.id)
    return res.json({ items })
  })

  router.post('/rewards/:rewardId/transfer', async (req, res) => {
    try {
      const reward = await requestArenaBonusTransfer(db, req.user.id, Number(req.params.rewardId))
      return res.json({ reward })
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.post('/convert-points', async (req, res) => {
    try {
      const balance = await convertArenaParticipationPoints(db, req.user.id)
      return res.json(balance)
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  router.get('/ticket-packages', (_req, res) => {
    return res.json({ items: ARENA_TICKET_PACKAGES })
  })

  router.post('/tickets/purchase', async (req, res) => {
    try {
      const result = await purchaseArenaTickets(db, req.user.id, String(req.body?.packageId || ''))
      return res.json(result)
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message })
      }
      throw error
    }
  })

  return router
}
