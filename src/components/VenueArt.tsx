import { rng } from '../data/rand'
import type { SportId, Venue } from '../types'

/*
 * Illustrated venue interiors in the pitch deck's style (brick, copper
 * pendants, a glowing screen wall, a crowd in silhouette). Generated per
 * venue so every room looks different, and never passes as a real photo.
 */

interface Look {
  wall: string
  wall2: string
  texture: 'brick' | 'panel' | 'tile'
  lamp: string
  counter: string
  top: string
}

export const LOOKS: Look[] = [
  { wall: '#3B2419', wall2: '#2A1912', texture: 'brick', lamp: '#B8935A', counter: '#2B1C14', top: '#8A5433' }, // copper brick
  { wall: '#4A1A22', wall2: '#2E0F15', texture: 'panel', lamp: '#E9A23B', counter: '#2A1013', top: '#C9BBA6' }, // burgundy + marble
  { wall: '#4A3020', wall2: '#2B1C14', texture: 'panel', lamp: '#C9A45C', counter: '#24170F', top: '#7A5235' }, // walnut
  { wall: '#2D2019', wall2: '#121A2C', texture: 'tile', lamp: '#E9A23B', counter: '#1F1611', top: '#E4CFB3' }, // navy lounge
  { wall: '#1F3D31', wall2: '#132820', texture: 'panel', lamp: '#C9A45C', counter: '#1A1410', top: '#7A1F2B' }, // stadium green
  { wall: '#33221B', wall2: '#1D1410', texture: 'brick', lamp: '#E9A23B', counter: '#1B120D', top: '#B8935A' }, // dark brick
]

const SCREEN_FILL: Record<SportId, [string, string]> = {
  football: ['#3A7D5F', '#24533F'],
  basketball: ['#B8935A', '#8A5433'],
  tennis: ['#3F7FA0', '#2A5670'],
  motorsport: ['#3C4456', '#3D2C22'],
  'american-football': ['#3A7D5F', '#24533F'],
}

export function VenueArt({
  venue,
  sport,
  className,
  animated = true,
}: {
  venue: Venue
  sport?: SportId
  className?: string
  animated?: boolean
}) {
  const look = LOOKS[venue.look % LOOKS.length]
  const r = rng(venue.id + ':art')
  const id = `va-${venue.id}`
  const W = 400
  const H = 260
  const sp = sport ?? venue.sports[0]
  const [s1, s2] = SCREEN_FILL[sp]

  const big = !!venue.bigScreen
  const n = big ? 1 : Math.min(3, Math.max(2, Math.round(venue.screens / 2)))
  const sw = big ? 230 : n === 2 ? 128 : 96
  const sh = big ? 120 : n === 2 ? 72 : 58
  const gap = 14
  const total = n * sw + (n - 1) * gap
  const sx0 = (W - total) / 2
  const sy = big ? 52 : 70

  const heads = Array.from({ length: 7 }, (_, i) => ({
    x: 20 + i * 60 + r() * 14,
    y: 206 + r() * 10,
    rad: 22 + r() * 6,
    arm: r() < 0.35,
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={`venue-art ${className ?? ''}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.wall} />
          <stop offset="1" stopColor={look.wall2} />
        </linearGradient>
        <linearGradient id={`${id}-scr`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s1} />
          <stop offset="1" stopColor={s2} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#FFD9A0" stopOpacity=".55" />
          <stop offset="1" stopColor="#FFD9A0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-scrglow`}>
          <stop offset="0" stopColor={s1} stopOpacity=".45" />
          <stop offset="1" stopColor={s1} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-tex`} width={look.texture === 'brick' ? 40 : look.texture === 'panel' ? 36 : 24} height={look.texture === 'brick' ? 20 : look.texture === 'panel' ? 260 : 24} patternUnits="userSpaceOnUse">
          {look.texture === 'brick' && (
            <path d="M0 10H40M0 20H40M10 0V10M30 10V20" stroke="#000" strokeOpacity=".22" strokeWidth="1.2" fill="none" />
          )}
          {look.texture === 'panel' && <path d="M0 0V260" stroke="#000" strokeOpacity=".25" strokeWidth="2" />}
          {look.texture === 'tile' && <path d="M0 0H24V24" stroke="#fff" strokeOpacity=".05" fill="none" />}
        </pattern>
      </defs>

      <rect width={W} height={H} fill={`url(#${id}-wall)`} />
      <rect width={W} height={H} fill={`url(#${id}-tex)`} />

      {/* screen glow on the wall */}
      <ellipse cx={W / 2} cy={sy + sh / 2} rx={total * 0.75} ry={sh * 1.3} fill={`url(#${id}-scrglow)`} className={animated ? 'va-glow' : ''} />

      {/* pendant lamps */}
      {[0.18, 0.5, 0.82].map((p, i) => (
        <g key={i} className={animated ? 'va-lamp' : ''} style={{ animationDelay: `${-i * 1.3}s` }}>
          <line x1={W * p} y1="0" x2={W * p} y2={big ? 18 : 30} stroke="#000" strokeOpacity=".5" />
          <circle cx={W * p} cy={big ? 30 : 42} r="46" fill={`url(#${id}-glow)`} />
          <path d={`M${W * p - 13} ${big ? 30 : 42}h26l-5-11h-16z`} fill={look.lamp} />
          <ellipse cx={W * p} cy={big ? 31 : 43} rx="10" ry="2.6" fill="#FFE2B0" />
        </g>
      ))}

      {/* screens */}
      {Array.from({ length: n }, (_, i) => {
        const x = sx0 + i * (sw + gap)
        return (
          <g key={i}>
            <rect x={x - 5} y={sy - 5} width={sw + 10} height={sh + 10} rx="4" fill="#0F0B09" />
            <rect x={x} y={sy} width={sw} height={sh} fill={`url(#${id}-scr)`} className={animated ? 'va-screen' : ''} style={{ animationDelay: `${-i * 0.7}s` }} />
            {sp === 'football' || sp === 'american-football' ? (
              <g stroke="#F3E9DA" strokeOpacity=".45" fill="none" strokeWidth="1">
                <rect x={x + 6} y={sy + 6} width={sw - 12} height={sh - 12} />
                <line x1={x + sw / 2} y1={sy + 6} x2={x + sw / 2} y2={sy + sh - 6} />
                <circle cx={x + sw / 2} cy={sy + sh / 2} r={sh / 6} />
              </g>
            ) : sp === 'basketball' ? (
              <g stroke="#F3E9DA" strokeOpacity=".45" fill="none" strokeWidth="1">
                <rect x={x + 6} y={sy + 6} width={sw - 12} height={sh - 12} />
                <line x1={x + sw / 2} y1={sy + 6} x2={x + sw / 2} y2={sy + sh - 6} />
                <path d={`M${x + 6} ${sy + sh * 0.3}a${sh * 0.2} ${sh * 0.2} 0 0 1 0 ${sh * 0.4}`} />
              </g>
            ) : (
              <g stroke="#F3E9DA" strokeOpacity=".4" fill="none">
                <line x1={x + 8} y1={sy + sh * 0.7} x2={x + sw - 8} y2={sy + sh * 0.7} />
              </g>
            )}
            {/* score bug */}
            <rect x={x + 6} y={sy + 6} width={Math.min(52, sw * 0.4)} height="8" rx="2" fill="#17110E" opacity=".85" />
            <rect x={x + 9} y={sy + 8.5} width="10" height="3" rx="1" fill="#C9A45C" />
            <rect x={x + 22} y={sy + 8.5} width="10" height="3" rx="1" fill="#F3E9DA" opacity=".8" />
          </g>
        )
      })}

      {/* bar counter */}
      <rect x="0" y={H - 46} width={W} height="46" fill={look.counter} />
      <rect x="0" y={H - 48} width={W} height="4" fill={look.top} opacity=".85" />

      {/* crowd */}
      <g fill="#0F0B09">
        {heads.map((h, i) => (
          <g key={i} className={animated && h.arm ? 'va-cheer' : ''} style={{ animationDelay: `${-i * 0.4}s`, transformOrigin: `${h.x}px ${h.y}px` }}>
            <circle cx={h.x} cy={h.y - h.rad - 6} r={h.rad * 0.55} />
            <path d={`M${h.x - h.rad} ${H}v-18a${h.rad} ${h.rad} 0 0 1 ${h.rad * 2} 0v18z`} />
            {h.arm && <rect x={h.x + h.rad * 0.4} y={h.y - h.rad * 2.6} width="7" height={h.rad * 1.6} rx="3.5" transform={`rotate(14 ${h.x} ${h.y})`} />}
          </g>
        ))}
      </g>
    </svg>
  )
}
