import type { WalletAsset } from '../../ui/mobileMock'
import { useI18n } from '../../i18nCore'

export function WalletAssetsList({ assets }: { assets: WalletAsset[] }) {
  const { t } = useI18n()
  return (
    <section className="wallet-assets-panel">
      <div className="wallet-assets-header">
        <h2>{t('wallet_assets')}</h2>
        <span>{t('wallet_token_price')}</span>
        <span>{t('wallet_amount_value')}</span>
      </div>
      {assets.map((asset) => (
        <div key={asset.symbol} className="wallet-asset-row">
          <div className="wallet-asset-token">
            <div className="wallet-asset-icon">{asset.symbol[0]}</div>
            <div className="wallet-asset-meta">
              <div className="wallet-asset-symbol">{asset.symbol}</div>
              <div className="wallet-asset-price">
                ${asset.price_usd.toLocaleString()} {'  '}
                <span className={asset.change_24h_percent >= 0 ? 'change positive' : 'change negative'}>
                  {asset.change_24h_percent >= 0 ? '+' : ''}
                  {asset.change_24h_percent.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          <div className="wallet-asset-balance">
            <div>{asset.balance}</div>
            <div className="text-muted">${asset.balance.toFixed(2)}</div>
          </div>
        </div>
      ))}
    </section>
  )
}
