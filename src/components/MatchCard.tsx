import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { getCity, getLeague, getTeam } from '../data/demo'
import { liveState, statusOf } from '../lib/match'
import { useShowing } from '../state/live'
import { fmtTime, relativeDay, useMinute } from '../lib/time'
import { usePrefs } from '../state/prefs'
import type { Match, Team } from '../types'
import { StatusPill } from './Countdown'
import { Crest, Monogram } from './Crest'
import { Field } from './Field'
import { IconPin, IconStar, SportIcon } from './Icons'

interface Props {
  match: Match
  variant?: 'row' | 'tile'
  reason?: string
  index?: number
  showDay?: boolean
}

export function MatchCard({ match, variant = 'row', reason, index = 0, showDay = true }: Props) {
  const now = useMinute()
  const { city, isFavTeam } = usePrefs()
  const status = statusOf(match, now)
  const live = liveState(match, now)
  const league = getLeague(match.league)
  const home = getTeam(match.home)
  const away = getTeam(match.away)
  const local = useShowing(match.id, city)
  const yours = isFavTeam(match.home) || isFavTeam(match.away)

  const sides: { team?: Team; label: string }[] =
    home && away
      ? [
          { team: home, label: home.name },
          { team: away, label: away.name },
        ]
      : match.participants
        ? match.participants.map((p) => ({ label: p }))
        : []

  return (
    <article
      className={`match-card match-${variant} is-${status}${yours ? ' is-yours' : ''}`}
      style={{ '--i': index } as CSSProperties}
    >
      <div className="mc-tv">
        <div className="mc-screen">
          <Field sport={match.sport} live={status === 'live'} colors={home && away ? [home.colors[0], away.colors[0]] : undefined} className="mc-field" />
          <header className="mc-head">
            <span className="mc-league">
              <SportIcon sport={match.sport} size={14} />
              {league.short}
              <span className="mc-stage"> · {match.stage.split(' · ')[0]}</span>
            </span>
            <StatusPill match={match} />
          </header>

          {sides.length ? (
            <ul className="mc-sides">
              {sides.map((s, i) => (
                <li key={i} className={`mc-side${s.team && isFavTeam(s.team.id) ? ' fav' : ''}`}>
                  {s.team ? <Crest team={s.team} size={26} /> : <Monogram label={s.label} size={26} />}
                  <span className="mc-name">{s.label === 'TBD' ? 'To be decided' : s.label}</span>
                  {s.team && isFavTeam(s.team.id) && <IconStar size={13} filled className="mc-favstar" />}
                  {live.score && <span className="mc-score">{live.score[i]}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mc-event">
              <span className="mc-event-title">{match.title}</span>
              {status === 'live' && <span className="mc-event-clock">{live.clock}</span>}
            </div>
          )}
          <span className="mc-glass" aria-hidden="true" />
        </div>
      </div>

      <footer className="mc-foot">
        <span className="mc-when">
          {showDay ? `${relativeDay(match.start, now)} · ` : ''}
          <strong>{fmtTime(match.start)}</strong>
        </span>
        {local ? (
          <span className="mc-where">
            <IconPin size={13} />
            {local.venues} bars in {getCity(city).name} · ~{local.fans} expected{local.confirmed ? ` · ${local.confirmed} confirmed` : ''}
          </span>
        ) : (
          <span className="mc-where muted">Not listed in {getCity(city).name} yet</span>
        )}
      </footer>

      {reason && <p className="mc-reason">{reason}</p>}

      <Link to={`/match/${match.id}`} className="stretched" aria-label={`Open ${sides.map((s) => s.label).join(' vs ') || match.title}`} />
    </article>
  )
}
