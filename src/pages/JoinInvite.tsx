import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { registerWithInvite, setToken } from '../api'

type JoinInviteProps = {
  onAuthSuccess?: () => void
}

export function JoinInvite({ onAuthSuccess }: JoinInviteProps) {
  const { code } = useParams()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setLoading(true)
    try {
      const res = await registerWithInvite(identifier.trim(), password, String(code || ''))
      setToken(res.token)
      onAuthSuccess?.()
      setMessage('تم تفعيل الدعوة وتسجيل الدخول.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'فشل التفعيل')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1 className="login-title">الانضمام عبر الدعوة</h1>
        <p className="login-subtitle">رمز الدعوة: {code}</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="field-input"
            placeholder="البريد أو الهاتف"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
          <input
            className="field-input"
            placeholder="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {message ? <div className="login-success">{message}</div> : null}
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'جار التفعيل...' : 'تفعيل الدعوة'}
          </button>
        </form>
      </div>
    </div>
  )
}
