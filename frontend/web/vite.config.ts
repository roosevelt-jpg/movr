import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import http from 'http'

const BOT_UA =
  /bot|crawl|slurp|spider|facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Discordbot|SkypeUriPreview|Slackbot|embedly|quora link preview|showyoubot|outbrain|pinterest|vkShare|W3C_Validator|redditbot|Applebot|Google-InspectionTool/i

function storeRefFromUrl(url?: string) {
  if (!url) return null
  const pathOnly = url.split('?')[0] || ''
  const m = pathOnly.match(/^\/store\/([^/]+)\/?$/)
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

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
    {
      name: 'store-share-og-for-bots',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const ref = storeRefFromUrl(req.url)
          const ua = String(req.headers['user-agent'] || '')
          if (!ref || !BOT_UA.test(ua)) return next()
          const target = `http://127.0.0.1:3000/api/v1/public/stores/${encodeURIComponent(ref)}/og`
          http
            .get(target, (upstream) => {
              res.statusCode = upstream.statusCode || 200
              const type = upstream.headers['content-type'] || 'text/html; charset=utf-8'
              res.setHeader('content-type', type)
              upstream.pipe(res)
            })
            .on('error', () => next())
        })
      },
    },
  ],
  appType: 'spa',
  resolve: {
    alias: {
      '@movr/format': path.resolve(__dirname, '../../design-system/format.ts'),
      '@movr/design-system/theme': path.resolve(__dirname, '../../design-system/theme.ts'),
      '@movr/design-system/ThemeProvider': path.resolve(
        __dirname,
        '../../design-system/ThemeProvider.tsx'
      ),
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
})
