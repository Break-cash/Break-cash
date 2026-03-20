export type WalletSummary = {
  totalAssets: number
  mainBalance: number
  lockedBalance: number
  withdrawableBalance: number
}

export const EMPTY_WALLET_SUMMARY: WalletSummary = {
  totalAssets: 0,
  mainBalance: 0,
  lockedBalance: 0,
  withdrawableBalance: 0,
}

type LooseRecord = Record<string, unknown>

type WalletSummaryInput = LooseRecord | null | undefined

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === 'object' ? (value as LooseRecord) : null
}

function coerceNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === 'string') {
    const normalized = value.trim().replace(/,/g, '')
    if (!normalized) return 0
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  if (value == null) {
    return 0
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null)
}

function sumNumericRecord(value: unknown): number {
  const record = asRecord(value)
  if (!record) return 0
  return Object.values(record).reduce<number>((total, entry) => total + coerceNumber(entry), 0)
}

function resolveNestedSummary(input: WalletSummaryInput) {
  const source = asRecord(input)
  return asRecord(
    firstDefined(
      source?.withdraw_summary,
      source?.withdrawSummary,
      source?.summary,
      source?.wallet_summary,
      source?.walletSummary,
      source?.balances,
    ),
  )
}

export function mapWalletApiToSummary(input: WalletSummaryInput): WalletSummary {
  const source = asRecord(input)
  if (!source) {
    return EMPTY_WALLET_SUMMARY
  }

  const nested = resolveNestedSummary(source)

  const mainBalance = coerceNumber(
    firstDefined(
      source.main_balance,
      source.mainBalance,
      source.current_balance,
      source.currentBalance,
      nested?.main_balance,
      nested?.mainBalance,
      nested?.current_balance,
      nested?.currentBalance,
    ),
  )

  const lockedBalance = coerceNumber(
    firstDefined(
      source.locked_balance,
      source.lockedBalance,
      nested?.locked_balance,
      nested?.lockedBalance,
    ),
  )

  const withdrawableBalance = coerceNumber(
    firstDefined(
      source.withdrawable_balance,
      source.withdrawableBalance,
      source.available_balance,
      source.availableBalance,
      nested?.withdrawable_balance,
      nested?.withdrawableBalance,
      nested?.available_balance,
      nested?.availableBalance,
    ),
  )

  const totalAssets = coerceNumber(
    firstDefined(
      source.total_assets,
      source.totalAssets,
      nested?.total_assets,
      nested?.totalAssets,
      sumNumericRecord(source.by_currency),
      sumNumericRecord(source.byCurrency),
      mainBalance + lockedBalance,
    ),
  )

  return {
    totalAssets,
    mainBalance,
    lockedBalance,
    withdrawableBalance,
  }
}
