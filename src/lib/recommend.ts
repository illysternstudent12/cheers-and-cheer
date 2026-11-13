import { MATCHES, getLeague, getTeam } from '../data/demo'
import type { CityId, Match } from '../types'
import { showingIn, statusOf } from './match'

export interface Recommendation {
  match: Match
  reason: string
  score: number
}

interface Prefs {
  favTeams: string[]
  favLeagues: string[]
  city: CityId
}

/**
 * Ranks upcoming and live games for the fan.
 * Signals, strongest first: a followed team plays, a followed league,
 * the league/sport of a followed team, then timing and local crowd size.
 */
export function recommend(prefs: Prefs, now: number, limit = 6): Recommendation[] {
  const favTeams = new Set(prefs.favTeams)
  const favLeagues = new Set(prefs.favLeagues)
  const teamLeagues = new Set(prefs.favTeams.map((id) => getTeam(id)?.league).filter(Boolean))
  const teamSports = new Set(prefs.favTeams.map((id) => getTeam(id)?.sport).filter(Boolean))

  const out: Recommendation[] = []
  for (const m of MATCHES) {
    const status = statusOf(m, now)
    if (status === 'finished') continue

    let score = 0
    let reason = ''
    const followed = [m.home, m.away].map(getTeam).find((t) => t && favTeams.has(t.id))
    if (followed) {
      score += 100
      reason = `You follow ${followed.name}`
    } else if (favLeagues.has(m.league)) {
      score += 45
      reason = `You follow ${getLeague(m.league).name}`
    } else if (teamLeagues.has(m.league)) {
      score += 25
      reason = `${getLeague(m.league).name}, like your teams`
    } else if (teamSports.has(m.sport)) {
      score += 8
    }
    if (score === 0) continue

    const hoursAway = (m.start.getTime() - now) / 3_600_000
    if (status === 'live') score += 20
    else if (hoursAway < 6) score += 12
    else if (hoursAway < 48) score += 6
    else score -= Math.min(15, hoursAway / 24)

    const local = showingIn(m, prefs.city)
    if (local) score += Math.min(12, local.fans / 40)

    if (!reason) reason = local && local.fans > 150 ? 'Big crowd near you' : 'Popular with fans like you'
    out.push({ match: m, reason, score })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Fallback when the fan hasn't picked teams yet: biggest local crowds. */
export function trending(city: CityId, now: number, limit = 6): Match[] {
  return MATCHES.filter((m) => statusOf(m, now) !== 'finished' && m.start.getTime() - now < 4 * 86_400_000)
    .map((m) => ({ m, fans: showingIn(m, city)?.fans ?? 0 }))
    .sort((a, b) => b.fans - a.fans)
    .slice(0, limit)
    .map((x) => x.m)
}
