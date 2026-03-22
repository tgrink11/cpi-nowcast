import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/fred-api': {
        target: 'https://api.stlouisfed.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fred-api/, ''),
      },
      '/fmp-api-v3': {
        target: 'https://financialmodelingprep.com/api/v3',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fmp-api-v3/, ''),
      },
      '/fmp-api-v4': {
        target: 'https://financialmodelingprep.com/api/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fmp-api-v4/, ''),
      },
    },
  },
})
