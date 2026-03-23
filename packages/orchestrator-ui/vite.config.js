import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:7533',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:7533',
        changeOrigin: true,
      },
      '/pair': {
        target: 'http://localhost:7533',
        changeOrigin: true,
      },
      '/terminals': {
        target: 'http://localhost:7533',
        changeOrigin: true,
      },
    },
  },
});
