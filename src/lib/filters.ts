import { MATCHES, getTeam } from '../data/demo'
import type { CityId, Match, SportId } from '../types'
import { showingIn, statusOf } from './match'
import { matchQuery } from './search'
import { dayDiff, startOfDay } from './time'

export type DateFilter = 'all' | 'live' | 'today' | 'tomorrow' | 'weekend' | 'week' | `d:${string}`

export interface Filters {
  q: string
  sport: SportId | ''
  date: DateFilter
  league: string
  team: string
  city: CityId | ''
}

export function dayKey(d: Date): string {
  const x = startOfDay(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Saturday + Sunday of the current week (or today if it is already the weekend). */
function isWeekend(d: Date, now: number): boolean {
  const diff = dayDiff(d, now)
  if (diff < 0 || diff > 6) return false
  const dow = d.getDay()
  return dow === 6 || dow === 0 || (dow === 5 && d.getHours() >= 17)
}

export function passDate(m: Match, f: DateFilter, now: number): boolean {
  const status = statusOf(m, now)
  const diff = dayDiff(m.start, now)
  switch (f) {
    case 'all':
      return status !== 'finished' || diff === 0
    case 'live':
      return status === 'live'
    case 'today':
      return diff === 0 || status === 'live'
    case 'tomorrow':
      return diff === 1
    case 'weekend':
      return isWeekend(m.start, now)
    case 'week':
      return diff >= 0 && diff < 7 && status !== 'finished'
    default:
      return dayKey(m.start) === f.slice(2)
  }
}

export function applyFilters(f: Filters, now: number): Match[] {
  return MATCHES.filter((m) => {
    if (f.sport && m.sport !== f.sport) return false
    if (f.league && m.league !== f.league) return false
    if (f.team && m.home !== f.team && m.away !== f.team) return false
    if (f.city && !showingIn(m, f.city)) return false
    if (!passDate(m, f.date, now)) return false
    if (f.q && !matchQuery(m, f.q)) return false
    return true
  })
}

export function describeTeam(id: string): string {
  return getTeam(id)?.name ?? id
}
