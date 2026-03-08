import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7534,
    proxy: {
      '/stall-state.json': {
        target: 'http://localhost:7533', // Future: server could serve this
        changeOrigin: true
      }
    }
  }
})
