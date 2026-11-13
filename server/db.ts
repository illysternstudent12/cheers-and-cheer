import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/*
 * SQLite via Node's built-in driver. The schema is plain SQL with no
 * SQLite-only features beyond AUTOINCREMENT, so it moves to Postgres with
 * minimal changes when the pilot outgrows a single file.
 */

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  pw          TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'fan' CHECK (role IN ('fan','venue')),
  venue_id    TEXT,
  prefs       TEXT,
  seeded      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id      TEXT NOT NULL,
  match_id      TEXT NOT NULL,
  party_size    INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 12),
  tables_needed INTEGER NOT NULL,
  slot_offset   INTEGER NOT NULL,
  arrive_at     TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('confirmed','cancelled','checked_in','no_show')),
  note          TEXT,
  match_title   TEXT NOT NULL,
  match_start   TEXT NOT NULL,
  venue_name    TEXT NOT NULL,
  seeded        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  cancelled_at  TEXT,
  checked_in_at TEXT
);
CREATE INDEX IF NOT EXISTS bookings_venue_match ON bookings (venue_id, match_id, status);
CREATE INDEX IF NOT EXISTS bookings_user ON bookings (user_id);

CREATE TABLE IF NOT EXISTS going (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id    TEXT NOT NULL,
  venue_id    TEXT,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, match_id)
);

CREATE TABLE IF NOT EXISTS fav_venues (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id    TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, venue_id)
);

CREATE TABLE IF NOT EXISTS parties (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  host_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id    TEXT NOT NULL,
  venue_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  note        TEXT,
  match_title TEXT NOT NULL,
  match_start TEXT NOT NULL,
  venue_name  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS party_members (
  party_id    INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TEXT NOT NULL,
  PRIMARY KEY (party_id, user_id)
);

CREATE TABLE IF NOT EXISTS invites (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  party_id    INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  invited_by  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at  TEXT NOT NULL,
  UNIQUE (party_id, email)
);

CREATE TABLE IF NOT EXISTS broadcast_overrides (
  venue_id    TEXT NOT NULL,
  match_id    TEXT NOT NULL,
  screens     INTEGER NOT NULL,
  sound       INTEGER NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('verified','hidden')),
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (venue_id, match_id)
);

-- One-time codes a venue owner enters at sign-up to claim their venue.
CREATE TABLE IF NOT EXISTS venue_claims (
  code        TEXT PRIMARY KEY,
  venue_id    TEXT NOT NULL,
  used_by     INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS venue_settings (
  venue_id    TEXT PRIMARY KEY,
  tables      INTEGER NOT NULL,
  updated_at  TEXT NOT NULL
);
`

export type DB = DatabaseSync

export function openDb(file: string): DB {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(SCHEMA)
  return db
}

/** Run fn inside a transaction (node:sqlite has no helper). */
export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export const nowIso = () => new Date().toISOString()
