import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4444',
        changeOrigin: true,
        timeout: 60000,
        proxyTimeout: 60000,
      }
    }
  },
});
