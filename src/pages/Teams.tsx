import { Link } from 'react-router-dom'
import { Crest } from '../components/Crest'
import { IconX } from '../components/Icons'
import { MatchCard } from '../components/MatchCard'
import { TeamPicker } from '../components/TeamPicker'
import { MATCHES, getLeague, getTeam } from '../data/demo'
import { statusOf } from '../lib/match'
import { recommend } from '../lib/recommend'
import { fmtTime, relativeDay, useMinute } from '../lib/time'
import type { Match } from '../types'
import { usePrefs } from '../state/prefs'

export function Teams() {
  const prefs = usePrefs()
  const now = useMinute()
  const recs = recommend(prefs, now, 6)

  return (
    <div className="teams">
      <section className="games-hero">
        <div className="wrap">
          <p className="eyebrow">My teams</p>
          <h1 className="display display-sm">
            Your teams. <em>Your games.</em>
          </h1>
          <p className="lede">Follow clubs and leagues — we’ll line up their games and the bars showing them.</p>
        </div>
      </section>

      <div className="wrap">
        {prefs.favTeams.length > 0 && (
          <section className="band-tight">
            <p className="eyebrow">Following · {prefs.favTeams.length}</p>
            <ul className="following">
              {prefs.favTeams.map((id) => {
                const t = getTeam(id)
                if (!t) return null
                const next = MATCHES.find(
                  (m) => (m.home === id || m.away === id) && statusOf(m, now) !== 'finished',
                )
                return (
                  <li key={id} className="following-item">
                    <Link to={`/games?team=${id}`} className="following-link">
                      <Crest team={t} size={36} />
                      <span>
                        <strong>{t.name}</strong>
                        <small>{next ? nextLabel(next, id, now) : 'No games scheduled'}</small>
                      </span>
                    </Link>
                    <button className="icon-btn" onClick={() => prefs.toggleTeam(id)} aria-label={`Unfollow ${t.name}`}>
                      <IconX size={16} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {recs.length > 0 && (
          <section className="band-tight">
            <p className="eyebrow">Up next for you</p>
            <div className="grid-cards">
              {recs.map((r, i) => (
                <MatchCard key={r.match.id} match={r.match} reason={r.reason} index={i} />
              ))}
            </div>
          </section>
        )}

        <section className="band-tight">
          <p className="eyebrow">Add teams &amp; leagues</p>
          <TeamPicker />
        </section>
      </div>
    </div>
  )
}

function nextLabel(m: Match, teamId: string, now: number): string {
  const opp = getTeam(m.home === teamId ? m.away : m.home)
  const when = statusOf(m, now) === 'live' ? 'Live now' : `${relativeDay(m.start, now)} ${fmtTime(m.start)}`
  return `vs ${opp?.name ?? 'TBD'} · ${when} · ${getLeague(m.league).short}`
}
