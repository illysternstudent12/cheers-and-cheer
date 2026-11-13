import { countdownParts, countdownShort, pad, useNow } from '../lib/time'
import { liveState, statusOf } from '../lib/match'
import type { Match } from '../types'

/** Small inline status: "in 2h 14m" / "Kick-off in 04:12" / LIVE 63' */
export function StatusPill({ match }: { match: Match }) {
  const now = useNow()
  const status = statusOf(match, now)
  if (status === 'live') {
    const s = liveState(match, now)
    return (
      <span className="pill pill-live">
        <span className="live-dot" aria-hidden="true" />
        Live{s.clock ? ` · ${s.clock}` : ''}
      </span>
    )
  }
  if (status === 'finished') {
    return <span className="pill pill-done">{liveState(match, now).clock}</span>
  }
  const p = countdownParts(match.start, now)
  if (p.total < 3_600_000) {
    return (
      <span className="pill pill-soon" aria-label={`Starts in ${p.minutes} minutes`}>
        <span className="tick" key={p.seconds}>
          {pad(p.minutes)}:{pad(p.seconds)}
        </span>
      </span>
    )
  }
  return <span className="pill pill-upcoming">{countdownShort(match.start, now)}</span>
}

/** Large segmented countdown for the match page. */
export function BigCountdown({ match }: { match: Match }) {
  const now = useNow()
  const p = countdownParts(match.start, now)
  const units: [number, string][] = [
    [p.days, 'days'],
    [p.hours, 'hrs'],
    [p.minutes, 'min'],
    [p.seconds, 'sec'],
  ]
  const shown = p.days > 0 ? units : units.slice(1)
  return (
    <div className="bigcount" role="timer" aria-live="off">
      {shown.map(([v, l]) => (
        <div className="bigcount-cell" key={l}>
          <span className="bigcount-num" key={`${l}-${v}`}>
            {pad(v)}
          </span>
          <span className="bigcount-label">{l}</span>
        </div>
      ))}
    </div>
  )
}
