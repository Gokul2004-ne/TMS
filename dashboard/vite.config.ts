import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/tms-api': {
        target: 'https://frccind.com',
        changeOrigin: true,
        secure: true,
      },
      '/api': {
        target: 'https://frccind.com/tms-api',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
