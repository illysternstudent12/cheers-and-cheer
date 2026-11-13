/**
 * Production server: serves the built app (dist/) and the API from one process.
 *   npm run build && npm start
 */
import express from 'express'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createApp } from './app'
import { openDb } from './db'
import { seed } from './seed'

const root = resolve(import.meta.dirname, '..')
const db = openDb(process.env.DB_FILE ?? join(root, 'data', 'cheers.db'))
if (seed(db)) console.log('[db] seeded demo data')

const app = createApp(db, { secureCookies: process.env.COOKIE_SECURE === '1' })
const dist = join(root, 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')))
}
const port = Number(process.env.PORT ?? 8787)
app.listen(port, () => console.log(`[cheers] http://localhost:${port}`))
