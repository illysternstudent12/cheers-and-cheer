import { CITIES, LEAGUES, MATCHES, SPORTS, TEAMS, getLeague, getTeam } from '../data/demo'
import type { City, League, Match, Sport, Team } from '../types'
import { matchTitle } from './match'

/** Lower-case and strip accents so "barca" finds "Barça" and "clasico" finds "Clásico". */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function matches(hay: string[], q: string): number {
  // 3 = prefix of a field, 2 = prefix of a word, 1 = substring, 0 = no match
  let best = 0
  for (const raw of hay) {
    const h = norm(raw)
    if (!h) continue
    if (h.startsWith(q)) return 3
    if (h.split(' ').some((w) => w.startsWith(q))) best = Math.max(best, 2)
    else if (h.includes(q)) best = Math.max(best, 1)
  }
  return best
}

export function teamHay(t: Team): string[] {
  return [t.name, t.short, t.city, ...(t.aliases ?? [])]
}

export function matchHay(m: Match): string[] {
  const teams = [getTeam(m.home), getTeam(m.away)].flatMap((t) => (t ? teamHay(t) : []))
  const l = getLeague(m.league)
  return [
    matchTitle(m),
    m.title ?? '',
    ...(m.participants ?? []),
    ...teams,
    l.name,
    l.short,
    m.stage,
    ...(m.aliases ?? []),
  ]
}

/** Every query term must hit the match somewhere ("maccabi euroleague"). */
export function matchQuery(m: Match, query: string): number {
  const terms = norm(query).split(' ').filter(Boolean)
  if (!terms.length) return 1
  const whole = matches(matchHay(m), norm(query))
  if (whole) return whole + 1
  let score = 0
  for (const term of terms) {
    const s = matches(matchHay(m), term)
    if (!s) return 0
    score += s
  }
  return score / terms.length
}

export interface Suggestions {
  matches: Match[]
  teams: Team[]
  leagues: League[]
  sports: Sport[]
  cities: City[]
}

export function suggest(query: string, now: number): Suggestions {
  const q = norm(query)
  if (!q) return { matches: [], teams: [], leagues: [], sports: [], cities: [] }

  const rank = <T,>(items: T[], hay: (x: T) => string[], n: number) =>
    items
      .map((x) => ({ x, s: matches(hay(x), q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, n)
      .map((r) => r.x)

  const upcoming = MATCHES.filter((m) => m.start.getTime() + m.durationMin * 60_000 > now)
  const matchHits = upcoming
    .map((m) => ({ m, s: matchQuery(m, query) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.m.start.getTime() - b.m.start.getTime())
    .slice(0, 4)
    .map((r) => r.m)

  return {
    matches: matchHits,
    teams: rank(TEAMS, teamHay, 4),
    leagues: rank(LEAGUES, (l) => [l.name, l.short, l.region], 3),
    sports: rank(SPORTS, (s) => [s.name, s.noun], 2),
    cities: rank(CITIES, (c) => [c.name, c.country], 3),
  }
}

export const POPULAR_SEARCHES = ['El Clásico', 'Maccabi Tel Aviv', 'Champions League', 'NBA', 'Tel Aviv derby']
