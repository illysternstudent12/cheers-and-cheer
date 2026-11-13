import { useMemo, useSyncExternalStore } from 'react'
import { api, type LiveFeed } from '../api/client'
import { BROADCASTS, VENUES, getMatch } from '../data/demo'
import type { Broadcast, CityId, Showing } from '../types'

/*
 * Real activity from the server (venue confirmations, RSVPs, bookings),
 * layered over the generated demo listings. Everything here is labelled by
 * source so simulated numbers are never presented as verified.
 */

const EMPTY: LiveFeed = { overrides: [], going: [], booked: [], settings: [], mine: null, at: '' }
let state: LiveFeed = EMPTY
let version = 0
const subs = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined
let inflight: Promise<void> | null = null

export function refreshLive(): Promise<void> {
  if (inflight) return inflight
  inflight = api<LiveFeed>('GET', '/live')
    .then((d) => {
      state = d
      version++
      subs.forEach((s) => s())
    })
    .catch(() => {
      /* offline: keep last known state */
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

function subscribe(cb: () => void) {
  subs.add(cb)
  if (!timer) {
    void refreshLive()
    timer = setInterval(refreshLive, 30_000)
    window.addEventListener('focus', onFocus)
  }
  return () => {
    subs.delete(cb)
    if (!subs.size && timer) {
      clearInterval(timer)
      timer = undefined
      window.removeEventListener('focus', onFocus)
    }
  }
}
const onFocus = () => void refreshLive()

export function useLive(): LiveFeed {
  return useSyncExternalStore(subscribe, () => state)
}

/** A broadcast with its source made explicit. */
export interface LiveBroadcast extends Broadcast {
  /** 'venue' = confirmed by the venue owner in their dashboard; 'demo' = generated listing */
  listing: 'venue' | 'demo'
  /** Real fans who said "I'm going" here (or booked) */
  confirmed: number
  updatedAt?: string
}

const venueById = new Map(VENUES.map((v) => [v.id, v]))

export function mergeBroadcasts(feed: LiveFeed): LiveBroadcast[] {
  const ov = new Map(feed.overrides.map((o) => [`${o.venueId}:${o.matchId}`, o]))
  const booked = new Map(feed.booked.map((b) => [`${b.venueId}:${b.matchId}`, b]))
  const going = new Map(feed.going.filter((g) => g.venueId).map((g) => [`${g.venueId}:${g.matchId}`, g.n]))
  const tables = new Map(feed.settings.map((s) => [s.venueId, s.tables]))

  const out: LiveBroadcast[] = []
  const seen = new Set<string>()
  const build = (b: Broadcast | undefined, venueId: string, matchId: string): LiveBroadcast | undefined => {
    const key = `${venueId}:${matchId}`
    const o = ov.get(key)
    if (o?.status === 'hidden') return undefined
    const v = venueById.get(venueId)
    if (!v) return undefined
    const total = tables.get(venueId) ?? v.tables
    const baselineBooked = b ? v.tables - b.tablesLeft : 0
    const realTables = booked.get(key)?.tables ?? 0
    return {
      matchId,
      venueId,
      screens: o?.screens ?? b?.screens ?? 1,
      mainScreen: o ? !!o.sound : (b?.mainScreen ?? false),
      sound: o ? !!o.sound : (b?.sound ?? false),
      status: o ? 'verified' : (b?.status ?? 'reported'),
      verifiedMinAgo: o ? Math.max(0, Math.round((Date.now() - Date.parse(o.updatedAt)) / 60_000)) : (b?.verifiedMinAgo ?? 0),
      fans: b?.fans ?? 0,
      tablesLeft: Math.max(0, total - baselineBooked - realTables),
      watchParty: b?.watchParty,
      listing: o ? 'venue' : 'demo',
      confirmed: going.get(key) ?? 0,
      updatedAt: o?.updatedAt,
    }
  }
  for (const b of BROADCASTS) {
    const key = `${b.venueId}:${b.matchId}`
    seen.add(key)
    const m = build(b, b.venueId, b.matchId)
    if (m) out.push(m)
  }
  // Games a venue added itself.
  for (const o of feed.overrides) {
    const key = `${o.venueId}:${o.matchId}`
    if (seen.has(key) || !getMatch(o.matchId)) continue
    const m = build(undefined, o.venueId, o.matchId)
    if (m) out.push(m)
  }
  return out
}

let cache: { v: number; list: LiveBroadcast[] } | null = null
function merged(feed: LiveFeed): LiveBroadcast[] {
  if (!cache || cache.v !== version) cache = { v: version, list: mergeBroadcasts(feed) }
  return cache.list
}

export function useBroadcasts(): LiveBroadcast[] {
  const feed = useLive()
  return merged(feed)
}

/** Per-city showing summary from the merged list. */
export function showingsOf(list: LiveBroadcast[], matchId: string): (Showing & { confirmed: number })[] {
  const agg = new Map<CityId, Showing & { confirmed: number }>()
  for (const b of list) {
    if (b.matchId !== matchId) continue
    const city = venueById.get(b.venueId)!.city
    const cur = agg.get(city) ?? { city, venues: 0, fans: 0, confirmed: 0 }
    cur.venues++
    cur.fans += b.fans
    cur.confirmed += b.confirmed
    agg.set(city, cur)
  }
  return [...agg.values()]
}

export function useShowing(matchId: string, city: CityId) {
  const list = useBroadcasts()
  return useMemo(() => showingsOf(list, matchId).find((s) => s.city === city), [list, matchId, city])
}

/** Real "I'm going" total for a game (all venues + undecided). */
export function useGoingCount(matchId: string): number {
  const feed = useLive()
  return feed.going.filter((g) => g.matchId === matchId).reduce((n, g) => n + g.n, 0)
}
