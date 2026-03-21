import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { registerWithInvite, setToken } from '../api'

type JoinInviteProps = {
  onAuthSuccess?: () => void
}

export function JoinInvite({ onAuthSuccess }: JoinInviteProps) {
  const { code } = useParams()
  const navigate = useNavigate()
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
      setMessage('تم إنشاء الحساب بنجاح عبر رابط الإحالة.')
      window.setTimeout(() => {
        navigate('/portfolio', { replace: true })
      }, 400)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'فشل إنشاء الحساب')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1 className="login-title">إنشاء حساب عبر رابط الإحالة</h1>
        <p className="login-subtitle">
          أكمل البيانات التالية لإنشاء حساب جديد باستخدام رمز الإحالة.
        </p>
        <p className="login-subtitle">رمز الإحالة: {code}</p>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="field-input"
            placeholder="البريد الإلكتروني أو رقم الهاتف"
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
            {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}
          </button>
        </form>
      </div>
    </div>
  )
}
