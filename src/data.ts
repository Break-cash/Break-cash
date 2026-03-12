export const appData = {
  app_name: 'Break cash',
  user_profile: {
    uid: '701928',
    email: 'bffh1331@gmail.com',
    vip_level: 0,
    avatar_url: 'assets/logo.png',
    invitation_code: 'YkXGle',
  },
  balance_info: {
    total_assets_usdt: 0.0,
    today_earnings: 0.0,
    funding_account: 0.0,
    team_earnings: 0.0,
    currency: 'USDT',
  },
  market_data: [
    {
      pair: 'BTC/USDT',
      last_price: 69969.87,
      change_percentage: -1.91,
      trend: 'down',
      icon: 'assets/btc.png',
    },
    {
      pair: 'ETH/USDT',
      last_price: 2033.45,
      change_percentage: -2.22,
      trend: 'down',
      icon: 'assets/eth.png',
    },
    {
      pair: 'ADA/USDT',
      last_price: 0.260409,
      change_percentage: -4.09,
      trend: 'down',
      icon: 'assets/ada.png',
    },
  ],
  navigation_menu: [
    { title: 'الصفحة الرئيسية', icon: 'home_icon', route: '/home' },
    { title: 'الأسعار السوقية', icon: 'market_icon', route: '/market' },
    { title: 'التزامن بالصفقة', icon: 'trade_icon', route: '/sync' },
    { title: 'الخيارات', icon: 'options_icon', route: '/options' },
    { title: 'الأصول', icon: 'wallet_icon', route: '/assets' },
  ],
  settings_options: [
    { id: 1, label: 'التحقق من الهوية', icon: 'identity_icon' },
    { id: 2, label: 'مركز المساعدة', icon: 'help_icon' },
    { id: 3, label: 'تعديل كلمة مرور الدخول', icon: 'lock_icon' },
    { id: 4, label: 'تعديل كلمة مرور الدفع', icon: 'key_icon' },
    { id: 5, label: 'تنزيل التطبيق الهاتفي', icon: 'download_icon' },
    { id: 6, label: 'مقدمة المنصة', icon: 'info_icon' },
    { id: 7, label: 'نظام مكافأة الفريق', icon: 'gift_icon' },
  ],
  ui_colors: {
    primary_dark: '#0A0E17',
    card_bg: '#161C2D',
    accent_blue: '#2E6FF2',
    accent_purple: '#7B61FF',
    text_white: '#FFFFFF',
    text_gray: '#8E97A8',
    negative_red: '#FF4D4D',
  },
} as const

export type AppData = typeof appData
