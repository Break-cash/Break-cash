import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  BadgeCheck,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe2,
  KeyRound,
  Lock,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserCircle2,
} from 'lucide-react'
import { getRecoveryCodeStatus, type AuthUser, updateMyProfile, uploadAvatar, uploadKyc } from '../api'
import { UserIdentityBadges } from '../components/user/UserIdentityBadges'
import { getPremiumProfileColorClass } from '../premiumIdentity'

type ProfilePageProps = {
  onLogout: () => void
  user: AuthUser
  onProfileRefresh?: () => Promise<void> | void
}

type SplashMode = 'always' | 'session'
type SectionId = 'avatar' | 'name' | 'bio' | 'identity' | 'splash' | 'recovery' | 'deposit_privacy' | 'country' | null

const SPLASH_MODE_KEY = 'breakcash_splash_mode'

const COUNTRY_OPTIONS = [
  { value: 'TR', label: 'تركيا', shortLabel: 'TR' },
  { value: 'SA', label: 'السعودية', shortLabel: 'SA' },
  { value: 'AE', label: 'الإمارات', shortLabel: 'AE' },
  { value: 'EG', label: 'مصر', shortLabel: 'EG' },
  { value: 'IQ', label: 'العراق', shortLabel: 'IQ' },
  { value: 'SY', label: 'سوريا', shortLabel: 'SY' },
  { value: 'JO', label: 'الأردن', shortLabel: 'JO' },
  { value: 'LB', label: 'لبنان', shortLabel: 'LB' },
  { value: 'KW', label: 'الكويت', shortLabel: 'KW' },
  { value: 'QA', label: 'قطر', shortLabel: 'QA' },
  { value: 'BH', label: 'البحرين', shortLabel: 'BH' },
  { value: 'OM', label: 'عمان', shortLabel: 'OM' },
  { value: 'YE', label: 'اليمن', shortLabel: 'YE' },
  { value: 'MA', label: 'المغرب', shortLabel: 'MA' },
  { value: 'DZ', label: 'الجزائر', shortLabel: 'DZ' },
  { value: 'TN', label: 'تونس', shortLabel: 'TN' },
  { value: 'LY', label: 'ليبيا', shortLabel: 'LY' },
  { value: 'US', label: 'الولايات المتحدة', shortLabel: 'US' },
  { value: 'GB', label: 'بريطانيا', shortLabel: 'GB' },
  { value: 'FR', label: 'فرنسا', shortLabel: 'FR' },
  { value: 'DE', label: 'ألمانيا', shortLabel: 'DE' },
] as const

type SectionCardProps = {
  icon: ReactNode
  title: string
  subtitle: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

function SectionCard({ icon, title, subtitle, isOpen, onToggle, children }: SectionCardProps) {
  return (
    <section className="elite-enter elite-hover-lift elite-panel overflow-hidden rounded-[24px] p-3">
      <button className="profile-settings-toggle gap-3" type="button" onClick={onToggle}>
        <span className="flex min-w-0 items-center gap-3 text-right">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200">
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">{title}</span>
            <span className="mt-1 block text-xs leading-6 text-slate-400">{subtitle}</span>
          </span>
        </span>
        <span className="profile-settings-toggle-icon rounded-full border border-white/10 bg-white/5 p-2 text-slate-300">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {isOpen ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  )
}

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
  const [openSection, setOpenSection] = useState<SectionId>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [loadingRecoveryCode, setLoadingRecoveryCode] = useState(false)
  const [copiedRecoveryCode, setCopiedRecoveryCode] = useState(false)
  const [splashMode, setSplashMode] = useState<SplashMode>('always')
  const computedBadgeColor =
    user.badge_color === 'blue' ||
    user.badge_color === 'gold' ||
    user.badge_color === 'red' ||
    user.badge_color === 'green' ||
    user.badge_color === 'purple' ||
    user.badge_color === 'silver' ||
    user.badge_color === 'none'
      ? user.badge_color
      : Number(user.blue_badge || 0) === 1
        ? 'blue'
        : user.verification_status === 'verified'
          ? 'gold'
          : 'none'
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
    setBio(user.bio || '')
  }, [user.bio])

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
      const parts = [fullName.firstName, fullName.fatherName, fullName.familyName].map((p) => p.trim()).filter(Boolean)
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

      if (parts.length > 0 && nextDisplayName !== currentDisplayName) profilePayload.displayName = nextDisplayName
      if (nextBio !== currentBio) profilePayload.bio = nextBio
      if (nextCountry !== currentCountry) profilePayload.country = nextCountry
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

  const selectedCountryOption = COUNTRY_OPTIONS.find((option) => option.value === country) || null
  const bioText = bio.trim() || 'لا توجد نبذة تعريفية حالياً.'

  return (
    <div className="page profile-settings-page space-y-5">
      <section className={`elite-enter overflow-hidden rounded-[30px] border border-brand-blue/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_32%),linear-gradient(140deg,rgba(6,13,24,0.96),rgba(9,17,30,0.92))] p-4 shadow-[0_24px_58px_rgba(2,8,20,0.34)] ${premiumProfileColorClass}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={`relative h-20 w-20 overflow-hidden rounded-full border-2 border-white/15 bg-app-elevated shadow-[0_10px_26px_rgba(0,0,0,0.35)] lg:h-24 lg:w-24 ${premiumProfileColorClass}`}>
              {avatarPreview && !avatarBroken ? (
                <img
                  src={avatarPreview}
                  alt={user.display_name || `#${user.id}`}
                  className="h-full w-full object-cover"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-white/80">
                  {String(user.id).slice(-2)}
                </div>
              )}
              <label className="absolute bottom-0 left-0 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-black/60 text-white">
                <Camera size={14} />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>

            <div className="min-w-0 flex-1">
              <div className="profile-name-row">
                <h1 className="profile-name-title text-2xl font-black tracking-tight text-white">{user.display_name || `#${user.id}`}</h1>
                <span className="profile-official-pill">
                  <span className="profile-official-mark">
                    <BadgeCheck size={12} />
                  </span>
                  <span>{'\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0631\u0633\u0645\u064a'}</span>
                </span>
                <UserIdentityBadges
                  badgeColor={computedBadgeColor}
                  vipLevel={user.vip_level || 0}
                  premiumBadge={user.profile_badge}
                  mode="all"
                  variant="profile-soft"
                  verifiedLabel={'\u0645\u0648\u062b\u0642'}
                  className="profile-name-badges"
                />
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">{bioText}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85">
                  ID: #{user.id}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUserId}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-brand-blue/35 bg-brand-blue/10 px-3 text-xs text-white/90 hover:bg-brand-blue/20"
                >
                  {copiedId ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedId ? 'تم النسخ' : 'نسخ المعرف'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <ShieldCheck size={14} />
                <span>الحالة</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {user.verification_status === 'verified' ? 'موثق ومعتمد' : 'بانتظار الاعتماد'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <Globe2 size={14} />
                <span>الدولة</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {selectedCountryOption?.label || 'غير محددة'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-slate-400">
                <Sparkles size={14} />
                <span>الخصوصية</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-white">
                {depositPrivacyEnabled ? 'الإيداع مخفي' : 'الإيداع ظاهر'}
              </div>
            </div>
          </div>
        </div>
      </section>

      <form className="profile-settings-grid gap-3" onSubmit={handleSubmit}>
        <SectionCard
          icon={<Lock size={18} />}
          title="خصوصية مبلغ الإيداع"
          subtitle="تحكم بظهور قيمة الإيداع للمستخدمين الآخرين."
          isOpen={openSection === 'deposit_privacy'}
          onToggle={() => setOpenSection((key) => (key === 'deposit_privacy' ? null : 'deposit_privacy'))}
        >
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
        </SectionCard>

        <SectionCard
          icon={<KeyRound size={18} />}
          title="رمز الاسترداد"
          subtitle="نسخ الرمز الاحتياطي المرتبط بحسابك عند الحاجة."
          isOpen={openSection === 'recovery'}
          onToggle={() => setOpenSection((key) => (key === 'recovery' ? null : 'recovery'))}
        >
          <p className="profile-settings-sub">يمكنك عرض ونسخ رمز الاسترداد في أي وقت.</p>
          <div className="rounded-2xl border border-app-border bg-app-elevated p-4">
            <div className="select-all break-all text-center font-mono text-sm font-semibold tracking-[0.12em] text-brand-blue">
              {loadingRecoveryCode ? 'جار التحميل...' : (recoveryCode || 'غير متاح حالياً')}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-brand-blue/35 bg-brand-blue/10 px-3 text-xs text-white/90 hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleCopyRecoveryCode}
              disabled={!recoveryCode || loadingRecoveryCode}
            >
              {copiedRecoveryCode ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedRecoveryCode ? 'تم النسخ' : 'نسخ الرمز'}</span>
            </button>
          </div>
        </SectionCard>

        <SectionCard
          icon={<Sparkles size={18} />}
          title="إعداد شاشة البداية"
          subtitle="حدد متى تظهر شاشة المقدمة قبل تسجيل الدخول."
          isOpen={openSection === 'splash'}
          onToggle={() => setOpenSection((key) => (key === 'splash' ? null : 'splash'))}
        >
          <p className="profile-settings-sub">اختر كيف تظهر شاشة المقدمة قبل تسجيل الدخول.</p>
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
        </SectionCard>

        <SectionCard
          icon={<Globe2 size={18} />}
          title="الدولة والعرض العام"
          subtitle="اختر الدولة التي ستظهر في حسابك ونتائج البحث."
          isOpen={openSection === 'country'}
          onToggle={() => setOpenSection((key) => (key === 'country' ? null : 'country'))}
        >
          <p className="profile-settings-sub">
            اختر دولتك لتظهر بجانب اسمك في الملف الشخصي ونتائج البحث بعد الحفظ.
          </p>
          <div className="profile-country-picker">
            <div className="profile-country-preview">
              <span className="profile-country-flag">{selectedCountryOption?.shortLabel || '--'}</span>
              <span className="profile-country-name">{selectedCountryOption?.label || 'بدون دولة محددة'}</span>
            </div>
            <select
              className="field-input"
              value={country}
              onChange={(e) => setCountry(String(e.target.value || '').trim().toUpperCase())}
            >
              <option value="">بدون دولة محددة</option>
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.shortLabel} - {option.label}
                </option>
              ))}
            </select>
          </div>
        </SectionCard>

        <SectionCard
          icon={<Camera size={18} />}
          title="صورة الحساب"
          subtitle="رفع صورة أوضح تظهر بشكل احترافي داخل التطبيق."
          isOpen={openSection === 'avatar'}
          onToggle={() => setOpenSection((key) => (key === 'avatar' ? null : 'avatar'))}
        >
          <p className="profile-settings-sub">اختر صورة واضحة ليتم عرضها للجميع داخل التطبيق.</p>
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
        </SectionCard>

        <SectionCard
          icon={<UserCircle2 size={18} />}
          title="الاسم والبيانات الأساسية"
          subtitle="تحديث الاسم الظاهر وبياناتك الأساسية للحساب."
          isOpen={openSection === 'name'}
          onToggle={() => setOpenSection((key) => (key === 'name' ? null : 'name'))}
        >
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
              placeholder="اسم العائلة"
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
              value={fullName.birthDate}
              onChange={(e) => setFullName((v) => ({ ...v, birthDate: e.target.value }))}
            />
          </div>
        </SectionCard>

        <SectionCard
          icon={<BadgeCheck size={18} />}
          title="النبذة المختصرة"
          subtitle="أضف سطرًا تعريفيًا قصيرًا يظهر أسفل اسمك."
          isOpen={openSection === 'bio'}
          onToggle={() => setOpenSection((key) => (key === 'bio' ? null : 'bio'))}
        >
          <p className="profile-settings-sub">اكتب جملة قصيرة لا تتعدى 66 حرفًا.</p>
          <input
            className="field-input"
            maxLength={66}
            placeholder="اكتب نبذة تعريفية مختصرة..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <div className="profile-settings-hint">{bio.length}/66</div>
        </SectionCard>

        <SectionCard
          icon={<ShieldCheck size={18} />}
          title="رفع التحقق والاعتماد"
          subtitle="إرسال بيانات الهوية وصور التحقق لطلب الاعتماد."
          isOpen={openSection === 'identity'}
          onToggle={() => setOpenSection((key) => (key === 'identity' ? null : 'identity'))}
        >
          <p className="profile-settings-sub">
            أدخل بياناتك القانونية وأرفق صورة الهوية وصورة شخصية للتحقق.
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
            {idCardPreview ? (
              <div className="profile-settings-upload-preview">
                <img src={idCardPreview} alt="ID card preview" />
              </div>
            ) : null}
          </div>
          <div className="profile-settings-upload-row">
            <label className="profile-settings-upload-btn">
              صورة شخصية
              <input type="file" accept="image/*" onChange={handleSelfieChange} />
            </label>
            {selfiePreview ? (
              <div className="profile-settings-upload-preview">
                <img src={selfiePreview} alt="Selfie preview" />
              </div>
            ) : null}
          </div>
        </SectionCard>

        <div className="elite-enter elite-panel profile-settings-actions rounded-[24px] p-3">
          <button className="ghost-btn inline-flex h-11 items-center justify-center gap-2 px-4" type="button" onClick={onLogout}>
            <LogOut size={16} />
            <span>تسجيل الخروج</span>
          </button>
          <button className="login-submit inline-flex h-11 items-center justify-center gap-2 px-5" type="submit" disabled={saving}>
            <Check size={16} />
            <span>{saving ? 'جار حفظ التغييرات...' : 'حفظ التغييرات'}</span>
          </button>
        </div>

        {error ? <div className="login-error">{error}</div> : null}
        {success ? <div className="login-success">{success}</div> : null}
      </form>
    </div>
  )
}
