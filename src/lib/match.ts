import { getCity, getLeague, getTeam } from '../data/demo'
import type { CityId, Match, MatchStatus, Team } from '../types'

export function statusOf(m: Match, now: number): MatchStatus {
  const start = m.start.getTime()
  if (now < start) return 'upcoming'
  if (now < start + m.durationMin * 60_000) return 'live'
  return 'finished'
}

export function progress(m: Match, now: number): number {
  const p = (now - m.start.getTime()) / (m.durationMin * 60_000)
  return Math.min(1, Math.max(0, p))
}

/** Human title: "Real Madrid vs FC Barcelona", or the event title. */
export function matchTitle(m: Match): string {
  const h = getTeam(m.home)
  const a = getTeam(m.away)
  if (h && a) return `${h.name} vs ${a.name}`
  if (m.participants && m.participants[0] !== 'TBD') return `${m.participants[0]} vs ${m.participants[1]}`
  return m.title ?? 'Event'
}

export function matchTeams(m: Match): Team[] {
  return [getTeam(m.home), getTeam(m.away)].filter((x): x is Team => !!x)
}

export function leagueName(m: Match): string {
  return getLeague(m.league).name
}

export function showingIn(m: Match, city: CityId) {
  return m.showings.find((s) => s.city === city)
}

export function totalFans(m: Match): number {
  return m.showings.reduce((n, s) => n + s.fans, 0)
}

export function totalVenues(m: Match): number {
  return m.showings.reduce((n, s) => n + s.venues, 0)
}

export function cityNames(m: Match): string[] {
  return m.showings.map((s) => getCity(s.city).name)
}

/* ------------------------------------------------------------------ */
/* Simulated live state (demo only)                                    */
/* ------------------------------------------------------------------ */

export interface LiveState {
  score: [number, number] | null
  clock: string
}

/** Deterministic pseudo-progress of the pre-set final score. */
function scoreAt(m: Match, p: number): [number, number] {
  const ease = (x: number, offset: number) => {
    // Points/goals arrive unevenly but monotonically.
    const shifted = Math.min(1, Math.max(0, (x - offset) / (1 - offset)))
    return shifted
  }
  const seed = m.id.length % 5
  const h = Math.floor(m.final[0] * ease(p, 0.04 * seed) + 1e-9)
  const a = Math.floor(m.final[1] * ease(p, 0.06 * ((seed + 2) % 5)) + 1e-9)
  return [Math.min(h, m.final[0]), Math.min(a, m.final[1])]
}

export function liveState(m: Match, now: number): LiveState {
  const status = statusOf(m, now)
  if (status === 'upcoming') return { score: null, clock: '' }
  const p = status === 'finished' ? 1 : progress(m, now)
  const elapsed = Math.floor((now - m.start.getTime()) / 60_000)

  switch (m.sport) {
    case 'football': {
      const score = scoreAt(m, p)
      if (status === 'finished') return { score, clock: 'Full time' }
      // ~115 min of real time: 45 + 15 break + 45 + stoppage
      if (elapsed < 47) return { score, clock: `${Math.max(1, elapsed)}'` }
      if (elapsed < 62) return { score, clock: 'Half time' }
      return { score, clock: `${Math.min(90, elapsed - 15)}'` }
    }
    case 'basketball': {
      const score = scoreAt(m, p)
      if (status === 'finished') return { score, clock: 'Final' }
      const q = Math.min(4, Math.floor(p * 4) + 1)
      const left = Math.max(0, Math.round(12 - ((p * 4) % 1) * 12))
      return { score, clock: `Q${q} · ${left}:00` }
    }
    case 'american-football': {
      const score = scoreAt(m, p)
      if (status === 'finished') return { score, clock: 'Final' }
      return { score, clock: `Q${Math.min(4, Math.floor(p * 4) + 1)}` }
    }
    case 'tennis': {
      const sets = scoreAt(m, p)
      if (status === 'finished') return { score: sets, clock: 'Final' }
      return { score: sets, clock: `Set ${Math.min(3, sets[0] + sets[1] + 1)}` }
    }
    case 'motorsport': {
      if (status === 'finished') return { score: null, clock: 'Chequered flag' }
      return { score: null, clock: `Lap ${Math.max(1, Math.round(p * 50))}/50` }
    }
  }
}
