import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spa-root-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/' || req.url === '') {
            req.url = '/index.html'
          }
          next()
        })
      },
    },
  ],
  appType: 'spa',
  resolve: {
    alias: {
      '@movr/format': path.resolve(__dirname, '../../design-system/format.ts'),
      '@movr/design-system/theme': path.resolve(__dirname, '../../design-system/theme.ts'),
      '@movr/design-system/assets': path.resolve(__dirname, '../../design-system/assets'),
      '@movr/design-system/components': path.resolve(__dirname, '../../design-system/components'),
      '@movr/design-system': path.resolve(__dirname, '../../design-system/theme.ts'),
    },
  },
  define: {
    // CRA-style env used by web sources; Vite runs in the browser without Node `process`
    'process.env.REACT_APP_API_URL': JSON.stringify(
      process.env.REACT_APP_API_URL ||
        process.env.VITE_API_URL ||
        // Same-origin /api via Vite proxy avoids CORS during local dev
        '/api/v1'
    ),
  },
  server: {
    port: 5180,
    strictPort: true,
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
})
