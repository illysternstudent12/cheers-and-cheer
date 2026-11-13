import { useMemo, useState } from 'react'
import { LEAGUES, SPORTS, TEAMS } from '../data/demo'
import { norm, teamHay } from '../lib/search'
import { usePrefs } from '../state/prefs'
import type { SportId } from '../types'
import { Crest } from './Crest'
import { IconSearch, IconStar, SportIcon } from './Icons'

/** Grid of followable teams + leagues, grouped by league. */
export function TeamPicker({ compact = false }: { compact?: boolean }) {
  const { favTeams, favLeagues, toggleTeam, toggleLeague } = usePrefs()
  const [sport, setSport] = useState<SportId | ''>('')
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const nq = norm(q)
    return LEAGUES.filter((l) => !sport || l.sport === sport)
      .map((l) => ({
        league: l,
        teams: TEAMS.filter(
          (t) => t.league === l.id && (!nq || teamHay(t).some((h) => norm(h).includes(nq))),
        ),
      }))
      .filter((g) => g.teams.length || (!nq && !compact))
  }, [sport, q, compact])

  return (
    <div className="picker">
      <div className="picker-tools">
        <label className="picker-search">
          <IconSearch size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a team" aria-label="Find a team" />
        </label>
        <div className="chips" role="group" aria-label="Sport">
          <button className={`chip${sport === '' ? ' on' : ''}`} onClick={() => setSport('')}>
            All
          </button>
          {SPORTS.map((s) => (
            <button key={s.id} className={`chip${sport === s.id ? ' on' : ''}`} onClick={() => setSport(s.id)}>
              <SportIcon sport={s.id} size={15} />
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {groups.map(({ league, teams }) => {
        const following = favLeagues.includes(league.id)
        return (
          <section key={league.id} className="picker-group">
            <header className="picker-head">
              <span className="eyebrow">{league.name}</span>
              <button
                className={`follow-league${following ? ' on' : ''}`}
                onClick={() => toggleLeague(league.id)}
                aria-pressed={following}
              >
                {following ? 'Following league' : 'Follow league'}
              </button>
            </header>
            {teams.length > 0 && (
              <div className="picker-grid">
                {teams.map((t) => {
                  const on = favTeams.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      className={`team-tile${on ? ' on' : ''}`}
                      onClick={() => toggleTeam(t.id)}
                      aria-pressed={on}
                    >
                      <Crest team={t} size={34} />
                      <span className="team-tile-name">{t.name}</span>
                      <span className="team-tile-star" aria-hidden="true">
                        <IconStar size={16} filled={on} />
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
      {groups.length === 0 && <p className="muted">No team called “{q}” in the demo yet.</p>}
    </div>
  )
}
