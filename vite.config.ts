/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'serve' ? '/' : '/cword/',
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname || process.cwd(), './src'),
    },
  },
  assetsInclude: ['**/*.svg'], // 確保 SVG 文件被當作資源處理
  build: {
    assetsInlineLimit: 0, // 禁用資源內聯，強制輸出為獨立文件
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
}))
