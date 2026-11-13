/** Thin JSON client for the Cheers & Cheer API (same origin, cookie session). */
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** The GitHub Pages build has no server: the API runs inside the visitor's browser instead. */
export const STATIC_SITE = import.meta.env.MODE === 'pages'

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  if (STATIC_SITE) {
    const { request } = await import('virtual:browser-api')
    const out = await request(method, path, body)
    const data = (out.data ?? {}) as { error?: string }
    if (out.status >= 400) throw new ApiError(out.status, data.error ?? 'Something went wrong.')
    return out.data as T
  }
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong.')
  return data as T
}

/* ------------------------------ API types ------------------------------ */

export interface SessionUser {
  id: number
  email: string
  name: string
  role: 'fan' | 'venue'
  venueId: string | null
  prefs: { favTeams: string[]; favLeagues: string[]; city: string } | null
}

export interface Booking {
  id: number
  code: string
  venueId: string
  matchId: string
  partySize: number
  tables: number
  slotOffset: number
  arriveAt: string
  status: 'confirmed' | 'cancelled' | 'checked_in' | 'no_show'
  note: string | null
  matchTitle: string
  matchStart: string
  venueName: string
  createdAt: string
  checkedInAt: string | null
  guestName?: string
  seeded: boolean
}

export interface Party {
  slug: string
  title: string
  note: string | null
  matchId: string
  venueId: string
  matchTitle: string
  matchStart: string
  venueName: string
  host: string
  isHost: boolean
  joined: boolean
  members: string[]
  invites?: { email: string; status: string }[]
}

export interface Invite {
  id: number
  slug: string
  title: string
  matchTitle: string
  matchStart: string
  venueName: string
  fromName: string
}

export interface Override {
  venueId: string
  matchId: string
  screens: number
  sound: number
  status: 'verified' | 'hidden'
  updatedAt: string
}

export interface LiveFeed {
  overrides: Override[]
  going: { matchId: string; venueId: string | null; n: number }[]
  booked: { venueId: string; matchId: string; tables: number; guests: number }[]
  settings: { venueId: string; tables: number }[]
  mine: {
    going: { matchId: string; venueId: string | null }[]
    favorites: string[]
    bookings: { code: string; venueId: string; matchId: string; status: string }[]
  } | null
  at: string
}

export interface SlotPlanResponse {
  showing: boolean
  plan: { offset: number; capacity: number; left: number }[]
  total: number
}
