import { useEffect, useState } from 'react'
import { siteUrl } from '../lib/origin'
import { Link, useParams } from 'react-router-dom'
import { api, type Booking } from '../api/client'
import { Roundel } from '../components/Badges'
import { downloadIcs, errText, QR, toast, useAuthed } from '../components/Social'
import { getVenue } from '../data/demo'
import { slotLabel } from '../lib/booking'
import { fmtDate, fmtTime } from '../lib/time'
import { refreshLive } from '../state/live'
import { useSession } from '../state/session'
import { NotFound } from './NotFound'

const STATUS: Record<Booking['status'], string> = {
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  checked_in: 'Checked in',
  no_show: 'Marked no-show',
}

export function TicketPage() {
  const { code } = useParams()
  const { user, ready } = useSession()
  const authed = useAuthed()
  const [b, setB] = useState<Booking | null>(null)
  const [missing, setMissing] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ready) return
    if (!user) return authed(() => undefined, 'Sign in to see your ticket')
    api<{ booking: Booking }>('GET', `/bookings/${code}`)
      .then((r) => setB(r.booking))
      .catch(() => setMissing(true))
  }, [code, user, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  if (missing) return <NotFound what="booking" />
  if (!b) return <div className="page-loading" />

  const v = getVenue(b.venueId)
  const start = new Date(b.matchStart)
  const arrive = new Date(b.arriveAt)

  const cancel = async () => {
    setBusy(true)
    try {
      const r = await api<{ booking: Booking }>('POST', `/bookings/${b.code}/cancel`)
      setB(r.booking)
      toast('Booking cancelled — the table is released')
      void refreshLive()
    } catch (e) {
      toast(errText(e), 'err')
    } finally {
      setBusy(false)
      setConfirmCancel(false)
    }
  }

  return (
    <section className="ticketpage wrap">
      <Link to="/me" className="back">
        ← My nights
      </Link>
      <article className={`ticket is-${b.status}`}>
        <header className="ticket-head">
          {v && <Roundel name={v.name} est={v.est} size={60} />}
          <div>
            <p className="eyebrow eyebrow-rust">Table reservation</p>
            <h1 className="ticket-venue">{b.venueName}</h1>
            <p className="ticket-game">{b.matchTitle}</p>
          </div>
        </header>
        <div className="ticket-tear" aria-hidden="true" />
        <div className="ticket-body">
          <div className="ticket-qr">
            {b.status === 'confirmed' ? <QR value={siteUrl(`/checkin/${b.code}`)} size={196} /> : <div className="ticket-stamp">{STATUS[b.status]}</div>}
            <p className="ticket-code" aria-label={`Booking code ${b.code.split('').join(' ')}`}>
              {b.code}
            </p>
          </div>
          <dl className="ticket-facts">
            <div>
              <dt>Status</dt>
              <dd className={`st st-${b.status}`}>{STATUS[b.status]}</dd>
            </div>
            <div>
              <dt>Kick-off</dt>
              <dd>
                {fmtDate(start)} · {fmtTime(start)}
              </dd>
            </div>
            <div>
              <dt>Arrive</dt>
              <dd>
                {fmtTime(arrive)} · {slotLabel(b.slotOffset).toLowerCase()}
              </dd>
            </div>
            <div>
              <dt>Party</dt>
              <dd>
                {b.partySize} {b.partySize === 1 ? 'guest' : 'guests'} · {b.tables} {b.tables === 1 ? 'table' : 'tables'}
              </dd>
            </div>
            {b.note && (
              <div>
                <dt>Note</dt>
                <dd>{b.note}</dd>
              </div>
            )}
          </dl>
        </div>
      </article>

      <div className="ticket-actions">
        {b.status === 'confirmed' && (
          <button
            className="btn btn-ghost"
            onClick={() =>
              downloadIcs({
                title: `${b.matchTitle} at ${b.venueName}`,
                start: arrive,
                minutes: Math.round((start.getTime() - arrive.getTime()) / 60_000) + 120,
                location: v ? `${v.name}, ${v.area}` : b.venueName,
                description: `Cheers & Cheer booking ${b.code} · ${b.partySize} guests`,
              })
            }
          >
            Add to calendar
          </button>
        )}
        <Link to={`/venue/${b.venueId}?match=${b.matchId}`} className="btn btn-ghost">
          Venue details
        </Link>
        {b.status === 'confirmed' &&
          (confirmCancel ? (
            <span className="confirm-inline">
              Release this table?
              <button className="btn btn-danger" onClick={cancel} disabled={busy}>
                Yes, cancel booking
              </button>
              <button className="btn btn-ghost" onClick={() => setConfirmCancel(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button className="btn btn-ghost btn-danger-ghost" onClick={() => setConfirmCancel(true)}>
              Cancel booking
            </button>
          ))}
      </div>
    </section>
  )
}
