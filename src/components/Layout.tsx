import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { CITIES, DEMO_NOTICE, MATCHES, getCity } from '../data/demo'
import { matchTitle, showingIn, statusOf } from '../lib/match'
import { fmtTime, relativeDay, useMinute } from '../lib/time'
import { useShowing } from '../state/live'
import { usePrefs } from '../state/prefs'
import { IconCalendar, IconChevronDown, IconHome, IconPin, IconStar, IconTicket } from './Icons'
import { Toasts } from './Social'
import { useSession } from '../state/session'

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className={`wordmark${small ? ' small' : ''}`}>
      Cheers <em>&amp;</em> Cheer
    </span>
  )
}

/** A label that rolls up to a copy of itself on hover, like a flip sign. */
function Roll({ children }: { children: string }) {
  return (
    <span className="roll" data-t={children}>
      <span>{children}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Promo strip: tonight's headline game, straight from the schedule    */
/* ------------------------------------------------------------------ */
function PromoStrip() {
  const now = useMinute()
  const { city } = usePrefs()
  const m = useMemo(
    () =>
      MATCHES.filter((x) => x.home && statusOf(x, now) !== 'finished' && x.start.getTime() - now < 24 * 3_600_000)
        .map((x) => ({ x, fans: showingIn(x, city)?.fans ?? 0 }))
        .filter((r) => r.fans > 0)
        .sort((a, b) => b.fans - a.fans)[0]?.x,
    [now, city],
  )
  const local = useShowing(m?.id ?? '', city)
  if (!m || !local) return null
  const live = statusOf(m, now) === 'live'
  return (
    <div className="promo">
      <p className="promo-in">
        <span className={`promo-tag${live ? ' is-live' : ''}`}>{live ? 'Live now' : relativeDay(m.start, now)}</span>
        <b>{matchTitle(m)}</b>
        {!live && <span className="promo-dim">{fmtTime(m.start)}</span>}
        <span className="promo-sep" aria-hidden="true">·</span>
        <span className="promo-dim">
          {local.venues} bars listed in {getCity(city).name}
        </span>
        <Link to={`/map?match=${m.id}`} className="promo-link">
          Find a seat
        </Link>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Centre navigation with a highlight that glides between links        */
/* ------------------------------------------------------------------ */
const NAV = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/games', label: 'Games', icon: IconCalendar, end: false },
  { to: '/map', label: 'Bars', icon: IconPin, end: false },
  { to: '/teams', label: 'My teams', icon: IconStar, end: false },
  { to: '/me', label: 'My nights', icon: IconTicket, end: false, mobileOnly: true },
]

function TopNav() {
  const ref = useRef<HTMLElement>(null)
  const loc = useLocation()

  const place = (el: HTMLElement | null | undefined, hovering = false) => {
    const n = ref.current
    if (!n) return
    if (!el) {
      n.style.setProperty('--ind-o', '0')
      return
    }
    n.style.setProperty('--ind-x', `${el.offsetLeft}px`)
    n.style.setProperty('--ind-w', `${el.offsetWidth}px`)
    n.style.setProperty('--ind-o', '1')
    n.classList.toggle('is-hovering', hovering)
  }
  const toActive = () => place(ref.current?.querySelector<HTMLElement>('a.active'))

  useLayoutEffect(toActive, [loc.pathname])
  useEffect(() => {
    document.fonts?.ready.then(toActive)
    window.addEventListener('resize', toActive)
    return () => window.removeEventListener('resize', toActive)
  }, [])

  return (
    <nav className="topnav" aria-label="Main" ref={ref} onMouseLeave={toActive}>
      <span className="topnav-ind" aria-hidden="true" />
      {NAV.filter((n) => !n.mobileOnly).map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className="topnav-link"
          onMouseEnter={(e) => place(e.currentTarget, true)}
          onFocus={(e) => place(e.currentTarget, true)}
          onBlur={toActive}
        >
          <Roll>{n.label}</Roll>
        </NavLink>
      ))}
    </nav>
  )
}

function CityPicker() {
  const { city, setCity } = usePrefs()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="citypick" ref={ref}>
      <button className="citypick-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox">
        <IconPin size={15} />
        <span>{getCity(city).name}</span>
        <IconChevronDown size={13} />
      </button>
      {open && (
        <ul className="citypick-menu" role="listbox" aria-label="Your city">
          {CITIES.map((c) => (
            <li key={c.id}>
              <button
                role="option"
                aria-selected={c.id === city}
                className={c.id === city ? 'on' : ''}
                onClick={() => {
                  setCity(c.id)
                  setOpen(false)
                }}
              >
                <span>{c.name}</span>
                <small>{c.pilot ? 'Pilot city' : c.country}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** How many games are on screens right now. */
function OnAir() {
  const now = useMinute()
  const n = MATCHES.filter((m) => statusOf(m, now) === 'live').length
  return (
    <Link to="/games?date=live" className={`onair${n ? ' is-on' : ''}`} aria-label={`${n} games live now`} title="Live now">
      <span className="onair-lamp" aria-hidden="true" />
      <b>{n}</b>
      <span className="onair-txt">live</span>
    </Link>
  )
}

const IconUser = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.2-4 4.3-6 8-6s6.8 2 8 6" />
  </svg>
)

function AccountButton() {
  const { user, ready } = useSession()
  if (!ready) return <span className="acct-ph" />
  if (!user)
    return (
      <Link to="/signin" className="acct" aria-label="Sign in" title="Sign in">
        <IconUser />
      </Link>
    )
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const owner = user.role === 'venue'
  return (
    <Link to={owner ? '/owner' : '/me'} className="acct is-in" aria-label={owner ? 'Venue dashboard' : 'My nights'} title={owner ? 'Venue dashboard' : 'My nights'}>
      {initials}
    </Link>
  )
}

function NavCta({ children }: { children: ReactNode }) {
  return (
    <Link to="/map" className="nav-cta">
      {children}
      <span className="nav-cta-ico" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  )
}

/** Scroll state for the header: flush at the top, a floating capsule once you move. */
function useScrolled(threshold = 16) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [threshold])
  return scrolled
}

export function Layout() {
  const loc = useLocation()
  const scrolled = useScrolled()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [loc.pathname])

  return (
    <div className="app">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <PromoStrip />
      <header className={`topbar${scrolled ? ' is-scrolled' : ''}`}>
        <div className="topbar-in">
          <Link to="/" className="brand" aria-label="Cheers & Cheer home">
            <Wordmark />
            <span className="demo-tag" title={DEMO_NOTICE}>
              Demo
            </span>
          </Link>
          <TopNav />
          <div className="topbar-end">
            <OnAir />
            <CityPicker />
            <AccountButton />
            <NavCta>
              <Roll>Find a bar</Roll>
            </NavCta>
          </div>
        </div>
      </header>

      <main id="main" className="page" key={loc.pathname}>
        <Outlet />
      </main>

      <footer className="sitefoot">
        <div className="wrap sitefoot-in">
          <div>
            <Wordmark small />
            <p className="sitefoot-tag">
              <em>Cheer together.</em> <em className="accent">Cheers together.</em>
            </p>
          </div>
          <p className="sitefoot-note">
            {DEMO_NOTICE} Team crests are generic placeholders, not official marks. Venue names are illustrative, not real
            partners. Bookings, RSVPs and venue confirmations you make are real and stored in this app’s database.
          </p>
        </div>
      </footer>

      <Toasts />
      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="tab">
            <n.icon size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
