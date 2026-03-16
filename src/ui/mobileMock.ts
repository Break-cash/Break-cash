export type OrderBookLevel = {
  price: number
  quantity: number
}

export type FuturesTradingModel = {
  pair: string
  contract_type: string
  current_price: number
  price_change_percent: number
  leverage_options: string[]
  selected_leverage: string
  margin_mode: 'Cross' | 'Isolated'
  order_book: {
    asks: OrderBookLevel[]
    bids: OrderBookLevel[]
  }
  trading_form: {
    order_types: string[]
    selected_type: string
    available_balance: number
    currency: string
  }
}

export type WalletAsset = {
  symbol: string
  full_name: string
  price_usd: number
  change_24h_percent: number
  balance: number
}

export type WalletDashboardModel = {
  account_type: string
  wallet_name: string
  total_balance_usd: number
  quick_actions: Array<{
    id: number
    label: string
    icon: string
  }>
  promotions: {
    title: string
    description: string
    asset_icon: string
  }
  my_assets: WalletAsset[]
}

export const futuresTradingMock: FuturesTradingModel = {
  pair: 'BTCUSDT',
  contract_type: 'Perpetual',
  current_price: 89572.1,
  price_change_percent: -0.6,
  leverage_options: ['1x', '3x', '5x', '10x', '20x'],
  selected_leverage: '3x',
  margin_mode: 'Cross',
  order_book: {
    asks: [
      { price: 89743.7, quantity: 0.5865 },
      { price: 89703.0, quantity: 0.5835 },
      { price: 89685.2, quantity: 0.026 },
    ],
    bids: [
      { price: 89575.2, quantity: 0.003 },
      { price: 89570.7, quantity: 0.006 },
      { price: 89566.2, quantity: 0.009 },
    ],
  },
  trading_form: {
    order_types: ['Limit', 'Market', 'Stop Limit'],
    selected_type: 'Limit',
    available_balance: 0,
    currency: 'USDT',
  },
}

export const walletDashboardMock: WalletDashboardModel = {
  account_type: 'Web3 Wallet',
  wallet_name: 'Wallet A',
  total_balance_usd: 0,
  quick_actions: [
    { id: 1, label: 'Send', icon: 'arrow_up' },
    { id: 2, label: 'Airdrops', icon: 'balloon' },
    { id: 3, label: 'xStocks', icon: 'stock_grid' },
    { id: 4, label: 'More', icon: 'dots' },
  ],
  promotions: {
    title: 'المكافأة عن طريق دعوة صديق',
    description: '',
    asset_icon: 'USDT',
  },
  my_assets: [
    {
      symbol: 'BTC',
      full_name: 'Bitcoin',
      price_usd: 91780.4,
      change_24h_percent: 2.61,
      balance: 0,
    },
    {
      symbol: 'ETH',
      full_name: 'Ethereum',
      price_usd: 3137.74,
      change_24h_percent: 3.25,
      balance: 0,
    },
    {
      symbol: 'KCS',
      full_name: 'KuCoin Token',
      price_usd: 10.54,
      change_24h_percent: 1.52,
      balance: 0,
    },
  ],
}
