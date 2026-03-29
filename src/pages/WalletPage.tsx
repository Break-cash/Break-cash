import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { getEarningHistory, getWalletHistory, type EarningEntry, type EarningGroup } from '../api'
import { AppModalPortal } from '../components/ui/AppModalPortal'
import { WalletSummaryPanel } from '../components/wallet/WalletSummaryPanel'
import { useWalletSummary } from '../hooks/useWalletSummary'
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

type EarningDisplayGroup = {
  key: string
  title: string
  description: string
  total_amount: number
  transferred_count: number
  pending_count: number
  timed_locked_count: number
  timed_locked_amount: number
  permanent_locked_count: number
  next_unlock_at: string | null
  entries: EarningEntry[]
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

function formatRemainingDuration(targetAt: string | null | undefined, nowMs = Date.now()): string {
  if (!targetAt) return ''
  const ms = Date.parse(targetAt) - nowMs
  if (!Number.isFinite(ms) || ms <= 0) return 'الآن'
  const totalSeconds = Math.ceil(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (days > 0) return `${days} يوم ${hours} ساعة`
  if (hours > 0) return `${hours} ساعة ${minutes} دقيقة`
  return `${minutes} دقيقة`
}

function formatLiveCountdown(targetAt: string | null | undefined, nowMs: number): string {
  if (!targetAt) return ''
  const ms = Date.parse(targetAt) - nowMs
  if (!Number.isFinite(ms) || ms <= 0) return 'الآن'
  const totalSeconds = Math.ceil(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (days > 0) return `${days} يوم ${hours} ساعة ${minutes} دقيقة`
  if (hours > 0) return `${hours} ساعة ${minutes} دقيقة ${seconds} ثانية`
  if (minutes > 0) return `${minutes} دقيقة ${seconds} ثانية`
  return `${seconds} ثانية`
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

function earningEntryLabel(entry: EarningEntry): string {
  const refType = String(entry.reference_type || '').toLowerCase()
  if (refType === 'mining_daily_claim') return 'ربح تعدين يومي'
  if (refType === 'task_redemption') return 'مكافأة مهمة'
  if (refType === 'strategy_code_bonus') return 'مكافأة استراتيجية'
  if (refType === 'first_deposit_bonus') return 'بونص أول إيداع'
  if (refType === 'referral_reward') return 'مكافأة إحالة'
  if (refType === 'daily_trade_reward') return 'ربح يومي'
  return 'ربح مضاف'
}

function buildEarningDisplayGroup(group: EarningGroup, t: (key: string) => string): EarningDisplayGroup | null {
  const source = String(group.source_type || '').toLowerCase()
  if (source === 'mining') {
    return {
      key: 'mining',
      title: t('earning_source_mining') !== 'earning_source_mining' ? t('earning_source_mining') : 'التعدين',
      description: 'أرباح التعدين اليومية والشهرية المرتبطة بحسابك.',
      total_amount: Number(group.total_amount || 0),
      transferred_count: Number(group.transferred_count || 0),
      pending_count: Number(group.pending_count || 0),
      timed_locked_count: Number(group.timed_locked_count || 0),
      timed_locked_amount: Number(group.timed_locked_amount || 0),
      permanent_locked_count: Number(group.permanent_locked_count || 0),
      next_unlock_at: group.next_unlock_at || null,
      entries: group.entries || [],
    }
  }
  if (source === 'tasks') {
    return {
      key: 'tasks',
      title: t('earning_source_tasks') !== 'earning_source_tasks' ? t('earning_source_tasks') : 'المهام',
      description: 'أرباح المهام والمكافآت المرتبطة بها.',
      total_amount: Number(group.total_amount || 0),
      transferred_count: Number(group.transferred_count || 0),
      pending_count: Number(group.pending_count || 0),
      timed_locked_count: Number(group.timed_locked_count || 0),
      timed_locked_amount: Number(group.timed_locked_amount || 0),
      permanent_locked_count: Number(group.permanent_locked_count || 0),
      next_unlock_at: group.next_unlock_at || null,
      entries: group.entries || [],
    }
  }
  if (source === 'deposits') {
    return {
      key: 'deposits',
      title: 'البونصات',
      description: 'بونصات الإيداع والعروض المرتبطة بأول إيداع.',
      total_amount: Number(group.total_amount || 0),
      transferred_count: Number(group.transferred_count || 0),
      pending_count: Number(group.pending_count || 0),
      timed_locked_count: Number(group.timed_locked_count || 0),
      timed_locked_amount: Number(group.timed_locked_amount || 0),
      permanent_locked_count: Number(group.permanent_locked_count || 0),
      next_unlock_at: group.next_unlock_at || null,
      entries: group.entries || [],
    }
  }
  if (source === 'referrals') {
    return {
      key: 'referrals',
      title: 'المكافآت',
      description: 'مكافآت الإحالة والمكافآت المرتبطة بدعوة المستخدمين.',
      total_amount: Number(group.total_amount || 0),
      transferred_count: Number(group.transferred_count || 0),
      pending_count: Number(group.pending_count || 0),
      timed_locked_count: Number(group.timed_locked_count || 0),
      timed_locked_amount: Number(group.timed_locked_amount || 0),
      permanent_locked_count: Number(group.permanent_locked_count || 0),
      next_unlock_at: group.next_unlock_at || null,
      entries: group.entries || [],
    }
  }
  return null
}

export function WalletPage() {
  const { t } = useI18n()
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [tab, setTab] = useState<TabId>('overview')
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
  const [loadError, setLoadError] = useState(false)
  const {
    summary,
    overview,
    loading: walletSummaryLoading,
    error: walletSummaryError,
  } = useWalletSummary()

  const loadInitial = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    Promise.all([
      getWalletHistory({ currency: 'USDT', limit: 100 }),
      getEarningHistory({ limit: 100, grouped: true }),
    ])
      .then(([hist, earn]) => {
        setTransactions((hist.transactions || []) as WalletTxn[])
        setEarningGrouped(earn.grouped || [])
        setLoadError(false)
      })
      .catch(() => {
        setTransactions([])
        setEarningGrouped([])
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadHistory = useCallback(() => {
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
  }, [filters.dateFrom, filters.dateTo, filters.sourceType, filters.transactionType])

  useEffect(() => {
    const id = window.setTimeout(() => {
      loadInitial()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadInitial])

  useEffect(() => {
    if (tab !== 'history') return () => {}
    const id = window.setTimeout(() => {
      loadHistory()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadHistory, tab])

  useEffect(() => {
    if (tab !== 'earnings') return
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [tab])

  const earningDisplayGroups = useMemo(
    () =>
      earningGrouped
        .map((group) => buildEarningDisplayGroup(group, t))
        .filter((group): group is EarningDisplayGroup => !!group),
    [earningGrouped, t],
  )

  const earningTotal = useMemo(
    () => earningDisplayGroups.reduce((sum, group) => sum + Number(group.total_amount || 0), 0),
    [earningDisplayGroups],
  )

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

  function statusLabel(status: string): string {
    const key = status === 'transferred' ? 'earning_status_transferred' : 'earning_status_pending'
    return t(key)
  }

  function clearFilters() {
    setFilters({ sourceType: '', transactionType: '', dateFrom: '', dateTo: '' })
  }

  if ((loading || walletSummaryLoading) && !overview) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="text-[var(--text-secondary)]">{t('common_loading')}</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t('wallet_overview_title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Break cash</p>
      </div>

      <div className="mb-8 flex gap-3">
        <Link
          to="/deposit"
          className="action-button action-button-deposit elite-hover-lift flex flex-1 items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 font-medium transition"
        >
          <ArrowDownLeft size={22} strokeWidth={2} />
          <span>{t('deposit')}</span>
        </Link>
        <Link
          to="/withdraw"
          className="action-button action-button-withdraw elite-hover-lift flex flex-1 items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 font-medium transition"
        >
          <ArrowUpRight size={22} strokeWidth={2} />
          <span>{t('withdraw')}</span>
        </Link>
      </div>

      <div className="glass-panel mb-6 flex gap-1 rounded-2xl p-1.5">
        {(['overview', 'history', 'earnings'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`glass-tab flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${
              tab === id ? 'glass-tab-active' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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

      {tab === 'overview' && !walletSummaryLoading && (loadError || walletSummaryError || !overview) && (
        <div className="glass-panel rounded-xl p-8 text-center">
          <p className="mb-4 text-[var(--text-secondary)]">{t('wallet_overview_load_failed')}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="glass-pill rounded-xl px-6 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-white/10"
          >
            {t('common_retry')}
          </button>
        </div>
      )}

      {tab === 'overview' && overview && (
        <div className="space-y-6">
          <WalletSummaryPanel summary={summary} currency="USDT" isLoading={walletSummaryLoading} />

          {overview.by_source && overview.by_source.length > 0 ? (
            <div className="glass-panel rounded-xl p-5">
              <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t('wallet_overview_by_source')}
              </p>
              <div className="space-y-3">
                {overview.by_source.map((s, i) => (
                  <div
                    key={`${s.source_type}-${s.currency}-${i}`}
                    className="glass-panel-soft flex items-center justify-between rounded-lg px-4 py-3"
                  >
                    <span className="font-medium text-[var(--text-secondary)]">{sourceLabel(s.source_type)}</span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatAmount(s.balance, s.currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-xl p-4">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-[var(--text-primary)]"
            >
              <span className="flex items-center gap-2">
                <Filter size={18} />
                {t('wallet_history_filter_source')} / {t('wallet_history_filter_type')}
              </span>
              {filtersOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            {filtersOpen ? (
              <div className="liquid-filter-panel mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <select
                  value={filters.sourceType}
                  onChange={(e) => setFilters((f) => ({ ...f, sourceType: e.target.value }))}
                  className="glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]"
                >
                  <option value="">{t('wallet_history_filter_source')}</option>
                  <option value="system">{sourceLabel('system')}</option>
                  <option value="mining">{sourceLabel('mining')}</option>
                  <option value="tasks">{sourceLabel('tasks')}</option>
                  <option value="referrals">{sourceLabel('referrals')}</option>
                  <option value="deposits">{sourceLabel('deposits')}</option>
                </select>
                <select
                  value={filters.transactionType}
                  onChange={(e) => setFilters((f) => ({ ...f, transactionType: e.target.value }))}
                  className="glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]"
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
                  className="glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]"
                />
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]"
                />
                <div className="col-span-2 flex gap-2 sm:col-span-4">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="glass-pill rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-white/10"
                  >
                    {t('wallet_history_filter_clear')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="glass-panel overflow-hidden rounded-xl">
            {transactions.length === 0 ? (
              <p className="p-8 text-center text-[var(--text-muted)]">{t('wallet_history_empty')}</p>
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
                        <p className="font-medium text-[var(--text-primary)]">{txnLabel(tx.transaction_type)}</p>
                        <p className="text-xs text-[var(--text-muted)]">
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
                      <ChevronRight size={18} className="shrink-0 text-[var(--text-muted)]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {selectedTxn ? (
        <AppModalPortal>
        <div
          className="liquid-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedTxn(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t('wallet_txn_details')}
        >
          <div
            className="liquid-modal-card glass-panel max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('wallet_txn_details')}</h3>
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)]"
                aria-label={t('wallet_txn_close')}
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-muted)]">{txnLabel(selectedTxn.transaction_type)}</span>
                <span className={`font-semibold ${Number(selectedTxn.net_amount) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {Number(selectedTxn.net_amount) >= 0 ? '+' : ''}
                  {formatAmount(selectedTxn.net_amount, selectedTxn.currency)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[var(--text-muted)]">{t('wallet_history_filter_source')}</p>
                  <p className="font-medium text-[var(--text-primary)]">{sourceLabel(selectedTxn.source_type)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">{t('wallet_txn_amount')}</p>
                  <p className="font-medium text-[var(--text-primary)]">{formatAmount(selectedTxn.amount, selectedTxn.currency)}</p>
                </div>
                {Number(selectedTxn.fee_amount || 0) !== 0 ? (
                  <div>
                    <p className="text-[var(--text-muted)]">{t('wallet_txn_fee')}</p>
                    <p className="font-medium text-[var(--text-primary)]">{formatAmount(selectedTxn.fee_amount, selectedTxn.currency)}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-[var(--text-muted)]">{t('wallet_txn_net')}</p>
                  <p className="font-medium text-[var(--text-primary)]">{formatAmount(selectedTxn.net_amount, selectedTxn.currency)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">{t('wallet_txn_balance_before')}</p>
                  <p className="font-medium text-[var(--text-primary)]">{formatAmount(selectedTxn.balance_before, selectedTxn.currency)}</p>
                </div>
                <div>
                  <p className="text-[var(--text-muted)]">{t('wallet_txn_balance_after')}</p>
                  <p className="font-medium text-[var(--text-primary)]">{formatAmount(selectedTxn.balance_after, selectedTxn.currency)}</p>
                </div>
                {selectedTxn.reference_type || selectedTxn.reference_id ? (
                  <div className="col-span-2">
                    <p className="text-[var(--text-muted)]">{t('wallet_txn_reference')}</p>
                    <p className="font-medium text-[var(--text-primary)]">
                      {selectedTxn.reference_type || '-'}#{selectedTxn.reference_id ?? '-'}
                    </p>
                  </div>
                ) : null}
              </div>
              {parseMetadata(selectedTxn.metadata) ? (
                <div>
                  <p className="text-[var(--text-muted)]">{t('wallet_txn_description')}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{parseMetadata(selectedTxn.metadata)}</p>
                </div>
              ) : null}
              <p className="text-xs text-[var(--text-disabled)]">{formatDate(selectedTxn.created_at)} · ID #{selectedTxn.id}</p>
            </div>
          </div>
        </div>
        </AppModalPortal>
      ) : null}

      {tab === 'earnings' ? (
        <div className="space-y-6">
          <div className="glass-panel flex gap-3 rounded-xl p-4">
            <Info size={20} className="shrink-0 text-[var(--accent-blue-soft)]" />
            <div className="text-sm text-[var(--text-secondary)]">
              <p className="font-medium text-[var(--text-primary)]">أرباح حسابك فقط</p>
              <p className="mt-0.5">هذه الواجهة تعرض الأرباح المربوطة بحسابك من التعدين والمهام والبونصات والمكافآت داخل النظام المالي الجديد.</p>
              <p className="mt-2 font-medium text-[var(--text-primary)]">{t('earning_status_transferred')}</p>
              <p className="mt-0.5">{t('earning_transferred_explain')}</p>
              <p className="mt-2 font-medium text-[var(--text-primary)]">{t('earning_status_pending')}</p>
              <p className="mt-0.5">{t('earning_pending_explain')}</p>
              <p className="mt-2 text-amber-200">أرباح المهام والأكواد الاستراتيجية تصبح قابلة للسحب بعد 7 أيام كاملة من وقت الربح.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="glass-panel rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)]">إجمالي الأرباح</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{formatAmount(earningTotal)}</p>
            </div>
            {earningDisplayGroups.map((group) => (
              <div key={`summary-${group.key}`} className="glass-panel rounded-xl p-4">
                <p className="text-xs text-[var(--text-muted)]">{group.title}</p>
                <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{formatAmount(group.total_amount)}</p>
              </div>
            ))}
          </div>

          {earningDisplayGroups.length > 0 ? (
            <div className="space-y-5">
              {earningDisplayGroups.map((group) => (
                <div key={group.key} className="glass-panel overflow-hidden rounded-xl">
                  <div className="border-b border-[var(--border-soft)] bg-white/[0.02] px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        {group.timed_locked_count > 0 && group.next_unlock_at ? (
                          <div className="mb-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                            {`يوجد ${group.timed_locked_count} ربح/أرباح مقيدة من هذا المصدر بقيمة ${formatAmount(group.timed_locked_amount)}. يمكن سحبها بعد ${formatRemainingDuration(group.next_unlock_at)} (${formatDate(group.next_unlock_at)}).`}
                          </div>
                        ) : null}
                        {group.permanent_locked_count > 0 ? (
                          <div className="mb-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                            {`يوجد ${group.permanent_locked_count} ربح/أرباح من هذا المصدر غير قابلة للسحب حاليًا حتى يغيّر المالك القاعدة.`}
                          </div>
                        ) : null}
                        <p className="font-semibold text-[var(--text-primary)]">{group.title}</p>
                        <p className="text-xs text-[var(--text-muted)]">{group.description}</p>
                      </div>
                      <p className="text-sm text-[var(--text-muted)]">
                        {formatAmount(group.total_amount)} · {group.transferred_count} {t('earning_status_transferred')} · {group.pending_count} {t('earning_status_pending')}
                      </p>
                    </div>
                  </div>
                  <ul className="divide-y divide-white/5">
                    {group.entries.slice(0, 15).map((entry) => (
                      <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{earningEntryLabel(entry)}</p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatAmount(entry.amount, entry.currency)}
                            {entry.transferred_wallet_txn_id ? ` · #${entry.transferred_wallet_txn_id}` : ''}
                            {` · ${formatDate(entry.created_at)}`}
                          </p>
                          {entry.status === 'pending' && entry.locked_until ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 font-mono text-[11px] text-amber-200">
                                {formatLiveCountdown(entry.locked_until, nowTick)}
                              </span>
                              <p className="text-[11px] text-amber-300">
                              {`متاح للسحب بعد ${formatRemainingDuration(entry.locked_until)} (${formatDate(entry.locked_until)}).`}
                            </p>
                            </div>
                          ) : null}
                          {entry.status === 'pending' && entry.payout_mode === 'bonus_locked' ? (
                            <p className="mt-1 text-[11px] text-rose-300">هذا الربح غير قابل للسحب حاليًا.</p>
                          ) : null}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                            entry.status === 'transferred'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {statusLabel(entry.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {group.entries.length > 15 ? (
                    <p className="border-t border-white/5 px-4 py-2 text-center text-sm text-[var(--text-muted)]">
                      +{group.entries.length - 15} more
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="glass-panel rounded-xl p-8 text-center text-[var(--text-muted)]">
              {t('earning_history_empty')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
