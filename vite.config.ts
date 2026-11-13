import react from '@vitejs/plugin-react'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { createApp } from './server/app'
import { openDb } from './server/db'
import { seed } from './server/seed'

/** Serves the API from the Vite dev server, so `npm run dev` is all you need. */
function api(): Plugin {
  return {
    name: 'cheers-api',
    configureServer(server) {
      const db = openDb(process.env.DB_FILE ?? join(import.meta.dirname, 'data', 'cheers.db'))
      if (seed(db)) server.config.logger.info('[db] seeded demo data')
      const app = createApp(db)
      server.middlewares.use((req, res, next) => (req.url?.startsWith('/api/') ? app(req as never, res as never, next) : next()))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), api()],
})
