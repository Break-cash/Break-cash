import { useEffect, useState } from 'react'
import { BellDot, CheckCheck, ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'
import { useI18n } from '../i18nCore'

type NotificationItem = {
  id: number
  title: string
  body: string
  is_read: number
  created_at?: string | null
}

function formatDate(value?: string | null, locale?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(locale)
}

export function NotificationsPage() {
  const { t, language } = useI18n()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/notifications/list')
      .then((res) => setItems(((res as { notifications?: NotificationItem[] }).notifications || [])))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  async function markAllRead() {
    await Promise.all(
      items
        .filter((item) => Number(item.is_read || 0) === 0)
        .map((item) =>
          apiFetch('/api/notifications/markAsRead', {
            method: 'POST',
            body: JSON.stringify({ id: item.id }),
          }),
        ),
    ).catch(() => {})
    setItems((current) => current.map((item) => ({ ...item, is_read: 1 })))
  }

  return (
    <div className="page app-secondary-page notifications-page">
      <section className="app-secondary-hero">
        <div className="app-secondary-hero__head">
          <div>
            <div className="app-secondary-hero__badge">
              <BellDot size={14} />
              <span>{t('notifications_page_badge')}</span>
            </div>
            <h1>{t('notifications')}</h1>
            <p>{t('notifications_page_desc')}</p>
          </div>
          <div className="app-secondary-hero__actions">
            <button type="button" className="app-secondary-action" onClick={markAllRead}>
              <CheckCheck size={14} />
              <span>{t('mark_all_read')}</span>
            </button>
            <Link to="/portfolio" className="app-secondary-action app-secondary-action--ghost">
              <ChevronLeft size={14} />
              <span>{t('back')}</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="app-secondary-card-stack">
        {loading ? <div className="app-secondary-card">{t('loading_notifications')}</div> : null}
        {!loading && items.length === 0 ? <div className="app-secondary-card">{t('no_notifications')}</div> : null}
        {!loading
          ? items.map((item) => (
              <article
                key={item.id}
                className={`app-secondary-card notifications-page__item ${Number(item.is_read || 0) === 0 ? 'is-unread' : ''}`}
              >
                <div className="notifications-page__item-head">
                  <strong>{item.title}</strong>
                  <span>{formatDate(item.created_at, language)}</span>
                </div>
                <p>{item.body}</p>
              </article>
            ))
          : null}
      </section>
    </div>
  )
}
