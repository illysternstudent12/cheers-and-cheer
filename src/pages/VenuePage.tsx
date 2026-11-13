import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { FanStack, PartyBadge, Roundel, ScreensBadge, SoundBadge, VerifiedBadge } from '../components/Badges'
import { StatusPill } from '../components/Countdown'
import { Crest, Monogram } from '../components/Crest'
import { Disclosure } from '../components/Disclosure'
import { IconArrowLeft, IconBeer, IconClock, IconPin, IconStar, IconTv, IconUsers, SportIcon } from '../components/Icons'
import { MapView } from '../components/MapView'
import { VenueArt } from '../components/VenueArt'
import { getCity, getLeague, getTeam, getVenue } from '../data/demo'
import { ATMOSPHERES } from '../data/venues'
import { liveState, matchTitle, statusOf } from '../lib/match'
import { useOrigin } from '../lib/origin'
import { dayKey } from '../lib/filters'
import { fmtTime, relativeDay, useMinute } from '../lib/time'
import { availability, distanceKm, fmtKm, venueSchedule } from '../lib/venues'
import type { Match, Venue } from '../types'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { BookingSheet } from '../components/BookingSheet'
import { FavVenueButton, GoingButton, useAuthed } from '../components/Social'
import { PartySheet } from './PartyPage'
import { useBroadcasts, useLive, type LiveBroadcast } from '../state/live'
import { usePrefs } from '../state/prefs'
import { NotFound } from './NotFound'


export function VenuePage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const now = useMinute()
  const origin = useOrigin()
  const prefs = usePrefs()
  const list = useBroadcasts()
  const authed = useAuthed()
  const [sheet, setSheet] = useState<'book' | 'party' | null>(null)
  // Deep links: ?book=1 opens the reservation, ?party=1 the watch-party form.
  const wants = params.get('book') === '1' ? 'book' : params.get('party') === '1' ? 'party' : null
  useEffect(() => {
    if (wants) authed(() => setSheet(wants), wants === 'book' ? 'Sign in to reserve a table' : 'Sign in to start a watch party')
  }, [wants]) // eslint-disable-line react-hooks/exhaustive-deps
  const v = id ? getVenue(id) : undefined
  if (!v) return <NotFound what="venue" />

  const city = getCity(v.city)
  const vibe = ATMOSPHERES.find((a) => a.id === v.atmosphere)!
  const schedule = venueSchedule(list, v.id, now)
  const focusId = params.get('match') ?? schedule[0]?.m.id
  const focus = schedule.find((s) => s.m.id === focusId)
  const dist = v.city === prefs.city ? distanceKm(origin, v) : undefined

  const byDay = new Map<string, { b: LiveBroadcast; m: Match }[]>()
  for (const s of schedule) {
    const k = statusOf(s.m, now) === 'live' ? 'live' : dayKey(s.m.start)
    byDay.set(k, [...(byDay.get(k) ?? []), s])
  }

  return (
    <div className="venuepage">
      <section className="vh">
        <div className="wrap">
          <button className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/map'))}>
            <IconArrowLeft size={18} /> Back
          </button>
          <div className="vh-grid">
            <div className="vh-art">
              <VenueArt venue={v} sport={focus?.m.sport} />
              <div className="vh-roundel">
                <Roundel name={v.name} est={v.est} size={84} />
              </div>
            </div>
            <div className="vh-info">
              <p className="eyebrow">
                {v.area} · {city.name}
              </p>
              <div className="vh-title">
                <h1 className="display display-sm vh-name">{v.name}</h1>
                <FavVenueButton venueId={v.id} name={v.name} />
              </div>
              <p className="vh-tagline">{v.tagline}</p>
              <ul className="vh-facts">
                <li>
                  <IconStar size={15} filled /> <b>{v.rating.toFixed(1)}</b> <span>({v.reviews})</span>
                </li>
                <li>
                  <span className={`vibe vibe-${v.atmosphere}`}>{vibe.label}</span>
                </li>
                <li className="vh-price" aria-label={`Price level ${v.priceLevel} of 3`}>
                  <span className="price-dots" aria-hidden="true">
                    {[1, 2, 3].map((n) => (
                      <i key={n} className={n <= v.priceLevel ? 'on' : ''} />
                    ))}
                  </span>
                  <span>{['', 'Budget', 'Mid-range', 'Premium'][v.priceLevel]}</span>
                </li>
                {dist !== undefined && (
                  <li>
                    <IconPin size={15} /> {fmtKm(dist)} <span>from {origin.gps ? 'you' : 'centre'}</span>
                  </li>
                )}
                <li>
                  <IconTv size={15} /> {v.screens} screens
                </li>
                <li>
                  <IconClock size={15} /> {v.hours}
                </li>
              </ul>
              {v.homeOf && (
                <p className="vh-home">
                  {v.homeOf
                    .map((t) => getTeam(t))
                    .filter((t, i, arr) => t && arr.findIndex((o) => o?.short === t.short) === i)
                    .slice(0, 2)
                    .map((t) => (
                    <span key={t!.id} className="vh-home-team">
                      <Crest team={t!} size={20} /> Home of {t!.name} fans
                    </span>
                  ))}
                </p>
              )}

              {focus ? (
                <FocusCard b={focus.b} m={focus.m} venue={v} onBook={() => setSheet('book')} onParty={() => setSheet('party')} />
              ) : (
                <p className="muted">No games scheduled here in the next week.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="band">
        <div className="wrap vp-grid">
          <div>
            <p className="eyebrow">On screens this week</p>
            <h2 className="h2">
              What’s <em>on.</em>
            </h2>
            <div className="vsched">
              {[...byDay.entries()].map(([k, list]) => (
                <div key={k} className="vsched-day">
                  <h3 className="vsched-head">{k === 'live' ? 'Live now' : relativeDay(list[0].m.start, now)}</h3>
                  <ul>
                    {list.map(({ b, m }) => (
                      <li key={m.id} className={`vsched-row${m.id === focus?.m.id ? ' on' : ''}`}>
                        <Link to={`/venue/${v.id}?match=${m.id}`} replace className="vsched-link">
                          <span className="vsched-time">{statusOf(m, now) === 'live' ? liveState(m, now).clock : fmtTime(m.start)}</span>
                          <SportIcon sport={m.sport} size={16} className="vsched-icon" />
                          <span className="vsched-title">
                            {matchTitle(m)}
                            <small>{getLeague(m.league).short}</small>
                          </span>
                          <span className="vsched-flags">
                            {b.sound && <span className="flag">Sound</span>}
                            {b.watchParty && <span className="flag flag-party">Party</span>}
                            <span className="vsched-fans">{b.fans}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="vp-side">
            <Disclosure title="The room" icon={<IconTv size={18} />} defaultOpen>
              <p>{v.description}</p>
              <p>
                {v.screens} screens{v.bigScreen ? `, plus a ${v.bigScreen}` : ''}. Seats around {v.capacity}, {v.tables} bookable tables.
              </p>
            </Disclosure>
            <Disclosure title="Food & drink" icon={<IconBeer size={18} />}>
              <p>
                {v.kitchen}. {v.drinks}.
              </p>
            </Disclosure>
            <Disclosure title="Hours & access" icon={<IconClock size={18} />}>
              <p>Open {v.hours}.</p>
              <p>
                {v.accessible ? 'Step-free access and accessible toilet.' : 'Steps at the entrance — call ahead if you need help.'}{' '}
                {v.terrace ? 'Outdoor terrace with a screen.' : 'Indoor only.'}
              </p>
            </Disclosure>
            {v.homeOf && (
              <Disclosure title="Supporters" icon={<IconUsers size={18} />}>
                <p>
                  Regular home of {[...new Set(v.homeOf.map((t) => getTeam(t)?.name.replace(/ BC$/, '')))].join(' and ')} supporters. Expect colours, songs and a
                  full room on their match days.
                </p>
              </Disclosure>
            )}
            <div className="vp-minimap">
              <MapView
                rows={[{ venue: v, distance: 0, broadcast: focus?.b }]}
                center={v}
                zoom={15}
                interactive={false}
                selected={v.id}
              />
              <Link to={`/map?v=${v.id}&view=map${focus ? `&match=${focus.m.id}` : ''}`} className="vp-minimap-link">
                <IconPin size={15} /> Open on the map
              </Link>
            </div>
            <p className="fine">Demo venue — name, details and photos are illustrative.</p>
          </div>
        </div>
      </section>
      {focus && (
        <>
          {sheet === 'book' && <BookingSheet open onClose={() => setSheet(null)} venue={v} match={focus.m} />}
          {sheet === 'party' && <PartySheet open onClose={() => setSheet(null)} venue={v} match={focus.m} />}
        </>
      )}
    </div>
  )
}

function FocusCard({
  b,
  m,
  venue,
  onBook,
  onParty,
}: {
  b: LiveBroadcast
  m: Match
  venue: Venue
  onBook: () => void
  onParty: () => void
}) {
  const now = useMinute()
  const live = useLive()
  const authed = useAuthed()
  const capacity = venue.capacity
  const mine = live.mine?.bookings.find((x) => x.matchId === m.id && x.venueId === venue.id && x.status === 'confirmed')
  const finished = statusOf(m, now) === 'finished'
  const [fans, setFans] = useState<string[]>([])
  useEffect(() => {
    api<{ fans: { name: string; venueId: string | null }[] }>('GET', `/going/${m.id}`)
      .then((r) => setFans(r.fans.filter((f) => f.venueId === venue.id).map((f) => f.name)))
      .catch(() => setFans([]))
  }, [m.id, venue.id, live.at])
  const h = getTeam(m.home)
  const a = getTeam(m.away)
  const av = availability(b)
  const party = b.watchParty
  return (
    <div className="focus">
      <div className="focus-top">
        <span className="focus-crests">
          {h ? <Crest team={h} size={30} /> : <Monogram label={m.participants?.[0] ?? m.title ?? ''} size={30} />}
          {a ? <Crest team={a} size={30} /> : m.participants ? <Monogram label={m.participants[1]} size={30} /> : null}
        </span>
        <span className="focus-title">
          <Link to={`/match/${m.id}`}>{matchTitle(m)}</Link>
          <small>
            {getLeague(m.league).short} · {relativeDay(m.start, now)} {fmtTime(m.start)}
          </small>
        </span>
        <StatusPill match={m} />
      </div>
      <div className="focus-badges">
        <VerifiedBadge b={b} long />
        <SoundBadge b={b} />
        <ScreensBadge b={b} />
        <PartyBadge b={b} />
      </div>
      {party && (
        <p className="focus-party">
          <b>{party.name}</b> · hosted by {party.host}
        </p>
      )}
      <div className="focus-foot">
        <FanStack fans={b.fans} confirmed={b.confirmed} capacity={capacity} />
        <span className={`avail avail-${av.key}`}>{av.label}</span>
      </div>
      {mine ? (
        <Link to={`/ticket/${mine.code}`} className="btn btn-book btn-book-held btn-block">
          Your table is booked · {mine.code}
        </Link>
      ) : (
        <button
          className="btn btn-book btn-block"
          disabled={finished || b.tablesLeft === 0}
          onClick={() => authed(onBook, 'Sign in to reserve a table', 'book=1')}
        >
          {finished ? 'Game finished' : b.tablesLeft === 0 ? 'Fully booked — walk-ins only' : 'Reserve a table'}
        </button>
      )}
      <div className="focus-social">
        <GoingButton matchId={m.id} venueId={venue.id} venueName={venue.name} />
        {!finished && (
          <button className="linkish" onClick={() => authed(onParty, 'Sign in to start a watch party', 'party=1')}>
            + Start a watch party
          </button>
        )}
      </div>
      {fans.length > 0 && (
        <p className="focus-fans">
          <b>{fans.slice(0, 3).join(', ')}</b>
          {fans.length > 3 ? ` and ${fans.length - 3} more` : ''} {fans.length === 1 ? 'is' : 'are'} going here
        </p>
      )}
    </div>
  )
}
