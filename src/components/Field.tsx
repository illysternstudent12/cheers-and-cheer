import type { CSSProperties, ReactNode } from 'react'
import type { SportId } from '../types'

/**
 * A broadcast-camera view of the playing surface, drawn in SVG so it stays
 * crisp on every screen size. Used inside the TV wall and match cards.
 * `live` animates players drifting across the surface in the two team colours.
 */
export function Field({
  sport,
  live = false,
  colors = ['#efe3cc', '#7a1f2b'],
  className = '',
}: {
  sport: SportId
  live?: boolean
  colors?: [string, string]
  className?: string
}) {
  return (
    <svg
      className={`surface surface-${sport}${live ? ' is-live' : ''} ${className}`}
      viewBox="0 0 160 90"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {SURFACES[sport]}
      {live && <Players sport={sport} colors={colors} />}
    </svg>
  )
}

const L = { fill: 'none', stroke: 'rgba(245,236,220,.62)', strokeWidth: 0.7 } as const

const SURFACES: Record<SportId, ReactNode> = {
  football: (
    <>
      <rect width="160" height="90" fill="#24533f" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x={i * 20} width="10" height="90" fill="#2c6249" />
      ))}
      <rect x="10" y="9" width="140" height="72" {...L} />
      <path d="M80 9v72" {...L} />
      <circle cx="80" cy="45" r="11" {...L} />
      <circle cx="80" cy="45" r=".9" fill="rgba(245,236,220,.7)" />
      <path d="M10 26h20v38H10M150 26h-20v38h20M10 36h7v18h-7M150 36h-7v18h7" {...L} />
      <path d="M30 38a8 8 0 0 1 0 14M130 38a8 8 0 0 0 0 14" {...L} />
    </>
  ),
  'american-football': (
    <>
      <rect width="160" height="90" fill="#1f4c39" />
      <rect x="0" width="16" height="90" fill="#5a1a24" />
      <rect x="144" width="16" height="90" fill="#5a1a24" />
      {Array.from({ length: 13 }).map((_, i) => (
        <path key={i} d={`M${20 + i * 10} 8v74`} {...L} strokeWidth={i === 6 ? 1 : 0.55} />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <path key={'h' + i} d={`M${25 + i * 10} 34v2M${25 + i * 10} 54v2`} {...L} />
      ))}
      <rect x="16" y="8" width="128" height="74" {...L} />
      <text x="8" y="49" fontSize="7" fill="rgba(245,236,220,.5)" textAnchor="middle" transform="rotate(-90 8 47)" fontFamily="Barlow Condensed, sans-serif" fontWeight="700" letterSpacing="1">HOME</text>
      <text x="152" y="49" fontSize="7" fill="rgba(245,236,220,.5)" textAnchor="middle" transform="rotate(90 152 47)" fontFamily="Barlow Condensed, sans-serif" fontWeight="700" letterSpacing="1">AWAY</text>
    </>
  ),
  basketball: (
    <>
      <rect width="160" height="90" fill="#8a5a33" />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} y={i * 7.5} width="160" height="3.7" fill="#93623a" />
      ))}
      <rect x="10" y="9" width="140" height="72" {...L} stroke="rgba(250,240,225,.75)" />
      <path d="M80 9v72" {...L} stroke="rgba(250,240,225,.75)" />
      <circle cx="80" cy="45" r="9" {...L} stroke="rgba(250,240,225,.75)" />
      <rect x="10" y="35" width="27" height="20" fill="rgba(122,31,43,.55)" {...{ stroke: 'rgba(250,240,225,.75)', strokeWidth: 0.7 }} />
      <rect x="123" y="35" width="27" height="20" fill="rgba(122,31,43,.55)" {...{ stroke: 'rgba(250,240,225,.75)', strokeWidth: 0.7 }} />
      <path d="M10 15h12a30 30 0 0 1 0 60H10M150 15h-12a30 30 0 0 0 0 60h12" {...L} stroke="rgba(250,240,225,.75)" />
    </>
  ),
  tennis: (
    <>
      <rect width="160" height="90" fill="#8e3b2c" />
      <rect x="22" y="12" width="116" height="66" fill="#a2482f" />
      <rect x="22" y="12" width="116" height="66" {...L} stroke="rgba(250,240,225,.85)" />
      <path d="M22 20h116M22 70h116M50 20v50M110 20v50M50 45h60" {...L} stroke="rgba(250,240,225,.85)" />
      <path d="M80 9v72" stroke="rgba(20,14,12,.65)" strokeWidth="1.6" />
      <path d="M80 9v72" stroke="rgba(250,240,225,.6)" strokeWidth=".5" strokeDasharray="1 1" />
    </>
  ),
  motorsport: (
    <>
      <rect width="160" height="90" fill="#2b3a2c" />
      <path d="M-10 70C30 70 40 22 80 22s50 52 90 52" fill="none" stroke="#2a2725" strokeWidth="22" />
      <path d="M-10 70C30 70 40 22 80 22s50 52 90 52" fill="none" stroke="rgba(245,236,220,.5)" strokeWidth=".5" strokeDasharray="4 4" />
      <path d="M-10 59C28 59 38 11 80 11s52 52 90 52" fill="none" stroke="#e9dfcf" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M-10 59C28 59 38 11 80 11s52 52 90 52" fill="none" stroke="#8e2a2a" strokeWidth="2" strokeDasharray="3 3" strokeDashoffset="3" />
      <path d="M-10 81C32 81 42 33 80 33s48 52 90 52" fill="none" stroke="rgba(245,236,220,.35)" strokeWidth=".6" />
      <path d="M58 13l4 18" stroke="#efe3cc" strokeWidth="2.4" strokeDasharray="1.2 1.2" />
    </>
  ),
}

/** Little players / cars drifting about while a game is live. */
function Players({ sport, colors }: { sport: SportId; colors: [string, string] }) {
  if (sport === 'motorsport') {
    return (
      <g className="cars">
        <path id="lap" d="M-10 70C30 70 40 22 80 22s50 52 90 52" fill="none" />
        {[0, 1, 2].map((i) => (
          <rect key={i} width="5" height="2.4" rx="1" y="-1.2" x="-2.5" fill={i === 0 ? colors[1] : i === 1 ? '#efe3cc' : '#c9a45c'}>
            <animateMotion dur="5s" begin={`${-i * 0.55}s`} repeatCount="indefinite" rotate="auto">
              <mpath href="#lap" />
            </animateMotion>
          </rect>
        ))}
      </g>
    )
  }
  const n = sport === 'tennis' ? 1 : sport === 'basketball' ? 3 : 4
  const spots = [
    [36, 30],
    [52, 58],
    [66, 40],
    [44, 46],
  ]
  return (
    <g className="players">
      {Array.from({ length: n }).map((_, i) => {
        const [x, y] = sport === 'tennis' ? [40, 45] : spots[i]
        return (
          <g key={i}>
            <circle className="p" style={{ '--d': `${i * -1.3}s` } as CSSProperties} cx={x} cy={y} r="2.1" fill={colors[0]} stroke="rgba(0,0,0,.4)" strokeWidth=".4" />
            <circle className="p p2" style={{ '--d': `${i * -1.7 - 0.6}s` } as CSSProperties} cx={160 - x} cy={90 - y} r="2.1" fill={colors[1]} stroke="rgba(0,0,0,.4)" strokeWidth=".4" />
          </g>
        )
      })}
      <circle className="ball" cx="80" cy="45" r="1.1" fill="#fffaf0" />
    </g>
  )
}
