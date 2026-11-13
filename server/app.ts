import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import { BROADCASTS, getMatch, getVenue } from '../src/data/demo'
import { MAX_PARTY, SLOT_OFFSETS, makeCode, slotPlan, tablesFor } from '../src/lib/booking'
import { matchTitle } from '../src/lib/match'
import { type DB, nowIso, tx } from './db'

/* ===================================================================== */
/* Helpers                                                               */
/* ===================================================================== */

interface User {
  id: number
  email: string
  name: string
  role: 'fan' | 'venue'
  venue_id: string | null
  prefs: string | null
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User
  }
}

const COOKIE = 'cc_sid'
const SESSION_DAYS = 30

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const bad = (msg: string) => new HttpError(400, msg)

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`
}

function checkPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const a = Buffer.from(hash, 'hex')
  const b = scryptSync(pw, salt, 64)
  return a.length === b.length && timingSafeEqual(a, b)
}

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
}

const email = (v: unknown) => {
  const s = String(v ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 200) throw bad('Enter a valid email address.')
  return s
}
const text = (v: unknown, max: number, field: string, required = false) => {
  const s = String(v ?? '').trim()
  if (required && !s) throw bad(`${field} is required.`)
  if (s.length > max) throw bad(`${field} is too long.`)
  return s
}

function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, venueId: u.venue_id, prefs: u.prefs ? JSON.parse(u.prefs) : null }
}

/** Is this game shown at this venue right now (generated listing or owner-confirmed)? */
function broadcastFor(db: DB, venueId: string, matchId: string) {
  const ov = db.prepare('SELECT * FROM broadcast_overrides WHERE venue_id = ? AND match_id = ?').get(venueId, matchId) as
    | { status: string; screens: number; sound: number }
    | undefined
  const gen = BROADCASTS.find((b) => b.venueId === venueId && b.matchId === matchId)
  if (ov?.status === 'hidden') return undefined
  if (!gen && !ov) return undefined
  return { gen, ov }
}

function venueTables(db: DB, venueId: string): number {
  const s = db.prepare('SELECT tables FROM venue_settings WHERE venue_id = ?').get(venueId) as { tables: number } | undefined
  return s?.tables ?? getVenue(venueId)!.tables
}

function availability(db: DB, venueId: string, matchId: string) {
  const bc = broadcastFor(db, venueId, matchId)
  const v = getVenue(venueId)!
  const total = venueTables(db, venueId)
  const baseline = bc?.gen ? v.tables - bc.gen.tablesLeft : 0
  const rows = db
    .prepare(
      `SELECT slot_offset AS o, SUM(tables_needed) AS t FROM bookings
       WHERE venue_id = ? AND match_id = ? AND status IN ('confirmed','checked_in') AND seeded = 0
       GROUP BY slot_offset`,
    )
    .all(venueId, matchId) as { o: number; t: number }[]
  const real: Record<number, number> = {}
  for (const r of rows) real[r.o] = r.t
  return { plan: slotPlan(total, baseline, real), total, baseline, realTables: rows.reduce((n, r) => n + r.t, 0) }
}

/* ===================================================================== */
/* App                                                                   */
/* ===================================================================== */

export function createApi(db: DB, opts: { secureCookies?: boolean } = {}) {
  const api = express.Router()
  api.use(express.json({ limit: '32kb' }))

  // Mutations must be JSON — blocks cross-site form posts (CSRF) alongside SameSite cookies.
  api.use((req, _res, next) => {
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || !!req.headers['transfer-encoding']
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && hasBody && !req.is('application/json')) {
      return next(new HttpError(415, 'Expected JSON.'))
    }
    next()
  })

  // Session → req.user
  api.use((req, _res, next) => {
    const token = readCookie(req, COOKIE)
    if (token) {
      const row = db
        .prepare(
          `SELECT u.id, u.email, u.name, u.role, u.venue_id, u.prefs FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND s.expires_at > ?`,
        )
        .get(token, Date.now()) as User | undefined
      if (row) req.user = row
    }
    next()
  })

  const auth = (req: Request, _res: Response, next: NextFunction) =>
    req.user ? next() : next(new HttpError(401, 'Please sign in.'))
  const owner = (req: Request, _res: Response, next: NextFunction) =>
    req.user?.role === 'venue' && req.user.venue_id ? next() : next(new HttpError(403, 'Venue accounts only.'))

  const startSession = (res: Response, userId: number) => {
    const token = randomBytes(32).toString('hex')
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
      token,
      userId,
      Date.now() + SESSION_DAYS * 86_400_000,
    )
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: !!opts.secureCookies,
      path: '/',
      maxAge: SESSION_DAYS * 86_400_000,
    })
  }

  // Basic brute-force protection for sign-in.
  const attempts = new Map<string, { n: number; until: number }>()
  const throttle = (key: string) => {
    const a = attempts.get(key)
    if (a && a.until > Date.now() && a.n >= 8) throw new HttpError(429, 'Too many attempts. Try again in a few minutes.')
  }
  const fail = (key: string) => {
    const a = attempts.get(key)
    const fresh = !a || a.until < Date.now()
    attempts.set(key, { n: fresh ? 1 : a!.n + 1, until: Date.now() + 10 * 60_000 })
  }

  /* ------------------------------ auth -------------------------------- */

  api.get('/auth/me', (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null })
  })

  api.post('/auth/register', (req, res) => {
    const name = text(req.body.name, 60, 'Name', true)
    const em = email(req.body.email)
    const pw = String(req.body.password ?? '')
    if (pw.length < 8) throw bad('Use at least 8 characters for your password.')
    const claim = req.body.venueCode ? String(req.body.venueCode).trim().toUpperCase() : ''
    let role: 'fan' | 'venue' = 'fan'
    let venueId: string | null = null
    if (claim) {
      const hit = db.prepare('SELECT venue_id FROM venue_claims WHERE code = ? AND used_by IS NULL').get(claim) as
        | { venue_id: string }
        | undefined
      if (!hit) throw bad('That venue code isn’t valid or has already been used.')
      role = 'venue'
      venueId = hit.venue_id
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(em)) throw new HttpError(409, 'An account with this email already exists.')
    const r = db
      .prepare('INSERT INTO users (email, name, pw, role, venue_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(em, name, hashPassword(pw), role, venueId, nowIso())
    const id = Number(r.lastInsertRowid)
    if (claim) db.prepare('UPDATE venue_claims SET used_by = ? WHERE code = ?').run(id, claim)
    startSession(res, id)
    const u = db.prepare('SELECT id, email, name, role, venue_id, prefs FROM users WHERE id = ?').get(id) as unknown as User
    res.status(201).json({ user: publicUser(u) })
  })

  api.post('/auth/login', (req, res) => {
    const em = email(req.body.email)
    const key = `${req.ip}:${em}`
    throttle(key)
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(em) as (User & { pw: string }) | undefined
    if (!u || !checkPassword(String(req.body.password ?? ''), u.pw)) {
      fail(key)
      throw new HttpError(401, 'Email or password is incorrect.')
    }
    attempts.delete(key)
    startSession(res, u.id)
    res.json({ user: publicUser(u) })
  })

  api.post('/auth/logout', (req, res) => {
    const token = readCookie(req, COOKIE)
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    res.clearCookie(COOKIE, { path: '/' })
    res.json({ ok: true })
  })

  api.put('/me/prefs', auth, (req, res) => {
    const prefs = req.body.prefs
    const s = JSON.stringify({
      favTeams: Array.isArray(prefs?.favTeams) ? prefs.favTeams.slice(0, 100).map(String) : [],
      favLeagues: Array.isArray(prefs?.favLeagues) ? prefs.favLeagues.slice(0, 50).map(String) : [],
      city: String(prefs?.city ?? 'tel-aviv'),
    })
    db.prepare('UPDATE users SET prefs = ? WHERE id = ?').run(s, req.user!.id)
    res.json({ ok: true })
  })

  /* --------------------------- live feed ------------------------------ */
  // Real, user-generated activity the app layers on top of the demo data.

  api.get('/live', (req, res) => {
    const overrides = db.prepare('SELECT venue_id AS venueId, match_id AS matchId, screens, sound, status, updated_at AS updatedAt FROM broadcast_overrides').all()
    const going = db
      .prepare('SELECT match_id AS matchId, venue_id AS venueId, COUNT(*) AS n FROM going GROUP BY match_id, venue_id')
      .all() as { matchId: string; venueId: string | null; n: number }[]
    const booked = db
      .prepare(
        `SELECT venue_id AS venueId, match_id AS matchId, SUM(tables_needed) AS tables, SUM(party_size) AS guests
         FROM bookings WHERE status IN ('confirmed','checked_in') AND seeded = 0 GROUP BY venue_id, match_id`,
      )
      .all()
    const settings = db.prepare('SELECT venue_id AS venueId, tables FROM venue_settings').all()
    let mine = null
    if (req.user) {
      const uid = req.user.id
      mine = {
        going: db.prepare('SELECT match_id AS matchId, venue_id AS venueId FROM going WHERE user_id = ?').all(uid),
        favorites: (db.prepare('SELECT venue_id FROM fav_venues WHERE user_id = ?').all(uid) as { venue_id: string }[]).map((r) => r.venue_id),
        bookings: db
          .prepare(`SELECT code, venue_id AS venueId, match_id AS matchId, status FROM bookings WHERE user_id = ? AND status IN ('confirmed','checked_in')`)
          .all(uid),
      }
    }
    res.json({ overrides, going, booked, settings, mine, at: nowIso() })
  })

  /* --------------------------- availability --------------------------- */

  api.get('/availability/:venueId/:matchId', (req, res) => {
    const { venueId, matchId } = req.params
    if (!getVenue(venueId) || !getMatch(matchId)) throw new HttpError(404, 'Not found.')
    if (!broadcastFor(db, venueId, matchId)) return res.json({ showing: false, plan: [], total: 0 })
    const a = availability(db, venueId, matchId)
    res.json({ showing: true, ...a })
  })

  /* ----------------------------- bookings ----------------------------- */

  const bookingOut = (b: Record<string, unknown>) => ({
    id: b.id,
    code: b.code,
    venueId: b.venue_id,
    matchId: b.match_id,
    partySize: b.party_size,
    tables: b.tables_needed,
    slotOffset: b.slot_offset,
    arriveAt: b.arrive_at,
    status: b.status,
    note: b.note,
    matchTitle: b.match_title,
    matchStart: b.match_start,
    venueName: b.venue_name,
    createdAt: b.created_at,
    checkedInAt: b.checked_in_at,
    guestName: b.guest_name,
    seeded: !!b.seeded,
  })

  api.post('/bookings', auth, (req, res) => {
    const venueId = String(req.body.venueId ?? '')
    const matchId = String(req.body.matchId ?? '')
    const v = getVenue(venueId)
    const m = getMatch(matchId)
    if (!v || !m) throw bad('Unknown venue or game.')
    const party = Number(req.body.partySize)
    if (!Number.isInteger(party) || party < 1 || party > MAX_PARTY) throw bad(`Party size must be 1–${MAX_PARTY}.`)
    const offset = Number(req.body.slotOffset)
    if (!SLOT_OFFSETS.includes(offset as (typeof SLOT_OFFSETS)[number])) throw bad('Pick an arrival time.')
    const note = text(req.body.note, 280, 'Note')
    if (m.start.getTime() + m.durationMin * 60_000 < Date.now()) throw bad('This game has finished.')
    if (!broadcastFor(db, venueId, matchId)) throw bad('This venue isn’t showing that game.')

    const out = tx(db, () => {
      const dup = db
        .prepare(`SELECT code FROM bookings WHERE user_id = ? AND match_id = ? AND status = 'confirmed'`)
        .get(req.user!.id, matchId) as { code: string } | undefined
      if (dup) throw new HttpError(409, `You already have a table for this game (booking ${dup.code}). Cancel it first to book elsewhere.`)
      const need = tablesFor(party)
      const slot = availability(db, venueId, matchId).plan.find((s) => s.offset === offset)!
      if (slot.left < need) throw new HttpError(409, 'Sorry — that arrival time just filled up. Pick another slot.')
      let code = makeCode(() => randomInt(0, 1_000_000) / 1_000_000)
      while (db.prepare('SELECT 1 FROM bookings WHERE code = ?').get(code)) code = makeCode(() => randomInt(0, 1_000_000) / 1_000_000)
      const arrive = new Date(m.start.getTime() + offset * 60_000).toISOString()
      const r = db
        .prepare(
          `INSERT INTO bookings (code, user_id, venue_id, match_id, party_size, tables_needed, slot_offset, arrive_at, status, note,
             match_title, match_start, venue_name, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)`,
        )
        .run(code, req.user!.id, venueId, matchId, party, need, offset, arrive, note || null, matchTitle(m), m.start.toISOString(), v.name, nowIso())
      // Booking implies going.
      db.prepare(
        `INSERT INTO going (user_id, match_id, venue_id, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (user_id, match_id) DO UPDATE SET venue_id = excluded.venue_id`,
      ).run(req.user!.id, matchId, venueId, nowIso())
      return db.prepare('SELECT * FROM bookings WHERE id = ?').get(Number(r.lastInsertRowid)) as Record<string, unknown>
    })
    res.status(201).json({ booking: bookingOut(out) })
  })

  api.get('/me/bookings', auth, (req, res) => {
    const rows = db.prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY match_start DESC').all(req.user!.id) as Record<string, unknown>[]
    res.json({ bookings: rows.map(bookingOut) })
  })

  api.get('/bookings/:code', auth, (req, res) => {
    const b = db
      .prepare('SELECT b.*, u.name AS guest_name FROM bookings b JOIN users u ON u.id = b.user_id WHERE code = ?')
      .get(String(req.params.code).toUpperCase()) as Record<string, unknown> | undefined
    const mineOrVenue = b && (b.user_id === req.user!.id || (req.user!.role === 'venue' && req.user!.venue_id === b.venue_id))
    if (!b || !mineOrVenue) throw new HttpError(404, 'Booking not found.')
    res.json({ booking: bookingOut(b) })
  })

  api.post('/bookings/:code/cancel', auth, (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE code = ? AND user_id = ?').get(String(req.params.code).toUpperCase(), req.user!.id) as
      | Record<string, unknown>
      | undefined
    if (!b) throw new HttpError(404, 'Booking not found.')
    if (b.status !== 'confirmed') throw bad('Only confirmed bookings can be cancelled.')
    db.prepare(`UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ?`).run(nowIso(), b.id as number)
    res.json({ booking: bookingOut({ ...b, status: 'cancelled' }) })
  })

  /* ---------------------------- I'm going ---------------------------- */

  api.post('/going', auth, (req, res) => {
    const matchId = String(req.body.matchId ?? '')
    if (!getMatch(matchId)) throw bad('Unknown game.')
    const venueId = req.body.venueId ? String(req.body.venueId) : null
    if (venueId && !broadcastFor(db, venueId, matchId)) throw bad('That venue isn’t showing this game.')
    db.prepare(
      `INSERT INTO going (user_id, match_id, venue_id, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, match_id) DO UPDATE SET venue_id = excluded.venue_id`,
    ).run(req.user!.id, matchId, venueId, nowIso())
    res.json({ ok: true })
  })

  api.delete('/going/:matchId', auth, (req, res) => {
    db.prepare('DELETE FROM going WHERE user_id = ? AND match_id = ?').run(req.user!.id, String(req.params.matchId))
    res.json({ ok: true })
  })

  /** Fans going to a game — first names only, never emails. */
  api.get('/going/:matchId', (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.name, g.venue_id AS venueId FROM going g JOIN users u ON u.id = g.user_id
         WHERE g.match_id = ? ORDER BY g.created_at DESC LIMIT 50`,
      )
      .all(String(req.params.matchId)) as { name: string; venueId: string | null }[]
    res.json({ fans: rows.map((r) => ({ name: r.name.split(' ')[0], venueId: r.venueId })) })
  })

  /* ---------------------------- favourites ---------------------------- */

  api.post('/favorites/:venueId', auth, (req, res) => {
    if (!getVenue(req.params.venueId as string)) throw new HttpError(404, 'Unknown venue.')
    db.prepare('INSERT OR IGNORE INTO fav_venues (user_id, venue_id, created_at) VALUES (?, ?, ?)').run(req.user!.id, req.params.venueId as string, nowIso())
    res.json({ ok: true })
  })
  api.delete('/favorites/:venueId', auth, (req, res) => {
    db.prepare('DELETE FROM fav_venues WHERE user_id = ? AND venue_id = ?').run(req.user!.id, req.params.venueId as string)
    res.json({ ok: true })
  })

  /* --------------------------- watch parties -------------------------- */

  const partyOut = (p: Record<string, unknown>, viewer?: User) => {
    const members = db
      .prepare(
        `SELECT u.id, u.name FROM party_members pm JOIN users u ON u.id = pm.user_id WHERE pm.party_id = ? ORDER BY pm.joined_at`,
      )
      .all(p.id as number) as { id: number; name: string }[]
    const host = db.prepare('SELECT name FROM users WHERE id = ?').get(p.host_id as number) as { name: string }
    return {
      slug: p.slug,
      title: p.title,
      note: p.note,
      matchId: p.match_id,
      venueId: p.venue_id,
      matchTitle: p.match_title,
      matchStart: p.match_start,
      venueName: p.venue_name,
      host: host.name.split(' ')[0],
      isHost: viewer?.id === p.host_id,
      joined: !!viewer && members.some((m) => m.id === viewer.id),
      members: members.map((m) => m.name.split(' ')[0]),
      invites:
        viewer?.id === p.host_id
          ? db.prepare('SELECT email, status FROM invites WHERE party_id = ? ORDER BY created_at DESC').all(p.id as number)
          : undefined,
    }
  }

  api.post('/parties', auth, (req, res) => {
    const matchId = String(req.body.matchId ?? '')
    const venueId = String(req.body.venueId ?? '')
    const m = getMatch(matchId)
    const v = getVenue(venueId)
    if (!m || !v) throw bad('Unknown venue or game.')
    if (!broadcastFor(db, venueId, matchId)) throw bad('That venue isn’t showing this game.')
    const title = text(req.body.title, 80, 'Title', true)
    const note = text(req.body.note, 400, 'Note')
    const slug = randomBytes(6).toString('base64url')
    const r = db
      .prepare(
        `INSERT INTO parties (slug, host_id, match_id, venue_id, title, note, match_title, match_start, venue_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(slug, req.user!.id, matchId, venueId, title, note || null, matchTitle(m), m.start.toISOString(), v.name, nowIso())
    const pid = Number(r.lastInsertRowid)
    db.prepare('INSERT INTO party_members (party_id, user_id, joined_at) VALUES (?, ?, ?)').run(pid, req.user!.id, nowIso())
    db.prepare(
      `INSERT INTO going (user_id, match_id, venue_id, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, match_id) DO UPDATE SET venue_id = excluded.venue_id`,
    ).run(req.user!.id, matchId, venueId, nowIso())
    const p = db.prepare('SELECT * FROM parties WHERE id = ?').get(pid) as Record<string, unknown>
    res.status(201).json({ party: partyOut(p, req.user) })
  })

  const findParty = (slug: string) => {
    const p = db.prepare('SELECT * FROM parties WHERE slug = ?').get(slug) as Record<string, unknown> | undefined
    if (!p) throw new HttpError(404, 'Watch party not found.')
    return p
  }

  api.get('/parties/:slug', (req, res) => {
    res.json({ party: partyOut(findParty(req.params.slug as string), req.user) })
  })

  api.post('/parties/:slug/join', auth, (req, res) => {
    const p = findParty(req.params.slug as string)
    db.prepare('INSERT OR IGNORE INTO party_members (party_id, user_id, joined_at) VALUES (?, ?, ?)').run(p.id as number, req.user!.id, nowIso())
    db.prepare(`UPDATE invites SET status = 'accepted' WHERE party_id = ? AND email = ?`).run(p.id as number, req.user!.email)
    db.prepare(
      `INSERT INTO going (user_id, match_id, venue_id, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, match_id) DO UPDATE SET venue_id = excluded.venue_id`,
    ).run(req.user!.id, p.match_id as string, p.venue_id as string, nowIso())
    res.json({ party: partyOut(p, req.user) })
  })

  api.post('/parties/:slug/leave', auth, (req, res) => {
    const p = findParty(req.params.slug as string)
    if (p.host_id === req.user!.id) throw bad('Hosts can’t leave their own party.')
    db.prepare('DELETE FROM party_members WHERE party_id = ? AND user_id = ?').run(p.id as number, req.user!.id)
    res.json({ party: partyOut(p, req.user) })
  })

  /** In-app invitation: shows up for that email when they sign in. No email is sent. */
  api.post('/parties/:slug/invite', auth, (req, res) => {
    const p = findParty(req.params.slug as string)
    const isMember = db.prepare('SELECT 1 FROM party_members WHERE party_id = ? AND user_id = ?').get(p.id as number, req.user!.id)
    if (!isMember) throw new HttpError(403, 'Join the party to invite friends.')
    const em = email(req.body.email)
    db.prepare('INSERT OR IGNORE INTO invites (party_id, email, invited_by, created_at) VALUES (?, ?, ?, ?)').run(p.id as number, em, req.user!.id, nowIso())
    res.json({ party: partyOut(p, req.user) })
  })

  api.get('/me/community', auth, (req, res) => {
    const uid = req.user!.id
    const parties = (
      db
        .prepare(`SELECT p.* FROM parties p JOIN party_members pm ON pm.party_id = p.id WHERE pm.user_id = ? ORDER BY p.match_start`)
        .all(uid) as Record<string, unknown>[]
    ).map((p) => partyOut(p, req.user))
    const invites = db
      .prepare(
        `SELECT i.id, p.slug, p.title, p.match_title AS matchTitle, p.match_start AS matchStart, p.venue_name AS venueName, u.name AS fromName
         FROM invites i JOIN parties p ON p.id = i.party_id JOIN users u ON u.id = i.invited_by
         WHERE i.email = ? AND i.status = 'pending' ORDER BY i.created_at DESC`,
      )
      .all(req.user!.email) as Record<string, unknown>[]
    const going = db.prepare('SELECT match_id AS matchId, venue_id AS venueId FROM going WHERE user_id = ?').all(uid)
    const favorites = (db.prepare('SELECT venue_id FROM fav_venues WHERE user_id = ? ORDER BY created_at DESC').all(uid) as { venue_id: string }[]).map(
      (r) => r.venue_id,
    )
    res.json({ parties, invites: invites.map((i) => ({ ...i, fromName: String(i.fromName).split(' ')[0] })), going, favorites })
  })

  api.post('/invites/:id/decline', auth, (req, res) => {
    db.prepare(`UPDATE invites SET status = 'declined' WHERE id = ? AND email = ?`).run(Number(req.params.id), req.user!.email)
    res.json({ ok: true })
  })

  /* ====================== venue owners (Batch 4) ====================== */

  const venueOf = (req: Request) => getVenue(req.user!.venue_id!)!

  api.get('/owner/venue', auth, owner, (req, res) => {
    const v = venueOf(req)
    res.json({ venueId: v.id, tables: venueTables(db, v.id) })
  })

  api.get('/owner/broadcasts', auth, owner, (req, res) => {
    res.json({
      overrides: db.prepare('SELECT match_id AS matchId, screens, sound, status, updated_at AS updatedAt FROM broadcast_overrides WHERE venue_id = ?').all(venueOf(req).id),
    })
  })

  api.put('/owner/broadcasts/:matchId', auth, owner, (req, res) => {
    const v = venueOf(req)
    const m = getMatch(req.params.matchId as string)
    if (!m) throw new HttpError(404, 'Unknown game.')
    const status = req.body.status === 'hidden' ? 'hidden' : 'verified'
    const screens = Math.round(Number(req.body.screens))
    if (!Number.isFinite(screens) || screens < 1 || screens > v.screens) throw bad(`Screens must be between 1 and ${v.screens}.`)
    const sound = req.body.sound ? 1 : 0
    tx(db, () => {
      // One soundtrack per room: turning sound on here mutes overlapping games.
      if (sound) {
        const s = m.start.getTime()
        const e = s + m.durationMin * 60_000
        const others = db.prepare(`SELECT match_id FROM broadcast_overrides WHERE venue_id = ? AND sound = 1 AND match_id != ?`).all(v.id, m.id) as {
          match_id: string
        }[]
        for (const o of others) {
          const om = getMatch(o.match_id)
          if (om && om.start.getTime() < e && om.start.getTime() + om.durationMin * 60_000 > s) {
            db.prepare('UPDATE broadcast_overrides SET sound = 0, updated_at = ? WHERE venue_id = ? AND match_id = ?').run(nowIso(), v.id, o.match_id)
          }
        }
      }
      db.prepare(
        `INSERT INTO broadcast_overrides (venue_id, match_id, screens, sound, status, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (venue_id, match_id) DO UPDATE SET screens = excluded.screens, sound = excluded.sound, status = excluded.status, updated_at = excluded.updated_at`,
      ).run(v.id, m.id, screens, sound, status, nowIso())
    })
    res.json({ ok: true })
  })

  api.delete('/owner/broadcasts/:matchId', auth, owner, (req, res) => {
    db.prepare('DELETE FROM broadcast_overrides WHERE venue_id = ? AND match_id = ?').run(venueOf(req).id, req.params.matchId as string)
    res.json({ ok: true })
  })

  api.put('/owner/settings', auth, owner, (req, res) => {
    const v = venueOf(req)
    const tables = Math.round(Number(req.body.tables))
    if (!Number.isFinite(tables) || tables < 0 || tables > 200) throw bad('Tables must be between 0 and 200.')
    db.prepare(
      `INSERT INTO venue_settings (venue_id, tables, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (venue_id) DO UPDATE SET tables = excluded.tables, updated_at = excluded.updated_at`,
    ).run(v.id, tables, nowIso())
    res.json({ ok: true, tables })
  })

  api.get('/owner/bookings', auth, owner, (req, res) => {
    const v = venueOf(req)
    const where = req.query.matchId ? 'AND b.match_id = ?' : ''
    const args: string[] = [v.id]
    if (req.query.matchId) args.push(String(req.query.matchId))
    const rows = db
      .prepare(
        `SELECT b.*, u.name AS guest_name FROM bookings b JOIN users u ON u.id = b.user_id
         WHERE b.venue_id = ? ${where} ORDER BY b.match_start DESC, b.arrive_at`,
      )
      .all(...args) as Record<string, unknown>[]
    res.json({ bookings: rows.map(bookingOut) })
  })

  api.get('/owner/availability/:matchId', auth, owner, (req, res) => {
    const v = venueOf(req)
    if (!getMatch(req.params.matchId as string)) throw new HttpError(404, 'Unknown game.')
    res.json(availability(db, v.id, req.params.matchId as string))
  })

  api.post('/owner/checkin', auth, owner, (req, res) => {
    const v = venueOf(req)
    const code = String(req.body.code ?? '').trim().toUpperCase()
    const b = db
      .prepare('SELECT b.*, u.name AS guest_name FROM bookings b JOIN users u ON u.id = b.user_id WHERE code = ?')
      .get(code) as Record<string, unknown> | undefined
    if (!b) throw new HttpError(404, `No booking with code ${code}.`)
    if (b.venue_id !== v.id) throw new HttpError(409, `Booking ${code} is for ${b.venue_name}, not ${v.name}.`)
    if (b.status === 'cancelled') throw new HttpError(409, `Booking ${code} was cancelled by the guest.`)
    if (b.status === 'checked_in') return res.json({ booking: bookingOut(b), already: true })
    db.prepare(`UPDATE bookings SET status = 'checked_in', checked_in_at = ? WHERE id = ?`).run(nowIso(), b.id as number)
    res.json({ booking: bookingOut({ ...b, status: 'checked_in', checked_in_at: nowIso() }), already: false })
  })

  api.post('/owner/bookings/:code/no-show', auth, owner, (req, res) => {
    const v = venueOf(req)
    const r = db
      .prepare(`UPDATE bookings SET status = 'no_show' WHERE code = ? AND venue_id = ? AND status = 'confirmed'`)
      .run(String(req.params.code).toUpperCase(), v.id)
    if (!r.changes) throw bad('Only confirmed bookings can be marked as no-show.')
    res.json({ ok: true })
  })

  api.get('/owner/analytics', auth, owner, (req, res) => {
    const v = venueOf(req)
    const rows = db
      .prepare('SELECT user_id, party_size, status, match_start, match_title, seeded, created_at FROM bookings WHERE venue_id = ?')
      .all(v.id) as { user_id: number; party_size: number; status: string; match_start: string; match_title: string; seeded: number; created_at: string }[]
    const active = rows.filter((r) => r.status !== 'cancelled')
    const past = active.filter((r) => new Date(r.match_start).getTime() < Date.now())
    const attended = rows.filter((r) => r.status === 'checked_in')
    const visits = new Map<number, number>()
    for (const r of attended) visits.set(r.user_id, (visits.get(r.user_id) ?? 0) + 1)
    const guests = visits.size
    const repeat = [...visits.values()].filter((n) => n > 1).length

    const days: { day: string; bookings: number; covers: number; attended: number }[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = -13; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      // Local calendar day (not UTC), matching how the venue reads its week.
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const local = (iso: string) => {
        const x = new Date(iso)
        x.setHours(0, 0, 0, 0)
        return x.getTime() === d.getTime()
      }
      const list = active.filter((r) => local(r.match_start))
      days.push({
        day: key,
        bookings: list.length,
        covers: list.reduce((n, r) => n + r.party_size, 0),
        attended: list.filter((r) => r.status === 'checked_in').length,
      })
    }
    const byMatch = new Map<string, { title: string; covers: number; bookings: number }>()
    for (const r of active) {
      const k = r.match_title + r.match_start
      const cur = byMatch.get(k) ?? { title: r.match_title, covers: 0, bookings: 0 }
      cur.covers += r.party_size
      cur.bookings += 1
      byMatch.set(k, cur)
    }
    res.json({
      totals: {
        bookings: active.length,
        covers: active.reduce((n, r) => n + r.party_size, 0),
        cancelled: rows.length - active.length,
        attended: attended.length,
        // Of bookings whose game has started, how many guests actually showed up.
        attendanceRate: past.length ? past.filter((r) => r.status === 'checked_in').length / past.length : null,
        guests,
        repeatGuests: repeat,
        repeatRate: guests ? repeat / guests : null,
      },
      seededCount: rows.filter((r) => r.seeded).length,
      days,
      topGames: [...byMatch.values()].sort((a, b) => b.covers - a.covers).slice(0, 5),
    })
  })

  /* ------------------------------ errors ------------------------------ */

  api.use((_req, _res, next) => next(new HttpError(404, 'Not found.')))
  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message })
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Malformed JSON.' })
    console.error('[api]', err)
    res.status(500).json({ error: 'Something went wrong on our side.' })
  })

  return api
}

/** Express app wrapper (used by the dev plugin and the production server). */
export function createApp(db: DB, opts: { secureCookies?: boolean } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.use('/api', createApi(db, opts))
  return app
}
