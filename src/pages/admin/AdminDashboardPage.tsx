import { useEffect, useState } from 'react'
import { apiFetch } from '../../api'

type DashboardStats = {
  balancesCount?: number
  totalAmount?: number
  transactionsCount?: number
}

export function AdminDashboardPage() {
  const [balanceStats, setBalanceStats] = useState<DashboardStats>({})

  useEffect(() => {
    apiFetch('/api/stats/balanceStats')
      .then((res) => setBalanceStats(res as DashboardStats))
      .catch(() => setBalanceStats({}))
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">Admin Dashboard</h1>
      <div className="cards-row">
        <div className="card">
          <div className="label">Balances Count</div>
          <div className="card-main-value sm">{balanceStats.balancesCount || 0}</div>
        </div>
        <div className="card">
          <div className="label">Total Amount</div>
          <div className="card-main-value sm">{balanceStats.totalAmount || 0}</div>
        </div>
        <div className="card">
          <div className="label">Transactions</div>
          <div className="card-main-value sm">{balanceStats.transactionsCount || 0}</div>
        </div>
      </div>
    </div>
  )
}
