const DETAIL_LABELS: Record<string, string> = {
  wallet: 'Wallet',
  walletAddress: 'Wallet',
  address: 'Address',
  account: 'Account',
  accountNumber: 'Account Number',
  iban: 'IBAN',
  network: 'Network',
  method: 'Method',
  bankName: 'Bank',
  accountName: 'Account Name',
  holderName: 'Holder',
  beneficiaryName: 'Beneficiary',
  fullName: 'Name',
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
}

function humanizeKey(key: string): string {
  const normalized = String(key || '').trim()
  if (!normalized) return 'Info'
  if (DETAIL_LABELS[normalized]) return DETAIL_LABELS[normalized]
  return normalized
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase())
}

function pushDetail(details: string[], label: string, value: unknown) {
  const normalizedValue = String(value ?? '').trim()
  if (!normalizedValue) return
  details.push(`${label}: ${normalizedValue}`)
}

export function getWithdrawalRequestDetails(accountInfo?: string | null): string[] {
  const raw = String(accountInfo || '').trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') {
      const value = parsed.trim()
      return value ? [value] : []
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const details: string[] = []
      for (const [key, value] of Object.entries(parsed)) {
        pushDetail(details, humanizeKey(key), value)
      }
      return details.length > 0 ? details : [raw]
    }
  } catch {
    return [raw]
  }

  return [raw]
}
