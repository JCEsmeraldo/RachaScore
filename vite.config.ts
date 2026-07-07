import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  // GitHub Pages serve em usuario.github.io/<repo>/ — só no build, dev server usa raiz
  const base = command === 'build' ? '/RachaScore/' : '/'

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // autoUpdate: ativa a versão nova sozinho em background (sem prompt),
        // evita usuário ficar preso numa build velha do service worker
        registerType: 'autoUpdate',
        base,
        manifest: {
          id: base,
          name: 'RachaScore',
          short_name: 'RachaScore',
          description: 'Organiza rachas de futebol e vôlei do seu grupo de amigos',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          start_url: base,
          scope: base,
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        },
      }),
    ],
  }
})
