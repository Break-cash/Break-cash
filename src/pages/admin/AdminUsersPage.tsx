import { useEffect, useState } from 'react'
import { apiFetch } from '../../api'

type UserRow = {
  id: number
  email: string | null
  phone: string | null
  role: string
  is_approved: number
  is_banned: number
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [q, setQ] = useState('')

  async function load() {
    const res = (await apiFetch(`/api/users/list?q=${encodeURIComponent(q)}`)) as { users: UserRow[] }
    setUsers(res.users)
  }

  useEffect(() => {
    apiFetch('/api/users/list')
      .then((res) => setUsers((res as { users: UserRow[] }).users))
      .catch(() => setUsers([]))
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">Admin Users</h1>
      <div className="card captcha-row">
        <input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="invite-copy-btn" type="button" onClick={() => load()}>
          Search
        </button>
      </div>
      <div className="table-card">
        {users.map((user) => (
          <div key={user.id} className="table-row">
            <span>{(user.email || user.phone) || '—'}</span>
            <span>{user.role}</span>
            <span>{user.is_banned ? 'Banned' : 'Active'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
