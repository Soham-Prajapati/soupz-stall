import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DAEMON_PORT = process.env.SOUPZ_REMOTE_PORT || '7533';
const DAEMON_TARGET = `http://localhost:${DAEMON_PORT}`;
const REACT_PATH = resolve(__dirname, 'node_modules/react');
const REACT_DOM_PATH = resolve(__dirname, 'node_modules/react-dom');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react': REACT_PATH,
      'react/jsx-runtime': resolve(REACT_PATH, 'jsx-runtime.js'),
      'react/jsx-dev-runtime': resolve(REACT_PATH, 'jsx-dev-runtime.js'),
      'react-dom': REACT_DOM_PATH,
      'react-dom/client': resolve(REACT_DOM_PATH, 'client.js'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'],
    preserveSymlinks: true,
  },
  server: {
    host: true,
    port: 5173,
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
