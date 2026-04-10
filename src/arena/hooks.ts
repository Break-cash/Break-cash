import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  convertParticipationPoints,
  getArenaEntryBalance,
  getArenaLeaderboard,
  getArenaMissions,
  getArenaResult,
  getArenaRewardHistory,
  getArenaRoundDetails,
  getArenaRounds,
  getArenaTicketPackages,
  getArenaWalletSummary,
  openFinancialRoute,
  purchaseArenaTickets,
  requestBonusTransfer,
  submitPrediction,
} from './api'
import type {
  ArenaEntryBalance,
  ArenaLeaderboardEntry,
  ArenaMission,
  ArenaRewardLedgerEntry,
  ArenaRound,
  ArenaRoundDetails,
  ArenaWalletSummary,
  ArenaBonusReward,
  PredictionDirection,
  PredictionEntry,
  RoundResult,
} from './types'

type AsyncState = {
  loading: boolean
  error: Error | null
}

function useAsyncState(initialLoading = true): [AsyncState, (next: Partial<AsyncState>) => void] {
  const [state, setState] = useState<AsyncState>({ loading: initialLoading, error: null })
  const patchState = useCallback((next: Partial<AsyncState>) => {
    setState((prev) => ({ ...prev, ...next }))
  }, [])
  return [state, patchState]
}

export function useArenaHomeData() {
  const [walletSummary, setWalletSummary] = useState<ArenaWalletSummary | null>(null)
  const [entryBalance, setEntryBalance] = useState<ArenaEntryBalance | null>(null)
  const [rounds, setRounds] = useState<ArenaRound[]>([])
  const [leaderboard, setLeaderboard] = useState<ArenaLeaderboardEntry[]>([])
  const [missions, setMissions] = useState<ArenaMission[]>([])
  const [asyncState, patchAsync] = useAsyncState(true)

  const refresh = useCallback(async () => {
    patchAsync({ loading: true })
    try {
      const [walletRes, entryRes, roundsRes, leaderboardRes, missionsRes] = await Promise.all([
        getArenaWalletSummary(),
        getArenaEntryBalance(),
        getArenaRounds(),
        getArenaLeaderboard('daily'),
        getArenaMissions(),
      ])
      setWalletSummary(walletRes)
      setEntryBalance(entryRes)
      setRounds(roundsRes)
      setLeaderboard(leaderboardRes)
      setMissions(missionsRes)
      patchAsync({ error: null })
    } catch (cause) {
      patchAsync({ error: cause instanceof Error ? cause : new Error('ARENA_HOME_LOAD_FAILED') })
    } finally {
      patchAsync({ loading: false })
    }
  }, [patchAsync])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const heroRound = useMemo(
    () => rounds.find((item) => item.status === 'OPEN') || rounds[0] || null,
    [rounds],
  )

  return {
    walletSummary,
    entryBalance,
    rounds,
    leaderboard,
    missions,
    heroRound,
    loading: asyncState.loading,
    error: asyncState.error,
    refresh,
  }
}

export function useArenaRound(roundId: string | undefined) {
  const [details, setDetails] = useState<ArenaRoundDetails | null>(null)
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted' | 'failed'>('idle')
  const [lastEntry, setLastEntry] = useState<PredictionEntry | null>(null)
  const [asyncState, patchAsync] = useAsyncState(true)

  const refresh = useCallback(async () => {
    if (!roundId) return
    patchAsync({ loading: true })
    try {
      const result = await getArenaRoundDetails(roundId)
      setDetails(result)
      patchAsync({ error: null })
    } catch (cause) {
      patchAsync({ error: cause instanceof Error ? cause : new Error('ARENA_ROUND_LOAD_FAILED') })
    } finally {
      patchAsync({ loading: false })
    }
  }, [patchAsync, roundId])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  useEffect(() => {
    if (!roundId) return () => {}
    const timer = window.setInterval(() => {
      refresh().catch(() => {})
    }, 1000)
    return () => window.clearInterval(timer)
  }, [refresh, roundId])

  const secondsRemaining = useMemo(() => {
    if (!details?.round) return 0
    const round = details.round
    const target =
      round.status === 'UPCOMING'
        ? Date.parse(round.startsAt)
        : round.status === 'OPEN' || round.status === 'LOCKED'
          ? Date.parse(round.endsAt)
          : 0
    return Math.max(0, Math.floor((target - Date.now()) / 1000))
  }, [details])

  const submit = useCallback(
    async (direction: PredictionDirection) => {
      if (!details) throw new Error('ARENA_ROUND_NOT_FOUND')
      setSubmitState('submitting')
      try {
        const entry = await submitPrediction(details.round.id, details.round.assetId, direction)
        setLastEntry(entry)
        setSubmitState('submitted')
        await refresh()
        return entry
      } catch (cause) {
        setSubmitState('failed')
        throw cause
      }
    },
    [details, refresh],
  )

  const buyTickets = useCallback(
    async (packageId: string) => {
      const result = await purchaseArenaTickets(packageId)
      await refresh()
      return result
    },
    [refresh],
  )

  const convertPoints = useCallback(async () => {
    await convertParticipationPoints()
    await refresh()
  }, [refresh])

  return {
    round: details?.round ?? null,
    walletSummary: details?.walletSummary ?? null,
    entryBalance: details?.entryBalance ?? null,
    existingEntry: details?.existingEntry ?? null,
    loading: asyncState.loading,
    error: asyncState.error,
    submitState,
    lastEntry,
    secondsRemaining,
    buyTickets,
    convertPoints,
    refresh,
    submit,
    ticketPackages: getArenaTicketPackages(),
    financeRoutes: {
      wallet: openFinancialRoute('wallet'),
      deposit: openFinancialRoute('tickets_purchase'),
      vip: openFinancialRoute('vip'),
    },
  }
}

export function useArenaResult(roundId: string | undefined) {
  const [result, setResult] = useState<RoundResult | null>(null)
  const [rewards, setRewards] = useState<ArenaRewardLedgerEntry[]>([])
  const [walletSummary, setWalletSummary] = useState<ArenaWalletSummary | null>(null)
  const [asyncState, patchAsync] = useAsyncState(true)

  const refresh = useCallback(async () => {
    if (!roundId) return
    patchAsync({ loading: true })
    try {
      const [resultRes, rewardsRes, walletRes] = await Promise.allSettled([
        getArenaResult(roundId),
        getArenaRewardHistory(),
        getArenaWalletSummary(),
      ])
      if (resultRes.status !== 'fulfilled') {
        throw resultRes.reason
      }
      setResult(resultRes.value)
      setRewards(rewardsRes.status === 'fulfilled' ? rewardsRes.value : [])
      setWalletSummary(walletRes.status === 'fulfilled' ? walletRes.value : null)
      patchAsync({ error: null })
    } catch (cause) {
      patchAsync({ error: cause instanceof Error ? cause : new Error('ARENA_RESULT_LOAD_FAILED') })
    } finally {
      patchAsync({ loading: false })
    }
  }, [patchAsync, roundId])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const requestTransfer = useCallback(async (reward: ArenaBonusReward | null) => {
    if (!reward) return null
    const updated = await requestBonusTransfer(reward.id)
    await refresh()
    return updated
  }, [refresh])

  return {
    result,
    rewards,
    walletSummary,
    loading: asyncState.loading,
    error: asyncState.error,
    refresh,
    requestTransfer,
    financeRoutes: {
      wallet: openFinancialRoute('wallet'),
      vip: openFinancialRoute('vip'),
      rewards: openFinancialRoute('rewards_history'),
      transfer: openFinancialRoute('bonus_transfer'),
    },
  }
}
