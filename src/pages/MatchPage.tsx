import type { CSSProperties } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BigCountdown, StatusPill } from '../components/Countdown'
import { Crest, Monogram } from '../components/Crest'
import { IconArrowLeft, IconPin, IconStar, IconTv, IconUsers, SportIcon } from '../components/Icons'
import { VenueCard } from '../components/VenueCard'
import { useOrigin } from '../lib/origin'
import { DEFAULT_VENUE_FILTERS, filterRows, venueRows } from '../lib/venues'
import { MatchCard } from '../components/MatchCard'
import { MATCHES, getCity, getLeague, getTeam } from '../data/demo'
import { liveState, matchTitle, statusOf } from '../lib/match'
import { fmtTime, relativeDay, useNow } from '../lib/time'
import { showingsOf, useBroadcasts, useGoingCount } from '../state/live'
import { GoingButton } from '../components/Social'
import { usePrefs } from '../state/prefs'
import type { Team } from '../types'
import { NotFound } from './NotFound'

export function MatchPage() {
  const { id } = useParams()
  const match = MATCHES.find((m) => m.id === id)
  const now = useNow()
  const prefs = usePrefs()
  const nav = useNavigate()
  const origin = useOrigin()
  const list = useBroadcasts()
  const going = useGoingCount(match?.id ?? '')

  if (!match) return <NotFound what="game" />

  const league = getLeague(match.league)
  const home = getTeam(match.home)
  const away = getTeam(match.away)
  const status = statusOf(match, now)
  const live = liveState(match, now)

  const showings = showingsOf(list, match.id).sort((a, b) =>
    a.city === prefs.city ? -1 : b.city === prefs.city ? 1 : b.fans - a.fans,
  )
  const maxFans = Math.max(...showings.map((s) => s.fans))
  const more = MATCHES.filter(
    (m) => m.league === match.league && m.id !== match.id && statusOf(m, now) !== 'finished',
  ).slice(0, 3)

  const hasSides = (home && away) || match.participants
  const local = filterRows(venueRows(list, prefs.city, origin, now, match.id), { ...DEFAULT_VENUE_FILTERS, sort: 'fans' })

  return (
    <div className="matchpage">
      <section className="mh">
        <div className="wrap">
          <button className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/games'))}>
            <IconArrowLeft size={18} /> Back
          </button>

          <div className="mh-arch">
            <p className="eyebrow mh-eyebrow">
              <SportIcon sport={match.sport} size={15} /> {league.name} · {match.stage}
            </p>

            {hasSides ? (
              <div className="mh-versus">
                <Side team={home} label={match.participants?.[0] ?? ''} />
                <div className="mh-mid">
                  {live.score ? (
                    <p className={`mh-score${status === 'live' ? ' is-live' : ''}`}>
                      {live.score[0]}
                      <span>–</span>
                      {live.score[1]}
                    </p>
                  ) : (
                    <p className="mh-vs">vs</p>
                  )}
                  <StatusPill match={match} />
                </div>
                <Side team={away} label={match.participants?.[1] ?? ''} />
              </div>
            ) : (
              <div className="mh-event">
                <h1 className="display display-sm">{match.title}</h1>
                <StatusPill match={match} />
              </div>
            )}

            {hasSides && <h1 className="sr-only">{matchTitle(match)}</h1>}

            {status === 'upcoming' && <BigCountdown match={match} />}

            {status !== 'finished' && (
              <div className="mh-going">
                <GoingButton matchId={match.id} />
                <span className="muted">
                  {going > 0 ? (
                    <>
                      <b>{going}</b> {going === 1 ? 'fan has' : 'fans have'} said they’re going
                    </>
                  ) : (
                    'Be the first to say you’re going'
                  )}
                </span>
              </div>
            )}

            <ul className="mh-facts">
              <li>
                <span className="fact-k">Starts</span>
                <span className="fact-v">
                  {relativeDay(match.start, now)} · {fmtTime(match.start)}
                </span>
              </li>
              <li>
                <span className="fact-k">
                  <IconTv size={14} /> On TV
                </span>
                <span className="fact-v">{match.broadcast}</span>
              </li>
              <li>
                <span className="fact-k">
                  <IconUsers size={14} /> Expected
                </span>
                <span className="fact-v" title="Demo estimate across all listed bars">
                  ~{showings.reduce((n, s) => n + s.fans, 0).toLocaleString('en-GB')}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <header className="sect-head">
            <div>
              <p className="eyebrow">Where to watch · {getCity(prefs.city).name}</p>
              <h2 className="h2">
                {local.length} {local.length === 1 ? 'bar' : 'bars'} <em>showing it.</em>
              </h2>
            </div>
            {local.length > 0 && (
              <Link to={`/map?match=${match.id}&view=map`} className="btn btn-primary btn-sm">
                <IconPin size={16} /> Open the map
              </Link>
            )}
          </header>
          {local.length ? (
            <>
              <div className="grid-cards">
                {local.slice(0, 3).map((r, i) => (
                  <VenueCard key={r.venue.id} row={r} index={i} originLabel={origin.label} />
                ))}
              </div>
              {local.length > 3 && (
                <p>
                  <Link to={`/map?match=${match.id}`} className="see-all">
                    See all {local.length} bars in {getCity(prefs.city).name} →
                  </Link>
                </p>
              )}
            </>
          ) : (
            <p className="muted">No bar in {getCity(prefs.city).name} has listed this game yet.</p>
          )}
        </div>
      </section>

      <section className="band">
        <div className="wrap where">
          <div>
            <p className="eyebrow">Around the world</p>
            <h2 className="h2">
              {showings.reduce((n, s) => n + s.venues, 0)} bars, <em>{showings.length} cities.</em>
            </h2>
            <p className="muted">Travelling? Pick a city to see its bars on the map.</p>
          </div>
          <ul className="cities">
            {showings.map((s, i) => {
              const c = getCity(s.city)
              const mine = s.city === prefs.city
              return (
                <li key={s.city} className={`city-row${mine ? ' mine' : ''}`} style={{ '--i': i } as CSSProperties}>
                  <Link
                    to={`/map?match=${match.id}`}
                    onClick={() => prefs.setCity(s.city)}
                    className="city-row-link"
                  >
                    <div className="city-row-top">
                      <span className="city-name">
                        <IconPin size={15} /> {c.name}
                        {mine && <span className="badge">Your city</span>}
                      </span>
                      <span className="city-stat">
                        <b>{s.venues}</b> bars · ~<b>{s.fans}</b> expected{s.confirmed ? ` · ${s.confirmed} confirmed` : ''}
                      </span>
                    </div>
                    <div className="meter" aria-hidden="true">
                      <span style={{ width: `${Math.max(6, (s.fans / maxFans) * 100)}%` }} />
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {more.length > 0 && (
        <section className="band">
          <div className="wrap">
            <p className="eyebrow">More from {league.name}</p>
            <div className="grid-cards">
              {more.map((m, i) => (
                <MatchCard key={m.id} match={m} index={i} />
              ))}
            </div>
            <p>
              <Link to={`/games?league=${league.id}`} className="see-all">
                Full {league.name} schedule →
              </Link>
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

function Side({ team, label }: { team?: Team; label: string }) {
  const prefs = usePrefs()
  const fav = prefs.isFavTeam(team?.id)
  return (
    <div className="mh-side">
      {team ? <Crest team={team} size={76} /> : <Monogram label={label} size={68} />}
      <p className="mh-name">{team?.name ?? (label === 'TBD' ? 'To be decided' : label)}</p>
      {team && (
        <button className={`follow${fav ? ' on' : ''}`} onClick={() => prefs.toggleTeam(team.id)} aria-pressed={fav}>
          <IconStar size={14} filled={fav} />
          {fav ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  )
}
