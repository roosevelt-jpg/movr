import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const rootDir = path.resolve(__dirname, '../..');

function normalizeApiBase(raw: string | undefined): string {
  let base = String(raw || '').trim().replace(/\/$/, '');
  if (!base) return '/api/v1';
  if (/^https?:\/\/[^/]+$/i.test(base)) {
    return `${base}/api/v1`;
  }
  return base;
}

export default defineConfig(({ mode }) => {
  // Load monorepo root .env so REACT_APP_* / VITE_* are available.
  const env = loadEnv(mode, rootDir, '');
  // In Vite dev, always use same-origin `/api/v1` (proxied). Absolute
  // `http://localhost:3000/...` from root .env breaks when the admin is opened
  // on 127.0.0.1 (and host-only URLs omit /api/v1 → "Route not found").
  const apiUrl =
    mode === 'development'
      ? '/api/v1'
      : normalizeApiBase(
          env.REACT_APP_API_URL ||
            env.VITE_API_URL ||
            process.env.REACT_APP_API_URL ||
            process.env.VITE_API_URL
        );

  return {
    plugins: [react()],
    base: '/admin/',
    envDir: rootDir,
    envPrefix: ['VITE_', 'REACT_APP_'],
    resolve: {
      alias: {
        '@movr/format': path.resolve(__dirname, '../../design-system/format.ts'),
        '@movr/design-system/theme': path.resolve(__dirname, '../../design-system/theme.ts'),
        '@movr/design-system': path.resolve(__dirname, '../../design-system/theme.ts'),
      },
    },
    define: {
      // CRA-style env used across admin pages (must be a full expression replacement)
      'process.env.REACT_APP_API_URL': JSON.stringify(apiUrl),
      'process.env.VITE_API_URL': JSON.stringify(apiUrl),
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
        '/assets': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
