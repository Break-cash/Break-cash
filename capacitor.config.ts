import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.breakcash.app',
  appName: 'Break Cash',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://breakcash.cash',
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
