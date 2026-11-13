import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { createApp } from './server/app'
import { openDb } from './server/db'
import { seed } from './server/seed'

const here = (p: string) => join(import.meta.dirname, p)

/** Serves the API from the Vite dev server, so `npm run dev` is all you need. */
function api(): Plugin {
  return {
    name: 'cheers-api',
    configureServer(server) {
      const db = openDb(process.env.DB_FILE ?? here('data/cheers.db'))
      if (seed(db)) server.config.logger.info('[db] seeded demo data')
      const app = createApp(db)
      server.middlewares.use((req, res, next) => (req.url?.startsWith('/api/') ? app(req as never, res as never, next) : next()))
    },
  }
}

/**
 * `virtual:browser-api` is the API running in the browser (browser/index.ts).
 * Only the GitHub Pages build (`--mode pages`) includes it; other builds get a stub.
 */
function browserApi(pages: boolean): Plugin {
  const STUB = '\0browser-api-stub'
  return {
    name: 'cheers-browser-api',
    resolveId(id) {
      if (id === 'virtual:browser-api') return pages ? here('browser/index.ts') : STUB
    },
    load(id) {
      if (id === STUB) return 'export async function request() { throw new Error("no in-browser API in this build") }'
    },
    // GitHub Pages serves 404.html for unknown paths: let the app route deep links itself.
    closeBundle() {
      if (pages) copyFileSync(here('dist/index.html'), here('dist/404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const pages = mode === 'pages'
  return {
    base: pages ? '/cheers-and-cheer/' : '/',
    plugins: [react(), api(), browserApi(pages)],
    resolve: pages
      ? {
          alias: {
            express: here('browser/express.ts'),
            'node:crypto': here('browser/crypto.ts'),
            'node:sqlite': here('browser/sqlite.ts'),
            'node:fs': here('browser/node-stubs.ts'),
            'node:path': here('browser/node-stubs.ts'),
          },
        }
      : undefined,
  }
})
