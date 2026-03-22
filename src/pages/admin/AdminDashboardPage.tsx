import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminDepositRequests,
  getAdminUsersList,
  getAdminWithdrawalRequests,
  getStrategyTradeDisplayConfig,
  updateStrategyTradeDisplayConfig,
  type StrategyTradeDisplayConfig,
} from '../../api'

type DashboardSnapshot = {
  usersCount: number
  pendingDeposits: number
  pendingWithdrawals: number
  vipUsers: number
}

const DEFAULT_DISPLAY_CONFIG: StrategyTradeDisplayConfig = {
  preview_notice: 'سيتم فتح الصفقة الاستراتيجية بعد التأكيد وفق آلية المعالجة الداخلية للنظام.',
  active_notice: 'تتم إعادة أصل الصفقة مع الربح تلقائيًا بعد اكتمال المعالجة الداخلية.',
  settled_notice: 'تمت تسوية الصفقة الاستراتيجية وإرجاع الأصل مع الربح.',
}

export function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    usersCount: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    vipUsers: 0,
  })
  const [displayConfig, setDisplayConfig] = useState<StrategyTradeDisplayConfig>(DEFAULT_DISPLAY_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let active = true
    async function loadDashboard() {
      setLoading(true)
      try {
        const [usersRes, depositsRes, withdrawalsRes, displayRes] = await Promise.all([
          getAdminUsersList({ limit: 20 }),
          getAdminDepositRequests('pending'),
          getAdminWithdrawalRequests('pending'),
          getStrategyTradeDisplayConfig(),
        ])
        if (!active) return
        const users = usersRes.users || []
        setSnapshot({
          usersCount: users.length,
          pendingDeposits: Number(depositsRes.items?.length || 0),
          pendingWithdrawals: Number(withdrawalsRes.items?.length || 0),
          vipUsers: users.filter((item) => Number(item.vip_level || 0) > 0).length,
        })
        setDisplayConfig(displayRes.config || DEFAULT_DISPLAY_CONFIG)
      } catch (error) {
        if (!active) return
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'تعذر تحميل لوحة الإدارة.' })
      } finally {
        if (active) setLoading(false)
      }
    }
    loadDashboard().catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function handleSaveDisplayConfig() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await updateStrategyTradeDisplayConfig(displayConfig)
      setDisplayConfig(res.config)
      setMessage({ type: 'success', text: 'تم تحديث الوصف الظاهر للمستخدمين في الصفقات الاستراتيجية.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'فشل تحديث وصف الصفقات.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="page-title">لوحة الإدارة</h1>
        <p className="text-sm text-app-muted">واجهة سريعة للمشرفين والإدمن لمتابعة العمل اليومي وضبط النص الظاهر في الصفقات الاستراتيجية.</p>
      </div>

      {message ? (
        <div className={`rounded-xl px-3 py-2 text-sm ${message.type === 'success' ? 'owner-message-success' : 'owner-message-error'}`}>
          {message.text}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'المستخدمون', value: snapshot.usersCount },
          { label: 'إيداعات معلقة', value: snapshot.pendingDeposits },
          { label: 'سحوبات معلقة', value: snapshot.pendingWithdrawals },
          { label: 'أعضاء VIP ظاهرون', value: snapshot.vipUsers },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-app-border bg-app-card p-4">
            <div className="text-xs text-app-muted">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-white">{loading ? '...' : item.value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-app-border bg-app-card p-4">
        <h2 className="text-sm font-semibold text-white">الوصول السريع</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/admin/users" className="rounded-xl border border-app-border bg-app-elevated px-3 py-3 text-sm font-semibold text-white">
            إدارة المستخدمين
          </Link>
          <Link to="/admin/balances" className="rounded-xl border border-app-border bg-app-elevated px-3 py-3 text-sm font-semibold text-white">
            الأرصدة والطلبات
          </Link>
          <Link to="/admin/invites" className="rounded-xl border border-app-border bg-app-elevated px-3 py-3 text-sm font-semibold text-white">
            الدعوات
          </Link>
          <Link to="/admin/permissions" className="rounded-xl border border-app-border bg-app-elevated px-3 py-3 text-sm font-semibold text-white">
            الصلاحيات
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-app-border bg-app-card p-4">
        <h2 className="text-sm font-semibold text-white">الوصف الظاهر للمستخدم في الصفقات الاستراتيجية</h2>
        <p className="mt-1 text-xs text-app-muted">هذا الوصف لا يكشف وقت الجدولة الحقيقي، ويظهر بدل الوقت الفعلي للمستخدم.</p>
        <div className="mt-3 space-y-2">
          <input
            className="field-input"
            placeholder="وصف ما قبل التأكيد"
            value={displayConfig.preview_notice}
            onChange={(e) => setDisplayConfig((prev) => ({ ...prev, preview_notice: e.target.value }))}
          />
          <input
            className="field-input"
            placeholder="وصف أثناء المعالجة"
            value={displayConfig.active_notice}
            onChange={(e) => setDisplayConfig((prev) => ({ ...prev, active_notice: e.target.value }))}
          />
          <input
            className="field-input"
            placeholder="وصف بعد التسوية"
            value={displayConfig.settled_notice}
            onChange={(e) => setDisplayConfig((prev) => ({ ...prev, settled_notice: e.target.value }))}
          />
          <div className="flex justify-end">
            <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleSaveDisplayConfig} disabled={saving}>
              {saving ? '...' : 'حفظ الوصف'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
