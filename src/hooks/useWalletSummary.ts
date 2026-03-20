import { useCallback, useEffect, useState } from 'react'
import { getWalletOverview, subscribeToLiveUpdates, type WalletOverview } from '../api'
import { EMPTY_WALLET_SUMMARY, mapWalletApiToSummary, type WalletSummary } from '../walletSummary'

type UseWalletSummaryOptions = {
  currency?: string
  subscribeLive?: boolean
  enabled?: boolean
}

type UseWalletSummaryResult = {
  summary: WalletSummary
  overview: WalletOverview | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<WalletSummary>
}

export function useWalletSummary({
  currency = 'USDT',
  subscribeLive = true,
  enabled = true,
}: UseWalletSummaryOptions = {}): UseWalletSummaryResult {
  const [summary, setSummary] = useState<WalletSummary>(EMPTY_WALLET_SUMMARY)
  const [overview, setOverview] = useState<WalletOverview | null>(null)
  const [loading, setLoading] = useState(Boolean(enabled))
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSummary(EMPTY_WALLET_SUMMARY)
      setOverview(null)
      setLoading(false)
      setError(null)
      return EMPTY_WALLET_SUMMARY
    }

    setLoading(true)
    setError(null)

    try {
      const nextOverview = await getWalletOverview(currency)
      const nextSummary = mapWalletApiToSummary(nextOverview as unknown as Record<string, unknown>)
      setOverview(nextOverview)
      setSummary(nextSummary)
      return nextSummary
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error('Failed to load wallet summary')
      setOverview(null)
      setSummary(EMPTY_WALLET_SUMMARY)
      setError(nextError)
      throw nextError
    } finally {
      setLoading(false)
    }
  }, [currency, enabled])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  useEffect(() => {
    if (!enabled || !subscribeLive) return () => {}

    return subscribeToLiveUpdates((event) => {
      if (event.type === 'balance_updated') {
        refresh().catch(() => {})
      }
    })
  }, [enabled, refresh, subscribeLive])

  return {
    summary,
    overview,
    loading,
    error,
    refresh,
  }
}
