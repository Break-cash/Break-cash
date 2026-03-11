import { appData } from '../data'

export function Options() {
  return (
    <div className="page">
      <h1 className="page-title">الخيارات</h1>

      <div className="grid">
        {appData.settings_options.map((item) => (
          <button key={item.id} className="card option-card">
            <div className="option-icon">⚙</div>
            <div className="option-label">{item.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

