import type { Team } from '../types'

/**
 * A generic crest in the team's colours with its short code.
 * Deliberately not an official badge — real club marks need licensing.
 */
export function Crest({ team, size = 40 }: { team: Team; size?: number }) {
  const [a, b] = team.colors
  const id = `cr-${team.id}`
  const light = isLight(a)
  return (
    <svg width={size} height={size * 1.12} viewBox="0 0 40 45" className="crest" role="img" aria-label={team.name}>
      <defs>
        <clipPath id={id}>
          <path d="M20 1.5 37.5 6v14.5c0 11-7.6 19.4-17.5 23-9.9-3.6-17.5-12-17.5-23V6Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="40" height="45" fill={a} />
        <path d="M0 30 40 21v24H0Z" fill={b} opacity={0.92} />
      </g>
      <path
        d="M20 1.5 37.5 6v14.5c0 11-7.6 19.4-17.5 23-9.9-3.6-17.5-12-17.5-23V6Z"
        fill="none"
        stroke="rgba(243,233,218,.35)"
        strokeWidth="1.2"
      />
      <text
        x="20"
        y="22"
        textAnchor="middle"
        fontFamily="DM Sans, sans-serif"
        fontWeight={700}
        fontSize={team.short.length > 3 ? 9 : 10.5}
        letterSpacing=".04em"
        fill={light ? '#17110E' : '#F3E9DA'}
      >
        {team.short}
      </text>
    </svg>
  )
}

/** Monogram disc for individual athletes / events without a team. */
export function Monogram({ label, size = 40 }: { label: string; size?: number }) {
  const initials = label
    .replace(/^[A-Z]\.\s*/, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span className="monogram" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {initials}
    </span>
  )
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const bl = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * bl > 160
}
