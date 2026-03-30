import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, ChevronDown, ChevronRight, Filter, History, Info, PiggyBank, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react'
import { getEarningHistory, getWalletHistory, type EarningEntry, type EarningGroup } from '../api'
import { AppModalPortal } from '../components/ui/AppModalPortal'
import { WalletSummaryPanel } from '../components/wallet/WalletSummaryPanel'
import { useWalletSummary } from '../hooks/useWalletSummary'
import { useI18n } from '../i18nCore'

type TabId = 'overview' | 'history' | 'earnings'
type WalletTxn = { id: number; transaction_type: string; source_type: string; amount: number; fee_amount: number; net_amount: number; currency: string; created_at: string; reference_type: string | null; reference_id: number | null; balance_before: number; balance_after: number; metadata: string | null }
type EarningDisplayGroup = { key: string; title: string; description: string; total_amount: number; transferred_count: number; pending_count: number; timed_locked_count: number; timed_locked_amount: number; permanent_locked_count: number; next_unlock_at: string | null; entries: EarningEntry[] }

const fmt = (n: number, c = 'USDT') => `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} ${c}`
const fmtDate = (s: string) => new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const timeLeft = (v: string | null | undefined, now = Date.now()) => {
  if (!v) return ''
  const ms = Date.parse(v) - now
  if (!Number.isFinite(ms) || ms <= 0) return 'الآن'
  const sec = Math.ceil(ms / 1000)
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d} يوم ${h} ساعة`
  if (h > 0) return `${h} ساعة ${m} دقيقة`
  if (m > 0) return `${m} دقيقة ${s} ثانية`
  return `${s} ثانية`
}

function parseMetadata(meta: string | null) {
  if (!meta) return ''
  try {
    const parsed = JSON.parse(meta)
    return typeof parsed.note === 'string' ? parsed.note : parsed.description || meta
  } catch {
    return meta
  }
}

function buildEarningDisplayGroup(group: EarningGroup, t: (key: string) => string): EarningDisplayGroup | null {
  const source = String(group.source_type || '').toLowerCase()
  const lookup: Record<string, { key: string; title: string; description: string }> = {
    mining: { key: 'mining', title: t('earning_source_mining') !== 'earning_source_mining' ? t('earning_source_mining') : 'التعدين', description: 'أرباح التعدين اليومية والشهرية المرتبطة بحسابك.' },
    tasks: { key: 'tasks', title: t('earning_source_tasks') !== 'earning_source_tasks' ? t('earning_source_tasks') : 'المهام', description: 'أرباح المهام والمكافآت المرتبطة بها.' },
    deposits: { key: 'deposits', title: 'البونصات', description: 'بونصات الإيداع والعروض المرتبطة بأول إيداع.' },
    referrals: { key: 'referrals', title: 'المكافآت', description: 'مكافآت الإحالة والمكافآت المرتبطة بدعوة المستخدمين.' },
  }
  const resolved = lookup[source]
  if (!resolved) return null
  return { ...resolved, total_amount: Number(group.total_amount || 0), transferred_count: Number(group.transferred_count || 0), pending_count: Number(group.pending_count || 0), timed_locked_count: Number(group.timed_locked_count || 0), timed_locked_amount: Number(group.timed_locked_amount || 0), permanent_locked_count: Number(group.permanent_locked_count || 0), next_unlock_at: group.next_unlock_at || null, entries: group.entries || [] }
}

export function WalletPage() {
  const { t, language } = useI18n()
  const [tab, setTab] = useState<TabId>('overview')
  const [transactions, setTransactions] = useState<WalletTxn[]>([])
  const [earningGrouped, setEarningGrouped] = useState<EarningGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({ sourceType: '', transactionType: '', dateFrom: '', dateTo: '' })
  const [selectedTxn, setSelectedTxn] = useState<WalletTxn | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [loadError, setLoadError] = useState(false)
  const { summary, overview, loading: walletSummaryLoading, error: walletSummaryError } = useWalletSummary()

  const loadInitial = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    Promise.all([getWalletHistory({ currency: 'USDT', limit: 100 }), getEarningHistory({ limit: 100, grouped: true })])
      .then(([hist, earn]) => {
        setTransactions((hist.transactions || []) as WalletTxn[])
        setEarningGrouped(earn.grouped || [])
      })
      .catch(() => {
        setTransactions([])
        setEarningGrouped([])
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadHistory = useCallback(() => {
    getWalletHistory({ currency: 'USDT', sourceType: filters.sourceType || undefined, transactionType: filters.transactionType || undefined, dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined, limit: 100 })
      .then((res) => setTransactions((res.transactions || []) as WalletTxn[]))
      .catch(() => setTransactions([]))
  }, [filters.dateFrom, filters.dateTo, filters.sourceType, filters.transactionType])

  useEffect(() => { loadInitial() }, [loadInitial])
  useEffect(() => { if (tab === 'history') loadHistory() }, [loadHistory, tab])
  useEffect(() => { if (tab !== 'earnings') return; const id = window.setInterval(() => setNowTick(Date.now()), 1000); return () => window.clearInterval(id) }, [tab])

  const earningDisplayGroups = useMemo(() => earningGrouped.map((group) => buildEarningDisplayGroup(group, t)).filter((group): group is EarningDisplayGroup => !!group), [earningGrouped, t])
  const earningTotal = useMemo(() => earningDisplayGroups.reduce((sum, group) => sum + Number(group.total_amount || 0), 0), [earningDisplayGroups])
  const heroText = language === 'ar' ? 'مركز موحد لإدارة الأصول، تتبع الحركة المالية، ومراجعة الأرباح بطريقة أوضح وأكثر رسمية.' : language === 'tr' ? 'Varliklari yonetmek ve finansal hareketleri izlemek icin tek merkez.' : 'A unified place to manage assets, review activity, and track earnings.'

  const txnLabel = (type: string) => {
    const key = `wallet_txn_${type}`
    const v = t(key)
    return v !== key ? v : type
  }
  const sourceLabel = (type: string) => {
    const key = `wallet_source_${type}`
    const v = t(key)
    return v !== key ? v : type
  }

  if ((loading || walletSummaryLoading) && !overview) {
    return <div className="flex min-h-[40vh] items-center justify-center"><span className="text-[var(--text-secondary)]">{t('common_loading')}</span></div>
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4">
      <section className="mb-6 overflow-hidden rounded-[28px] border border-brand-blue/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_28%),linear-gradient(135deg,rgba(6,13,24,0.96),rgba(10,18,32,0.92))] p-5 shadow-[0_22px_52px_rgba(2,8,20,0.32)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200"><BadgeCheck size={14} /><span>{language === 'ar' ? 'المحفظة الرسمية' : language === 'tr' ? 'Resmi cuzdan' : 'Official wallet'}</span></div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">{t('wallet_overview_title')}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-300">{heroText}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400"><ShieldCheck size={14} /><span>{t('wallet_overview_total_assets')}</span></div><div className="mt-2 text-lg font-bold text-white">{fmt(summary.totalAssets)}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400"><Sparkles size={14} /><span>{language === 'ar' ? 'النشاط المالي' : 'Activity'}</span></div><div className="mt-2 text-lg font-bold text-white">{transactions.length > 0 ? transactions.length : 0}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3"><div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400"><PiggyBank size={14} /><span>{language === 'ar' ? 'مصادر الأرباح' : 'Sources'}</span></div><div className="mt-2 text-lg font-bold text-white">{earningDisplayGroups.length}</div></div>
        </div>
      </section>

      <div className="mb-8 flex gap-3">
        <Link to="/deposit" className="action-button action-button-deposit elite-hover-lift flex flex-1 items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 font-medium transition"><ArrowDownLeft size={22} strokeWidth={2} /><span>{t('deposit')}</span></Link>
        <Link to="/withdraw" className="action-button action-button-withdraw elite-hover-lift flex flex-1 items-center justify-center gap-2.5 rounded-2xl px-4 py-3.5 font-medium transition"><ArrowUpRight size={22} strokeWidth={2} /><span>{t('withdraw')}</span></Link>
      </div>

      <div className="glass-panel mb-6 flex gap-1 rounded-2xl p-1.5">
        {(['overview', 'history', 'earnings'] as const).map((id) => <button key={id} type="button" onClick={() => setTab(id)} className={`glass-tab flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${tab === id ? 'glass-tab-active' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{id === 'overview' && <Wallet size={18} />}{id === 'history' && <History size={18} />}{id === 'earnings' && <PiggyBank size={18} />}{id === 'overview' && t('wallet_overview_title')}{id === 'history' && t('wallet_history_title')}{id === 'earnings' && t('earning_history_title')}</button>)}
      </div>

      {tab === 'overview' && !walletSummaryLoading && (loadError || walletSummaryError || !overview) ? <div className="glass-panel rounded-xl p-8 text-center"><p className="mb-4 text-[var(--text-secondary)]">{t('wallet_overview_load_failed')}</p><button type="button" onClick={() => window.location.reload()} className="glass-pill rounded-xl px-6 py-2.5 text-sm font-medium text-[var(--text-primary)] transition hover:bg-white/10">{t('common_retry')}</button></div> : null}

      {tab === 'overview' && overview ? (
        <div className="space-y-6">
          <WalletSummaryPanel summary={summary} currency="USDT" isLoading={walletSummaryLoading} />
          {overview.by_source?.length ? <div className="glass-panel rounded-2xl p-5"><p className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t('wallet_overview_by_source')}</p><div className="space-y-3">{overview.by_source.map((s, i) => <div key={`${s.source_type}-${s.currency}-${i}`} className="glass-panel-soft flex items-center justify-between rounded-xl px-4 py-3"><span className="font-medium text-[var(--text-secondary)]">{sourceLabel(s.source_type)}</span><span className="font-semibold text-[var(--text-primary)]">{fmt(s.balance, s.currency)}</span></div>)}</div></div> : null}
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl p-4">
            <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="flex w-full items-center justify-between text-left text-sm font-medium text-[var(--text-primary)]"><span className="flex items-center gap-2"><Filter size={18} />{t('wallet_history_filter_source')} / {t('wallet_history_filter_type')}</span>{filtersOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>
            {filtersOpen ? <div className="liquid-filter-panel mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><select value={filters.sourceType} onChange={(e) => setFilters((f) => ({ ...f, sourceType: e.target.value }))} className="glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]"><option value="">{t('wallet_history_filter_source')}</option><option value="system">{sourceLabel('system')}</option><option value="mining">{sourceLabel('mining')}</option><option value="tasks">{sourceLabel('tasks')}</option><option value="referrals">{sourceLabel('referrals')}</option><option value="deposits">{sourceLabel('deposits')}</option></select><select value={filters.transactionType} onChange={(e) => setFilters((f) => ({ ...f, transactionType: e.target.value }))} className="glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]"><option value="">{t('wallet_history_filter_type')}</option><option value="deposit">{txnLabel('deposit')}</option><option value="withdrawal">{txnLabel('withdrawal')}</option><option value="earning_credit">{txnLabel('earning_credit')}</option><option value="lock">{txnLabel('lock')}</option><option value="unlock">{txnLabel('unlock')}</option><option value="adjust">{txnLabel('adjust')}</option></select><input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]" /><input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} className="glass-input rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)]" /><div className="col-span-2 flex gap-2 sm:col-span-4"><button type="button" onClick={() => setFilters({ sourceType: '', transactionType: '', dateFrom: '', dateTo: '' })} className="glass-pill rounded-lg px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-white/10">{t('wallet_history_filter_clear')}</button></div></div> : null}
          </div>
          <div className="glass-panel overflow-hidden rounded-2xl">{transactions.length === 0 ? <p className="p-8 text-center text-[var(--text-muted)]">{t('wallet_history_empty')}</p> : <ul className="divide-y divide-white/5">{transactions.map((tx) => <li key={tx.id}><button type="button" onClick={() => setSelectedTxn(tx)} className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"><div className="min-w-0 flex-1"><p className="font-medium text-[var(--text-primary)]">{txnLabel(tx.transaction_type)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{sourceLabel(tx.source_type)} • {fmtDate(tx.created_at)}</p></div><span className={`shrink-0 font-semibold ${Number(tx.net_amount) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(tx.net_amount) >= 0 ? '+' : ''}{fmt(tx.net_amount, tx.currency)}</span><ChevronRight size={18} className="shrink-0 text-[var(--text-muted)]" /></button></li>)}</ul>}</div>
        </div>
      ) : null}

      {selectedTxn ? <AppModalPortal><div className="liquid-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedTxn(null)} role="dialog" aria-modal="true" aria-label={t('wallet_txn_details')}><div className="liquid-modal-card glass-panel max-h-[90vh] w-full max-w-md overflow-auto rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('wallet_txn_details')}</h3><button type="button" onClick={() => setSelectedTxn(null)} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)]" aria-label={t('wallet_txn_close')}><X size={20} /></button></div><div className="space-y-4"><div className="flex justify-between text-sm"><span className="text-[var(--text-muted)]">{txnLabel(selectedTxn.transaction_type)}</span><span className={`font-semibold ${Number(selectedTxn.net_amount) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(selectedTxn.net_amount) >= 0 ? '+' : ''}{fmt(selectedTxn.net_amount, selectedTxn.currency)}</span></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-[var(--text-muted)]">{t('wallet_history_filter_source')}</p><p className="font-medium text-[var(--text-primary)]">{sourceLabel(selectedTxn.source_type)}</p></div><div><p className="text-[var(--text-muted)]">{t('wallet_txn_amount')}</p><p className="font-medium text-[var(--text-primary)]">{fmt(selectedTxn.amount, selectedTxn.currency)}</p></div><div><p className="text-[var(--text-muted)]">{t('wallet_txn_net')}</p><p className="font-medium text-[var(--text-primary)]">{fmt(selectedTxn.net_amount, selectedTxn.currency)}</p></div><div><p className="text-[var(--text-muted)]">{t('wallet_txn_balance_after')}</p><p className="font-medium text-[var(--text-primary)]">{fmt(selectedTxn.balance_after, selectedTxn.currency)}</p></div></div>{parseMetadata(selectedTxn.metadata) ? <div><p className="text-[var(--text-muted)]">{t('wallet_txn_description')}</p><p className="mt-1 text-sm text-[var(--text-secondary)]">{parseMetadata(selectedTxn.metadata)}</p></div> : null}<p className="text-xs text-[var(--text-disabled)]">{fmtDate(selectedTxn.created_at)} • ID #{selectedTxn.id}</p></div></div></div></AppModalPortal> : null}

      {tab === 'earnings' ? (
        <div className="space-y-6">
          <div className="glass-panel flex gap-3 rounded-2xl p-4"><Info size={20} className="shrink-0 text-[var(--accent-blue-soft)]" /><div className="text-sm text-[var(--text-secondary)]"><p className="font-medium text-[var(--text-primary)]">أرباح حسابك فقط</p><p className="mt-0.5">هذه الواجهة تعرض الأرباح المرتبطة بحسابك من التعدين والمهام والبونصات والمكافآت داخل النظام المالي الجديد.</p><p className="mt-2 font-medium text-[var(--text-primary)]">{t('earning_status_transferred')}</p><p className="mt-0.5">{t('earning_transferred_explain')}</p><p className="mt-2 font-medium text-[var(--text-primary)]">{t('earning_status_pending')}</p><p className="mt-0.5">{t('earning_pending_explain')}</p></div></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="glass-panel rounded-2xl p-4"><p className="text-xs text-[var(--text-muted)]">إجمالي الأرباح</p><p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{fmt(earningTotal)}</p></div>{earningDisplayGroups.map((group) => <div key={`summary-${group.key}`} className="glass-panel rounded-2xl p-4"><p className="text-xs text-[var(--text-muted)]">{group.title}</p><p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{fmt(group.total_amount)}</p></div>)}</div>
          {earningDisplayGroups.length > 0 ? <div className="space-y-5">{earningDisplayGroups.map((group) => <div key={group.key} className="glass-panel overflow-hidden rounded-2xl"><div className="border-b border-[var(--border-soft)] bg-white/[0.02] px-4 py-3"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div>{group.timed_locked_count > 0 && group.next_unlock_at ? <div className="mb-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{`يوجد ${group.timed_locked_count} ربح/أرباح مقيدة من هذا المصدر بقيمة ${fmt(group.timed_locked_amount)}. يمكن سحبها بعد ${timeLeft(group.next_unlock_at)} (${fmtDate(group.next_unlock_at)}).`}</div> : null}<p className="font-semibold text-[var(--text-primary)]">{group.title}</p><p className="text-xs text-[var(--text-muted)]">{group.description}</p></div><p className="text-sm text-[var(--text-muted)]">{fmt(group.total_amount)} • {group.transferred_count} {t('earning_status_transferred')} • {group.pending_count} {t('earning_status_pending')}</p></div></div><ul className="divide-y divide-white/5">{group.entries.slice(0, 12).map((entry) => <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3"><div><p className="font-medium text-[var(--text-primary)]">{entry.reference_type ? entry.reference_type : 'earning'}</p><p className="text-xs text-[var(--text-muted)]">{fmt(entry.amount, entry.currency)} • {fmtDate(entry.created_at)}</p>{entry.status === 'pending' && entry.locked_until ? <p className="mt-1 text-[11px] text-amber-300">{`متاح للسحب بعد ${timeLeft(entry.locked_until, nowTick)}.`}</p> : null}</div><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${entry.status === 'transferred' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>{entry.status === 'transferred' ? t('earning_status_transferred') : t('earning_status_pending')}</span></li>)}</ul></div>)}</div> : <p className="glass-panel rounded-2xl p-8 text-center text-[var(--text-muted)]">{t('earning_history_empty')}</p>}
        </div>
      ) : null}
    </div>
  )
}
