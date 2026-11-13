/**
 * Seed data for local development and demos.
 *
 * TEST ACCOUNTS (localhost only — not real credentials):
 *   Venue owners   owner+copper-tap@cheers.test        password: PilotOwner!2026
 *                  owner+north-stand@cheers.test       password: PilotOwner!2026
 *                  owner+half-time-social@cheers.test  password: PilotOwner!2026
 *   Fan            fan@cheers.test                     password: PilotFan!2026
 *
 * Every other venue can be claimed by registering with its claim code
 * (CLAIM-<VENUE-ID>, e.g. CLAIM-CORNER-FLAG).
 *
 * Seeded bookings are flagged `seeded = 1` and shown as "Demo" in the venue
 * dashboard so they're never confused with real reservations.
 */
import { randomBytes } from 'node:crypto'
import { MATCHES, VENUES } from '../src/data/demo'
import { matchTitle } from '../src/lib/match'
import { hashPassword } from './app'
import { type DB, nowIso, tx } from './db'

export const OWNER_PASSWORD = 'PilotOwner!2026'
export const FAN_PASSWORD = 'PilotFan!2026'
const OWNED = ['copper-tap', 'north-stand', 'half-time-social']

const DEMO_FANS = ['Noa Levi', 'Itay Cohen', 'Maya Friedman', 'Omer Katz', 'Shira Ben-David', 'Yoni Peretz', 'Tamar Golan', 'Daniel Mizrahi', 'Lior Avraham', 'Gal Shapira']

const PAST_GAMES = [
  'Maccabi Tel Aviv vs Maccabi Haifa',
  'Arsenal vs Liverpool',
  'FC Barcelona vs Atlético Madrid',
  'Maccabi Tel Aviv BC vs Olympiacos',
  'Hapoel Tel Aviv vs Beitar Jerusalem',
  'Manchester City vs Chelsea',
  'Real Madrid vs Sevilla',
  'Inter vs Juventus',
  'Panathinaikos vs Maccabi Tel Aviv BC',
  'Liverpool vs Manchester United',
]

export function seed(db: DB) {
  const has = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }
  if (has.n > 0) return false

  // Simple seeded RNG so the demo history is stable.
  let s = 42
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const code = () => randomBytes(4).toString('hex').slice(0, 6).toUpperCase().replace(/[01IO]/g, 'X')

  tx(db, () => {
    const ins = db.prepare('INSERT INTO users (email, name, pw, role, venue_id, seeded, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
    for (const id of OWNED) {
      const v = VENUES.find((x) => x.id === id)!
      ins.run(`owner+${id}@cheers.test`, `${v.name} team`, hashPassword(OWNER_PASSWORD), 'venue', id, nowIso())
    }
    ins.run('fan@cheers.test', 'Alex Demo', hashPassword(FAN_PASSWORD), 'fan', null, nowIso())

    for (const v of VENUES) {
      if (OWNED.includes(v.id)) continue
      db.prepare('INSERT INTO venue_claims (code, venue_id) VALUES (?, ?)').run(`CLAIM-${v.id.toUpperCase()}`, v.id)
    }

    // Demo fans can't sign in (random password) — they only exist to give the dashboard history.
    const fanIds: number[] = []
    for (const [i, name] of DEMO_FANS.entries()) {
      const res = ins.run(`demo.fan${i + 1}@cheers.test`, name, hashPassword(randomBytes(16).toString('hex')), 'fan', null, nowIso())
      fanIds.push(Number(res.lastInsertRowid))
    }

    const book = db.prepare(
      `INSERT INTO bookings (code, user_id, venue_id, match_id, party_size, tables_needed, slot_offset, arrive_at, status, note,
         match_title, match_start, venue_name, seeded, created_at, checked_in_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1, ?, ?)`,
    )

    for (const vid of OWNED) {
      const v = VENUES.find((x) => x.id === vid)!
      // Past two weeks: a mix of attended, no-shows and cancellations; some fans come back.
      for (let d = 13; d >= 1; d--) {
        if (r() < 0.35) continue
        const start = new Date()
        start.setDate(start.getDate() - d)
        start.setHours(r() < 0.5 ? 21 : 19, r() < 0.5 ? 0 : 45, 0, 0)
        const title = PAST_GAMES[Math.floor(r() * PAST_GAMES.length)]
        const n = 2 + Math.floor(r() * 6)
        for (let k = 0; k < n; k++) {
          const fan = fanIds[Math.floor(r() * (r() < 0.6 ? 4 : fanIds.length))] // a few regulars
          const party = 1 + Math.floor(r() * 6)
          const roll = r()
          const status = roll < 0.74 ? 'checked_in' : roll < 0.88 ? 'no_show' : 'cancelled'
          const offset = [-90, -60, -30, 0][Math.floor(r() * 4)]
          const arrive = new Date(start.getTime() + offset * 60_000).toISOString()
          const created = new Date(start.getTime() - (1 + r() * 4) * 86_400_000).toISOString()
          book.run(code(), fan, vid, `past-${d}-${k}`, party, Math.ceil(party / 4), offset, arrive, status, title, start.toISOString(), v.name, created, status === 'checked_in' ? arrive : null)
        }
      }
      // A few upcoming demo reservations for tonight's big game, so check-in can be tried.
      const tonight = MATCHES.find((m) => m.id === 'rma-bar')!
      for (let k = 0; k < 4; k++) {
        const party = 2 + k
        const offset = [-90, -60, -30, 0][k]
        book.run(
          code(),
          fanIds[k],
          vid,
          tonight.id,
          party,
          Math.ceil(party / 4),
          offset,
          new Date(tonight.start.getTime() + offset * 60_000).toISOString(),
          'confirmed',
          matchTitle(tonight),
          tonight.start.toISOString(),
          v.name,
          nowIso(),
          null,
        )
      }
    }
  })
  return true
}
