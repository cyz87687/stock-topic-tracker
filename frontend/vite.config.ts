import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts', 'echarts-for-react'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/em': {
        target: 'http://push2.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/em/, ''),
      },
      '/emhis': {
        target: 'http://push2his.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/emhis/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
})
