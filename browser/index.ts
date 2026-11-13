/*
 * The Cheers & Cheer API running inside the visitor's browser.
 *
 * The GitHub Pages build has no server, so this runs the real server code
 * (server/app.ts, db.ts, seed.ts) on sql.js, through small stand-ins for
 * Express and node:crypto. Each visitor gets a private copy of the demo
 * database, saved in their own browser's localStorage.
 */
import './crypto'
import { createApp } from '../server/app'
import { openDb } from '../server/db'
import { seed } from '../server/seed'
import type { ShimReq } from './express'
import { DatabaseSync, loadSqlite } from './sqlite'

const DB_KEY = 'cc-browser-db-v1'
const SID_KEY = 'cc-browser-sid'
/** The schedule is relative to "now", so a saved copy goes stale; start fresh after this long. */
const FRESH_FOR = 12 * 3_600_000

type Handler = (req: ShimReq, res: unknown, done: (err?: unknown) => void) => void

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* private mode or full: the session still works until the tab closes */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

let booted: Promise<{ app: Handler; db: DatabaseSync }> | undefined

function boot() {
  booted ??= (async () => {
    await loadSqlite()
    let db: DatabaseSync | undefined
    try {
      const saved = JSON.parse(store.get(DB_KEY) ?? 'null') as { at: number; data: string } | null
      if (saved && Date.now() - saved.at < FRESH_FOR) {
        db = new DatabaseSync(':memory:', fromB64(saved.data))
        db.exec('PRAGMA foreign_keys = ON')
      }
    } catch {
      db = undefined
    }
    if (!db) {
      store.del(SID_KEY)
      db = openDb(':memory:') as unknown as DatabaseSync
      seed(db as never)
      save(db)
    }
    return { app: createApp(db as never) as unknown as Handler, db }
  })()
  return booted
}

function save(db: DatabaseSync) {
  store.set(DB_KEY, JSON.stringify({ at: Date.now(), data: toB64(db.raw.export()) }))
  db.exec('PRAGMA foreign_keys = ON')
}

export async function request(method: string, path: string, body?: unknown): Promise<{ status: number; data: unknown }> {
  const { app, db } = await boot()
  const [pathname, qs = ''] = path.split('?')
  const sid = store.get(SID_KEY)
  const payload = body === undefined ? {} : JSON.parse(JSON.stringify(body))

  const result = await new Promise<{ status: number; data: unknown }>((resolve) => {
    const req: ShimReq = {
      method,
      path: '/api' + pathname,
      query: Object.fromEntries(new URLSearchParams(qs)),
      params: {},
      headers: {
        ...(sid ? { cookie: `cc_sid=${encodeURIComponent(sid)}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json', 'content-length': String(JSON.stringify(body).length) }),
      },
      body: payload,
      ip: 'browser',
      is: (t: string) => t === 'application/json',
    }
    const res = {
      statusCode: 200,
      status(n: number) {
        this.statusCode = n
        return this
      },
      json(data: unknown) {
        resolve({ status: this.statusCode, data: JSON.parse(JSON.stringify(data ?? null)) })
      },
      cookie(_name: string, value: string) {
        store.set(SID_KEY, value)
      },
      clearCookie() {
        store.del(SID_KEY)
      },
    }
    app(req, res, (err) => resolve(err ? { status: 500, data: { error: 'Something went wrong.' } } : { status: 404, data: { error: 'Not found.' } }))
  })

  if (method !== 'GET' && result.status < 400) save(db)
  return result
}
