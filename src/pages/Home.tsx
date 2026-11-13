import { useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MatchCard } from '../components/MatchCard'
import { Crowd, FeaturedGame, ScoreTicker, TvWall } from '../components/TvWall'
import { SearchBox } from '../components/SearchBox'
import { Sheet } from '../components/Sheet'
import { TeamPicker } from '../components/TeamPicker'
import { Crest } from '../components/Crest'
import { IconChevron, IconStar, IconUsers, IconVerified, IconSearch, SportIcon } from '../components/Icons'
import { useBroadcasts } from '../state/live'
import { DEMO_NOTICE, MATCHES, SPORTS, getCity, getMatch, getTeam, getVenue } from '../data/demo'
import { VenueCard } from '../components/VenueCard'
import { useOrigin } from '../lib/origin'
import { distanceKm, type VenueRow } from '../lib/venues'
import { showingIn, statusOf } from '../lib/match'
import { recommend, trending } from '../lib/recommend'
import { POPULAR_SEARCHES } from '../lib/search'
import { useMinute } from '../lib/time'
import { usePrefs } from '../state/prefs'

export function Home() {
  const now = useMinute()
  const prefs = usePrefs()
  const [picking, setPicking] = useState(false)
  const [cheer, setCheer] = useState(false)
  const tavern = useRef<HTMLElement>(null)
  const frame = useRef(0)
  // Pointer parallax: written straight to CSS variables, no re-render.
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return
    const el = tavern.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * 2 - 1
    const y = ((e.clientY - r.top) / r.height) * 2 - 1
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--mx', x.toFixed(3))
      el.style.setProperty('--my', y.toFixed(3))
    })
  }
  const resetMove = () => {
    cancelAnimationFrame(frame.current)
    tavern.current?.style.setProperty('--mx', '0')
    tavern.current?.style.setProperty('--my', '0')
    setCheer(false)
  }
  const city = getCity(prefs.city)

  const live = useMemo(() => MATCHES.filter((m) => statusOf(m, now) === 'live'), [now])
  const recs = useMemo(() => recommend(prefs, now, 6), [prefs, now])
  const hot = useMemo(() => trending(prefs.city, now, 6), [prefs.city, now])
  const nextUp = useMemo(
    () =>
      MATCHES.filter((m) => statusOf(m, now) === 'upcoming' && m.start.getTime() - now < 30 * 3_600_000)
        .filter((m) => showingIn(m, prefs.city))
        .slice(0, 6),
    [now, prefs.city],
  )
  const fansOut = useMemo(
    () =>
      MATCHES.filter((m) => statusOf(m, now) !== 'finished' && m.start.getTime() - now < 12 * 3_600_000).reduce(
        (n, m) => n + (showingIn(m, prefs.city)?.fans ?? 0),
        0,
      ),
    [now, prefs.city],
  )
  const hasFavs = prefs.favTeams.length + prefs.favLeagues.length > 0
  const featured = useMemo(
    () =>
      MATCHES.filter((m) => statusOf(m, now) !== 'finished' && m.start.getTime() - now < 30 * 3_600_000 && m.home)
        .map((m) => ({ m, fans: showingIn(m, prefs.city)?.fans ?? 0 }))
        .sort((a, b) => b.fans - a.fans)
        .slice(0, 3)
        .map((x) => x.m),
    [now, prefs.city],
  )
  const origin = useOrigin()
  const list = useBroadcasts()
  const parties = useMemo(
    () =>
      list.filter((b) => b.watchParty)
        .map((b) => ({ b, m: getMatch(b.matchId)!, v: getVenue(b.venueId)! }))
        .filter(({ m, v }) => v.city === prefs.city && statusOf(m, now) !== 'finished' && m.start.getTime() - now < 48 * 3_600_000)
        .sort((x, y) => x.m.start.getTime() - y.m.start.getTime())
        .slice(0, 8)
        .map(({ b, m, v }): VenueRow => ({ venue: v, broadcast: b, match: m, distance: distanceKm(origin, v) })),
    [list, prefs.city, now, origin.lat, origin.lng], // eslint-disable-line
  )

  return (
    <>
      {/* ---------------- Hero: the basement bar ---------------- */}
      <section className={`tavern${cheer ? ' is-cheering' : ''}`} ref={tavern} onPointerMove={onMove} onPointerLeave={resetMove}>
        <div className="tavern-brick" aria-hidden="true" />
        <div className="tavern-lamps" aria-hidden="true">
          <span className="lamp" />
          <span className="lamp" />
          <span className="lamp" />
          <span className="lamp" />
        </div>
        <div className="wrap tavern-in">
          <header className="tavern-copy">
            <p className="eyebrow">
              <span className="live-dot" /> {live.length} live now · {city.name} · {fansOut.toLocaleString('en-GB')} fans expected out tonight
            </p>
            <h1 className="display tavern-title">
              The game’s on. <em>Pull up a stool.</em>
            </h1>
          </header>
          <TvWall onCheer={setCheer} />
        </div>
        <Crowd />
        <div className="counter">
          <div className="counter-top" aria-hidden="true" />
          <div className="wrap counter-in">
            <div className="counter-search">
              <SearchBox size="hero" placeholder="What are you watching tonight? Team, league, match or city" />
            </div>
            <div className="quick">
              <span className="quick-label">On everyone’s lips</span>
              {POPULAR_SEARCHES.map((s, i) => (
                <Link key={s} to={`/games?q=${encodeURIComponent(s)}`} className="coaster" style={{ '--i': i } as CSSProperties}>
                  {s}
                </Link>
              ))}
            </div>
            <p className="counter-promise">
              <span>Every game.</span> <span>Every city.</span> <em>One app.</em>
              <small>Crowd numbers are demo estimates</small>
            </p>
          </div>
          <div className="counter-rail" aria-hidden="true" />
        </div>
      </section>
      <ScoreTicker />

      {/* ---------------- Featured: tonight's big screens ---------------- */}
      {featured.length > 0 && (
        <section className="band band-brick">
          <div className="wrap">
            <SectionHead
              eyebrow={`Tonight’s big screens · ${city.name}`}
              title={
                <>
                  The games <em>worth going out for.</em>
                </>
              }
              to="/games?date=today"
            />
            <div className="featured">
              {featured.map((m, i) => (
                <FeaturedGame key={m.id} match={m} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Live now ---------------- */}
      {live.length > 0 && (
        <section className="band">
          <div className="wrap">
            <SectionHead eyebrow="On screens right now" title={<>Live <em>now.</em></>} to="/games?date=live" />
          </div>
          <div className="rail">
            {live.map((m, i) => (
              <MatchCard key={m.id} match={m} variant="tile" index={i} showDay={false} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- For you ---------------- */}
      <section className="band">
        <div className="wrap">
          <SectionHead
            eyebrow={hasFavs ? 'Picked for you' : `Trending in ${city.name}`}
            title={
              hasFavs ? (
                <>
                  Your games, <em>your crowd.</em>
                </>
              ) : (
                <>
                  Where the <em>crowds</em> are going.
                </>
              )
            }
            to={hasFavs ? '/teams' : '/games'}
            toLabel={hasFavs ? 'Edit teams' : 'All games'}
          />
          {hasFavs ? (
            <FavStrip />
          ) : (
            <button className="onboard-card" onClick={() => setPicking(true)}>
              <span className="onboard-icon">
                <IconStar size={22} />
              </span>
              <span className="onboard-text">
                <strong>Pick your teams</strong>
                <span>Follow clubs and leagues to get a personal schedule and recommendations.</span>
              </span>
              <IconChevron className="onboard-go" />
            </button>
          )}
        </div>
        <div className="rail" key={hasFavs ? 'for-you' : 'trending'}>
          {(hasFavs && recs.length ? recs : hot.map((m) => ({ match: m, reason: '' }))).map((r, i) => (
            <MatchCard key={r.match.id} match={r.match} variant="tile" reason={r.reason || undefined} index={i} />
          ))}
        </div>
        {hasFavs && recs.length === 0 && (
          <div className="wrap">
            <p className="muted">None of your teams play in the next few days. Here’s what’s trending instead.</p>
          </div>
        )}
      </section>

      {/* ---------------- Watch parties ---------------- */}
      {parties.length > 0 && (
        <section className="band">
          <div className="wrap">
            <SectionHead
              eyebrow={`Watch parties · ${city.name}`}
              title={
                <>
                  Find your <em>crowd.</em>
                </>
              }
              to="/map"
              toLabel="All bars"
            />
          </div>
          <div className="rail">
            {parties.map((r, i) => (
              <div className="rail-venue" key={r.venue.id + r.match!.id}>
                <VenueCard row={r} showMatch index={i} originLabel={origin.label} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Next up in city ---------------- */}
      <section className="band">
        <div className="wrap">
          <SectionHead
            eyebrow={`Next 30 hours · ${city.name}`}
            title={
              <>
                Starting <em>soon.</em>
              </>
            }
            to="/games?date=today"
          />
          {nextUp.length ? (
            <div className="grid-cards">
              {nextUp.map((m, i) => (
                <MatchCard key={m.id} match={m} index={i} />
              ))}
            </div>
          ) : (
            <p className="muted">Nothing listed in {city.name} for the next 30 hours.</p>
          )}
        </div>
      </section>

      {/* ---------------- Browse by sport ---------------- */}
      <section className="band">
        <div className="wrap">
          <SectionHead
            eyebrow="Browse"
            title={
              <>
                Pick a <em>sport.</em>
              </>
            }
          />
          <SportArches now={now} />
        </div>
      </section>

      {/* ---------------- How it works (cream, like the deck's solution slide) ---------------- */}
      <section className="cream">
        <div className="wrap how">
          <div>
            <p className="eyebrow eyebrow-rust">How it works</p>
            <h2 className="display display-ink">
              Find the game.
              <br />
              <em>Find your crowd.</em>
            </h2>
          </div>
          <ol className="steps">
            <Step n="01" title="Find" icon={<IconSearch size={20} />} status="Live now">
              Search by team, league, match or location.
            </Step>
            <Step n="02" title="Connect" icon={<IconUsers size={20} />} status="Live now">
              See who’s showing it, and where fellow fans gather.
            </Step>
            <Step n="03" title="Book" icon={<IconVerified size={20} />} status="Live now">
              Reserve a table and watch together.
            </Step>
          </ol>
          <p className="cream-note">{DEMO_NOTICE}</p>
        </div>
      </section>

      <Sheet
        open={picking}
        onClose={() => {
          setPicking(false)
          prefs.finishOnboarding()
        }}
        eyebrow="Personalise"
        title={
          <>
            Who do you <em>cheer</em> for?
          </>
        }
        footer={
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              setPicking(false)
              prefs.finishOnboarding()
            }}
          >
            {prefs.favTeams.length ? `Done · ${prefs.favTeams.length} followed` : 'Skip for now'}
          </button>
        }
      >
        <TeamPicker compact />
      </Sheet>
    </>
  )
}

function FavStrip() {
  const { favTeams } = usePrefs()
  if (!favTeams.length) return null
  return (
    <div className="favstrip">
      {favTeams.slice(0, 8).map((id) => {
        const t = getTeam(id)
        if (!t) return null
        return (
          <Link key={id} to={`/games?team=${id}`} className="favstrip-item" title={t.name}>
            <Crest team={t} size={26} />
            <span>{t.short}</span>
          </Link>
        )
      })}
    </div>
  )
}

function SportArches({ now }: { now: number }) {
  return (
    <div className="arches">
      {SPORTS.map((s, i) => {
        const n = MATCHES.filter(
          (m) => m.sport === s.id && statusOf(m, now) !== 'finished' && m.start.getTime() - now < 7 * 86_400_000,
        ).length
        return (
          <Link
            key={s.id}
            to={`/games?sport=${s.id}`}
            className="arch-tile"
            style={{ '--i': i } as CSSProperties}
          >
            <SportIcon sport={s.id} size={26} className="arch-tile-icon" />
            <span className="arch-tile-name">{s.name}</span>
            <span className="arch-tile-count">{n} this week</span>
          </Link>
        )
      })}
    </div>
  )
}

function Step({
  n,
  title,
  icon,
  status,
  children,
}: {
  n: string
  title: string
  icon: ReactNode
  status: string
  children: ReactNode
}) {
  return (
    <li className="step">
      <span className="step-n">{n}</span>
      <div>
        <p className="step-title">
          {icon}
          {title}
          <span className={`step-status${status === 'Live now' ? ' on' : ''}`}>{status}</span>
        </p>
        <p className="step-body">{children}</p>
      </div>
    </li>
  )
}

export function SectionHead({
  eyebrow,
  title,
  to,
  toLabel = 'See all',
}: {
  eyebrow: string
  title: ReactNode
  to?: string
  toLabel?: string
}) {
  return (
    <header className="sect-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="h2">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="see-all">
          {toLabel}
          <IconChevron size={16} />
        </Link>
      )}
    </header>
  )
}
