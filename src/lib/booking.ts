/**
 * Booking rules shared by the app and the API, so the screen and the server
 * always agree on slots and capacity.
 *
 * Model: a table seats up to 4 and is held for the whole game. Guests pick
 * an arrival slot; each slot has a share of the room's tables.
 */

export const SEATS_PER_TABLE = 4
export const MAX_PARTY = 12
export const SLOT_OFFSETS = [-90, -60, -30, 0] as const
export type SlotOffset = (typeof SLOT_OFFSETS)[number]

/** Where simulated (demo) bookings sit across slots — fans arrive early. */
const BASELINE_WEIGHTS = [0.35, 0.3, 0.2, 0.15]

export const tablesFor = (party: number) => Math.ceil(party / SEATS_PER_TABLE)

export function slotLabel(offset: number): string {
  if (offset === 0) return 'At kick-off'
  const m = -offset
  return m >= 60 ? `${m / 60 === 1 ? '1 hr' : `${m / 60} hrs`} before` : `${m} min before`
}

export interface SlotAvailability {
  offset: SlotOffset
  capacity: number
  left: number
}

/**
 * @param totalTables   bookable tables tonight (venue setting)
 * @param baselineBooked tables taken in the simulated demo data
 * @param realBySlot     tables held by real bookings, keyed by slot offset
 */
export function slotPlan(totalTables: number, baselineBooked: number, realBySlot: Partial<Record<number, number>>): SlotAvailability[] {
  const n = SLOT_OFFSETS.length
  const base = Math.floor(totalTables / n)
  let rem = totalTables - base * n
  let baseLeft = Math.min(baselineBooked, totalTables)
  return SLOT_OFFSETS.map((offset, i) => {
    const capacity = base + (rem-- > 0 ? 1 : 0)
    const simulated = i === n - 1 ? baseLeft : Math.min(baseLeft, Math.round(baselineBooked * BASELINE_WEIGHTS[i]))
    baseLeft -= Math.min(simulated, capacity)
    const real = realBySlot[offset] ?? 0
    return { offset, capacity, left: Math.max(0, capacity - Math.min(simulated, capacity) - real) }
  })
}

export const totalLeft = (plan: SlotAvailability[]) => plan.reduce((n, s) => n + s.left, 0)

/** Short, unambiguous booking code (no 0/O/1/I). */
export function makeCode(rand: () => number = Math.random): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += A[Math.floor(rand() * A.length)]
  return s
}
