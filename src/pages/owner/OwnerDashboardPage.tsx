import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  adjustBalance,
  getBalanceForUser,
  getBalanceHistory,
  setBalance,
  type AuthUser,
} from '../api'

type OwnerDashboardProps = {
  user: AuthUser | null
}

export function OwnerDashboardPage({ user }: OwnerDashboardProps) {
  const [targetUserId, setTargetUserId] = useState('')
  const [balances, setBalances] = useState<{ currency: string; amount: number; updated_at: string }[]>([])
  const [history, setHistory] = useState<{ id: number; type: string; currency: string; amount: number; note: string | null; created_at: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currency, setCurrency] = useState('USDC')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const isOwner = user?.role === 'owner'

  useEffect(() => {
    if (!targetUserId.trim()) {
      setBalances([])
      setHistory([])
      return
    }
    const id = Number(targetUserId)
    if (!Number.isFinite(id) || id < 1) return
    setLoading(true)
    setMessage(null)
    Promise.all([getBalanceForUser(id), getBalanceHistory(id)])
      .then(([balRes, histRes]) => {
        setBalances(balRes.balances)
        setHistory(histRes.history || [])
      })
      .catch(() => setMessage({ type: 'error', text: 'تعذر تحميل البيانات.' }))
      .finally(() => setLoading(false))
  }, [targetUserId])

  async function handleAdjust(type: 'add' | 'deduct') {
    const uid = Number(targetUserId)
    const amt = Number(amount)
    if (!uid || !Number.isFinite(amt) || amt <= 0) {
      setMessage({ type: 'error', text: 'أدخل رقم مستخدم ومبلغاً صحيحاً.' })
      return
    }
    setActionLoading(true)
    setMessage(null)
    try {
      await adjustBalance({ userId: uid, currency, amount: amt, type, note })
      setMessage({ type: 'success', text: type === 'add' ? 'تمت الإضافة.' : 'تم الخصم.' })
      setAmount('')
      setNote('')
      const [balRes, histRes] = await Promise.all([getBalanceForUser(uid), getBalanceHistory(uid)])
      setBalances(balRes.balances)
      setHistory(histRes.history || [])
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل الإجراء.' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSet() {
    const uid = Number(targetUserId)
    const amt = Number(amount)
    if (!uid || !Number.isFinite(amt) || amt < 0) {
      setMessage({ type: 'error', text: 'أدخل رقم مستخدم ومبلغاً صحيحاً (≥0).' })
      return
    }
    setActionLoading(true)
    setMessage(null)
    try {
      await setBalance({ userId: uid, currency, amount: amt, note })
      setMessage({ type: 'success', text: 'تم تعيين الرصيد.' })
      setAmount('')
      setNote('')
      const [balRes, histRes] = await Promise.all([getBalanceForUser(uid), getBalanceHistory(uid)])
      setBalances(balRes.balances)
      setHistory(histRes.history || [])
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'فشل الإجراء.' })
    } finally {
      setActionLoading(false)
    }
  }

  if (user && !isOwner) return <Navigate to="/portfolio" replace />

  return (
    <div className="page owner-dashboard">
      <h1 className="page-title owner-dashboard-title">لوحة المالك — تحكم كامل</h1>

      <nav className="owner-nav">
        <Link to="/admin/dashboard" className="owner-nav-link">لوحة الإدارة</Link>
        <Link to="/admin/users" className="owner-nav-link">المستخدمين</Link>
        <Link to="/admin/invites" className="owner-nav-link">الدعوات</Link>
        <Link to="/admin/balances" className="owner-nav-link">الأرصدة (إداري)</Link>
        <Link to="/admin/permissions" className="owner-nav-link">الصلاحيات</Link>
      </nav>

      <section className="owner-balance-section">
        <h2 className="owner-section-title">إدارة الأرصدة — واجهة المحفظة</h2>
        <p className="owner-hint">ابحث بالمستخدم برقم الـ ID ثم اعرض أرصدته وحرّكها (إضافة / خصم / تعيين).</p>
        <div className="owner-search-row">
          <input
            type="text"
            inputMode="numeric"
            className="field-input owner-user-id-input"
            placeholder="رقم المستخدم (ID)"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
          />
        </div>

        {message && (
          <div className={`owner-message owner-message-${message.type}`}>{message.text}</div>
        )}

        {loading && <div className="owner-loading">جاري التحميل...</div>}

        {!loading && targetUserId.trim() && (
          <>
            <div className="owner-wallet-card">
              <h3 className="owner-wallet-heading">أرصدة المستخدم #{targetUserId}</h3>
              {balances.length === 0 ? (
                <p className="owner-empty">لا توجد أرصدة.</p>
              ) : (
                <ul className="owner-balance-list">
                  {balances.map((b) => (
                    <li key={b.currency} className="owner-balance-item">
                      <span className="owner-balance-currency">{b.currency}</span>
                      <span className="owner-balance-amount">{Number(b.amount).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="owner-actions-card">
              <h3 className="owner-wallet-heading">إضافة / خصم / تعيين الرصيد</h3>
              <div className="owner-form-row">
                <input
                  type="text"
                  className="field-input owner-currency-input"
                  placeholder="العملة"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  className="field-input owner-amount-input"
                  placeholder="المبلغ"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <input
                type="text"
                className="field-input owner-note-input"
                placeholder="ملاحظة (اختياري)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="owner-buttons">
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-deposit"
                  onClick={() => handleAdjust('add')}
                  disabled={actionLoading}
                >
                  إضافة
                </button>
                <button
                  type="button"
                  className="wallet-action-btn wallet-action-withdraw"
                  onClick={() => handleAdjust('deduct')}
                  disabled={actionLoading}
                >
                  خصم
                </button>
                <button
                  type="button"
                  className="wallet-action-btn owner-set-btn"
                  onClick={handleSet}
                  disabled={actionLoading}
                >
                  تعيين الرصيد
                </button>
              </div>
            </div>

            {history.length > 0 && (
              <div className="owner-history-card">
                <h3 className="owner-wallet-heading">سجل الحركات</h3>
                <ul className="owner-history-list">
                  {history.slice(0, 20).map((h) => (
                    <li key={h.id} className="owner-history-item">
                      <span>{h.type === 'add' ? '+' : '-'}</span>
                      <span>{h.amount} {h.currency}</span>
                      <span className="owner-history-date">{h.created_at}</span>
                      {h.note && <span className="owner-history-note">{h.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
