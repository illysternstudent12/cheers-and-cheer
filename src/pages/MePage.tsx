import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api, type Booking, type Invite, type Party } from '../api/client'
import { VenueCard } from '../components/VenueCard'
import { errText, QR, toast } from '../components/Social'
import { getMatch, getVenue } from '../data/demo'
import { matchTitle, statusOf } from '../lib/match'
import { useOrigin } from '../lib/origin'
import { fmtDate, fmtTime, relativeDay, useMinute } from '../lib/time'
import { distanceKm, nextBroadcast } from '../lib/venues'
import { refreshLive, useBroadcasts } from '../state/live'
import { useSession } from '../state/session'

interface Community {
  parties: Party[]
  invites: Invite[]
  going: { matchId: string; venueId: string | null }[]
  favorites: string[]
}

const STATUS: Record<Booking['status'], string> = { confirmed: 'Confirmed', cancelled: 'Cancelled', checked_in: 'Checked in', no_show: 'No-show' }

export function MePage() {
  const { user, ready, logout } = useSession()
  const now = useMinute()
  const origin = useOrigin()
  const list = useBroadcasts()
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [c, setC] = useState<Community | null>(null)

  const load = useCallback(() => {
    api<{ bookings: Booking[] }>('GET', '/me/bookings').then((r) => setBookings(r.bookings)).catch(() => setBookings([]))
    api<Community>('GET', '/me/community').then(setC).catch(() => undefined)
  }, [])
  useEffect(() => {
    if (user) load()
  }, [user, load])

  if (ready && !user) return <Navigate to="/signin?next=/me&why=Sign%20in%20to%20see%20your%20bookings%20and%20watch%20parties" replace />
  if (!user || !bookings || !c) return <div className="page-loading" />

  const upcoming = bookings.filter((b) => b.status === 'confirmed' && Date.parse(b.matchStart) + 3 * 3_600_000 > now).sort((a, b) => a.arriveAt.localeCompare(b.arriveAt))
  const past = bookings.filter((b) => !upcoming.includes(b))
  const bookedMatches = new Set(upcoming.map((b) => b.matchId))
  const goingOnly = c.going.filter((g) => !bookedMatches.has(g.matchId)).map((g) => ({ ...g, m: getMatch(g.matchId) })).filter((g) => g.m && statusOf(g.m, now) !== 'finished')
  const parties = c.parties.filter((p) => Date.parse(p.matchStart) + 3 * 3_600_000 > now)

  const decline = async (id: number) => {
    try {
      await api('POST', `/invites/${id}/decline`)
      load()
    } catch (e) {
      toast(errText(e), 'err')
    }
  }

  return (
    <div className="me">
      <section className="games-hero">
        <div className="wrap me-head">
          <div>
            <p className="eyebrow">My nights</p>
            <h1 className="display display-sm">
              Hey {user.name.split(' ')[0]}, <em>game on.</em>
            </h1>
          </div>
          <div className="me-account">
            <span className="muted">{user.email}</span>
            {user.role === 'venue' && (
              <Link className="btn btn-ghost btn-sm" to="/owner">
                Venue dashboard
              </Link>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </div>
      </section>

      <div className="wrap">
        {c.invites.length > 0 && (
          <section className="band-tight">
            <p className="eyebrow">Invitations</p>
            <ul className="invites">
              {c.invites.map((i) => (
                <li key={i.id} className="invite-card">
                  <div>
                    <b>{i.fromName}</b> invited you to <b>{i.title}</b>
                    <span className="muted">
                      {i.matchTitle} · {i.venueName} · {fmtDate(new Date(i.matchStart))} {fmtTime(new Date(i.matchStart))}
                    </span>
                  </div>
                  <div className="invite-actions">
                    <Link className="btn btn-primary btn-sm" to={`/party/${i.slug}`}>
                      View & join
                    </Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => decline(i.id)}>
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="band-tight">
          <p className="eyebrow">Upcoming tables · {upcoming.length}</p>
          {upcoming.length === 0 ? (
            <div className="me-empty">
              <p>No tables booked yet.</p>
              <Link to="/games" className="btn btn-primary btn-sm">
                Find a game
              </Link>
            </div>
          ) : (
            <div className="grid-cards">
              {upcoming.map((b) => (
                <Link key={b.code} to={`/ticket/${b.code}`} className="bk-card">
                  <QR value={`${location.origin}/checkin/${b.code}`} size={84} />
                  <div className="bk-card-body">
                    <p className="bk-card-when">
                      {relativeDay(new Date(b.matchStart), now)} · arrive {fmtTime(new Date(b.arriveAt))}
                    </p>
                    <p className="bk-card-venue">{b.venueName}</p>
                    <p className="bk-card-game">{b.matchTitle}</p>
                    <p className="bk-card-meta">
                      {b.partySize} guests · <span className="mono">{b.code}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {parties.length > 0 && (
          <section className="band-tight">
            <p className="eyebrow">Watch parties</p>
            <div className="grid-cards">
              {parties.map((p) => (
                <Link key={p.slug} to={`/party/${p.slug}`} className="party-card">
                  <span className="party-card-tag">{p.isHost ? 'Hosting' : 'Joined'}</span>
                  <b>{p.title}</b>
                  <span>
                    {p.matchTitle} · {p.venueName}
                  </span>
                  <span className="muted">
                    {relativeDay(new Date(p.matchStart), now)} {fmtTime(new Date(p.matchStart))} · {p.members.length} in
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {goingOnly.length > 0 && (
          <section className="band-tight">
            <p className="eyebrow">Going, no table yet</p>
            <ul className="going-list">
              {goingOnly.map(({ m, venueId }) => {
                const v = venueId ? getVenue(venueId) : undefined
                return (
                  <li key={m!.id}>
                    <div>
                      <b>{matchTitle(m!)}</b>
                      <span className="muted">
                        {relativeDay(m!.start, now)} {fmtTime(m!.start)} · {v ? v.name : 'no bar picked'}
                      </span>
                    </div>
                    <Link className="btn btn-ghost btn-sm" to={v ? `/venue/${v.id}?match=${m!.id}&book=1` : `/map?match=${m!.id}`}>
                      {v ? 'Book a table' : 'Pick a bar'}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="band-tight">
          <p className="eyebrow">Favourite bars · {c.favorites.length}</p>
          {c.favorites.length === 0 ? (
            <p className="muted">Tap the heart on any bar to keep it here.</p>
          ) : (
            <div className="grid-cards">
              {c.favorites
                .map((id) => getVenue(id))
                .filter((v) => !!v)
                .map((v, i) => {
                  const nb = nextBroadcast(list, v.id, now, 24 * 7)
                  return <VenueCard key={v.id} index={i} showMatch row={{ venue: v, broadcast: nb?.b, match: nb?.m, distance: distanceKm(origin, v) }} />
                })}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section className="band-tight">
            <p className="eyebrow">History</p>
            <ul className="history">
              {past.map((b) => (
                <li key={b.code}>
                  <Link to={`/ticket/${b.code}`}>
                    <span>{fmtDate(new Date(b.matchStart))}</span>
                    <b>{b.matchTitle}</b>
                    <span className="muted">{b.venueName}</span>
                    <span className={`st st-${b.status}`}>{STATUS[b.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <button className="linkish refresh" onClick={() => (load(), void refreshLive())}>
          Refresh
        </button>
      </div>
    </div>
  )
}
