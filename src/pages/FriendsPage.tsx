import { useCallback, useEffect, useState } from 'react'
import {
  acceptFriendRequest,
  getFriendsList,
  removeFriend,
  searchUsersById,
  sendFriendRequest,
  type FriendItem,
  type FriendUser,
} from '../api'
import { UserIdentityBadges } from '../components/user/UserIdentityBadges'
import { useI18n } from '../i18nCore'

const COUNTRY_FLAG_ALIASES: Record<string, string> = {
  tr: 'TR',
  turkey: 'TR',
  turkiye: 'TR',
  sa: 'SA',
  'saudi arabia': 'SA',
  saudi: 'SA',
  eg: 'EG',
  egypt: 'EG',
  ae: 'AE',
  uae: 'AE',
  iq: 'IQ',
  iraq: 'IQ',
  sy: 'SY',
  syria: 'SY',
  jo: 'JO',
  jordan: 'JO',
  lb: 'LB',
  lebanon: 'LB',
  kw: 'KW',
  kuwait: 'KW',
  qa: 'QA',
  qatar: 'QA',
  bh: 'BH',
  bahrain: 'BH',
  om: 'OM',
  oman: 'OM',
  ye: 'YE',
  yemen: 'YE',
  ma: 'MA',
  morocco: 'MA',
  dz: 'DZ',
  algeria: 'DZ',
  tn: 'TN',
  tunisia: 'TN',
  ly: 'LY',
  libya: 'LY',
  us: 'US',
  usa: 'US',
  'united states': 'US',
  america: 'US',
  gb: 'GB',
  uk: 'GB',
  britain: 'GB',
  england: 'GB',
  fr: 'FR',
  france: 'FR',
  de: 'DE',
  germany: 'DE',
}

export function FriendsPage() {
  const { t } = useI18n()
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<FriendUser[]>([])
  const [searching, setSearching] = useState(false)
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [pendingReceived, setPendingReceived] = useState<FriendItem[]>([])
  const [pendingSent, setPendingSent] = useState<FriendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [selectedUser, setSelectedUser] = useState<FriendUser | null>(null)

  const loadList = useCallback(async () => {
    try {
      const res = await getFriendsList()
      setFriends(res.friends)
      setPendingReceived(res.pendingReceived)
      setPendingSent(res.pendingSent)
    } catch {
      setMessage({ type: 'error', text: t('friends_load_error') })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadList()
  }, [loadList])

  async function handleSearch() {
    const q = searchQ.trim().replace(/\D/g, '')
    if (!q) {
      setSearchResults([])
      return
    }
    setSearching(true)
    setMessage(null)
    try {
      const res = await searchUsersById(q)
      setSearchResults(res.users)
      setSelectedUser(res.users[0] || null)
      if (res.users.length === 0) setMessage({ type: 'error', text: t('friends_no_results') })
    } catch {
      setSearchResults([])
      setMessage({ type: 'error', text: t('friends_search_error') })
    } finally {
      setSearching(false)
    }
  }

  async function handleAddFriend(user: FriendUser) {
    setAddingId(user.id)
    setMessage(null)
    try {
      await sendFriendRequest(user.id)
      setMessage({ type: 'success', text: t('friends_request_sent') })
      setSearchResults((prev) => prev.filter((u) => u.id !== user.id))
      loadList()
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : t('friends_add_error') })
    } finally {
      setAddingId(null)
    }
  }

  async function handleAccept(item: FriendItem) {
    setMessage(null)
    try {
      await acceptFriendRequest(item.id)
      setMessage({ type: 'success', text: t('friends_accepted') })
      loadList()
    } catch {
      setMessage({ type: 'error', text: t('friends_accept_error') })
    }
  }

  async function handleRemove(item: FriendItem) {
    setMessage(null)
    try {
      await removeFriend(item.userId)
      setMessage({ type: 'success', text: t('friends_removed') })
      loadList()
    } catch {
      setMessage({ type: 'error', text: t('friends_remove_error') })
    }
  }

  const isPendingSent = (userId: number) => pendingSent.some((p) => p.userId === userId)
  const isFriend = (userId: number) => friends.some((f) => f.userId === userId)
  const selectedBadgeColor =
    selectedUser && Number(selectedUser.blueBadge || 0) === 1
      ? 'blue'
      : selectedUser?.verificationStatus === 'verified'
        ? 'gold'
        : 'none'
  const selectedVerified = selectedUser?.verificationStatus === 'verified'
  const selectedHasPublicTitles = Boolean(
    selectedUser &&
      ((selectedUser.vipLevel || 0) > 0 ||
        selectedUser.verificationStatus === 'verified' ||
        Number(selectedUser.blueBadge || 0) === 1),
  )

  function getCountryFlagEmoji(value?: string | null) {
    const raw = String(value || '').trim()
    if (!raw) return ''
    const lower = raw.toLowerCase()
    const code = /^[a-z]{2}$/i.test(raw) ? raw.toUpperCase() : COUNTRY_FLAG_ALIASES[lower] || ''
    if (!code) return ''
    return String.fromCodePoint(...code.split('').map((char) => 127397 + char.charCodeAt(0)))
  }

  return (
    <div className="friends-page page">
      <section className="mb-4 app-icon-hero-shell overflow-hidden rounded-2xl border border-app-border">
        <img src="/ads/partners.jpeg" alt={t('home_action_partners')} className="app-icon-hero-image w-full object-cover" loading="eager" />
      </section>
      <h1 className="friends-title">{t('nav_friends')}</h1>

      <section className="friends-search-section">
        <label className="friends-search-label">{t('friends_search_by_id')}</label>
        <div className="friends-search-row">
          <input
            type="text"
            inputMode="numeric"
            placeholder={t('friends_search_placeholder')}
            className="friends-search-input"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            type="button"
            className="friends-search-btn"
            onClick={handleSearch}
            disabled={searching || !searchQ.trim()}
          >
            {searching ? t('friends_searching') : t('friends_search')}
          </button>
        </div>
      </section>

      {message && (
        <div className={`friends-message friends-message-${message.type}`}>{message.text}</div>
      )}

      {searchResults.length > 0 && (
        <section className="friends-results">
          <h2 className="friends-section-title">{t('friends_results')}</h2>
          <ul className="friends-list">
            {searchResults.map((user) => (
              <li key={user.id} className="friends-list-item">
                <div className="friends-item-avatar">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" />
                  ) : (
                    <span className="friends-item-initial">#{user.id}</span>
                  )}
                </div>
                <div className="friends-item-info">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="friends-item-name">{user.displayName}</span>
                    {getCountryFlagEmoji(user.country) ? (
                      <span className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/8 px-1.5 text-base leading-5">
                        {getCountryFlagEmoji(user.country)}
                      </span>
                    ) : null}
                    <UserIdentityBadges
                      badgeColor={
                        Number(user.blueBadge || 0) === 1
                          ? 'blue'
                          : user.verificationStatus === 'verified'
                            ? 'gold'
                            : 'none'
                      }
                      vipLevel={user.vipLevel || 0}
                      premiumBadge={user.premiumBadge}
                      mode="verified"
                    />
                  </div>
                  {(Number(user.vipLevel || 0) > 0 ||
                    user.verificationStatus === 'verified' ||
                    Number(user.blueBadge || 0) === 1) ? (
                    <div className="friends-public-titles">
                      <UserIdentityBadges
                        badgeColor={
                          Number(user.blueBadge || 0) === 1
                            ? 'blue'
                            : user.verificationStatus === 'verified'
                              ? 'gold'
                              : 'none'
                        }
                        vipLevel={user.vipLevel || 0}
                        mode="secondary"
                      />
                    </div>
                  ) : null}
                  <span className="friends-item-id">ID: {user.id}</span>
                </div>
                <button
                  type="button"
                  className="friends-view-btn"
                  onClick={() => setSelectedUser(user)}
                >
                  {t('friends_view_profile')}
                </button>
                {isFriend(user.id) ? (
                  <span className="friends-item-badge">{t('friends_already')}</span>
                ) : isPendingSent(user.id) ? (
                  <span className="friends-item-badge friends-item-pending">{t('friends_pending')}</span>
                ) : (
                  <button
                    type="button"
                    className="friends-add-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddFriend(user)
                    }}
                    disabled={addingId === user.id}
                  >
                    {addingId === user.id ? '...' : t('friends_add')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="friends-loading">{t('friends_loading')}</div>
      ) : (
        <>
          {pendingReceived.length > 0 && (
            <section className="friends-section">
              <h2 className="friends-section-title">{t('friends_pending_received')}</h2>
              <ul className="friends-list">
                {pendingReceived.map((item) => (
                  <li key={item.id} className="friends-list-item">
                    <div className="friends-item-avatar">
                      {item.avatarUrl ? (
                        <img src={item.avatarUrl} alt="" />
                      ) : (
                        <span className="friends-item-initial">#{item.userId}</span>
                      )}
                    </div>
                    <div className="friends-item-info">
                      <span className="friends-item-name">{item.displayName}</span>
                      <span className="friends-item-id">ID: {item.userId}</span>
                    </div>
                    <div className="friends-item-actions">
                      <button
                        type="button"
                        className="friends-accept-btn"
                        onClick={() => handleAccept(item)}
                      >
                        {t('friends_accept')}
                      </button>
                      <button
                        type="button"
                        className="friends-remove-btn"
                        onClick={() => handleRemove(item)}
                      >
                        {t('friends_decline')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="friends-section">
            <h2 className="friends-section-title">{t('friends_list')}</h2>
            {friends.length === 0 ? (
              <p className="friends-empty">{t('friends_empty')}</p>
            ) : (
              <ul className="friends-list">
                {friends.map((item) => (
                  <li key={item.id} className="friends-list-item">
                    <div className="friends-item-avatar">
                      {item.avatarUrl ? (
                        <img src={item.avatarUrl} alt="" />
                      ) : (
                        <span className="friends-item-initial">#{item.userId}</span>
                      )}
                    </div>
                    <div className="friends-item-info">
                      <span className="friends-item-name">{item.displayName}</span>
                      <span className="friends-item-id">ID: {item.userId}</span>
                    </div>
                    <button
                      type="button"
                      className="friends-remove-btn"
                      onClick={() => handleRemove(item)}
                    >
                      {t('friends_remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {selectedUser ? (
        <div className="friends-profile-overlay" onClick={() => setSelectedUser(null)}>
          <div className="friends-profile-popup" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="friends-profile-close"
              onClick={() => setSelectedUser(null)}
              aria-label={t('close_search')}
            >
              ×
            </button>
            <div className="friends-profile-header">
              <div className="friends-profile-avatar">
                {selectedUser.avatarUrl ? (
                  <img src={selectedUser.avatarUrl} alt={selectedUser.displayName} />
                ) : (
                  <span>{String(selectedUser.id).slice(-2)}</span>
                )}
              </div>
              <div className="friends-profile-title-wrap">
                <div className="friends-profile-title-row">
                  <span className="friends-profile-name">{selectedUser.displayName}</span>
                  <UserIdentityBadges
                    badgeColor={selectedBadgeColor}
                    vipLevel={selectedUser.vipLevel || 0}
                    premiumBadge={selectedUser.premiumBadge}
                    mode="verified"
                  />
                </div>
                {selectedHasPublicTitles ? (
                  <div className="friends-profile-public-titles">
                    <UserIdentityBadges
                      badgeColor={selectedBadgeColor}
                      vipLevel={selectedUser.vipLevel || 0}
                      mode="secondary"
                    />
                  </div>
                ) : null}
                <div className="friends-profile-id">ID: {selectedUser.id}</div>
              </div>
            </div>

            <div className="friends-profile-bio">
              {selectedUser.bio?.trim() || t('friends_bio_empty')}
            </div>

            <div className="friends-profile-status-row">
              <span className={`friends-verify-dot ${selectedVerified ? 'verified' : 'unverified'}`} />
              <span className="friends-verify-text">
                {selectedVerified ? t('friends_verified') : t('friends_not_verified')}
              </span>
            </div>

            <div className="friends-profile-balance">
              <span>{t('friends_trading_balance')}</span>
              <strong>
                {selectedUser.depositPrivacyEnabled || selectedUser.tradingBalance == null
                  ? t('contact_hidden')
                  : `${Number(selectedUser.tradingBalance || 0).toFixed(2)} USDT`}
              </strong>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
