import { MATCHES, VENUES, getCity, getMatch } from '../data/demo'
import type { LiveBroadcast } from '../state/live'
import type { Atmosphere, Broadcast, CityId, Match, Venue } from '../types'
import { statusOf } from './match'

export interface LatLng {
  lat: number
  lng: number
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function fmtKm(km: number): string {
  return km < 1 ? `${(Math.round(km * 10) / 10).toFixed(1)} km` : `${km.toFixed(1)} km`
}

export type Availability = 'open' | 'filling' | 'full'

export function availability(b: Pick<Broadcast, 'tablesLeft'>): { key: Availability; label: string } {
  if (b.tablesLeft === 0) return { key: 'full', label: 'Walk-in only' }
  if (b.tablesLeft <= 3) return { key: 'filling', label: `${b.tablesLeft} ${b.tablesLeft === 1 ? 'table' : 'tables'} left` }
  return { key: 'open', label: `${b.tablesLeft} tables free` }
}

export interface VenueRow {
  venue: Venue
  /** The broadcast for the selected match, or the venue's next broadcast. */
  broadcast?: LiveBroadcast
  match?: Match
  distance: number
}

export interface VenueFilters {
  dist: number // km, 0 = any
  sound: boolean
  avail: boolean
  verified: boolean
  vibes: Atmosphere[]
  sort: 'distance' | 'fans' | 'tables'
}

export const DEFAULT_VENUE_FILTERS: VenueFilters = {
  dist: 0,
  sound: false,
  avail: false,
  verified: false,
  vibes: [],
  sort: 'distance',
}

/** Next relevant broadcast at a venue: live first, then soonest upcoming. */
export function nextBroadcast(list: LiveBroadcast[], venueId: string, now: number, withinHours = 36): { b: LiveBroadcast; m: Match } | undefined {
  let best: { b: LiveBroadcast; m: Match } | undefined
  for (const b of list) {
    if (b.venueId !== venueId) continue
    const m = getMatch(b.matchId)!
    const st = statusOf(m, now)
    if (st === 'finished') continue
    if (m.start.getTime() - now > withinHours * 3_600_000) continue
    if (!best) best = { b, m }
    else {
      const bestLive = statusOf(best.m, now) === 'live'
      const live = st === 'live'
      if (live && !bestLive) best = { b, m }
      else if (live === bestLive && (b.sound && !best.b.sound ? true : m.start < best.m.start)) best = { b, m }
    }
  }
  return best
}

export function venueRows(list: LiveBroadcast[], city: CityId, origin: LatLng, now: number, matchId?: string): VenueRow[] {
  const venues = VENUES.filter((v) => v.city === city)
  if (matchId) {
    const match = getMatch(matchId)
    return list
      .filter((b) => b.matchId === matchId)
      .map((b) => ({ b, venue: VENUES.find((v) => v.id === b.venueId)! }))
      .filter(({ venue }) => venue.city === city)
      .map(({ b, venue }) => ({ venue, broadcast: b, match, distance: distanceKm(origin, venue) }))
  }
  return venues.map((venue) => {
    const nb = nextBroadcast(list, venue.id, now)
    return { venue, broadcast: nb?.b, match: nb?.m, distance: distanceKm(origin, venue) }
  })
}

export function filterRows(rows: VenueRow[], f: VenueFilters): VenueRow[] {
  const out = rows.filter((r) => {
    if (f.dist && r.distance > f.dist) return false
    if (f.vibes.length && !f.vibes.includes(r.venue.atmosphere)) return false
    if (f.sound && !r.broadcast?.sound) return false
    if (f.avail && !(r.broadcast && r.broadcast.tablesLeft > 0)) return false
    if (f.verified && r.broadcast?.listing !== 'venue') return false
    return true
  })
  const key = (r: VenueRow) =>
    f.sort === 'fans' ? -(r.broadcast?.fans ?? 0) : f.sort === 'tables' ? -(r.broadcast?.tablesLeft ?? -1) : r.distance
  return out.sort((a, b) => key(a) - key(b))
}

/** Upcoming games showing anywhere in a city — used by the map's game picker. */
export function gamesInCity(list: LiveBroadcast[], city: CityId, now: number): Match[] {
  const ids = new Set(
    list.filter((b) => VENUES.find((v) => v.id === b.venueId)?.city === city).map((b) => b.matchId),
  )
  return MATCHES.filter((m) => ids.has(m.id) && statusOf(m, now) !== 'finished')
}

export function cityCenter(city: CityId): LatLng {
  const c = getCity(city)
  return { lat: c.lat, lng: c.lng }
}

/** Upcoming broadcasts at a venue, soonest first. */
export function venueSchedule(list: LiveBroadcast[], venueId: string, now: number): { b: LiveBroadcast; m: Match }[] {
  return list
    .filter((b) => b.venueId === venueId)
    .map((b) => ({ b, m: getMatch(b.matchId)! }))
    .filter(({ m }) => statusOf(m, now) !== 'finished')
    .sort((x, y) => x.m.start.getTime() - y.m.start.getTime())
}

export const PRICE = ['', '₪', '₪₪', '₪₪₪'] as const
