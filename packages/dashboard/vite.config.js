import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DAEMON_PORT = process.env.SOUPZ_REMOTE_PORT || '7533';
const DAEMON_TARGET = `http://localhost:${DAEMON_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 7534,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    proxy: {
      '/api': { target: DAEMON_TARGET, changeOrigin: true },
      '/health': { target: DAEMON_TARGET, changeOrigin: true },
      '/command': { target: DAEMON_TARGET, changeOrigin: true },
      '/pair': { target: DAEMON_TARGET, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco': ['@monaco-editor/react'],
          'supabase': ['@supabase/supabase-js'],
          'vendor': ['react', 'react-dom'],
          'charts': ['recharts'],
          'icons': ['lucide-react'],
          'motion': ['framer-motion'],
        },
      },
    },
  },
})
