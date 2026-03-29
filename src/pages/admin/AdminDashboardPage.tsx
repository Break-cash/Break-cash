import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  broadcastAdminNotification,
  createAdminNotification,
  deleteStrategyUsageAdmin,
  getAdminDepositRequests,
  getAdminUsersList,
  getAdminWithdrawalRequests,
  getMyPermissions,
  getStrategyCodesAdmin,
  getStrategyTradeDisplayConfig,
  upsertStrategyCodeAdmin,
  type StrategyCodeAdminItem,
  type StrategyCodeUsageAdminItem,
  type StrategyTradeDisplayConfig,
  updateStrategyTradeDisplayConfig,
} from '../../api'

type DashboardSnapshot = {
  usersCount: number
  pendingDeposits: number
  pendingWithdrawals: number
  vipUsers: number
}

const DEFAULT_DISPLAY_CONFIG: StrategyTradeDisplayConfig = {
  preview_notice: 'سيتم فتح الصفقة الاستراتيجية بعد التأكيد وفق آلية المعالجة الداخلية للنظام.',
  active_notice: 'تتم إعادة أصل الصفقة مع الربح تلقائيا بعد اكتمال المعالجة الداخلية.',
  settled_notice: 'تمت تسوية الصفقة الاستراتيجية وإرجاع الأصل مع الربح.',
}

const DEFAULT_STRATEGY_DRAFT = {
  code: '',
  title: '',
  description: '',
  expertName: '',
  assetSymbol: 'BTCUSDT',
  purchasePercent: '50',
  tradeReturnPercent: '12',
  expiresAt: '',
  isActive: true,
}

export function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    usersCount: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    vipUsers: 0,
  })
  const [grantedPermissions, setGrantedPermissions] = useState<string[]>([])
  const [displayConfig, setDisplayConfig] = useState<StrategyTradeDisplayConfig>(DEFAULT_DISPLAY_CONFIG)
  const [strategyCodes, setStrategyCodes] = useState<StrategyCodeAdminItem[]>([])
  const [strategyUsages, setStrategyUsages] = useState<StrategyCodeUsageAdminItem[]>([])
  const [expertDrafts, setExpertDrafts] = useState<Record<number, string>>({})
  const [strategyDraft, setStrategyDraft] = useState(DEFAULT_STRATEGY_DRAFT)
  const [notificationDraft, setNotificationDraft] = useState({
    userId: '',
    title: '',
    body: '',
    broadcast: false,
  })
  const [loading, setLoading] = useState(true)
  const [savingDisplay, setSavingDisplay] = useState(false)
  const [savingExpertId, setSavingExpertId] = useState<number | null>(null)
  const [deletingStrategyUsageId, setDeletingStrategyUsageId] = useState<number | null>(null)
  const [savingStrategy, setSavingStrategy] = useState(false)
  const [sendingNotification, setSendingNotification] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const canManageStrategy = grantedPermissions.includes('trades.manage') || grantedPermissions.includes('إنشاء مهام')
  const canManageNotifications = grantedPermissions.includes('notifications.manage') || grantedPermissions.includes('manage_users')
  const canEditStrategyDisplay = grantedPermissions.includes('settings.manage')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      try {
        const permissionsRes = await getMyPermissions()
        if (!active) return

        const permissions = Array.isArray(permissionsRes.permissions) ? permissionsRes.permissions : []
        setGrantedPermissions(permissions)

        const [usersRes, depositsRes, withdrawalsRes, displayRes, strategyRes] = await Promise.all([
          getAdminUsersList({ limit: 20 }),
          getAdminDepositRequests('pending'),
          getAdminWithdrawalRequests('pending'),
          getStrategyTradeDisplayConfig(),
          permissions.includes('trades.manage') || permissions.includes('إنشاء مهام')
            ? getStrategyCodesAdmin()
            : Promise.resolve({ items: [], usages: [] }),
        ])
        if (!active) return

        const users = usersRes.users || []
        const strategyItems = (strategyRes.items || []).filter((item) => item.featureType === 'trial_trade')
        const strategyUsageItems = (strategyRes.usages || []).filter((item) => item.status === 'trade_settled')
        setSnapshot({
          usersCount: users.length,
          pendingDeposits: Number(depositsRes.items?.length || 0),
          pendingWithdrawals: Number(withdrawalsRes.items?.length || 0),
          vipUsers: users.filter((item) => Number(item.vip_level || 0) > 0).length,
        })
        setDisplayConfig(displayRes.config || DEFAULT_DISPLAY_CONFIG)
        setStrategyCodes(strategyItems)
        setStrategyUsages(strategyUsageItems)
        setExpertDrafts(Object.fromEntries(strategyItems.map((item) => [item.id, String(item.expertName || '')])))
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

  async function reloadStrategyCodes() {
    const strategyRes = await getStrategyCodesAdmin()
    const strategyItems = (strategyRes.items || []).filter((item) => item.featureType === 'trial_trade')
    const strategyUsageItems = (strategyRes.usages || []).filter((item) => item.status === 'trade_settled')
    setStrategyCodes(strategyItems)
    setStrategyUsages(strategyUsageItems)
    setExpertDrafts(Object.fromEntries(strategyItems.map((item) => [item.id, String(item.expertName || '')])))
  }

  async function handleSaveDisplayConfig() {
    setSavingDisplay(true)
    setMessage(null)
    try {
      const res = await updateStrategyTradeDisplayConfig(displayConfig)
      setDisplayConfig(res.config)
      setMessage({ type: 'success', text: 'تم تحديث الوصف الظاهر للصفقات الاستراتيجية.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'فشل تحديث وصف الصفقات.' })
    } finally {
      setSavingDisplay(false)
    }
  }

  async function handleSaveExpertName(item: StrategyCodeAdminItem) {
    setSavingExpertId(item.id)
    setMessage(null)
    try {
      await upsertStrategyCodeAdmin({
        id: item.id,
        code: item.code,
        title: item.title,
        description: item.description || '',
        expertName: String(expertDrafts[item.id] || '').trim(),
        assetSymbol: item.assetSymbol,
        purchasePercent: Number(item.purchasePercent || 50),
        tradeReturnPercent: Number(item.tradeReturnPercent || 0),
        expiresAt: item.expiresAt || null,
        isActive: item.isActive,
      })
      await reloadStrategyCodes()
      setMessage({ type: 'success', text: 'تم تحديث اسم الخبير.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'فشل تحديث اسم الخبير.' })
    } finally {
      setSavingExpertId(null)
    }
  }

  async function handleCreateStrategyCode() {
    setSavingStrategy(true)
    setMessage(null)
    try {
      await upsertStrategyCodeAdmin({
        code: strategyDraft.code.trim(),
        title: strategyDraft.title.trim(),
        description: strategyDraft.description.trim(),
        expertName: strategyDraft.expertName.trim(),
        assetSymbol: strategyDraft.assetSymbol.trim().toUpperCase() || 'BTCUSDT',
        purchasePercent: Number(strategyDraft.purchasePercent || 0),
        tradeReturnPercent: Number(strategyDraft.tradeReturnPercent || 0),
        expiresAt: strategyDraft.expiresAt ? new Date(strategyDraft.expiresAt).toISOString() : null,
        isActive: strategyDraft.isActive,
      })
      await reloadStrategyCodes()
      setStrategyDraft(DEFAULT_STRATEGY_DRAFT)
      setMessage({ type: 'success', text: 'تم إنشاء كود الاستراتيجية للمشرف.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'فشل إنشاء كود الاستراتيجية.' })
    } finally {
      setSavingStrategy(false)
    }
  }

  async function handleDeleteStrategyUsage(item: StrategyCodeUsageAdminItem) {
    const confirmed = window.confirm(
      `هل تريد حذف الصفقة المكتملة #${item.id} من السجل الظاهر فقط؟ سيبقى الربح اليومي المقفل أسبوعًا كما هو دون تغيير.`,
    )
    if (!confirmed) return

    setDeletingStrategyUsageId(item.id)
    setMessage(null)
    try {
      await deleteStrategyUsageAdmin(item.id)
      await reloadStrategyCodes()
      setMessage({ type: 'success', text: 'تم حذف الصفقة المكتملة من السجل دون المساس بالربح المقفل.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'فشل حذف الصفقة المكتملة.' })
    } finally {
      setDeletingStrategyUsageId(null)
    }
  }

  async function handleSendNotification() {
    setSendingNotification(true)
    setMessage(null)
    try {
      const title = notificationDraft.title.trim()
      const body = notificationDraft.body.trim()
      if (notificationDraft.broadcast) {
        const res = await broadcastAdminNotification({ title, body, vibrate: true })
        setMessage({ type: 'success', text: `تم إرسال الإشعار إلى ${res.createdCount} مستخدم.` })
      } else {
        const userId = Number(notificationDraft.userId || 0)
        await createAdminNotification({ userId, title, body })
        setMessage({ type: 'success', text: `تم إرسال الإشعار إلى المستخدم #${userId}.` })
      }
      setNotificationDraft({ userId: '', title: '', body: '', broadcast: false })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'فشل إرسال الإشعار.' })
    } finally {
      setSendingNotification(false)
    }
  }

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="page-title">لوحة الإدارة</h1>
        <p className="text-sm text-app-muted">واجهة سريعة للمشرفين لمتابعة العمل اليومي وإنشاء أكواد الاستراتيجية والإشعارات عند توفر الصلاحية.</p>
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
          { label: 'أعضاء VIP', value: snapshot.vipUsers },
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
            <button
              type="button"
              className="wallet-action-btn wallet-action-deposit"
              onClick={handleSaveDisplayConfig}
              disabled={savingDisplay || !canEditStrategyDisplay}
            >
              {savingDisplay ? '...' : 'حفظ الوصف'}
            </button>
          </div>
        </div>
      </section>

      {canManageStrategy ? (
        <>
          <section className="rounded-2xl border border-app-border bg-app-card p-4">
            <h2 className="text-sm font-semibold text-white">إنشاء كود استراتيجية</h2>
            <p className="mt-1 text-xs text-app-muted">متاح للمشرفين الذين يملكون صلاحية التداول أو إنشاء المهام.</p>
            <p className="mt-1 text-xs text-app-muted">يتم خصم نسبة الشراء من إجمالي الأصول بعد استثناء الجزء المقيد، ويعود أصل مبلغ الصفقة كاملًا للمستخدم عند انتهاء المدة.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                className="field-input"
                placeholder="الكود"
                value={strategyDraft.code}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              />
              <input
                className="field-input"
                placeholder="العنوان"
                value={strategyDraft.title}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, title: e.target.value }))}
              />
              <input
                className="field-input"
                placeholder="اسم الخبير"
                value={strategyDraft.expertName}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, expertName: e.target.value }))}
              />
              <input
                className="field-input"
                placeholder="الرمز مثل BTCUSDT"
                value={strategyDraft.assetSymbol}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, assetSymbol: e.target.value.toUpperCase() }))}
              />
              <input
                className="field-input"
                type="number"
                placeholder="نسبة الشراء من إجمالي الأصول بعد استثناء المقيد"
                value={strategyDraft.purchasePercent}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, purchasePercent: e.target.value }))}
              />
              <input
                className="field-input"
                type="number"
                placeholder="نسبة ربح الصفقة"
                value={strategyDraft.tradeReturnPercent}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, tradeReturnPercent: e.target.value }))}
              />
              <input
                className="field-input sm:col-span-2"
                type="datetime-local"
                value={strategyDraft.expiresAt}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, expiresAt: e.target.value }))}
              />
              <textarea
                className="field-input sm:col-span-2"
                rows={3}
                placeholder="الوصف"
                value={strategyDraft.description}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-app-muted">
              <input
                type="checkbox"
                checked={strategyDraft.isActive}
                onChange={(e) => setStrategyDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <span>تفعيل الكود مباشرة</span>
            </label>
            <div className="mt-3 flex justify-end">
              <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleCreateStrategyCode} disabled={savingStrategy}>
                {savingStrategy ? '...' : 'إنشاء الكود'}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-app-border bg-app-card p-4">
            <h2 className="text-sm font-semibold text-white">أسماء الخبراء للصفقات المنشورة</h2>
            <p className="mt-1 text-xs text-app-muted">الاسم يظهر للمستخدم كعرض فقط تحت خانة كود الاستراتيجية.</p>
            <div className="mt-3 space-y-3">
              {strategyCodes.length > 0 ? strategyCodes.map((item) => (
                <div key={item.id} className="rounded-2xl border border-app-border bg-app-elevated p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{item.title || item.code}</div>
                      <div className="text-xs text-app-muted">
                        {item.code} · {item.assetSymbol} · شراء {Number(item.purchasePercent || 0).toFixed(0)}% · {item.isActive ? 'منشورة' : 'معطلة'}
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-300'}`}>
                      {item.isActive ? 'ظاهرة للمستخدم' : 'غير منشورة'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="field-input flex-1"
                      placeholder="اسم الخبير الظاهر للمستخدم"
                      value={expertDrafts[item.id] ?? ''}
                      onChange={(e) => setExpertDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="wallet-action-btn wallet-action-deposit whitespace-nowrap"
                      onClick={() => handleSaveExpertName(item)}
                      disabled={savingExpertId === item.id}
                    >
                      {savingExpertId === item.id ? '...' : 'حفظ اسم الخبير'}
                    </button>
                  </div>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-app-border bg-app-elevated px-3 py-4 text-sm text-app-muted">
                  لا توجد أكواد استراتيجية محفوظة حاليا.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-app-border bg-app-card p-4">
            <h2 className="text-sm font-semibold text-white">حذف الصفقات السابقة</h2>
            <p className="mt-1 text-xs text-app-muted">يمكن للمشرف حذف أي صفقة استراتيجية قديمة من هنا بشكل نهائي.</p>
            <div className="mt-3 space-y-2">
              {strategyUsages.length > 0 ? strategyUsages.map((item) => (
                <div key={`delete-usage-${item.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-app-border bg-app-elevated px-3 py-3">
                  <div className="text-sm text-white">
                    <div>#{item.id} · #{item.codeId}</div>
                    <div className="text-xs text-app-muted">
                      {item.userDisplayName || item.userEmail || item.userPhone || `#${item.userId}`} · {item.selectedSymbol || '--'} · خصم {Number(item.stakeAmount || 0).toFixed(2)} USDT · نسبة {Number(item.purchasePercent || 0).toFixed(0)}%
                    </div>
                  </div>
                  <button
                    type="button"
                    className="wallet-action-btn whitespace-nowrap border border-red-500/30 bg-red-500/10 text-red-200"
                    onClick={() => handleDeleteStrategyUsage(item)}
                    disabled={deletingStrategyUsageId === item.id}
                  >
                    {deletingStrategyUsageId === item.id ? '...' : 'حذف من السجل'}
                  </button>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-app-border bg-app-elevated px-3 py-4 text-sm text-app-muted">
                  لا توجد صفقات سابقة متاحة للحذف حالياً.
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {canManageNotifications ? (
        <section className="rounded-2xl border border-app-border bg-app-card p-4">
          <h2 className="text-sm font-semibold text-white">إنشاء إشعار</h2>
          <p className="mt-1 text-xs text-app-muted">يمكن للمشرف إرسال إشعار لمستخدم محدد أو بث إشعار عام لجميع المستخدمين.</p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-app-muted">
              <input
                type="checkbox"
                checked={notificationDraft.broadcast}
                onChange={(e) => setNotificationDraft((prev) => ({ ...prev, broadcast: e.target.checked }))}
              />
              <span>إرسال للجميع</span>
            </label>
            {!notificationDraft.broadcast ? (
              <input
                className="field-input"
                type="number"
                placeholder="رقم المستخدم"
                value={notificationDraft.userId}
                onChange={(e) => setNotificationDraft((prev) => ({ ...prev, userId: e.target.value }))}
              />
            ) : null}
            <input
              className="field-input"
              placeholder="عنوان الإشعار"
              value={notificationDraft.title}
              onChange={(e) => setNotificationDraft((prev) => ({ ...prev, title: e.target.value }))}
            />
            <textarea
              className="field-input"
              rows={4}
              placeholder="محتوى الإشعار"
              value={notificationDraft.body}
              onChange={(e) => setNotificationDraft((prev) => ({ ...prev, body: e.target.value }))}
            />
            <div className="flex justify-end">
              <button type="button" className="wallet-action-btn wallet-action-deposit" onClick={handleSendNotification} disabled={sendingNotification}>
                {sendingNotification ? '...' : 'إرسال الإشعار'}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

