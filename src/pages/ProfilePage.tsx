import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { getRecoveryCodeStatus, type AuthUser, updateMyProfile, uploadAvatar, uploadKyc } from '../api'
import { UserIdentityBadges } from '../components/user/UserIdentityBadges'
import { getPremiumProfileColorClass } from '../premiumIdentity'

type ProfilePageProps = {
  onLogout: () => void
  user: AuthUser
  onProfileRefresh?: () => Promise<void> | void
}

type SplashMode = 'always' | 'session'
const SPLASH_MODE_KEY = 'breakcash_splash_mode'

const COUNTRY_OPTIONS = [
  { value: 'TR', label: 'تركيا', flag: '🇹🇷' },
  { value: 'SA', label: 'السعودية', flag: '🇸🇦' },
  { value: 'AE', label: 'الإمارات', flag: '🇦🇪' },
  { value: 'EG', label: 'مصر', flag: '🇪🇬' },
  { value: 'IQ', label: 'العراق', flag: '🇮🇶' },
  { value: 'SY', label: 'سوريا', flag: '🇸🇾' },
  { value: 'JO', label: 'الأردن', flag: '🇯🇴' },
  { value: 'LB', label: 'لبنان', flag: '🇱🇧' },
  { value: 'KW', label: 'الكويت', flag: '🇰🇼' },
  { value: 'QA', label: 'قطر', flag: '🇶🇦' },
  { value: 'BH', label: 'البحرين', flag: '🇧🇭' },
  { value: 'OM', label: 'عمان', flag: '🇴🇲' },
  { value: 'YE', label: 'اليمن', flag: '🇾🇪' },
  { value: 'MA', label: 'المغرب', flag: '🇲🇦' },
  { value: 'DZ', label: 'الجزائر', flag: '🇩🇿' },
  { value: 'TN', label: 'تونس', flag: '🇹🇳' },
  { value: 'LY', label: 'ليبيا', flag: '🇱🇾' },
  { value: 'US', label: 'الولايات المتحدة', flag: '🇺🇸' },
  { value: 'GB', label: 'بريطانيا', flag: '🇬🇧' },
  { value: 'FR', label: 'فرنسا', flag: '🇫🇷' },
  { value: 'DE', label: 'ألمانيا', flag: '🇩🇪' },
] as const

export function ProfilePage({ onLogout, user, onProfileRefresh }: ProfilePageProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url || null)
  const [avatarBroken, setAvatarBroken] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [depositPrivacyEnabled, setDepositPrivacyEnabled] = useState(Number(user.deposit_privacy_enabled ?? 1) === 1)
  const [fullName, setFullName] = useState({
    firstName: '',
    fatherName: '',
    familyName: '',
    motherName: '',
    birthDate: '',
  })
  const [bio, setBio] = useState(user.bio || '')
  const [country, setCountry] = useState((user.country || '').trim().toUpperCase())
  const [identity, setIdentity] = useState({
    legalName: '',
    nationalId: '',
    phone: '',
    country: '',
  })
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)
  const [idCardFile, setIdCardFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [openSection, setOpenSection] = useState<
    'avatar' | 'name' | 'bio' | 'identity' | 'splash' | 'recovery' | 'deposit_privacy' | 'country' | null
  >(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [loadingRecoveryCode, setLoadingRecoveryCode] = useState(false)
  const [copiedRecoveryCode, setCopiedRecoveryCode] = useState(false)
  const [splashMode, setSplashMode] = useState<SplashMode>('always')
  const computedBadgeColor =
    Number(user.blue_badge || 0) === 1 ? 'blue' : user.verification_status === 'verified' ? 'gold' : 'none'
  const premiumProfileColorClass = getPremiumProfileColorClass(user.profile_color)

  useEffect(() => {
    const raw = String(localStorage.getItem(SPLASH_MODE_KEY) || '').trim().toLowerCase()
    setSplashMode(raw === 'session' ? 'session' : 'always')
  }, [])

  useEffect(() => {
    setAvatarBroken(false)
    setAvatarPreview(user.avatar_url || null)
  }, [user.avatar_url])

  useEffect(() => {
    setDepositPrivacyEnabled(Number(user.deposit_privacy_enabled ?? 1) === 1)
  }, [user.deposit_privacy_enabled])

  useEffect(() => {
    setCountry((user.country || '').trim().toUpperCase())
  }, [user.country])

  useEffect(() => {
    setLoadingRecoveryCode(true)
    getRecoveryCodeStatus()
      .then((res) => {
        setRecoveryCode(res.recoveryCode ? String(res.recoveryCode) : null)
      })
      .catch(() => {
        setRecoveryCode(null)
      })
      .finally(() => setLoadingRecoveryCode(false))
  }, [])

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setAvatarBroken(false)
    setAvatarPreview(url)
    setAvatarFile(file)
  }

  function handleIdCardChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setIdCardPreview(url)
    setIdCardFile(file)
  }

  function handleSelfieChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setSelfiePreview(url)
    setSelfieFile(file)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      const parts = [fullName.firstName, fullName.fatherName, fullName.familyName]
        .map((p) => p.trim())
        .filter(Boolean)
      const nextDisplayName = parts.length > 0 ? parts.join(' ') : (user.display_name || null)
      const nextBio = bio.trim() || null
      const currentDisplayName = user.display_name || null
      const currentBio = user.bio || null
      const nextCountry = country.trim() || null
      const currentCountry = user.country ? String(user.country).trim().toUpperCase() : null
      const currentDepositPrivacyEnabled = Number(user.deposit_privacy_enabled ?? 1) === 1
      const profilePayload: {
        displayName?: string | null
        bio?: string | null
        country?: string | null
        depositPrivacyEnabled?: boolean
      } = {}

      if (parts.length > 0 && nextDisplayName !== currentDisplayName) {
        profilePayload.displayName = nextDisplayName
      }
      if (nextBio !== currentBio) {
        profilePayload.bio = nextBio
      }
      if (nextCountry !== currentCountry) {
        profilePayload.country = nextCountry
      }
      if (depositPrivacyEnabled !== currentDepositPrivacyEnabled) {
        profilePayload.depositPrivacyEnabled = depositPrivacyEnabled
      }

      if (Object.keys(profilePayload).length > 0) {
        await updateMyProfile(profilePayload)
      }

      if (avatarFile) {
        const res = await uploadAvatar(avatarFile)
        setAvatarBroken(false)
        setAvatarPreview(res.profile.avatar_url || null)
      }

      if (idCardFile && selfieFile) {
        await uploadKyc(idCardFile, selfieFile)
      }

      await onProfileRefresh?.()
      setSuccess('تم حفظ التغييرات بنجاح.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التغييرات.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyUserId() {
    try {
      await navigator.clipboard.writeText(String(user.id))
      setCopiedId(true)
      window.setTimeout(() => setCopiedId(false), 1600)
    } catch {
      setCopiedId(false)
    }
  }

  async function handleCopyRecoveryCode() {
    if (!recoveryCode) return
    try {
      await navigator.clipboard.writeText(recoveryCode)
      setCopiedRecoveryCode(true)
      window.setTimeout(() => setCopiedRecoveryCode(false), 1600)
    } catch {
      setCopiedRecoveryCode(false)
    }
  }

  const selectedCountryOption =
    COUNTRY_OPTIONS.find((option) => option.value === country) || null

  return (
    <div className="page profile-settings-page space-y-4">
      <h1 className="page-title">الملف الشخصي</h1>
      <div className="elite-enter elite-hover-lift elite-panel p-3 lg:rounded-3xl lg:p-4">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className={`h-16 w-16 overflow-hidden rounded-full border-2 border-brand-blue/35 bg-app-elevated shadow-[0_8px_18px_rgba(0,0,0,0.28)] lg:h-24 lg:w-24 lg:border-brand-blue/40 lg:shadow-[0_10px_24px_rgba(0,0,0,0.35)] ${premiumProfileColorClass}`}>
            {avatarPreview && !avatarBroken ? (
              <img
                src={avatarPreview}
                alt={user.display_name || `#${user.id}`}
                className="h-full w-full object-cover"
                onError={() => setAvatarBroken(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-base font-semibold text-white/80 lg:text-xl">
                {String(user.id).slice(-2)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold text-white lg:text-lg">{user.display_name || `#${user.id}`}</span>
              <UserIdentityBadges
                badgeColor={computedBadgeColor}
                vipLevel={user.vip_level || 0}
                premiumBadge={user.profile_badge}
                mode="verified"
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-app-border bg-app-elevated px-2.5 py-1 text-xs text-white/85">
                ID: #{user.id}
              </span>
              <button
                type="button"
                onClick={handleCopyUserId}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-brand-blue/35 bg-brand-blue/10 px-2.5 text-xs text-white/90 hover:bg-brand-blue/20"
                aria-label="نسخ رقم المستخدم"
                title="نسخ رقم المستخدم"
              >
                {copiedId ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedId ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
            <UserIdentityBadges
              badgeColor={computedBadgeColor}
              vipLevel={user.vip_level || 0}
              premiumBadge={user.profile_badge}
              mode="secondary"
              className="mt-2"
            />
            <div className="mt-2 text-xs text-white/65 lg:text-sm">{bio.trim() || 'لا توجد سيرة ذاتية حالياً.'}</div>
          </div>
        </div>
      </div>
      <form className="profile-settings-grid gap-3" onSubmit={handleSubmit}>
        <section className="elite-enter elite-hover-lift elite-panel p-3">
          <button
            className="profile-settings-toggle"
            type="button"
            onClick={() => setOpenSection((key) => (key === 'deposit_privacy' ? null : 'deposit_privacy'))}
          >
            <span>خصوصية مبلغ الإيداع</span>
            <span className="profile-settings-toggle-icon">
              {openSection === 'deposit_privacy' ? 'â–´' : 'â–¾'}
            </span>
          </button>
          {openSection === 'deposit_privacy' && (
            <>
              <p className="profile-settings-sub">
                عند تفعيل هذا الخيار سيتم إخفاء مبلغك الظاهر عن المستخدمين الآخرين بشكل تلقائي.
              </p>
              <div className="captcha-row">
                <button
                  type="button"
                  className={`wallet-action-btn ${depositPrivacyEnabled ? 'owner-set-btn' : 'wallet-action-withdraw'}`}
                  onClick={() => setDepositPrivacyEnabled(true)}
                >
                  تفعيل الخصوصية
                </button>
                <button
                  type="button"
                  className={`wallet-action-btn ${!depositPrivacyEnabled ? 'owner-set-btn' : 'wallet-action-withdraw'}`}
                  onClick={() => setDepositPrivacyEnabled(false)}
                >
                  تعطيل الخصوصية
                </button>
              </div>
            </>
          )}
        </section>

        <section className="elite-enter elite-hover-lift elite-panel p-3">
          <button
            className="profile-settings-toggle"
            type="button"
            onClick={() => setOpenSection((key) => (key === 'recovery' ? null : 'recovery'))}
          >
            <span className="inline-flex items-center gap-2">
              <KeyRound size={14} />
              <span>رمز الاسترداد</span>
            </span>
            <span className="profile-settings-toggle-icon">
              {openSection === 'recovery' ? '▴' : '▾'}
            </span>
          </button>
          {openSection === 'recovery' && (
            <>
              <p className="profile-settings-sub">يمكنك عرض ونسخ رمز الاسترداد في أي وقت.</p>
              <div className="rounded-xl border border-app-border bg-app-elevated p-3">
                <div className="select-all break-all text-center font-mono text-sm font-semibold tracking-[0.12em] text-brand-blue">
                  {loadingRecoveryCode ? 'جارٍ التحميل...' : (recoveryCode || 'غير متاح حالياً')}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end">
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-brand-blue/35 bg-brand-blue/10 px-3 text-xs text-white/90 hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleCopyRecoveryCode}
                  disabled={!recoveryCode || loadingRecoveryCode}
                >
                  {copiedRecoveryCode ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedRecoveryCode ? 'تم النسخ' : 'نسخ الرمز'}</span>
                </button>
              </div>
            </>
          )}
        </section>

        <section className="elite-enter elite-hover-lift elite-panel p-3">
          <button
            className="profile-settings-toggle"
            type="button"
            onClick={() => setOpenSection((key) => (key === 'splash' ? null : 'splash'))}
          >
            <span>إعداد شاشة البداية</span>
            <span className="profile-settings-toggle-icon">
              {openSection === 'splash' ? '▴' : '▾'}
            </span>
          </button>
          {openSection === 'splash' && (
            <>
              <p className="profile-settings-sub">اختر كيف تظهر شاشة INTRO قبل تسجيل الدخول.</p>
              <select
                className="field-input"
                value={splashMode}
                onChange={(e) => {
                  const mode = e.target.value === 'session' ? 'session' : 'always'
                  setSplashMode(mode)
                  localStorage.setItem(SPLASH_MODE_KEY, mode)
                  setSuccess('تم حفظ إعداد شاشة البداية.')
                }}
              >
                <option value="always">في كل مرة</option>
                <option value="session">مرة واحدة لكل جلسة</option>
              </select>
            </>
          )}
        </section>

        <section className="elite-enter elite-hover-lift elite-panel p-3">
          <button
            className="profile-settings-toggle"
            type="button"
            onClick={() => setOpenSection((key) => (key === 'country' ? null : 'country'))}
          >
            <span>العلم والدولة</span>
            <span className="profile-settings-toggle-icon">
              {openSection === 'country' ? 'â–´' : 'â–¾'}
            </span>
          </button>
          {openSection === 'country' && (
            <>
              <p className="profile-settings-sub">
                اختر علمك ليظهر بجانب اسمك في البروفايل ونتائج البحث بعد حفظ التعديل.
              </p>
              <div className="profile-country-picker">
                <div className="profile-country-preview">
                  <span className="profile-country-flag">{selectedCountryOption?.flag || '🏳️'}</span>
                  <span className="profile-country-name">{selectedCountryOption?.label || 'بدون علم'}</span>
                </div>
                <select
                  className="field-input"
                  value={country}
                  onChange={(e) => setCountry(String(e.target.value || '').trim().toUpperCase())}
                >
                  <option value="">بدون علم</option>
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.flag} {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </section>

        <section className="elite-enter elite-hover-lift elite-panel p-3">
          <button
            className="profile-settings-toggle"
            type="button"
            onClick={() => setOpenSection((key) => (key === 'avatar' ? null : 'avatar'))}
          >
            <span>تبديل صورة البروفايل</span>
            <span className="profile-settings-toggle-icon">
              {openSection === 'avatar' ? '▴' : '▾'}
            </span>
          </button>
          {openSection === 'avatar' && (
            <>
              <p className="profile-settings-sub">
                اختر صورة واضحة ليتم عرضها للجميع في التطبيق.
              </p>
              <div className="profile-settings-avatar-row">
                <div className="profile-settings-avatar-preview">
                  {avatarPreview && !avatarBroken ? (
                    <img src={avatarPreview} alt="Profile preview" onError={() => setAvatarBroken(true)} />
                  ) : (
                    <span>{String(user.id).slice(-2)}</span>
                  )}
                </div>
                <label className="profile-settings-upload-btn">
                  رفع صورة من الجهاز
                  <input type="file" accept="image/*" onChange={handleAvatarChange} />
                </label>
              </div>
            </>
          )}
        </section>

        <section className="elite-enter elite-hover-lift elite-panel p-3">
          <button
            className="profile-settings-toggle"
            type="button"
            onClick={() => setOpenSection((key) => (key === 'name' ? null : 'name'))}
          >
            <span>الاسم والكنية</span>
            <span className="profile-settings-toggle-icon">
              {openSection === 'name' ? '▴' : '▾'}
            </span>
          </button>
          {openSection === 'name' && (
            <div className="profile-settings-fields">
              <input
                className="field-input"
                placeholder="الاسم الأول"
                value={fullName.firstName}
                onChange={(e) => setFullName((v) => ({ ...v, firstName: e.target.value }))}
              />
              <input
                className="field-input"
                placeholder="اسم الأب"
                value={fullName.fatherName}
                onChange={(e) => setFullName((v) => ({ ...v, fatherName: e.target.value }))}
              />
              <input
                className="field-input"
                placeholder="الكنية"
                value={fullName.familyName}
                onChange={(e) => setFullName((v) => ({ ...v, familyName: e.target.value }))}
              />
              <input
                className="field-input"
                placeholder="اسم الأم"
                value={fullName.motherName}
                onChange={(e) => setFullName((v) => ({ ...v, motherName: e.target.value }))}
              />
              <input
                className="field-input"
                type="date"
                placeholder="تاريخ الولادة"
                value={fullName.birthDate}
                onChange={(e) => setFullName((v) => ({ ...v, birthDate: e.target.value }))}
              />
            </div>
          )}
        </section>

        <section className="elite-enter elite-hover-lift elite-panel p-3">
          <button
            className="profile-settings-toggle"
            type="button"
            onClick={() => setOpenSection((key) => (key === 'bio' ? null : 'bio'))}
          >
            <span>السيرة الذاتية</span>
            <span className="profile-settings-toggle-icon">
              {openSection === 'bio' ? '▴' : '▾'}
            </span>
          </button>
          {openSection === 'bio' && (
            <>
              <p className="profile-settings-sub">اكتب جملة قصيرة لا تتعدى 66 حرفًا.</p>
              <input
                className="field-input"
                maxLength={66}
                placeholder="اكتب سيرة ذاتية مختصرة..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <div className="profile-settings-hint">{bio.length}/66</div>
            </>
          )}
        </section>

        <section className="elite-enter elite-hover-lift elite-panel p-3">
          <button
            className="profile-settings-toggle"
            type="button"
            onClick={() => setOpenSection((key) => (key === 'identity' ? null : 'identity'))}
          >
            <span>تأكيد هويتك للاعتماد</span>
            <span className="profile-settings-toggle-icon">
              {openSection === 'identity' ? '▴' : '▾'}
            </span>
          </button>
          {openSection === 'identity' && (
            <>
              <p className="profile-settings-sub">
                أدخل بياناتك القانونية وأرفق صورة الهوية وصورة شخصية (سلفي) للتحقق.
              </p>
              <div className="profile-settings-fields">
                <input
                  className="field-input"
                  placeholder="الاسم القانوني الكامل"
                  value={identity.legalName}
                  onChange={(e) => setIdentity((v) => ({ ...v, legalName: e.target.value }))}
                />
                <input
                  className="field-input"
                  placeholder="الرقم الوطني"
                  value={identity.nationalId}
                  onChange={(e) => setIdentity((v) => ({ ...v, nationalId: e.target.value }))}
                />
                <input
                  className="field-input"
                  placeholder="رقم الهاتف"
                  value={identity.phone}
                  onChange={(e) => setIdentity((v) => ({ ...v, phone: e.target.value }))}
                />
                <input
                  className="field-input"
                  placeholder="الدولة"
                  value={identity.country}
                  onChange={(e) => setIdentity((v) => ({ ...v, country: e.target.value }))}
                />
              </div>
              <div className="profile-settings-upload-row">
                <label className="profile-settings-upload-btn">
                  بطاقة الهوية
                  <input type="file" accept="image/*" onChange={handleIdCardChange} />
                </label>
                {idCardPreview && (
                  <div className="profile-settings-upload-preview">
                    <img src={idCardPreview} alt="ID card preview" />
                  </div>
                )}
              </div>
              <div className="profile-settings-upload-row">
                <label className="profile-settings-upload-btn">
                  صورة شخصية (سلفي)
                  <input type="file" accept="image/*" onChange={handleSelfieChange} />
                </label>
                {selfiePreview && (
                  <div className="profile-settings-upload-preview">
                    <img src={selfiePreview} alt="Selfie preview" />
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <div className="elite-enter elite-panel profile-settings-actions p-3">
          <button className="ghost-btn h-10 px-4" type="button" onClick={onLogout}>
            تسجيل الخروج
          </button>
          <button className="login-submit h-10 px-5" type="submit" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}
      </form>
    </div>
  )
}
