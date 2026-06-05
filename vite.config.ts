import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      base: '/2klondike/',
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'manifest.webmanifest'],
      manifest: {
        name: 'Double Klondike',
        short_name: '2 Klondike',
        description: 'Double Klondike solitaire.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#1b5e20',
        theme_color: '#1b5e20',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  base: '/2klondike/', // this is the repo name
})
