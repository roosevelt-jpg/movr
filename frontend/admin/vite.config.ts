import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  resolve: {
    alias: {
      '@movr/format': path.resolve(__dirname, '../../design-system/format.ts'),
      '@movr/design-system/theme': path.resolve(__dirname, '../../design-system/theme.ts'),
      '@movr/design-system': path.resolve(__dirname, '../../design-system/theme.ts'),
    },
  },
  define: {
    'process.env.REACT_APP_API_URL': JSON.stringify(
      process.env.REACT_APP_API_URL ||
        process.env.VITE_API_URL ||
        '/api/v1'
    ),
  },
  server: {
    port: 3002,
    strictPort: false,
    host: '127.0.0.1',
    fs: {
      allow: [path.resolve(__dirname, '../..')],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
