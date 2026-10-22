import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 5173,
    // Em dev, /api é encaminhado ao backend (mesma origem => cookie do refresh token funciona sem CORS)
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080', changeOrigin: true } },
  },
})
