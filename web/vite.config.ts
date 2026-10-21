import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  // GitHub Pages 專案頁由 CI 設定子路徑
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': r('./src'),
      '@content': r('../content'),
      '@assets': r('../assets'),
    },
  },
  server: {
    fs: {
      // 允許讀取專案根目錄的 content/ 與 assets/
      allow: [r('..')],
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
