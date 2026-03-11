export function Login() {
  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-badge">ابدأ رحلتك الآن</div>
          <h1 className="login-title">عملات مشفرة خاصة بك</h1>
          <p className="login-subtitle">
            سجّل دخولك للبدء في إدارة محافظك الرقمية بأمان وسهولة.
          </p>
        </div>

        <form className="login-form">
          <label className="login-field">
            <span className="field-label">البريد الإلكتروني / رقم الهاتف المحمول</span>
            <input
              type="text"
              className="field-input"
              placeholder="يرجى إدخال البريد الإلكتروني أو رقم الهاتف"
            />
          </label>

          <label className="login-field">
            <span className="field-label">كلمة المرور</span>
            <div className="field-input field-input-with-icon">
              <input
                type="password"
                className="field-input-inner"
                placeholder="يرجى إدخال كلمة المرور"
              />
              <button type="button" className="field-icon-btn" aria-label="إظهار كلمة المرور">
                👁
              </button>
            </div>
          </label>

          <label className="login-field">
            <span className="field-label">رمز التحقق</span>
            <div className="captcha-row">
              <input
                type="text"
                className="field-input"
                placeholder="يرجى إدخال كود التحقق"
              />
              <div className="captcha-box" aria-label="رمز التحقق">
                <span>S</span>
                <span>K</span>
                <span>T</span>
                <span>V</span>
              </div>
            </div>
          </label>

          <button type="submit" className="login-submit">
            تسجيل الدخول
          </button>

          <div className="login-footer-links">
            <button type="button" className="link-btn">
              إعادة تعيين كلمة المرور
            </button>
            <button type="button" className="link-btn">
              إنشاء حساب
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

