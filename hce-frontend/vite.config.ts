import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // El dev server corre en Docker con el código montado desde Windows (bind-mount).
    // El watcher por inotify NO recibe los eventos del FS de Windows → HMR no refresca y
    // Vite sirve transforms stale. El polling fuerza la detección de cambios.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})