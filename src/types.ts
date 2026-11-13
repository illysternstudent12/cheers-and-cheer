export type SportId = 'football' | 'basketball' | 'tennis' | 'motorsport' | 'american-football'

export interface Sport {
  id: SportId
  name: string
  /** Plural noun used in copy, e.g. "12 football games" */
  noun: string
}

export interface League {
  id: string
  name: string
  short: string
  sport: SportId
  region: string
}

export interface Team {
  id: string
  name: string
  short: string
  sport: SportId
  league: string
  city: string
  /** [primary, secondary] — used to draw a generic crest, never an official logo */
  colors: [string, string]
  aliases?: string[]
}

export type CityId = 'tel-aviv' | 'jerusalem' | 'haifa' | 'london' | 'barcelona' | 'new-york'

export interface City {
  id: CityId
  name: string
  country: string
  pilot?: boolean
  /** Map centre + default zoom */
  lat: number
  lng: number
  zoom: number
}

export interface Showing {
  city: CityId
  venues: number
  fans: number
}

export interface Match {
  id: string
  sport: SportId
  league: string
  home?: string
  away?: string
  /** Used for events without two teams (tennis, motorsport) */
  title?: string
  participants?: [string, string]
  stage: string
  start: Date
  durationMin: number
  broadcast: string
  showings: Showing[]
  aliases?: string[]
  /** Pre-set final score used to simulate live/finished states in the demo */
  final: [number, number]
}

export type MatchStatus = 'upcoming' | 'live' | 'finished'

export type Atmosphere = 'lively' | 'supporters' | 'casual' | 'lounge' | 'family'

export interface Venue {
  id: string
  name: string
  city: CityId
  area: string
  lat: number
  lng: number
  atmosphere: Atmosphere
  /** Short editorial line */
  tagline: string
  description: string
  screens: number
  /** e.g. "4m projector" — the room's hero screen */
  bigScreen?: string
  capacity: number
  tables: number
  sports: SportId[]
  /** Teams whose supporters call this place home */
  homeOf?: string[]
  kitchen: string
  drinks: string
  terrace: boolean
  accessible: boolean
  priceLevel: 1 | 2 | 3
  rating: number
  reviews: number
  hours: string
  est: number
  /** Index into the illustration palette */
  look: number
}

export interface WatchParty {
  name: string
  host: string
  team?: string
}

export interface Broadcast {
  matchId: string
  venueId: string
  screens: number
  mainScreen: boolean
  sound: boolean
  /** verified = confirmed by the venue for this match; reported = fan-reported, awaiting confirmation */
  status: 'verified' | 'reported'
  verifiedMinAgo: number
  fans: number
  tablesLeft: number
  watchParty?: WatchParty
}
