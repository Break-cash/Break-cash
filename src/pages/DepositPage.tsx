import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLogoUrl,
  getMyProfile,
  getWalletLink,
  type AuthUser,
  updateLogoUrl,
  updateWalletLink,
} from '../api'
import { DEPOSIT_TERMS_AR } from '../depositTerms'

type DepositPageProps = {
  user: AuthUser | null
}

export function DepositPage({ user }: DepositPageProps) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<AuthUser | null>(user ?? null)
  const [walletLink, setWalletLink] = useState('')
  const [walletLinkEdit, setWalletLinkEdit] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoUrlEdit, setLogoUrlEdit] = useState('')
  const [termsOpen, setTermsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingWallet, setSavingWallet] = useState(false)
  const [savingLogo, setSavingLogo] = useState(false)
  const [copyDone, setCopyDone] = useState(false)

  const isOwner = profile?.role === 'owner'

  useEffect(() => {
    if (!profile && user) setProfile(user)
  }, [user, profile])

  useEffect(() => {
    Promise.all([getMyProfile(), getWalletLink(), getLogoUrl()])
      .then(([profileRes, walletRes, logoRes]) => {
        setProfile(profileRes.profile)
        setWalletLink(walletRes.walletLink || '')
        setWalletLinkEdit(walletRes.walletLink || '')
        const url = (logoRes.logoUrl || '').trim()
        setLogoUrl(url)
        setLogoUrlEdit(url)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const displayLogoUrl = (logoUrl || '').trim() ? logoUrl : '/logo-bc.png'

  async function handleSaveWallet() {
    if (!isOwner) return
    const v = walletLinkEdit.trim()
    setSavingWallet(true)
    try {
      await updateWalletLink(v)
      setWalletLink(v)
    } finally {
      setSavingWallet(false)
    }
  }

  async function handleSaveLogo() {
    if (!isOwner) return
    const v = logoUrlEdit.trim()
    setSavingLogo(true)
    try {
      await updateLogoUrl(v)
      setLogoUrl(v)
    } finally {
      setSavingLogo(false)
    }
  }

  function handleCopyWallet() {
    const text = walletLink || walletLinkEdit
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="deposit-page">
        <div className="deposit-loading">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="deposit-page">
      <button type="button" className="deposit-back" onClick={() => navigate(-1)} aria-label="رجوع">
        ←
      </button>

      <div className="deposit-brand">
        <div className="deposit-logo-wrap">
          {isOwner ? (
            <>
              <img src={displayLogoUrl} alt="BREAK CASH" className="deposit-logo" />
              <div className="deposit-owner-edit">
                <input
                  type="text"
                  className="deposit-owner-input"
                  placeholder="رابط صورة الشعار"
                  value={logoUrlEdit}
                  onChange={(e) => setLogoUrlEdit(e.target.value)}
                />
                <button
                  type="button"
                  className="deposit-owner-save"
                  onClick={handleSaveLogo}
                  disabled={savingLogo}
                >
                  {savingLogo ? '...' : 'حفظ'}
                </button>
              </div>
            </>
          ) : (
            <img src={displayLogoUrl} alt="BREAK CASH" className="deposit-logo" />
          )}
        </div>
        <h1 className="deposit-title">BREAK CASH</h1>
      </div>

      <section className="deposit-section deposit-wallet-section">
        <h2 className="deposit-section-title">محفظة المنصة</h2>
        {isOwner ? (
          <div className="deposit-wallet-edit">
            <input
              type="text"
              className="deposit-wallet-input"
              placeholder="عنوان المحفظة أو الرابط"
              value={walletLinkEdit}
              onChange={(e) => setWalletLinkEdit(e.target.value)}
            />
            <button
              type="button"
              className="deposit-wallet-save"
              onClick={handleSaveWallet}
              disabled={savingWallet}
            >
              {savingWallet ? '...' : 'حفظ'}
            </button>
          </div>
        ) : null}
        <div className="deposit-wallet-display">
          <span className="deposit-wallet-value">{walletLink || walletLinkEdit || '—'}</span>
          <button
            type="button"
            className="deposit-copy-btn"
            onClick={handleCopyWallet}
            disabled={!walletLink && !walletLinkEdit}
          >
            {copyDone ? 'تم النسخ ✓' : 'نسخ'}
          </button>
        </div>
      </section>

      <section className="deposit-section deposit-tiers">
        <div className="deposit-tier">
          <span className="deposit-tier-label">أقل ترقية</span>
          <span className="deposit-tier-amount">75$</span>
        </div>
        <div className="deposit-tier deposit-tier-popular">
          <span className="deposit-tier-badge">الأكثر رواجاً</span>
          <span className="deposit-tier-amount">499$</span>
        </div>
        <div className="deposit-tier">
          <span className="deposit-tier-label">الترقية</span>
          <span className="deposit-tier-amount">1000$</span>
        </div>
      </section>

      <p className="deposit-welcome">
        مرحباً بك في BREAK CASH. ابدأ بإيداعك وارتقِ بمستواك للاستفادة من الامتيازات الحصرية.
      </p>

      <button
        type="button"
        className="deposit-terms-link"
        onClick={() => setTermsOpen(true)}
      >
        تعرف على الامتيازات والشروط
      </button>

      {termsOpen && (
        <div className="deposit-terms-overlay" onClick={() => setTermsOpen(false)}>
          <div
            className="deposit-terms-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="امتيازات وشروط الاشتراك"
          >
            <div className="deposit-terms-content">
              {DEPOSIT_TERMS_AR.split('\n\n').map((p, i) => (
                <p key={i} className="deposit-terms-para">
                  {p}
                </p>
              ))}
            </div>
            <button
              type="button"
              className="deposit-terms-close"
              onClick={() => setTermsOpen(false)}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
