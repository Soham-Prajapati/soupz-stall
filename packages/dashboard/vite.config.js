import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7534,
    proxy: {
      '/api': { target: 'http://localhost:7533', changeOrigin: true },
      '/health': { target: 'http://localhost:7533', changeOrigin: true },
      '/command': { target: 'http://localhost:7533', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco': ['@monaco-editor/react'],
          'supabase': ['@supabase/supabase-js'],
          'vendor': ['react', 'react-dom'],
        },
      },
    },
  },
})
