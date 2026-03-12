import { useEffect, useState } from 'react'
import { apiFetch } from '../../api'

type InviteRow = {
  id: number
  code: string
  is_active: number
  used_by: number | null
}

export function AdminInvitesPage() {
  const [invites, setInvites] = useState<InviteRow[]>([])

  async function load() {
    const res = (await apiFetch('/api/invites/list')) as { invites: InviteRow[] }
    setInvites(res.invites)
  }

  useEffect(() => {
    apiFetch('/api/invites/list')
      .then((res) => setInvites((res as { invites: InviteRow[] }).invites))
      .catch(() => setInvites([]))
  }, [])

  async function createInvite() {
    await apiFetch('/api/invites/generate', { method: 'POST', body: JSON.stringify({}) })
    await load()
  }

  return (
    <div className="page">
      <h1 className="page-title">Admin Invites</h1>
      <button className="login-submit" type="button" onClick={createInvite}>
        Generate Invite
      </button>
      <div className="table-card">
        {invites.map((invite) => (
          <div className="table-row" key={invite.id}>
            <span>{invite.code}</span>
            <span>{invite.is_active ? 'Active' : 'Inactive'}</span>
            <span>{invite.used_by || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
