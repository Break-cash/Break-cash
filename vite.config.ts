import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (
            id.includes(`${'node_modules'}${'/react/'}`) ||
            id.includes(`${'node_modules'}${'/react-dom/'}`) ||
            id.includes(`${'node_modules'}${'/react-router-dom/'}`) ||
            id.includes(`${'node_modules'}${'/scheduler/'}`)
          ) {
            return 'vendor-react'
          }

          if (id.includes(`${'node_modules'}${'/framer-motion/'}`)) {
            return 'vendor-motion'
          }

          if (
            id.includes(`${'node_modules'}${'/recharts/'}`) ||
            id.includes(`${'node_modules'}${'/victory-vendor/'}`) ||
            id.includes(`${'node_modules'}${'/d3-'}`)
          ) {
            return 'vendor-recharts'
          }

          if (id.includes(`${'node_modules'}${'/lightweight-charts/'}`)) {
            return 'vendor-lightweight-charts'
          }

          if (id.includes(`${'node_modules'}${'/lucide-react/'}`)) {
            return 'vendor-icons'
          }

          return 'vendor-misc'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5174',
    },
  },
})
