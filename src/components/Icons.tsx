import type { SVGProps } from 'react'
import type { SportId } from '../types'

/* Thin-stroke line icons matching the deck's icon set (search, verified,
   users, clock), drawn on a 24px grid with round caps. */

type P = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 20, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconSearch = (p: P) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7.5" />
    <path d="m20.5 20.5-4.2-4.2" />
  </Base>
)
export const IconClock = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 6.5V12l3.5 2" />
  </Base>
)
export const IconUsers = (p: P) => (
  <Base {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </Base>
)
export const IconVerified = (p: P) => (
  <Base {...p}>
    <path d="M12 2.5l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L12 19.1l-2.2-1.6-2.7.1-.9-2.6L4 13.4l.8-2.6L4 8.2l2.2-1.6.9-2.6 2.7.1z" />
    <path d="m9 11 2 2 4-4" />
  </Base>
)
export const IconPin = (p: P) => (
  <Base {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Base>
)
export const IconHome = (p: P) => (
  <Base {...p}>
    <path d="M4 21V10a8 8 0 0 1 16 0v11" />
    <path d="M9.5 21v-6h5v6" />
  </Base>
)
export const IconCalendar = (p: P) => (
  <Base {...p}>
    <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
    <path d="M16 2.5v4M8 2.5v4M3 10h18" />
  </Base>
)
export const IconHeart = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Base {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
  </Base>
)
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <Base {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9Z" />
  </Base>
)
export const IconX = (p: P) => (
  <Base {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
)
export const IconChevron = (p: P) => (
  <Base {...p}>
    <path d="m9 18 6-6-6-6" />
  </Base>
)
export const IconChevronDown = (p: P) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
)
export const IconArrowLeft = (p: P) => (
  <Base {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Base>
)
export const IconTv = (p: P) => (
  <Base {...p}>
    <rect x="2.5" y="6.5" width="19" height="14" rx="2" />
    <path d="m16.5 2.5-4.5 4-4.5-4" />
  </Base>
)
export const IconTicket = (p: P) => (
  <Base {...p}>
    <path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
    <path d="M14 5v2M14 11v2M14 17v2" />
  </Base>
)
export const IconSpark = (p: P) => (
  <Base {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </Base>
)
export const IconBeer = (p: P) => (
  <Base {...p}>
    <path d="M6 8h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
    <path d="M16 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2" />
    <path d="M6 8a3 3 0 0 1 2.5-4.6A3.5 3.5 0 0 1 15 4a2.5 2.5 0 0 1 1 4" />
    <path d="M9.5 12v6M12.5 12v6" />
  </Base>
)

/* Sport glyphs */
export const IconFootball = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m12 7.5 4 2.9-1.5 4.7h-5L8 10.4Z" />
    <path d="M12 7.5V2.6M16 10.4l4.6-1.5M14.5 15.1l2.9 3.9M9.5 15.1 6.6 19M8 10.4 3.4 8.9" />
  </Base>
)
export const IconBasketball = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M2.5 12h19M12 2.5v19" />
    <path d="M5.3 5.3a9.5 9.5 0 0 1 0 13.4M18.7 5.3a9.5 9.5 0 0 0 0 13.4" />
  </Base>
)
export const IconTennis = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M5.2 5.4a9.5 9.5 0 0 1 0 13.2M18.8 5.4a9.5 9.5 0 0 0 0 13.2" />
  </Base>
)
export const IconFlag = (p: P) => (
  <Base {...p}>
    <path d="M5 21V3.5" />
    <path d="M5 4h14v9H5" />
    <path d="M9.7 4v9M14.3 4v9M5 8.5h14" />
  </Base>
)
export const IconAmFootball = (p: P) => (
  <Base {...p}>
    <path d="M4.2 19.8c-1.6-5.4.3-11.4 4.6-14 3.4-2.1 7.6-2.4 11-1.8.6 3.4.3 7.6-1.8 11-2.6 4.3-8.6 6.2-13.8 4.8Z" />
    <path d="m8.5 15.5 7-7M10 11l1 1M12 9l1 1M11.5 13.5l1 1" />
  </Base>
)

export function SportIcon({ sport, ...p }: P & { sport: SportId }) {
  switch (sport) {
    case 'football':
      return <IconFootball {...p} />
    case 'basketball':
      return <IconBasketball {...p} />
    case 'tennis':
      return <IconTennis {...p} />
    case 'motorsport':
      return <IconFlag {...p} />
    case 'american-football':
      return <IconAmFootball {...p} />
  }
}
