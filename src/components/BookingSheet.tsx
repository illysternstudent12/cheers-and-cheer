import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, type Booking, type SlotPlanResponse } from '../api/client'
import { matchTitle } from '../lib/match'
import { MAX_PARTY, slotLabel, tablesFor } from '../lib/booking'
import { fmtTime, relativeDay } from '../lib/time'
import { refreshLive } from '../state/live'
import type { Match, Venue } from '../types'
import { Sheet } from './Sheet'
import { errText, QR, toast } from './Social'

type Step = 'party' | 'time' | 'confirm' | 'done'

/**
 * Restaurant-style reservation: party size → arrival → confirm → ticket.
 * Availability comes from the server; demo venues start from simulated
 * occupancy (said so in the sheet), real bookings are subtracted live.
 */
export function BookingSheet({ open, onClose, venue, match }: { open: boolean; onClose: () => void; venue: Venue; match: Match }) {
  const [step, setStep] = useState<Step>('party')
  const [party, setParty] = useState(2)
  const [slot, setSlot] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [plan, setPlan] = useState<SlotPlanResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [booking, setBooking] = useState<Booking | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    // Mounted fresh each time it opens, so only availability needs loading.
    if (!open) return
    api<SlotPlanResponse>('GET', `/availability/${venue.id}/${match.id}`)
      .then(setPlan)
      .catch((e) => setErr(errText(e)))
  }, [open, venue.id, match.id])

  const need = tablesFor(party)
  const anyFits = plan?.plan.some((s) => s.left >= need)

  const confirm = async () => {
    if (slot === null) return
    setBusy(true)
    setErr('')
    try {
      const r = await api<{ booking: Booking }>('POST', '/bookings', { venueId: venue.id, matchId: match.id, partySize: party, slotOffset: slot, note })
      setBooking(r.booking)
      setStep('done')
      void refreshLive()
    } catch (e) {
      setErr(errText(e))
      // Someone may have taken the slot — refresh availability.
      api<SlotPlanResponse>('GET', `/availability/${venue.id}/${match.id}`).then(setPlan).catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  const steps: Step[] = ['party', 'time', 'confirm']
  const idx = steps.indexOf(step)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={step === 'done' ? 'Booked' : `${venue.name} · ${relativeDay(match.start)} ${fmtTime(match.start)}`}
      title={
        step === 'done' ? (
          <>
            See you <em>there.</em>
          </>
        ) : (
          <>
            Reserve a <em>table.</em>
          </>
        )
      }
      footer={
        step === 'done' ? (
          <div className="bk-actions">
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <button className="btn btn-primary" onClick={() => nav(`/ticket/${booking!.code}`)}>
              Open ticket
            </button>
          </div>
        ) : (
          <div className="bk-actions">
            {idx > 0 && (
              <button className="btn btn-ghost" onClick={() => setStep(steps[idx - 1])} disabled={busy}>
                Back
              </button>
            )}
            {step === 'party' && (
              <button className="btn btn-primary" onClick={() => setStep('time')} disabled={!plan || !anyFits}>
                {plan && !anyFits ? 'Fully booked for this size' : 'Choose arrival time'}
              </button>
            )}
            {step === 'time' && (
              <button className="btn btn-primary" onClick={() => setStep('confirm')} disabled={slot === null}>
                Review
              </button>
            )}
            {step === 'confirm' && (
              <button className="btn btn-book" onClick={confirm} disabled={busy}>
                {busy ? 'Booking…' : 'Confirm reservation'}
              </button>
            )}
          </div>
        )
      }
    >
      {step !== 'done' && (
        <ol className="bk-steps" aria-label="Booking steps">
          {['Guests', 'Arrival', 'Confirm'].map((l, i) => (
            <li key={l} className={i === idx ? 'on' : i < idx ? 'done' : ''}>
              <span>{i + 1}</span>
              {l}
            </li>
          ))}
        </ol>
      )}

      {err && (
        <p className="form-err" role="alert">
          {err}
        </p>
      )}

      {step === 'party' && (
        <div className="bk-pane" key="party">
          <p className="bk-label">How many of you?</p>
          <div className="stepper">
            <button onClick={() => setParty((p) => Math.max(1, p - 1))} disabled={party <= 1} aria-label="Fewer guests">
              −
            </button>
            <output aria-live="polite">
              <b key={party}>{party}</b>
              <span>{party === 1 ? 'guest' : 'guests'}</span>
            </output>
            <button onClick={() => setParty((p) => Math.min(MAX_PARTY, p + 1))} disabled={party >= MAX_PARTY} aria-label="More guests">
              +
            </button>
          </div>
          <div className="seats" aria-hidden="true">
            {Array.from({ length: need }, (_, t) => (
              <span key={t} className="table-ico">
                {Array.from({ length: 4 }, (_, s) => (
                  <i key={s} className={t * 4 + s < party ? 'on' : ''} />
                ))}
              </span>
            ))}
          </div>
          <p className="muted bk-hint">
            {need} {need === 1 ? 'table' : 'tables'} · tables seat 4 and are yours for the whole game.
          </p>
        </div>
      )}

      {step === 'time' && plan && (
        <div className="bk-pane" key="time">
          <p className="bk-label">When will you arrive?</p>
          <div className="slots" role="radiogroup" aria-label="Arrival time">
            {plan.plan.map((s) => {
              const at = new Date(match.start.getTime() + s.offset * 60_000)
              const ok = s.left >= need
              return (
                <button
                  key={s.offset}
                  role="radio"
                  aria-checked={slot === s.offset}
                  className={`slot${slot === s.offset ? ' on' : ''}`}
                  disabled={!ok}
                  onClick={() => setSlot(s.offset)}
                >
                  <b>{fmtTime(at)}</b>
                  <span>{slotLabel(s.offset)}</span>
                  <small className={s.left === 0 ? 'full' : s.left < 3 ? 'low' : ''}>
                    {s.left === 0 ? 'Full' : !ok ? `Only ${s.left} left` : `${s.left} ${s.left === 1 ? 'table' : 'tables'} left`}
                  </small>
                </button>
              )
            })}
          </div>
          <p className="fine">Availability at demo venues starts from simulated occupancy; real reservations are subtracted live.</p>
        </div>
      )}

      {step === 'confirm' && slot !== null && (
        <div className="bk-pane" key="confirm">
          <dl className="bk-summary">
            <div>
              <dt>Game</dt>
              <dd>{matchTitle(match)}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd>
                {venue.name} · {venue.area}
              </dd>
            </div>
            <div>
              <dt>Arrive</dt>
              <dd>
                {relativeDay(match.start)} {fmtTime(new Date(match.start.getTime() + slot * 60_000))} · {slotLabel(slot).toLowerCase()}
              </dd>
            </div>
            <div>
              <dt>Party</dt>
              <dd>
                {party} {party === 1 ? 'guest' : 'guests'} · {need} {need === 1 ? 'table' : 'tables'}
              </dd>
            </div>
          </dl>
          <label className="field">
            <span>Note for the venue (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} rows={2} placeholder="Near the big screen, birthday, high chair…" />
          </label>
          <p className="fine">Free to book. Cancel any time before you check in.</p>
        </div>
      )}

      {step === 'done' && booking && (
        <div className="bk-done">
          <div className="ticket-mini">
            <QR value={`${location.origin}/checkin/${booking.code}`} size={150} />
            <div>
              <p className="ticket-code">{booking.code}</p>
              <p>
                {booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'} · arrive {fmtTime(new Date(booking.arriveAt))}
              </p>
              <p className="muted">Show this code at the door — staff scan it to check you in.</p>
            </div>
          </div>
          <p className="bk-next">
            Watching with friends?{' '}
            <Link to={`/venue/${venue.id}?match=${match.id}&party=1`} onClick={() => toast('Create a watch party and share the link')}>
              Start a watch party
            </Link>{' '}
            and send them the link.
          </p>
        </div>
      )}
    </Sheet>
  )
}
