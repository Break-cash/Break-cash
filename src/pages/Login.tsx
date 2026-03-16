import { useEffect, useState } from 'react'
import {
  getLogoUrl,
  getLoginLogoVariant,
  login,
  registerAccount,
  registerWithInvite,
  setToken,
  submitRecoveryCodeReviewRequest,
} from '../api'
import { useI18n, type Language } from '../i18nCore'

type LoginProps = {
  onAuthSuccess?: () => void
}

export function Login({ onAuthSuccess }: LoginProps) {
  const { t, language, setLanguage } = useI18n()
  const [logoUrl, setLogoUrl] = useState('/break-cash-logo-premium.png')
  const [logoVariant, setLogoVariant] = useState<'a' | 'b'>('a')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  // Keep sign-in as default primary action.
  const [isRegister, setIsRegister] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryLoading, setRecoveryLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null)
  const [logoBroken, setLogoBroken] = useState(false)
  const [showRecoveryRequest, setShowRecoveryRequest] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  useEffect(() => {
    let mounted = true
    Promise.all([getLogoUrl(), getLoginLogoVariant()])
      .then(([logoRes, variantRes]) => {
        if (!mounted) return
        const value = String(logoRes.logoUrl || '').trim()
        if (value) setLogoUrl(value)
        setLogoVariant(variantRes.variant === 'b' ? 'b' : 'a')
      })
      .catch(() => {
        // Keep fallback logo path.
      })
    return () => {
      mounted = false
    }
  }, [])

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

  async function onRecoveryRequestSubmit() {
    setRecoveryError(null)
    setRecoverySuccess(null)
    const code = recoveryCode.trim().toUpperCase()
    if (!code) {
      setRecoveryError(t('login_recovery_request_validation'))
      return
    }
    setRecoveryLoading(true)
    try {
      await submitRecoveryCodeReviewRequest(code)
      setRecoverySuccess(t('login_recovery_request_success'))
      setRecoveryCode('')
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : t('login_unknown_error'))
    } finally {
      setRecoveryLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className={`login-premium-brand ${logoVariant === 'b' ? 'variant-b' : 'variant-a'}`} aria-hidden>
            <div className="login-premium-brand-shell">
              <span className="login-premium-arc arc-a" />
              <span className="login-premium-arc arc-b" />
              <div className="login-premium-logo-wrap">
                <img
                  src={logoBroken ? '/break-cash-logo-premium.png' : logoUrl}
                  alt="BREAK CASH"
                  className="login-premium-logo"
                  decoding="async"
                  loading="eager"
                  onError={() => setLogoBroken(true)}
                />
                <span className="login-premium-sweep" />
              </div>
            </div>
            <div className="login-premium-brand-text">BREAK CASH</div>
            <div className="login-premium-brand-sub">{t('header_trading_platform')}</div>
          </div>
          <div className="login-lang-switch" role="group" aria-label={t('language')}>
            {(['ar', 'en', 'tr'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className={`login-lang-btn ${language === lang ? 'active' : ''}`}
                onClick={() => setLanguage(lang)}
                aria-pressed={language === lang}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="login-badge">{t('login_badge')}</div>
          <h1 className="login-title">{t('login_title')}</h1>
          <p className="login-subtitle">{t('login_subtitle')}</p>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label className="login-field">
            <span className="field-label">{t('login_identifier')}</span>
            <small className="field-hint">{t('login_identifier_hint')}</small>
            <input
              type="text"
              className="field-input"
              placeholder={t('login_identifier_ph')}
              autoComplete="username"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              aria-label={t('login_identifier')}
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
                aria-label={t('login_password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="field-icon-btn"
                aria-label={showPassword ? t('login_hide_password') : t('login_show_password')}
                aria-pressed={showPassword}
                title={showPassword ? t('login_hide_password') : t('login_show_password')}
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
                aria-label={t('login_invite')}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </label>
          ) : null}

          {error ? (
            <div className="login-error">
              {t('login_action_failed')}: {error}
            </div>
          ) : null}
          {successMsg ? <div className="login-success">{successMsg}</div> : null}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading
              ? isRegister
                ? t('login_register_loading')
                : t('login_signin_loading')
              : isRegister
              ? t('login_register')
              : t('login_signin')}
          </button>
          <p className="login-primary-hint">{t('login_primary_action_hint')}</p>

          <div className="login-footer-links">
            {!isRegister ? (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setRecoveryError(null)
                  setRecoverySuccess(null)
                  setShowRecoveryRequest((v) => !v)
                }}
              >
                {showRecoveryRequest ? t('login_recovery_request_close') : t('login_recovery_request_open')}
              </button>
            ) : null}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setError(null)
                setSuccessMsg(null)
                setRecoveryError(null)
                setRecoverySuccess(null)
                setShowRecoveryRequest(false)
                setIsRegister((v) => !v)
              }}
            >
              {isRegister ? t('login_have_account') : t('login_create_account')}
            </button>
          </div>
          {!isRegister && showRecoveryRequest ? (
            <div className="mt-3 rounded-xl border border-app-border bg-app-elevated p-3">
              <label className="login-field">
                <span className="field-label">{t('login_recovery_request_label')}</span>
                <small className="field-hint">{t('login_recovery_request_hint')}</small>
                <input
                  type="text"
                  className="field-input"
                  placeholder={t('login_recovery_request_ph')}
                  autoComplete="off"
                  inputMode="text"
                  autoCapitalize="characters"
                  aria-label={t('login_recovery_request_label')}
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="login-submit mt-2"
                disabled={recoveryLoading}
                onClick={onRecoveryRequestSubmit}
              >
                {recoveryLoading ? t('login_recovery_request_loading') : t('login_recovery_request_submit')}
              </button>
              {recoveryError ? <div className="login-error mt-2">{recoveryError}</div> : null}
              {recoverySuccess ? <div className="login-success mt-2">{recoverySuccess}</div> : null}
            </div>
          ) : null}
        </form>
      </div>
    </div>
  )
}
