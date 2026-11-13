import { useEffect, useState, useSyncExternalStore } from 'react'
import QRCode from 'qrcode'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { refreshLive, useLive } from '../state/live'
import { useSession } from '../state/session'
import { IconHeart } from './Icons'

/* ------------------------------- toasts ------------------------------- */

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'err'
}
let toasts: Toast[] = []
const tsubs = new Set<() => void>()
export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: Date.now() + Math.random(), text, tone }
  toasts = [...toasts, t]
  tsubs.forEach((s) => s())
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    tsubs.forEach((s) => s())
  }, 3600)
}
export function Toasts() {
  const list = useSyncExternalStore(
    (cb) => (tsubs.add(cb), () => tsubs.delete(cb)),
    () => toasts,
  )
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function errText(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Something went wrong. Try again.'
}

/* ----------------------------- auth gate ------------------------------ */

/** Returns a function that runs `fn` if signed in, else sends the fan to sign in and back. */
export function useAuthed() {
  const { user } = useSession()
  const nav = useNavigate()
  const loc = useLocation()
  /** `intent` (e.g. "book=1") is added to the return URL so the action resumes after sign-in. */
  return (fn: () => void, why = 'Sign in to continue', intent?: string) => {
    if (user) return fn()
    const back = loc.pathname + loc.search + (intent ? (loc.search ? '&' : '?') + intent : '')
    nav(`/signin?next=${encodeURIComponent(back)}&why=${encodeURIComponent(why)}`)
  }
}

/* ----------------------------- I'm going ------------------------------ */

export function GoingButton({ matchId, venueId, venueName, compact = false }: { matchId: string; venueId?: string; venueName?: string; compact?: boolean }) {
  const live = useLive()
  const authed = useAuthed()
  const [busy, setBusy] = useState(false)
  const mine = live.mine?.going.find((g) => g.matchId === matchId)
  const here = !!mine && (!venueId || mine.venueId === venueId)
  const booked = live.mine?.bookings.some((b) => b.matchId === matchId && b.status === 'confirmed')

  const toggle = () =>
    authed(async () => {
      setBusy(true)
      try {
        if (here) {
          if (booked) return toast('You have a table booked for this game — cancel the booking to change plans.', 'err')
          await api('DELETE', `/going/${matchId}`)
          toast('Removed from your games')
        } else {
          await api('POST', '/going', { matchId, venueId })
          toast(venueId ? `You’re going — see you at ${venueName ?? 'the bar'}!` : 'You’re going! Pick a bar to meet other fans.')
        }
        await refreshLive()
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        setBusy(false)
      }
    }, 'Sign in to tell fans you’re going')

  const switching = !!mine && !!venueId && mine.venueId !== venueId
  return (
    <button className={`going${here ? ' on' : ''}${compact ? ' compact' : ''}`} onClick={toggle} disabled={busy} aria-pressed={here}>
      <span className="going-check" aria-hidden="true">
        {here ? '✓' : '+'}
      </span>
      {here ? 'I’m going' : switching ? 'Go here instead' : 'I’m going'}
    </button>
  )
}

/* ---------------------------- favourites ------------------------------ */

export function FavVenueButton({ venueId, name }: { venueId: string; name: string }) {
  const live = useLive()
  const authed = useAuthed()
  const on = !!live.mine?.favorites.includes(venueId)
  const [pop, setPop] = useState(false)
  return (
    <button
      className={`favbtn${on ? ' on' : ''}${pop ? ' pop' : ''}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      onClick={() =>
        authed(async () => {
          try {
            await api(on ? 'DELETE' : 'POST', `/favorites/${venueId}`)
            setPop(!on)
            await refreshLive()
            toast(on ? 'Removed from favourites' : `${name} saved to favourites`)
          } catch (e) {
            toast(errText(e), 'err')
          }
        }, 'Sign in to save favourite bars')
      }
      onAnimationEnd={() => setPop(false)}
    >
      <IconHeart size={20} filled={on} />
    </button>
  )
}

/* -------------------------------- QR ---------------------------------- */

export function QR({ value, size = 180 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let alive = true
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#17110E', light: '#F3E9DA' } }).then(
      (s) => alive && setSvg(s),
    )
    return () => {
      alive = false
    }
  }, [value])
  return <div className="qr" style={{ width: size, height: size }} role="img" aria-label="Check-in QR code" dangerouslySetInnerHTML={{ __html: svg }} />
}

/* ------------------------------ sharing ------------------------------- */

export async function shareLink(url: string, title: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return
    } catch {
      /* cancelled — fall back to copy */
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    toast('Link copied — paste it anywhere to invite friends')
  } catch {
    toast(url)
  }
}

/** Calendar file the fan downloads themselves. */
export function downloadIcs(opts: { title: string; start: Date; minutes: number; location: string; description: string }) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cheers & Cheer//EN',
    'BEGIN:VEVENT',
    `UID:${fmt(opts.start)}-${Math.random().toString(36).slice(2)}@cheers`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(new Date(opts.start.getTime() + opts.minutes * 60_000))}`,
    `SUMMARY:${esc(opts.title)}`,
    `LOCATION:${esc(opts.location)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = 'cheers-and-cheer.ics'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
