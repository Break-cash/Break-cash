import { useEffect, useState } from 'react'
import { CheckCircle2, Eye, EyeOff, ShieldCheck, Sparkles, WalletCards } from 'lucide-react'
import {
  getLoginLogoVariant,
  getLogoUrl,
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
  const brandLabel = 'BREAK CASH'

  const trustHighlights =
    language === 'ar'
      ? [
          { icon: ShieldCheck, title: 'وصول آمن', body: 'تجربة دخول محسّنة مع هوية واضحة ومظهر موثوق.' },
          { icon: WalletCards, title: 'إدارة متكاملة', body: 'المحفظة، الأسواق، والعمليات الأساسية ضمن واجهة موحدة.' },
          { icon: Sparkles, title: 'جاهز للاعتماد', body: 'تصميم مؤسسي يركّز على الوضوح والثقة وسهولة الاستخدام.' },
        ]
      : language === 'tr'
        ? [
            { icon: ShieldCheck, title: 'Guvenli erisim', body: 'Daha net kimlik ve daha guven veren bir giris deneyimi.' },
            { icon: WalletCards, title: 'Birlesik yonetim', body: 'Cuzdan, piyasalar ve temel islemler tek bir arayuzde.' },
            { icon: Sparkles, title: 'Resmi gorunum', body: 'Kurumsal, temiz ve hizli bir ilk izlenim icin hazirlandi.' },
          ]
        : [
            { icon: ShieldCheck, title: 'Secure access', body: 'A clearer sign-in experience with stronger brand trust.' },
            { icon: WalletCards, title: 'Unified control', body: 'Wallets, markets, and key actions in one organized surface.' },
            { icon: Sparkles, title: 'Official feel', body: 'A more polished, production-ready first impression.' },
          ]

  const trustStats =
    language === 'ar'
      ? [
          { value: '24/7', label: 'وصول مستمر' },
          { value: 'PWA', label: 'جاهز للتثبيت' },
          { value: 'Live', label: 'تحديثات مباشرة' },
        ]
      : language === 'tr'
        ? [
            { value: '7/24', label: 'Kesintisiz erisim' },
            { value: 'PWA', label: 'Yuklenebilir' },
            { value: 'Live', label: 'Canli veri' },
          ]
        : [
            { value: '24/7', label: 'Always available' },
            { value: 'PWA', label: 'Install ready' },
            { value: 'Live', label: 'Realtime updates' },
          ]

  useEffect(() => {
    let mounted = true
    Promise.all([getLogoUrl(), getLoginLogoVariant()])
      .then(([logoRes, variantRes]) => {
        if (!mounted) return
        const value = String(logoRes.logoUrl || '').trim()
        if (value) setLogoUrl(value)
        setLogoVariant(variantRes.variant === 'b' ? 'b' : 'a')
      })
      .catch(() => {})
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
      setSuccessMsg(isRegister ? t('login_register_success') : t('login_signin_success'))
      onAuthSuccess?.()
    } catch (err) {
      const isNetworkError =
        err instanceof Error && (err.message === 'Failed to fetch' || err.name === 'TypeError')
      setError(
        isNetworkError ? t('login_network_error') : err instanceof Error ? err.message : t('login_unknown_error'),
      )
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
      const isNetworkError =
        err instanceof Error && (err.message === 'Failed to fetch' || err.name === 'TypeError')
      setRecoveryError(
        isNetworkError ? t('login_network_error') : err instanceof Error ? err.message : t('login_unknown_error'),
      )
    } finally {
      setRecoveryLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-shell glass-panel">
        <div className="login-brand-panel">
          <div className="login-card-topline">
            <div>
              <div className="login-badge">{t('login_badge')}</div>
              <p className="login-card-kicker">{brandLabel}</p>
              <h1 className="login-title">{t('login_title')}</h1>
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
          </div>

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
            <div className="login-premium-brand-text">{brandLabel}</div>
            <div className="login-premium-brand-sub">{t('header_trading_platform')}</div>
          </div>

          <p className="login-subtitle">{t('login_subtitle')}</p>

          <div className="login-trust-grid">
            {trustStats.map((item) => (
              <div key={item.label} className="login-trust-stat">
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="login-trust-list">
            {trustHighlights.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.title} className="login-trust-item">
                  <span className="login-trust-icon">
                    <Icon size={16} />
                  </span>
                  <div>
                    <div className="login-trust-title">{item.title}</div>
                    <p className="login-trust-text">{item.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-brandmark">
            <div className="login-card-brandmark-image-wrap">
              <img
                src={logoBroken ? '/break-cash-logo-premium.png' : logoUrl}
                alt="BREAK CASH"
                className="login-card-brandmark-image"
                decoding="async"
                loading="eager"
                onError={() => setLogoBroken(true)}
              />
            </div>
          </div>

          <div className="login-form-header">
            <div className="login-form-eyebrow">
              <CheckCircle2 size={14} />
              <span>{isRegister ? t('login_register') : t('login_signin')}</span>
            </div>
            <h2 className="login-form-title">{brandLabel}</h2>
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
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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

            {error ? <div className="login-error">{error}</div> : null}
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
              <div className="login-recovery-panel glass-panel-soft mt-3 rounded-xl p-3">
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
    </div>
  )
}
