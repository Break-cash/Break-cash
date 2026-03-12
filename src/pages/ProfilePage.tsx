import { useState, type ChangeEvent, type FormEvent } from 'react'
import { type AuthUser, updateMyProfile, uploadAvatar, uploadKyc } from '../api'

type ProfilePageProps = {
  onLogout: () => void
  user: AuthUser
}

export function ProfilePage({ onLogout, user }: ProfilePageProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatar_url || null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [fullName, setFullName] = useState({
    firstName: '',
    fatherName: '',
    familyName: '',
    motherName: '',
    birthDate: '',
  })
  const [bio, setBio] = useState('')
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
  const [openSection, setOpenSection] = useState<'avatar' | 'name' | 'bio' | 'identity' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
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
      if (parts.length > 0) {
        await updateMyProfile({ displayName: parts.join(' ') })
      }

      if (avatarFile) {
        await uploadAvatar(avatarFile)
      }

      if (idCardFile && selfieFile) {
        await uploadKyc(idCardFile, selfieFile)
      }

      setSuccess('تم حفظ التغييرات بنجاح.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ التغييرات.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page profile-settings-page">
      <h1 className="page-title">الملف الشخصي</h1>
      <form className="profile-settings-grid" onSubmit={handleSubmit}>
        <section className="profile-settings-card">
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
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Profile preview" />
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

        <section className="profile-settings-card">
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

        <section className="profile-settings-card">
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

        <section className="profile-settings-card">
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

        <div className="profile-settings-actions">
          <button className="ghost-btn" type="button" onClick={onLogout}>
            تسجيل الخروج
          </button>
          <button className="login-submit" type="submit" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}
      </form>
    </div>
  )
}
