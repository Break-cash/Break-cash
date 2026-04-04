import { useEffect, useState } from 'react'
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
import { useNativeAppInstalled } from '../hooks/useNativeAppInstalled'

type LoginProps = {
  onAuthSuccess?: () => void
}

const APK_DOWNLOAD_URL = '/downloads/Break-Cash-Android-Release-v1.apk'

function resolveAuthErrorMessage(rawMessage: string, language: Language, isRegister: boolean) {
  const normalized = String(rawMessage || '').trim()
  const code = normalized.toUpperCase()

  const dictionary = {
    ar: {
      INVALID_INPUT: isRegister
        ? 'تحقق من البريد أو رقم الهاتف، وتأكد أن كلمة المرور لا تقل عن 6 أحرف.'
        : 'تحقق من بيانات الدخول المدخلة ثم أعد المحاولة.',
      ALREADY_EXISTS: 'هذا البريد أو رقم الهاتف مستخدم بالفعل. جرّب تسجيل الدخول أو استخدم بيانات أخرى.',
      INVALID_INVITE: 'كود الدعوة غير صحيح أو غير صالح للاستخدام.',
      INVALID_CREDENTIALS: 'بيانات الدخول غير صحيحة. تحقق من البريد أو الهاتف وكلمة المرور.',
      USER_BANNED: 'هذا الحساب موقوف حاليًا. يرجى التواصل مع الدعم.',
      USER_FROZEN: 'هذا الحساب مجمّد مؤقتًا. يرجى التواصل مع الدعم.',
      AUTH_REQUIRED: 'يجب تسجيل الدخول أولًا للمتابعة.',
      SERVER_ERROR: 'حدث خطأ من الخادم أثناء تنفيذ الطلب. حاول مرة أخرى بعد قليل.',
    },
    en: {
      INVALID_INPUT: isRegister
        ? 'Check your email or phone and make sure the password has at least 6 characters.'
        : 'Check your login details and try again.',
      ALREADY_EXISTS: 'This email or phone number is already in use. Try signing in or use different details.',
      INVALID_INVITE: 'The invite code is invalid or can no longer be used.',
      INVALID_CREDENTIALS: 'Incorrect login details. Check your email/phone and password.',
      USER_BANNED: 'This account is currently suspended. Please contact support.',
      USER_FROZEN: 'This account is temporarily frozen. Please contact support.',
      AUTH_REQUIRED: 'You need to sign in first to continue.',
      SERVER_ERROR: 'The server could not complete the request. Please try again shortly.',
    },
    tr: {
      INVALID_INPUT: isRegister
        ? 'E-posta veya telefonu kontrol edin ve sifrenin en az 6 karakter oldugundan emin olun.'
        : 'Giris bilgilerini kontrol edip tekrar deneyin.',
      ALREADY_EXISTS: 'Bu e-posta veya telefon numarasi zaten kullaniliyor. Giris yapin veya farkli bilgiler kullanin.',
      INVALID_INVITE: 'Davet kodu gecersiz veya artik kullanilamiyor.',
      INVALID_CREDENTIALS: 'Giris bilgileri hatali. E-posta/telefon ve sifreyi kontrol edin.',
      USER_BANNED: 'Bu hesap su anda engellenmis. Lutfen destek ile iletisim kurun.',
      USER_FROZEN: 'Bu hesap gecici olarak dondurulmus. Lutfen destek ile iletisim kurun.',
      AUTH_REQUIRED: 'Devam etmek icin once giris yapmaniz gerekiyor.',
      SERVER_ERROR: 'Sunucu istegi tamamlayamadi. Lutfen biraz sonra tekrar deneyin.',
    },
  } as const

  const selected = dictionary[language] || dictionary.en
  return selected[code as keyof typeof selected] || normalized
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
  const nativeAppInstalled = useNativeAppInstalled()
  const brandLabel = 'BREAK CASH'
  const apkDownloadLabel =
    language === 'ar' ? 'تحميل التطبيق' : language === 'tr' ? 'Uygulamayi indir' : 'Download app'
  const registerCommonIssues =
    language === 'ar'
      ? [
          'استخدم بريدًا إلكترونيًا أو رقم هاتف غير مستخدم من قبل.',
          'تأكد أن كلمة المرور لا تقل عن 6 أحرف.',
          'إذا استخدمت كود دعوة، فتأكد أنه صحيح وما زال صالحًا.',
        ]
      : language === 'tr'
        ? [
            'Daha once kullanilmamis bir e-posta veya telefon numarasi kullanin.',
            'Sifrenin en az 6 karakter oldugundan emin olun.',
            'Davet kodu kullaniyorsaniz dogru ve gecerli oldugunu kontrol edin.',
          ]
        : [
            'Use an email or phone number that has not been used before.',
            'Make sure the password is at least 6 characters long.',
            'If you use an invite code, make sure it is correct and still valid.',
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
        isNetworkError
          ? t('login_network_error')
          : err instanceof Error
            ? resolveAuthErrorMessage(err.message, language, isRegister)
            : t('login_unknown_error'),
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
      <div className="login-card glass-panel">
        <div className="login-header">
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
          {!nativeAppInstalled ? (
            <a
              href={APK_DOWNLOAD_URL}
              download
              className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-brand-blue px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(59,130,246,0.28)] transition-transform duration-200 hover:scale-[1.01]"
            >
              {apkDownloadLabel}
            </a>
          ) : null}
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

          {error ? <div className="login-error">{error}</div> : null}
          {isRegister ? (
            <div className="glass-panel-soft rounded-xl border border-white/8 px-3 py-3 text-xs leading-6 text-white/75">
              <div className="mb-1 font-semibold text-white/90">
                {language === 'ar'
                  ? 'أخطاء التسجيل الشائعة'
                  : language === 'tr'
                    ? 'Yaygin kayit hatalari'
                    : 'Common registration issues'}
              </div>
              <ul className="space-y-1">
                {registerCommonIssues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
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
  )
}
