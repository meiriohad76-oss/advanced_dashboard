import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Atlas backend host port. Defaults to 8100 so the dev proxy doesn't collide with the
// local ratings extractor ("email article analyzer"), which serves on :8000. Override
// with ATLAS_PORT to match a custom `uvicorn --port`.
const apiPort = process.env.ATLAS_PORT ?? '8100'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: { '/api': `http://127.0.0.1:${apiPort}` },
  },
})
