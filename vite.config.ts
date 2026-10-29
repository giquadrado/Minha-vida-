import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // o link da agenda e os modelos para baixar não podem cair na página do app
      workbox: { navigateFallbackDenylist: [new RegExp('^/api/'), new RegExp('^/modelos/')] },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Minha Faculdade',
        short_name: 'Faculdade',
        description: 'Faltas, notas, grade horária e progresso do curso',
        theme_color: '#080b1a',
        background_color: '#080b1a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
