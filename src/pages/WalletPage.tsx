import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Filter,
  History,
  Info,
  PiggyBank,
  Wallet,
  X,
} from 'lucide-react'
import {
  getWalletOverview,
  getWalletHistory,
  getEarningHistory,
  subscribeToLiveUpdates,
  type WalletOverview,
  type EarningGroup,
} from '../api'
import { useI18n } from '../i18nCore'

type TabId = 'overview' | 'history' | 'earnings'

type WalletTxn = {
  id: number
  transaction_type: string
  source_type: string
  amount: number
  fee_amount: number
  net_amount: number
  currency: string
  created_at: string
  reference_type: string | null
  reference_id: number | null
  balance_before: number
  balance_after: number
  metadata: string | null
}

function formatAmount(n: number, currency = 'USDT'): string {
  return `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} ${currency}`
}

function formatDate(s: string): string {
  const d = new Date(s)
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function parseMetadata(meta: string | null): string {
  if (!meta) return ''
  try {
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta
    return typeof parsed.note === 'string' ? parsed.note : parsed.description || meta
  } catch {
    return typeof meta === 'string' ? meta : ''
  }
}

export function WalletPage() {
  const { t } = useI18n()
  const [tab, setTab] = useState<TabId>('overview')
  const [overview, setOverview] = useState<WalletOverview | null>(null)
  const [transactions, setTransactions] = useState<WalletTxn[]>([])
  const [earningGrouped, setEarningGrouped] = useState<EarningGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({
    sourceType: '',
    transactionType: '',
    dateFrom: '',
    dateTo: '',
  })
  const [selectedTxn, setSelectedTxn] = useState<WalletTxn | null>(null)

  function loadOverview() {
    getWalletOverview('USDT')
      .then((data) => setOverview(data))
      .catch(() => setOverview(null))
  }

  function loadHistory() {
    getWalletHistory({
      currency: 'USDT',
      sourceType: filters.sourceType || undefined,
      transactionType: filters.transactionType || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      limit: 100,
    })
      .then((res) => setTransactions((res.transactions || []) as WalletTxn[]))
      .catch(() => setTransactions([]))
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getWalletOverview('USDT'),
      getWalletHistory({ currency: 'USDT', limit: 100 }),
      getEarningHistory({ limit: 100, grouped: true }),
    ])
      .then(([ov, hist, earn]) => {
        setOverview(ov)
        setTransactions((hist.transactions || []) as WalletTxn[])
        setEarningGrouped(earn.grouped || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const unsub = subscribeToLiveUpdates((event) => {
      if (event.type === 'balance_updated') loadOverview()
    })
    return unsub
  }, [])

  useEffect(() => {
    if (tab === 'history') loadHistory()
  }, [tab, filters])

  function txnLabel(type: string): string {
    const key = `wallet_txn_${type}`
    const v = t(key)
    return v !== key ? v : type
  }

  function sourceLabel(type: string): string {
    const key = `wallet_source_${type}`
    const v = t(key)
    return v !== key ? v : type
  }

  function earningSourceLabel(type: string): string {
    const key = `earning_source_${type}`
    const v = t(key)
    return v !== key ? v : type
  }

  function statusLabel(status: string): string {
    const key = status === 'transferred' ? 'earning_status_transferred' : 'earning_status_pending'
    return t(key)
  }

  function clearFilters() {
    setFilters({ sourceType: '', transactionType: '', dateFrom: '', dateTo: '' })
  }

  if (loading && !overview) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="text-white/60">{t('common_loading')}</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">{t('wallet_overview_title')}</h1>
        <p className="mt-1 text-sm text-white/50">Break cash</p>
      </div>

      {/* Quick actions */}
      <div className="mb-8 flex gap-3">
        <Link
          to="/deposit"
          className="elite-hover-lift flex flex-1 items-center justify-center gap-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 font-medium text-emerald-400 transition hover:border-emerald-500/50 hover:bg-emerald-500/15"
        >
          <ArrowDownLeft size={22} strokeWidth={2} />
          <span>{t('deposit')}</span>
        </Link>
        <Link
          to="/withdraw"
          className="elite-hover-lift flex flex-1 items-center justify-center gap-2.5 rounded-2xl border border-brand-blue/30 bg-brand-blue/10 px-4 py-3.5 font-medium text-brand-blue transition hover:border-brand-blue/50 hover:bg-brand-blue/15"
        >
          <ArrowUpRight size={22} strokeWidth={2} />
          <span>{t('withdraw')}</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5">
        {(['overview', 'history', 'earnings'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${
              tab === id
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/60 hover:text-white/80'
            }`}
          >
            {id === 'overview' && <Wallet size={18} />}
            {id === 'history' && <History size={18} />}
            {id === 'earnings' && <PiggyBank size={18} />}
            {id === 'overview' && t('wallet_overview_title')}
            {id === 'history' && t('wallet_history_title')}
            {id === 'earnings' && t('earning_history_title')}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Total assets - hero */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 shadow-xl">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(0,230,118,0.08)_0%,transparent_60%)]" />
            <p className="relative mb-2 text-sm font-medium uppercase tracking-wider text-white/50">
              {t('wallet_overview_total_assets')}
            </p>
            <p className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {formatAmount(overview.total_assets)}
            </p>
          </div>

          {/* Balance breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-white/50">
                {t('wallet_overview_main_balance')}
              </p>
              <p className="text-lg font-semibold text-white">{formatAmount(overview.main_balance)}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-amber-400/70">
                {t('wallet_overview_locked')}
              </p>
              <p className="text-lg font-semibold text-amber-400">{formatAmount(overview.locked_balance)}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-emerald-400/70">
                {t('wallet_overview_withdrawable')}
              </p>
              <p className="text-lg font-semibold text-emerald-400">{formatAmount(overview.withdrawable_balance)}</p>
            </div>
          </div>

          {/* By source */}
          {overview.by_source && overview.by_source.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
              <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/50">
                {t('wallet_overview_by_source')}
              </p>
              <div className="space-y-3">
                {overview.by_source.map((s, i) => (
                  <div
                    key={`${s.source_type}-${s.currency}-${i}`}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3"
                  >
                    <span className="font-medium text-white/90">{sourceLabel(s.source_type)}</span>
                    <span className="font-semibold text-white">{formatAmount(s.balance, s.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-white"
            >
              <span className="flex items-center gap-2">
                <Filter size={18} />
                {t('wallet_history_filter_source')} / {t('wallet_history_filter_type')}
              </span>
              {filtersOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {filtersOpen && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <select
                  value={filters.sourceType}
                  onChange={(e) => setFilters((f) => ({ ...f, sourceType: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                >
                  <option value="">{t('wallet_history_filter_source')}</option>
                  <option value="system">{sourceLabel('system')}</option>
                  <option value="mining">{sourceLabel('mining')}</option>
                  <option value="tasks">{sourceLabel('tasks')}</option>
                  <option value="referrals">{sourceLabel('referrals')}</option>
                </select>
                <select
                  value={filters.transactionType}
                  onChange={(e) => setFilters((f) => ({ ...f, transactionType: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                >
                  <option value="">{t('wallet_history_filter_type')}</option>
                  <option value="deposit">{txnLabel('deposit')}</option>
                  <option value="withdrawal">{txnLabel('withdrawal')}</option>
                  <option value="earning_credit">{txnLabel('earning_credit')}</option>
                  <option value="lock">{txnLabel('lock')}</option>
                  <option value="unlock">{txnLabel('unlock')}</option>
                  <option value="adjust">{txnLabel('adjust')}</option>
                </select>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white"
                />
                <div className="col-span-2 flex gap-2 sm:col-span-4">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                  >
                    {t('wallet_history_filter_clear')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Transaction list */}
          <div className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
            {transactions.length === 0 ? (
              <p className="p-8 text-center text-white/50">{t('wallet_history_empty')}</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {transactions.map((tx) => (
                  <li key={tx.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTxn(tx)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">{txnLabel(tx.transaction_type)}</p>
                        <p className="text-xs text-white/50">
                          {sourceLabel(tx.source_type)} · {formatDate(tx.created_at)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-semibold ${
                          Number(tx.net_amount) >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {Number(tx.net_amount) >= 0 ? '+' : ''}
                        {formatAmount(tx.net_amount, tx.currency)}
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-white/40" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Transaction details modal */}
      {selectedTxn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedTxn(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t('wallet_txn_details')}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl border border-white/15 bg-[#0f1419] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{t('wallet_txn_details')}</h3>
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label={t('wallet_txn_close')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">{txnLabel(selectedTxn.transaction_type)}</span>
                <span className={`font-semibold ${Number(selectedTxn.net_amount) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {Number(selectedTxn.net_amount) >= 0 ? '+' : ''}
                  {formatAmount(selectedTxn.net_amount, selectedTxn.currency)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-white/50">{t('wallet_history_filter_source')}</p>
                  <p className="font-medium text-white">{sourceLabel(selectedTxn.source_type)}</p>
                </div>
                <div>
                  <p className="text-white/50">{t('wallet_txn_amount')}</p>
                  <p className="font-medium text-white">{formatAmount(selectedTxn.amount, selectedTxn.currency)}</p>
                </div>
                {Number(selectedTxn.fee_amount || 0) !== 0 && (
                  <div>
                    <p className="text-white/50">{t('wallet_txn_fee')}</p>
                    <p className="font-medium text-white">{formatAmount(selectedTxn.fee_amount, selectedTxn.currency)}</p>
                  </div>
                )}
                <div>
                  <p className="text-white/50">{t('wallet_txn_net')}</p>
                  <p className="font-medium text-white">{formatAmount(selectedTxn.net_amount, selectedTxn.currency)}</p>
                </div>
                <div>
                  <p className="text-white/50">{t('wallet_txn_balance_before')}</p>
                  <p className="font-medium text-white">{formatAmount(selectedTxn.balance_before, selectedTxn.currency)}</p>
                </div>
                <div>
                  <p className="text-white/50">{t('wallet_txn_balance_after')}</p>
                  <p className="font-medium text-white">{formatAmount(selectedTxn.balance_after, selectedTxn.currency)}</p>
                </div>
                {(selectedTxn.reference_type || selectedTxn.reference_id) && (
                  <div className="col-span-2">
                    <p className="text-white/50">{t('wallet_txn_reference')}</p>
                    <p className="font-medium text-white">
                      {selectedTxn.reference_type || '—'}#{selectedTxn.reference_id ?? '—'}
                    </p>
                  </div>
                )}
              </div>
              {parseMetadata(selectedTxn.metadata) && (
                <div>
                  <p className="text-white/50">{t('wallet_txn_description')}</p>
                  <p className="mt-1 text-sm text-white/90">{parseMetadata(selectedTxn.metadata)}</p>
                </div>
              )}
              <p className="text-xs text-white/40">{formatDate(selectedTxn.created_at)} · ID #{selectedTxn.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Earnings tab */}
      {tab === 'earnings' && (
        <div className="space-y-6">
          {/* Explanation */}
          <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <Info size={20} className="shrink-0 text-brand-blue/80" />
            <div className="text-sm text-white/80">
              <p className="font-medium text-white">{t('earning_status_transferred')}</p>
              <p className="mt-0.5">{t('earning_transferred_explain')}</p>
              <p className="mt-2 font-medium text-white">{t('earning_status_pending')}</p>
              <p className="mt-0.5">{t('earning_pending_explain')}</p>
            </div>
          </div>

          {earningGrouped.length > 0 ? (
            <div className="space-y-5">
              {earningGrouped.map((g) => (
                <div key={g.source_type} className="rounded-xl border border-white/10 bg-white/[0.04] overflow-hidden">
                  <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white">{earningSourceLabel(g.source_type)}</p>
                      <p className="text-sm text-white/60">
                        {formatAmount(g.total_amount)} · {g.transferred_count} {t('earning_status_transferred')} · {g.pending_count} {t('earning_status_pending')}
                      </p>
                    </div>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {g.entries.slice(0, 15).map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-white">{formatAmount(e.amount, e.currency)}</p>
                          <p className="text-xs text-white/50">
                            {e.transferred_wallet_txn_id ? `#${e.transferred_wallet_txn_id}` : ''} · {formatDate(e.created_at)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                            e.status === 'transferred'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {statusLabel(e.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {g.entries.length > 15 && (
                    <p className="border-t border-white/5 px-4 py-2 text-center text-sm text-white/50">
                      +{g.entries.length - 15} more
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] p-8 text-center text-white/50">
              {t('earning_history_empty')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
