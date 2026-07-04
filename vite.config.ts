import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serve em usuario.github.io/<repo>/ — só no build, dev server usa raiz
  base: command === 'build' ? '/RachaScore/' : '/',
}))
