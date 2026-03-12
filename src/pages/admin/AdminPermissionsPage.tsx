import { useEffect, useState } from 'react'
import { apiFetch } from '../../api'

export function AdminPermissionsPage() {
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    apiFetch('/api/permissions/available')
      .then((res) => setPermissions((res as { permissions: string[] }).permissions))
      .catch(() => setPermissions([]))
  }, [])

  return (
    <div className="page">
      <h1 className="page-title">Admin Permissions</h1>
      <div className="grid">
        {permissions.map((permission) => (
          <div key={permission} className="card">
            {permission}
          </div>
        ))}
      </div>
    </div>
  )
}
