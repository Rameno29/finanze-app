import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Content-Security-Policy iniettata solo nella build di produzione:
// limita script, connessioni e iframe ai soli domini usati dall'app.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://boucbthrnddmnzcowafy.supabase.co https://www.googleapis.com https://gmail.googleapis.com https://accounts.google.com https://accounts.spotify.com https://api.spotify.com blob:",
  "frame-src https://www.youtube-nocookie.com https://open.spotify.com https://accounts.google.com",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "manifest-src 'self'",
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/finanze-app/',
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
      },
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'AJE',
        short_name: 'AJE',
        description: 'Gestione personale di finanze, documenti e buste paga',
        lang: 'it',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#03372f',
        theme_color: '#03372f',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
