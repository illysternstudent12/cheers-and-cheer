import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CityId } from '../types'

/* Fan preferences live in localStorage for the MVP. When accounts arrive
   (later batch) this provider is the single place to swap in a backend. */

export interface Prefs {
  favTeams: string[]
  favLeagues: string[]
  city: CityId
  onboarded: boolean
}

const KEY = 'cc.prefs.v1'
const DEFAULTS: Prefs = { favTeams: [], favLeagues: [], city: 'tel-aviv', onboarded: false }

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

export interface Here {
  lat: number
  lng: number
}

interface PrefsApi extends Prefs {
  /** Device location for this session only (never persisted). */
  here: Here | null
  setHere: (h: Here | null) => void
  toggleTeam: (id: string) => void
  toggleLeague: (id: string) => void
  setCity: (c: CityId) => void
  replace: (p: Pick<Prefs, 'favTeams' | 'favLeagues' | 'city'>) => void
  finishOnboarding: () => void
  isFavTeam: (id?: string) => boolean
}

const Ctx = createContext<PrefsApi | null>(null)

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load)
  const [here, setHere] = useState<Here | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs))
    } catch {
      /* storage unavailable (private mode) — prefs stay in memory */
    }
  }, [prefs])

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

  const toggleTeam = useCallback((id: string) => setPrefs((p) => ({ ...p, favTeams: toggle(p.favTeams, id) })), [])
  const toggleLeague = useCallback(
    (id: string) => setPrefs((p) => ({ ...p, favLeagues: toggle(p.favLeagues, id) })),
    [],
  )
  const setCity = useCallback((city: CityId) => setPrefs((p) => ({ ...p, city })), [])
  const replace = useCallback(
    (next: Pick<Prefs, 'favTeams' | 'favLeagues' | 'city'>) => setPrefs((p) => ({ ...p, ...next })),
    [],
  )
  const finishOnboarding = useCallback(() => setPrefs((p) => ({ ...p, onboarded: true })), [])

  const api = useMemo<PrefsApi>(
    () => ({
      ...prefs,
      here,
      setHere,
      toggleTeam,
      toggleLeague,
      setCity,
      replace,
      finishOnboarding,
      isFavTeam: (id?: string) => !!id && prefs.favTeams.includes(id),
    }),
    [prefs, here, toggleTeam, toggleLeague, setCity, replace, finishOnboarding],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function usePrefs(): PrefsApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePrefs must be used inside PrefsProvider')
  return v
}
