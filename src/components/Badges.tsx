import type { CSSProperties } from 'react'
import { getTeam } from '../data/demo'
import type { LiveBroadcast } from '../state/live'
type Broadcast = LiveBroadcast
import { Crest } from './Crest'
import { IconTv, IconVerified } from './Icons'

export function IconSound({ on, size = 14 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4z" />
      {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /> : <path d="m22 9-6 6M16 9l6 6" />}
    </svg>
  )
}

/**
 * Only a venue owner's confirmation counts as "Verified". Generated demo
 * listings say so plainly.
 */
export function VerifiedBadge({ b, long = false }: { b: LiveBroadcast; long?: boolean }) {
  const m = b.verifiedMinAgo
  const ago = m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
  if (b.listing === 'venue')
    return (
      <span className="vb vb-ok" title={`Confirmed by the venue in their dashboard ${ago}`}>
        <IconVerified size={14} />
        {long ? `Verified by venue · ${ago}` : 'Verified'}
      </span>
    )
  if (b.status === 'reported')
    return (
      <span className="vb vb-pending" title="Demo listing reported by fans — the venue hasn’t confirmed it">
        <IconVerified size={14} />
        {long ? 'Fan-reported · not confirmed' : 'Unconfirmed'}
      </span>
    )
  return (
    <span className="vb vb-listed" title="Demo listing — not yet confirmed by the venue">
      <IconTv size={14} />
      {long ? 'Listed · awaiting venue confirmation' : 'Listed'}
    </span>
  )
}

export function SoundBadge({ b }: { b: Broadcast }) {
  return (
    <span className={`vb ${b.sound ? 'vb-sound' : ''}`} title={b.sound ? 'Commentary on' : 'Showing muted — another game has the sound'}>
      <IconSound on={b.sound} />
      {b.sound ? 'Sound on' : 'Muted'}
    </span>
  )
}

export function ScreensBadge({ b, bigScreen }: { b: Broadcast; bigScreen?: string }) {
  return (
    <span className="vb">
      <IconTv size={14} />
      {b.screens} {b.screens === 1 ? 'screen' : 'screens'}
      {b.mainScreen && bigScreen ? ` · ${bigScreen}` : ''}
    </span>
  )
}

export function PartyBadge({ b }: { b: Broadcast }) {
  if (!b.watchParty) return null
  const team = getTeam(b.watchParty.team)
  return (
    <span className="vb vb-party">
      {team ? <Crest team={team} size={14} /> : <span aria-hidden="true">★</span>}
      Watch party
    </span>
  )
}

/** Animated "who's going" stack, in the deck's avatar-dot style. */
const DOTS = ['#B8935A', '#C9A45C', '#8A5433', '#E4CFB3', '#5A6B8C', '#7A1F2B']

export function FanStack({
  fans,
  confirmed = 0,
  capacity,
  compact = false,
}: {
  /** Simulated demo estimate */
  fans: number
  /** Real fans who said they're going */
  confirmed?: number
  capacity?: number
  compact?: boolean
}) {
  const shown = Math.min(compact ? 4 : 5, Math.max(1, Math.round(fans / 12)))
  const fill = capacity ? Math.min(1, fans / (capacity * 0.6)) : undefined
  return (
    <span className={`fanstack${compact ? ' compact' : ''}`}>
      <span className="fanstack-dots" aria-hidden="true">
        {Array.from({ length: shown }, (_, i) => (
          <i key={i} style={{ background: DOTS[i % DOTS.length], '--i': i } as CSSProperties} />
        ))}
      </span>
      <span className="fanstack-n" title="Expected crowd is a demo estimate; confirmed fans said “I’m going” in the app">
        <b>{fans}</b> expected
        {confirmed > 0 && (
          <span className="fanstack-real">
            {' '}
            · <b>{confirmed}</b> confirmed
          </span>
        )}
      </span>
      {fill !== undefined && !compact && (
        <span className="fanstack-meter" title={`${Math.round(fill * 100)}% of the room`}>
          <span style={{ width: `${Math.max(6, fill * 100)}%` }} />
        </span>
      )}
    </span>
  )
}

/** Vintage pub roundel: monogram + established year. */
export function Roundel({ name, est, size = 64 }: { name: string; est: number; size?: number }) {
  const initials = name
    .replace(/^The\s+/i, '')
    .split(/\s+|&/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const id = `rd-${name.replace(/\W/g, '')}`
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="roundel" aria-hidden="true">
      <defs>
        <path id={id} d="M50 50m-37 0a37 37 0 1 1 74 0a37 37 0 1 1-74 0" />
      </defs>
      <circle cx="50" cy="50" r="48" fill="#17110E" stroke="#B8935A" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="29" fill="none" stroke="#B8935A" strokeOpacity=".5" />
      <text fontFamily="Barlow Condensed, DM Sans, sans-serif" fontSize="10.5" fontWeight="600" letterSpacing="3.2" fill="#B8935A">
        <textPath href={`#${id}`} startOffset="2%">
          SPORTS · BAR · EST · {est} · CHEERS ·
        </textPath>
      </text>
      <text x="50" y="59" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontWeight="700" fontStyle="italic" fontSize="28" fill="#F3E9DA">
        {initials}
      </text>
    </svg>
  )
}
