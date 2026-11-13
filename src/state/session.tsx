import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, type SessionUser } from '../api/client'
import type { CityId } from '../types'
import { refreshLive } from './live'
import { usePrefs } from './prefs'

interface SessionApi {
  user: SessionUser | null
  ready: boolean
  login: (email: string, password: string) => Promise<SessionUser>
  register: (input: { name: string; email: string; password: string; venueCode?: string }) => Promise<SessionUser>
  logout: () => Promise<void>
}

const Ctx = createContext<SessionApi | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)
  const prefs = usePrefs()

  useEffect(() => {
    api<{ user: SessionUser | null }>('GET', '/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  // Signing in brings the fan's saved teams/city; local picks made while signed out are merged in.
  const adopt = useCallback(
    (u: SessionUser) => {
      setUser(u)
      if (u.prefs) {
        prefs.replace({
          favTeams: [...new Set([...u.prefs.favTeams, ...prefs.favTeams])],
          favLeagues: [...new Set([...u.prefs.favLeagues, ...prefs.favLeagues])],
          city: (u.prefs.city as CityId) ?? prefs.city,
        })
      }
      void refreshLive()
      return u
    },
    [prefs],
  )

  const login = useCallback(
    async (email: string, password: string) => adopt((await api<{ user: SessionUser }>('POST', '/auth/login', { email, password })).user),
    [adopt],
  )
  const register = useCallback(
    async (input: { name: string; email: string; password: string; venueCode?: string }) =>
      adopt((await api<{ user: SessionUser }>('POST', '/auth/register', input)).user),
    [adopt],
  )
  const logout = useCallback(async () => {
    await api('POST', '/auth/logout').catch(() => undefined)
    setUser(null)
    void refreshLive()
  }, [])

  // Keep favourites in sync with the account (debounced).
  const first = useRef(true)
  useEffect(() => {
    if (!user) return
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => {
      void api('PUT', '/me/prefs', { prefs: { favTeams: prefs.favTeams, favLeagues: prefs.favLeagues, city: prefs.city } }).catch(() => undefined)
    }, 600)
    return () => clearTimeout(t)
  }, [user, prefs.favTeams, prefs.favLeagues, prefs.city])

  const value = useMemo(() => ({ user, ready, login, register, logout }), [user, ready, login, register, logout])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession must be used inside SessionProvider')
  return v
}
