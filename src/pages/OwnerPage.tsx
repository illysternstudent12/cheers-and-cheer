import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { api, type Booking, type Override } from '../api/client'
import { Roundel } from '../components/Badges'
import { Crest } from '../components/Crest'
import { SportIcon } from '../components/Icons'
import { errText, toast } from '../components/Social'
import { BROADCASTS, MATCHES, getLeague, getMatch, getTeam, getVenue } from '../data/demo'
import { slotLabel } from '../lib/booking'
import { dayKey } from '../lib/filters'
import { matchTitle, statusOf } from '../lib/match'
import { fmtDate, fmtTime, relativeDay, useMinute } from '../lib/time'
import { refreshLive } from '../state/live'
import { useSession } from '../state/session'
import type { Match, Venue } from '../types'

type Tab = 'tonight' | 'schedule' | 'bookings' | 'analytics' | 'settings'
const TABS: { id: Tab; label: string }[] = [
  { id: 'tonight', label: 'Tonight' },
  { id: 'schedule', label: 'Broadcasts' },
  { id: 'bookings', label: 'Reservations' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
]

export function OwnerPage() {
  const { user, ready, logout } = useSession()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'tonight'

  if (ready && !user) return <Navigate to="/signin?venue=1&next=/owner" replace />
  if (ready && user && user.role !== 'venue')
    return (
      <section className="wrap empty empty-page">
        <p className="eyebrow">Venue dashboard</p>
        <p className="empty-title">
          This area is for <em>venues.</em>
        </p>
        <p className="muted">You’re signed in as a fan. Venue owners sign in with a venue account.</p>
        <Link to="/me" className="btn btn-primary">
          Go to My nights
        </Link>
      </section>
    )
  if (!user?.venueId) return <div className="page-loading" />
  const v = getVenue(user.venueId)!

  return (
    <div className="owner">
      <header className="ow-head">
        <div className="wrap ow-head-in">
          <Roundel name={v.name} est={v.est} size={56} />
          <div className="ow-title">
            <p className="eyebrow">Venue dashboard</p>
            <h1>{v.name}</h1>
            <p className="muted">
              {v.area} · {v.screens} screens · signed in as {user.name}
            </p>
          </div>
          <div className="ow-head-actions">
            <Link to={`/venue/${v.id}`} className="btn btn-ghost btn-sm">
              Public page
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="wrap ow-tabs" role="tablist" aria-label="Dashboard sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setParams({ tab: t.id }, { replace: true })}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="wrap ow-body" key={tab}>
        {tab === 'tonight' && <Tonight venue={v} />}
        {tab === 'schedule' && <Schedule venue={v} />}
        {tab === 'bookings' && <Reservations venue={v} />}
        {tab === 'analytics' && <Analytics />}
        {tab === 'settings' && <Settings venue={v} />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Shared: the venue's games (demo listing + owner changes)           */
/* ------------------------------------------------------------------ */

interface Row {
  m: Match
  listed: boolean // in the generated demo listing
  ov?: Override
}

function useVenueGames(venue: Venue) {
  const [ovs, setOvs] = useState<Override[] | null>(null)
  const reload = useCallback(() => {
    api<{ overrides: Override[] }>('GET', '/owner/broadcasts').then((r) => setOvs(r.overrides)).catch(() => setOvs([]))
  }, [])
  useEffect(reload, [reload])
  const now = useMinute()
  const rows = useMemo<Row[]>(() => {
    if (!ovs) return []
    const map = new Map(ovs.map((o) => [o.matchId, o]))
    const ids = new Set([...BROADCASTS.filter((b) => b.venueId === venue.id).map((b) => b.matchId), ...ovs.map((o) => o.matchId)])
    return [...ids]
      .map((id) => ({ m: getMatch(id)!, listed: BROADCASTS.some((b) => b.venueId === venue.id && b.matchId === id), ov: map.get(id) }))
      .filter((r) => r.m && statusOf(r.m, now) !== 'finished' && r.m.start.getTime() - now < 8 * 86_400_000)
      .sort((a, b) => a.m.start.getTime() - b.m.start.getTime())
  }, [ovs, venue.id, now])
  return { rows, reload, loading: !ovs }
}

function MatchLine({ m }: { m: Match }) {
  const h = getTeam(m.home)
  const a = getTeam(m.away)
  return (
    <span className="ow-match">
      <span className="ow-crests">
        {h ? <Crest team={h} size={22} /> : <SportIcon sport={m.sport} size={18} />}
        {a && <Crest team={a} size={22} />}
      </span>
      <span>
        <b>{matchTitle(m)}</b>
        <small>
          {getLeague(m.league).short} · {relativeDay(m.start)} {fmtTime(m.start)}
        </small>
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Tonight: capacity + check-in                                       */
/* ------------------------------------------------------------------ */

interface Avail {
  plan: { offset: number; capacity: number; left: number }[]
  total: number
  baseline: number
  realTables: number
}

function Tonight({ venue }: { venue: Venue }) {
  const { rows, loading } = useVenueGames(venue)
  const now = useMinute()
  const upcoming = rows.filter((r) => r.ov?.status !== 'hidden' && r.m.start.getTime() - now < 30 * 3_600_000)
  const [sel, setSel] = useState<string>()
  // Default to the room's main event: the next game with the sound on, else the soonest.
  const current =
    upcoming.find((r) => r.m.id === sel) ??
    upcoming.find((r) => statusOf(r.m, now) === 'upcoming' && (r.ov ? !!r.ov.sound : BROADCASTS.some((b) => b.venueId === venue.id && b.matchId === r.m.id && b.sound))) ??
    upcoming[0]
  const [bookings, setBookings] = useState<Booking[]>([])
  const [avail, setAvail] = useState<Avail | null>(null)

  const load = useCallback(() => {
    if (!current) return
    api<{ bookings: Booking[] }>('GET', `/owner/bookings?matchId=${current.m.id}`).then((r) => setBookings(r.bookings))
    api<Avail>('GET', `/owner/availability/${current.m.id}`).then(setAvail)
  }, [current?.m.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(load, [load])

  if (loading) return <div className="page-loading" />

  const active = bookings.filter((b) => b.status !== 'cancelled')
  const guests = active.reduce((n, b) => n + b.partySize, 0)
  const inside = active.filter((b) => b.status === 'checked_in').reduce((n, b) => n + b.partySize, 0)
  const left = avail ? avail.plan.reduce((n, s) => n + s.left, 0) : 0

  return (
    <div className="ow-tonight">
      <CheckIn onDone={load} />

      {upcoming.length === 0 ? (
        <p className="muted">No games on your screens in the next 30 hours. Add one under Broadcasts.</p>
      ) : (
        <>
          <div className="chips chips-scroll ow-gamechips" role="tablist" aria-label="Game">
            {upcoming.map((r) => (
              <button key={r.m.id} className={`chip${current?.m.id === r.m.id ? ' on' : ''}`} onClick={() => setSel(r.m.id)} role="tab" aria-selected={current?.m.id === r.m.id}>
                {fmtTime(r.m.start)} · {matchTitle(r.m)}
              </button>
            ))}
          </div>

          {current && (
            <section className="ow-panel">
              <header className="ow-panel-head">
                <MatchLine m={current.m} />
                <span className={`ow-status ${current.ov ? 'ok' : 'demo'}`}>{current.ov ? 'Verified by you' : 'Demo listing — not verified'}</span>
              </header>
              <div className="kpis">
                <Kpi label="Booked guests" value={guests} sub={`${active.length} reservations`} />
                <Kpi label="Checked in" value={inside} sub={guests ? `${Math.round((inside / guests) * 100)}% arrived` : '—'} />
                <Kpi label="Tables free" value={left} sub={avail ? `of ${avail.total} bookable` : ''} />
              </div>
              {avail && (
                <div className="cap">
                  <p className="cap-title">Arrival slots</p>
                  {avail.plan.map((s) => {
                    const used = s.capacity - s.left
                    return (
                      <div key={s.offset} className="cap-row">
                        <span className="cap-k">
                          {fmtTime(new Date(current.m.start.getTime() + s.offset * 60_000))}
                          <small>{slotLabel(s.offset)}</small>
                        </span>
                        <span className="cap-bar" title={`${used} of ${s.capacity} tables taken`}>
                          <span style={{ width: `${s.capacity ? (used / s.capacity) * 100 : 0}%` }} />
                        </span>
                        <span className="cap-v">
                          {s.left}/{s.capacity} free
                        </span>
                      </div>
                    )
                  })}
                  {avail.baseline > 0 && (
                    <p className="fine">Includes {avail.baseline} tables of simulated demo occupancy, shown so the pilot venue isn’t empty.</p>
                  )}
                </div>
              )}
              <BookingTable bookings={bookings} onChange={load} />
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" key={String(value)}>
        {value}
      </span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  )
}

/** Code entry + camera scan (where the browser supports BarcodeDetector). */
export function CheckIn({ onDone, initial }: { onDone?: () => void; initial?: string }) {
  const [code, setCode] = useState(initial ?? '')
  const [result, setResult] = useState<{ ok: boolean; text: string; b?: Booking } | null>(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window

  const submit = useCallback(
    async (raw: string) => {
      const c = raw.trim().split('/').pop()!.toUpperCase()
      if (!c) return
      setBusy(true)
      try {
        const r = await api<{ booking: Booking; already: boolean }>('POST', '/owner/checkin', { code: c })
        setResult({
          ok: true,
          b: r.booking,
          text: r.already ? `${r.booking.code} was already checked in.` : `Welcome ${r.booking.guestName?.split(' ')[0] ?? ''} — party of ${r.booking.partySize}.`,
        })
        setCode('')
        onDone?.()
        void refreshLive()
      } catch (e) {
        setResult({ ok: false, text: errText(e) })
      } finally {
        setBusy(false)
      }
    },
    [onDone],
  )

  // Arriving from a scanned QR link: check the guest in straight away.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    if (initial) void submit(initial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scanning) return
    let stream: MediaStream | undefined
    let raf = 0
    let stop = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (!video.current) return
        video.current.srcObject = stream
        await video.current.play()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const det = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const tick = async () => {
          if (stop || !video.current) return
          const codes = await det.detect(video.current).catch(() => [])
          if (codes[0]?.rawValue) {
            setScanning(false)
            void submit(codes[0].rawValue)
            return
          }
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch {
        setScanning(false)
        setResult({ ok: false, text: 'Couldn’t open the camera — type the code instead.' })
      }
    })()
    return () => {
      stop = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [scanning, submit])

  return (
    <section className="checkin">
      <div>
        <p className="eyebrow">Guest check-in</p>
        <form
          className="checkin-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void submit(code)
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Booking code"
            aria-label="Booking code"
            maxLength={40}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button className="btn btn-primary" disabled={busy || !code.trim()}>
            Check in
          </button>
          {canScan && (
            <button type="button" className="btn btn-ghost" onClick={() => setScanning((s) => !s)}>
              {scanning ? 'Stop camera' : 'Scan QR'}
            </button>
          )}
        </form>
        {!canScan && <p className="fine">QR scanning needs a browser with camera barcode support (e.g. Chrome on Android). Typing the 6-letter code always works.</p>}
      </div>
      {scanning && <video ref={video} className="checkin-video" muted playsInline />}
      {result && (
        <div className={`checkin-result ${result.ok ? 'ok' : 'err'}`} role="status" key={result.text}>
          <span className="checkin-icon" aria-hidden="true">
            {result.ok ? '✓' : '!'}
          </span>
          <div>
            <b>{result.text}</b>
            {result.b && (
              <small>
                {result.b.matchTitle} · arrive {fmtTime(new Date(result.b.arriveAt))} · {result.b.tables} {result.b.tables === 1 ? 'table' : 'tables'}
                {result.b.note ? ` · “${result.b.note}”` : ''}
              </small>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

const STATUS: Record<Booking['status'], string> = { confirmed: 'Confirmed', cancelled: 'Cancelled', checked_in: 'Checked in', no_show: 'No-show' }

function BookingTable({ bookings, onChange, showGame = false }: { bookings: Booking[]; onChange: () => void; showGame?: boolean }) {
  const now = useMinute()
  const act = async (b: Booking, kind: 'checkin' | 'noshow') => {
    try {
      if (kind === 'checkin') await api('POST', '/owner/checkin', { code: b.code })
      else await api('POST', `/owner/bookings/${b.code}/no-show`)
      toast(kind === 'checkin' ? `${b.code} checked in` : `${b.code} marked as no-show`)
      onChange()
    } catch (e) {
      toast(errText(e), 'err')
    }
  }
  if (!bookings.length) return <p className="muted">No reservations yet.</p>
  return (
    <div className="ow-table-wrap">
      <table className="ow-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Guest</th>
            {showGame && <th>Game</th>}
            <th>Arrive</th>
            <th>Party</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.code} className={`is-${b.status}`}>
              <td className="mono">{b.code}</td>
              <td>
                {b.guestName}
                {b.seeded && <span className="demo-pill">Demo</span>}
                {b.note && <small className="ow-note">“{b.note}”</small>}
              </td>
              {showGame && (
                <td>
                  {b.matchTitle}
                  <small className="ow-note">{fmtDate(new Date(b.matchStart))}</small>
                </td>
              )}
              <td>{fmtTime(new Date(b.arriveAt))}</td>
              <td>
                {b.partySize} · {b.tables}t
              </td>
              <td>
                <span className={`st st-${b.status}`}>{STATUS[b.status]}</span>
              </td>
              <td className="ow-actions">
                {b.status === 'confirmed' && (
                  <>
                    <button className="btn btn-primary btn-xs" onClick={() => act(b, 'checkin')}>
                      Check in
                    </button>
                    {Date.parse(b.matchStart) < now && (
                      <button className="btn btn-ghost btn-xs" onClick={() => act(b, 'noshow')}>
                        No-show
                      </button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Broadcast schedule & screens                                       */
/* ------------------------------------------------------------------ */

function Schedule({ venue }: { venue: Venue }) {
  const { rows, reload, loading } = useVenueGames(venue)
  const [adding, setAdding] = useState('')
  const now = useMinute()
  const candidates = MATCHES.filter(
    (m) => statusOf(m, now) !== 'finished' && m.start.getTime() - now < 8 * 86_400_000 && !rows.some((r) => r.m.id === m.id),
  )

  const save = async (m: Match, body: { screens: number; sound: boolean; status: 'verified' | 'hidden' }, msg: string) => {
    try {
      await api('PUT', `/owner/broadcasts/${m.id}`, body)
      toast(msg)
      reload()
      void refreshLive()
    } catch (e) {
      toast(errText(e), 'err')
    }
  }
  const reset = async (m: Match) => {
    await api('DELETE', `/owner/broadcasts/${m.id}`).catch(() => undefined)
    toast('Back to the demo listing')
    reload()
    void refreshLive()
  }

  if (loading) return <div className="page-loading" />
  return (
    <div className="ow-schedule">
      <p className="ow-intro">
        Confirm what’s on your screens. Fans see <b>Verified by venue</b> only for games you confirm here — everything else shows as an unconfirmed
        demo listing.
      </p>
      <ul className="sched">
        {rows.map((r) => (
          <SchedRow key={r.m.id} row={r} venue={venue} onSave={save} onReset={reset} />
        ))}
      </ul>

      <form
        className="sched-add"
        onSubmit={(e) => {
          e.preventDefault()
          const m = getMatch(adding)
          if (m) void save(m, { screens: Math.min(2, venue.screens), sound: false, status: 'verified' }, `${matchTitle(m)} added to your screens`)
          setAdding('')
        }}
      >
        <label className="field">
          <span>Add a game you’re showing</span>
          <select value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Choose a game…</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {fmtDate(m.start)} {fmtTime(m.start)} — {matchTitle(m)} ({getLeague(m.league).short})
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" disabled={!adding}>
          Add & verify
        </button>
      </form>
    </div>
  )
}

function SchedRow({
  row,
  venue,
  onSave,
  onReset,
}: {
  row: Row
  venue: Venue
  onSave: (m: Match, b: { screens: number; sound: boolean; status: 'verified' | 'hidden' }, msg: string) => void
  onReset: (m: Match) => void
}) {
  const gen = BROADCASTS.find((b) => b.venueId === venue.id && b.matchId === row.m.id)
  const [screens, setScreens] = useState(row.ov?.screens ?? gen?.screens ?? 1)
  const [sound, setSound] = useState(row.ov ? !!row.ov.sound : (gen?.sound ?? false))
  const hidden = row.ov?.status === 'hidden'
  const verified = row.ov?.status === 'verified'
  const dirty = verified && (screens !== row.ov!.screens || sound !== !!row.ov!.sound)

  return (
    <li className={`sched-row${hidden ? ' is-hidden' : ''}${verified ? ' is-verified' : ''}`}>
      <MatchLine m={row.m} />
      <span className={`ow-status ${verified ? 'ok' : hidden ? 'off' : 'demo'}`}>
        {verified ? 'Verified' : hidden ? 'Not showing' : row.listed ? 'Demo listing' : '—'}
      </span>
      <div className="sched-controls">
        <div className="mini-stepper" aria-label="Screens">
          <button onClick={() => setScreens((s) => Math.max(1, s - 1))} disabled={hidden || screens <= 1} aria-label="Fewer screens">
            −
          </button>
          <span>
            <b>{screens}</b> {screens === 1 ? 'screen' : 'screens'}
          </span>
          <button onClick={() => setScreens((s) => Math.min(venue.screens, s + 1))} disabled={hidden || screens >= venue.screens} aria-label="More screens">
            +
          </button>
        </div>
        <label className={`switch${hidden ? ' disabled' : ''}`}>
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} disabled={hidden} />
          <span className="switch-track" aria-hidden="true" />
          Sound
        </label>
      </div>
      <div className="sched-actions">
        {!hidden && (!verified || dirty) && (
          <button className="btn btn-primary btn-xs" onClick={() => onSave(row.m, { screens, sound, status: 'verified' }, `${matchTitle(row.m)} verified`)}>
            {verified ? 'Save' : 'Verify'}
          </button>
        )}
        {!hidden && (
          <button className="btn btn-ghost btn-xs" onClick={() => onSave(row.m, { screens, sound: false, status: 'hidden' }, 'Hidden from fans — no new bookings')}>
            Not showing
          </button>
        )}
        {row.ov && (
          <button className="linkish" onClick={() => onReset(row.m)}>
            Reset
          </button>
        )}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* All reservations                                                   */
/* ------------------------------------------------------------------ */

function Reservations({ venue }: { venue: Venue }) {
  const [all, setAll] = useState<Booking[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | Booking['status']>('all')
  const [hideDemo, setHideDemo] = useState(false)
  const load = useCallback(() => {
    api<{ bookings: Booking[] }>('GET', '/owner/bookings').then((r) => setAll(r.bookings))
  }, [])
  useEffect(load, [load])
  if (!all) return <div className="page-loading" />
  const list = all.filter(
    (b) =>
      (status === 'all' || b.status === status) &&
      (!hideDemo || !b.seeded) &&
      (!q || b.code.includes(q.toUpperCase()) || b.guestName?.toLowerCase().includes(q.toLowerCase()) || b.matchTitle.toLowerCase().includes(q.toLowerCase())),
  )
  return (
    <div>
      <div className="ow-filters">
        <input className="ow-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code, guest or game" aria-label="Search reservations" />
        <div className="chips chips-wrap">
          {(['all', 'confirmed', 'checked_in', 'no_show', 'cancelled'] as const).map((s) => (
            <button key={s} className={`chip${status === s ? ' on' : ''}`} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : STATUS[s]}
            </button>
          ))}
          <button className={`chip${hideDemo ? ' on' : ''}`} onClick={() => setHideDemo((h) => !h)} aria-pressed={hideDemo}>
            Real only
          </button>
        </div>
      </div>
      <p className="muted">
        {list.length} of {all.length} reservations at {venue.name}. Rows marked <span className="demo-pill">Demo</span> are seeded history.
      </p>
      <BookingTable bookings={list} onChange={load} showGame />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Analytics                                                          */
/* ------------------------------------------------------------------ */

interface AnalyticsData {
  totals: {
    bookings: number
    covers: number
    cancelled: number
    attended: number
    attendanceRate: number | null
    guests: number
    repeatGuests: number
    repeatRate: number | null
  }
  seededCount: number
  days: { day: string; bookings: number; covers: number; attended: number }[]
  topGames: { title: string; covers: number; bookings: number }[]
}

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

function Analytics() {
  const [a, setA] = useState<AnalyticsData | null>(null)
  useEffect(() => {
    api<AnalyticsData>('GET', '/owner/analytics').then(setA)
  }, [])
  if (!a) return <div className="page-loading" />
  const t = a.totals
  return (
    <div className="ow-analytics">
      {a.seededCount > 0 && (
        <p className="ow-intro">
          Includes <b>{a.seededCount}</b> seeded demo reservations so the pilot dashboard has history. Real bookings are added on top.
        </p>
      )}
      <div className="kpis kpis-4">
        <Kpi label="Bookings" value={t.bookings} sub={`${t.covers} covers · ${t.cancelled} cancelled`} />
        <Kpi label="Attendance" value={pct(t.attendanceRate)} sub={`${t.attended} checked in`} />
        <Kpi label="Guests" value={t.guests} sub="unique fans who came" />
        <Kpi label="Repeat visits" value={pct(t.repeatRate)} sub={`${t.repeatGuests} fans came back`} />
      </div>
      <CoversChart days={a.days} />
      <section className="ow-panel">
        <p className="cap-title">Top games by covers</p>
        <ol className="topgames">
          {a.topGames.map((g, i) => (
            <li key={g.title + i}>
              <span className="topgames-n">{i + 1}</span>
              <span className="topgames-t">{g.title}</span>
              <span className="topgames-v">
                <b>{g.covers}</b> covers · {g.bookings} bookings
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

/** Single-series bar chart: covers per match day, past 2 weeks + next week. */
function CoversChart({ days }: { days: AnalyticsData['days'] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(4, ...days.map((d) => d.covers))
  const nice = Math.ceil(max / 10) * 10
  const W = 720
  const H = 220
  const pad = { l: 34, r: 8, t: 12, b: 26 }
  const bw = (W - pad.l - pad.r) / days.length
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / nice)
  const now = useMinute()
  const todayKey = dayKey(new Date(now))
  const todayIdx = days.findIndex((d) => d.day === todayKey)
  const ticks = [0, nice / 2, nice]
  const h = hover !== null ? days[hover] : null

  return (
    <section className="ow-panel chart">
      <p className="cap-title">Covers per match day</p>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Covers booked per day, last 14 days and next 7" onMouseLeave={() => setHover(null)}>
          {ticks.map((tk) => (
            <g key={tk}>
              <line x1={pad.l} x2={W - pad.r} y1={y(tk)} y2={y(tk)} className="chart-grid" />
              <text x={pad.l - 6} y={y(tk) + 4} className="chart-axis" textAnchor="end">
                {tk}
              </text>
            </g>
          ))}
          {days.map((d, i) => {
            const x = pad.l + i * bw
            const isToday = d.day === todayKey
            const future = d.day > todayKey
            const top = y(d.covers)
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
                {d.covers > 0 && (
                  <path
                    className={`chart-bar${future ? ' future' : ''}${hover === i ? ' hot' : ''}`}
                    d={`M${x + 2} ${H - pad.b}V${top + 4}a4 4 0 0 1 4 -4h${bw - 12}a4 4 0 0 1 4 4V${H - pad.b}z`}
                    style={{ animationDelay: `${i * 25}ms`, transformOrigin: `0 ${H - pad.b}px` }}
                  />
                )}
                {(isToday || (i % 3 === 0 && Math.abs(i - todayIdx) > 1)) && (
                  <text x={x + bw / 2} y={H - 8} className={`chart-axis${isToday ? ' today' : ''}`} textAnchor="middle">
                    {isToday ? 'Today' : new Date(d.day + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </text>
                )}
                {isToday && <line x1={x + bw / 2} x2={x + bw / 2} y1={pad.t} y2={H - pad.b} className="chart-today" />}
              </g>
            )
          })}
        </svg>
        {h && (
          <div className="chart-tip" style={{ left: `${((pad.l + (hover! + 0.5) * bw) / W) * 100}%` }}>
            <b>{new Date(h.day + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</b>
            <span>{h.covers} covers</span>
            <span>{h.bookings} bookings</span>
            {h.day <= todayKey && <span>{h.attended} checked in</span>}
          </div>
        )}
      </div>
      <p className="fine">Lighter bars are upcoming days (bookings so far).</p>
      <table className="sr-only">
        <caption>Covers per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th>{d.day}</th>
              <td>{d.covers} covers</td>
              <td>{d.bookings} bookings</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

function Settings({ venue }: { venue: Venue }) {
  const [tables, setTables] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api<{ tables: number }>('GET', '/owner/venue').then((r) => setTables(r.tables))
  }, [])
  if (tables === null) return <div className="page-loading" />
  return (
    <form
      className="ow-panel ow-settings"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api('PUT', '/owner/settings', { tables })
          toast('Capacity saved — availability updates right away')
          void refreshLive()
        } catch (e2) {
          toast(errText(e2), 'err')
        } finally {
          setBusy(false)
        }
      }}
    >
      <label className="field">
        <span>Bookable tables per game</span>
        <input type="number" min={0} max={200} value={tables} onChange={(e) => setTables(Number(e.target.value))} />
        <small>
          Tables seat 4 and are split across four arrival slots. Set 0 to pause online bookings. Room capacity: about {venue.capacity}.
        </small>
      </label>
      <button className="btn btn-primary" disabled={busy}>
        Save capacity
      </button>
    </form>
  )
}
