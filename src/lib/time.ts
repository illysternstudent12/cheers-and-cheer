import { useSyncExternalStore } from 'react'

/* A single shared 1-second ticker, so every countdown on screen updates
   together without each component owning its own interval. */
let now = Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => now)
}

/** Minute-resolution clock for lists, so long lists don't re-render every second. */
export function useMinute(): number {
  const n = useNow()
  return Math.floor(n / 60_000) * 60_000
}

const DAY = 86_400_000

export function startOfDay(d: Date | number): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function dayDiff(a: Date | number, b: Date | number): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY)
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function fmtDayShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short' })
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** "Today", "Tomorrow", "Sat 14 Nov" */
export function relativeDay(d: Date, ref: number = Date.now()): string {
  const diff = dayDiff(d, ref)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return fmtDate(d)
}

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

export function countdownParts(target: Date, ref: number): CountdownParts {
  const total = Math.max(0, target.getTime() - ref)
  const s = Math.floor(total / 1000)
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    total,
  }
}

export function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Compact phrase: "in 2d 4h", "in 5h 12m", "in 42m" */
export function countdownShort(target: Date, ref: number): string {
  const p = countdownParts(target, ref)
  if (p.days > 0) return `in ${p.days}d ${p.hours}h`
  if (p.hours > 0) return `in ${p.hours}h ${pad(p.minutes)}m`
  if (p.minutes > 0) return `in ${p.minutes}m`
  return 'starting now'
}
