import { useState } from 'react'
import {
  apiFetch,
  login,
  registerAccount,
  registerWithInvite,
  resetForgotPassword,
  sendForgotPasswordCode,
  setToken,
} from '../api'
import { useI18n } from '../i18nCore'

type LoginProps = {
  onAuthSuccess?: () => void
}

export function Login({ onAuthSuccess }: LoginProps) {
  const { t } = useI18n()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  // نجعل وضع إنشاء الحساب هو الافتراضي عند فتح الصفحة
  const [isRegister, setIsRegister] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [walletLink, setWalletLink] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotIdentifier, setForgotIdentifier] = useState('')
  const [forgotCode, setForgotCode] = useState('')
  const [forgotPassword, setForgotPassword] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    const trimmed = identifier.trim()
    if (!trimmed || password.length < 6) {
      setError(t('login_validation_error'))
      return
    }

    setLoading(true)
    try {
      const res = isRegister
        ? inviteCode.trim()
          ? await registerWithInvite(trimmed, password, inviteCode.trim())
          : await registerAccount(trimmed, password)
        : await login(trimmed, password)

      setToken(res.token)
      setSuccessMsg(
        isRegister
          ? t('login_register_success')
          : t('login_signin_success'),
      )
      onAuthSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login_unknown_error'))
    } finally {
      setLoading(false)
    }
  }

  async function onSendForgotCode() {
    const trimmed = forgotIdentifier.trim()
    setError(null)
    setSuccessMsg(null)
    if (!trimmed) {
      setError(t('login_identifier_ph'))
      return
    }
    setLoading(true)
    try {
      const res = await sendForgotPasswordCode(trimmed)
      setCodeSent(true)
      setSuccessMsg(
        res.mode === 'mock' && res.dev_code
          ? `${t('login_reset_code_sent')} (${res.dev_code})`
          : t('login_reset_code_sent'),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login_unknown_error'))
    } finally {
      setLoading(false)
    }
  }

  async function onResetPassword() {
    setError(null)
    setSuccessMsg(null)
    if (!forgotIdentifier.trim() || !forgotCode.trim() || forgotPassword.length < 6) {
      setError(t('login_reset_validation'))
      return
    }
    setLoading(true)
    try {
      await resetForgotPassword({
        identifier: forgotIdentifier.trim(),
        code: forgotCode.trim(),
        newPassword: forgotPassword,
      })
      setForgotMode(false)
      setCodeSent(false)
      setPassword('')
      setForgotCode('')
      setForgotPassword('')
      setSuccessMsg(t('login_reset_success'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login_unknown_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-badge">{t('login_badge')}</div>
          <h1 className="login-title">{t('login_title')}</h1>
          <p className="login-subtitle">{t('login_subtitle')}</p>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          {forgotMode ? (
            <label className="login-field">
              <span className="field-label">{t('login_identifier')}</span>
              <input
                type="text"
                className="field-input"
                placeholder={t('login_identifier_ph')}
                autoComplete="username"
                value={forgotIdentifier}
                onChange={(e) => setForgotIdentifier(e.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="login-field">
                <span className="field-label">{t('login_identifier')}</span>
                <input
                  type="text"
                  className="field-input"
                  placeholder={t('login_identifier_ph')}
                  autoComplete="username"
                  inputMode="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </label>

              <label className="login-field">
                <span className="field-label">{t('login_password')}</span>
                <div className="field-input field-input-with-icon">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="field-input-inner"
                    placeholder={t('login_password_ph')}
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="field-icon-btn"
                    aria-label={showPassword ? t('login_hide_password') : t('login_show_password')}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    👁
                  </button>
                </div>
              </label>

              {isRegister ? (
                <label className="login-field">
                  <span className="field-label">{t('login_invite')}</span>
                  <input
                    type="text"
                    className="field-input"
                    placeholder={t('login_invite_ph')}
                    autoComplete="off"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                </label>
              ) : null}
            </>
          )}

          {forgotMode && codeSent ? (
            <>
              <label className="login-field">
                <span className="field-label">{t('login_reset_code')}</span>
                <input
                  type="text"
                  className="field-input"
                  placeholder={t('login_reset_code_ph')}
                  value={forgotCode}
                  onChange={(e) => setForgotCode(e.target.value)}
                />
              </label>
              <label className="login-field">
                <span className="field-label">{t('login_reset_new_password')}</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="field-input"
                  placeholder={t('login_password_ph')}
                  value={forgotPassword}
                  onChange={(e) => setForgotPassword(e.target.value)}
                />
              </label>
            </>
          ) : null}

          {error ? (
            <div className="login-error">
              {t('login_action_failed')}: {error}
            </div>
          ) : null}
          {successMsg ? <div className="login-success">{successMsg}</div> : null}

          {forgotMode ? (
            <>
              {!codeSent ? (
                <button type="button" className="login-submit" disabled={loading} onClick={onSendForgotCode}>
                  {loading ? t('login_signin_loading') : t('login_reset_send_code')}
                </button>
              ) : (
                <button type="button" className="login-submit" disabled={loading} onClick={onResetPassword}>
                  {loading ? t('login_signin_loading') : t('login_reset_submit')}
                </button>
              )}
            </>
          ) : (
            <button type="submit" className="login-submit" disabled={loading}>
              {loading
                ? isRegister
                  ? t('login_register_loading')
                  : t('login_signin_loading')
                : isRegister
                ? t('login_register')
                : t('login_signin')}
            </button>
          )}

          <details className="login-secondary">
            <summary>{t('login_more_options')}</summary>
            <label className="login-field">
              <span className="field-label">{t('login_verification_code')}</span>
              <div className="captcha-row">
                <input type="text" className="field-input" placeholder={t('login_verification_ph')} />
                <div className="captcha-box" aria-label={t('login_verification_code')}>
                  <span>S</span>
                  <span>K</span>
                  <span>T</span>
                  <span>V</span>
                </div>
              </div>
            </label>
            <button
              type="button"
              className="link-btn login-wallet-link-btn"
              onClick={() => {
                apiFetch('/api/settings/wallet-link')
                  .then((res) => {
                    const value = (res as { walletLink?: string }).walletLink || t('login_wallet_link_empty')
                    setWalletLink(value)
                  })
                  .catch(() => setWalletLink(t('login_wallet_link_failed')))
              }}
            >
              {t('login_wallet_link_show')}
            </button>
            {walletLink ? <div className="login-success">{walletLink}</div> : null}
          </details>

          <div className="login-footer-links">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setError(null)
                setSuccessMsg(null)
                setForgotMode((v) => !v)
                setCodeSent(false)
              }}
            >
              {forgotMode ? t('login_back_signin') : t('login_forgot_password')}
            </button>
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setError(null)
                setSuccessMsg(null)
                setIsRegister((v) => !v)
              }}
            >
              {isRegister ? t('login_have_account') : t('login_create_account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
