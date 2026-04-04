import { useCallback, useEffect, useState } from 'react'
import { getEarningHistory, subscribeToLiveUpdates, type EarningEntry } from '../api'

type DailyEarningsSummary = {
  totalAmount: number
  withdrawableAmount: number
  lockedAmount: number
  entriesCount: number
  currency: string
  sourceTotals: {
    mining: number
    tasks: number
    referrals: number
    deposits: number
  }
}

const EMPTY_SUMMARY: DailyEarningsSummary = {
  totalAmount: 0,
  withdrawableAmount: 0,
  lockedAmount: 0,
  entriesCount: 0,
  currency: 'USDT',
  sourceTotals: {
    mining: 0,
    tasks: 0,
    referrals: 0,
    deposits: 0,
  },
}

function isSameLocalDay(dateText: string) {
  const ms = Date.parse(String(dateText || ''))
  if (Number.isNaN(ms)) return false
  const entryDate = new Date(ms)
  const now = new Date()
  return (
    entryDate.getFullYear() === now.getFullYear() &&
    entryDate.getMonth() === now.getMonth() &&
    entryDate.getDate() === now.getDate()
  )
}

function buildSummary(entries: EarningEntry[]): DailyEarningsSummary {
  let totalAmount = 0
  let withdrawableAmount = 0
  let lockedAmount = 0
  let currency = 'USDT'
  const sourceTotals = {
    mining: 0,
    tasks: 0,
    referrals: 0,
    deposits: 0,
  }

  for (const entry of entries) {
    if (!isSameLocalDay(entry.created_at)) continue
    const amount = Number(entry.amount || 0)
    if (!Number.isFinite(amount) || amount === 0) continue
    totalAmount += amount
    currency = entry.currency || currency
    const sourceType = String(entry.source_type || '').trim().toLowerCase() as keyof typeof sourceTotals
    if (sourceType in sourceTotals) {
      sourceTotals[sourceType] = Number((sourceTotals[sourceType] + amount).toFixed(8))
    }
    if (String(entry.payout_mode || 'withdrawable').trim().toLowerCase() === 'withdrawable') {
      withdrawableAmount += amount
    } else {
      lockedAmount += amount
    }
  }

  return {
    totalAmount: Number(totalAmount.toFixed(8)),
    withdrawableAmount: Number(withdrawableAmount.toFixed(8)),
    lockedAmount: Number(lockedAmount.toFixed(8)),
    entriesCount: entries.filter((entry) => isSameLocalDay(entry.created_at)).length,
    currency,
    sourceTotals,
  }
}

export function useDailyEarningsSummary() {
  const [summary, setSummary] = useState<DailyEarningsSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const res = await getEarningHistory({ limit: 200 })
      setSummary(buildSummary(res.entries || []))
    } catch {
      setSummary(EMPTY_SUMMARY)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  useEffect(() => {
    return subscribeToLiveUpdates((event) => {
      if (event.type === 'balance_updated' || event.type === 'home_content_updated') {
        refresh({ silent: true }).catch(() => {})
      }
    })
  }, [refresh])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refresh({ silent: true }).catch(() => {})
    }, 15000)

    const handleForegroundRefresh = () => {
      if (document.visibilityState === 'visible') {
        refresh({ silent: true }).catch(() => {})
      }
    }

    window.addEventListener('focus', handleForegroundRefresh)
    document.addEventListener('visibilitychange', handleForegroundRefresh)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleForegroundRefresh)
      document.removeEventListener('visibilitychange', handleForegroundRefresh)
    }
  }, [refresh])

  return { summary, loading, refresh }
}
