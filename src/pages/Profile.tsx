import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch, getMyProfile, type AuthUser } from '../api'
import { WalletQuickActions } from '../components/mobile/WalletQuickActions'
import { WalletAssetsList } from '../components/mobile/WalletAssetsList'
import { useI18n } from '../i18nCore'
import { walletDashboardMock } from '../ui/mobileMock'

export function Profile() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [realBalance, setRealBalance] = useState<number | null>(null)
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [holdings, setHoldings] = useState<{ id: number; symbol: string; quantity: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [profitsOpen, setProfitsOpen] = useState(false)
  const [dailyProfit, setDailyProfit] = useState(0)
  const [totalProfit, setTotalProfit] = useState(0)

  useEffect(() => {
    Promise.allSettled([getMyProfile(), apiFetch('/api/balance/my'), apiFetch('/api/portfolio/holdings')])
      .then((results) => {
        const [profileRes, balanceRes, holdingsRes] = results
        if (profileRes.status === 'fulfilled') setProfile(profileRes.value.profile)
        if (balanceRes.status === 'fulfilled') {
          const balances = (balanceRes.value as { balances: { amount: number }[] }).balances
          const sum = balances.reduce((acc, row) => acc + Number(row.amount || 0), 0)
          setRealBalance(sum)
        }
        if (holdingsRes.status === 'fulfilled') {
          setHoldings(
            (holdingsRes.value as { holdings: { id: number; symbol: string; quantity: number }[] }).holdings,
          )
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const displayIdentity = useMemo(
    () => profile?.email || profile?.phone || walletDashboardMock.wallet_name,
    [profile],
  )
  const dashboardBalance = realBalance ?? walletDashboardMock.total_balance_usd
  const assetsToRender = useMemo(() => {
    if (holdings.length === 0) return walletDashboardMock.my_assets
    return walletDashboardMock.my_assets.map((item) => {
      const found = holdings.find((holding) => holding.symbol === item.symbol)
      return { ...item, balance: found?.quantity || 0 }
    })
  }, [holdings])

  const isOwner = profile?.role === 'owner'

  return (
    <div className="wallet-screen">
      <div className="wallet-brand-wrap">
        <img src="/logo-bc.png" alt="Break Cash" className="wallet-brand-logo" />
        <span className="wallet-brand-name">BREAK CASH</span>
        <span className="wallet-brand-tagline">المحفظة الرقمية</span>
      </div>

      <section className="wallet-balance-card">
        <div className="wallet-balance-head">
          <span>{walletDashboardMock.wallet_name}</span>
          <button className="wallet-inline-icon" type="button">
            ⧉
          </button>
        </div>
        <div className="wallet-main-balance">${dashboardBalance.toFixed(2)}</div>
        <div className="wallet-balance-actions">
          <button className="wallet-receive-btn" type="button">
            {t('wallet_receive')}
          </button>
        </div>
      </section>

      <WalletQuickActions
        actions={walletDashboardMock.quick_actions}
        onDepositClick={() => navigate('/deposit')}
        onToggleProfits={() => setProfitsOpen((open) => !open)}
      />

      {profitsOpen && (
        <section className="wallet-profits-panel">
          <div className="wallet-profits-row">
            <span>الأرباح اليومية</span>
            {isOwner ? (
              <input
                className="field-input wallet-profits-input"
                type="number"
                value={dailyProfit}
                onChange={(e) => setDailyProfit(Number(e.target.value) || 0)}
              />
            ) : (
              <span className="wallet-profits-value">{dailyProfit}</span>
            )}
          </div>
          <div className="wallet-profits-row">
            <span>إجمالي الأرباح</span>
            {isOwner ? (
              <input
                className="field-input wallet-profits-input"
                type="number"
                value={totalProfit}
                onChange={(e) => setTotalProfit(Number(e.target.value) || 0)}
              />
            ) : (
              <span className="wallet-profits-value">{totalProfit}</span>
            )}
          </div>
        </section>
      )
      }

      <section className="wallet-promo-card">
        <div className="wallet-promo-icon">{walletDashboardMock.promotions.asset_icon[0]}</div>
        <div>
          <div className="wallet-promo-title">{walletDashboardMock.promotions.title}</div>
          <div className="wallet-promo-sub">{walletDashboardMock.promotions.description}</div>
        </div>
      </section>

      {loading ? (
        <section className="wallet-assets-panel">
          <div className="text-muted">Loading...</div>
        </section>
      ) : (
        <WalletAssetsList assets={assetsToRender} />
      )}

      {!loading && assetsToRender.length === 0 ? (
        <div className="wallet-empty">{t('wallet_empty_assets')}</div>
      ) : null}

      <div className="wallet-screen-user">{displayIdentity}</div>
    </div>
  )
}

