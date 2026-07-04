import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serve em usuario.github.io/<repo>/ — ajustar se o nome do repo mudar
  base: '/RachaScore/',
})
