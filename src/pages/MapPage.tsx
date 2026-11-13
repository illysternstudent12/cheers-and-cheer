import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FanStack } from '../components/Badges'
import { Crest, Monogram } from '../components/Crest'
import { IconChevronDown, IconPin, IconSearch, IconX, SportIcon } from '../components/Icons'
import { MapView } from '../components/MapView'
import { Sheet } from '../components/Sheet'
import { VenueCard } from '../components/VenueCard'
import { getCity, getLeague, getMatch, getTeam } from '../data/demo'
import { ATMOSPHERES } from '../data/venues'
import { matchTitle, statusOf } from '../lib/match'
import { useOrigin } from '../lib/origin'
import { fmtTime, relativeDay, useMinute } from '../lib/time'
import { DEFAULT_VENUE_FILTERS, filterRows, gamesInCity, venueRows, type VenueFilters } from '../lib/venues'
import { showingsOf, useBroadcasts } from '../state/live'
import { usePrefs } from '../state/prefs'
import type { Atmosphere, Match } from '../types'

const DISTANCES = [
  { v: 0, label: 'Any distance' },
  { v: 1, label: '< 1 km' },
  { v: 2, label: '< 2 km' },
  { v: 5, label: '< 5 km' },
]

export function MapPage() {
  const [params, setParams] = useSearchParams()
  const prefs = usePrefs()
  const now = useMinute()
  const origin = useOrigin()
  const city = getCity(prefs.city)

  const matchId = params.get('match') ?? undefined
  const match = matchId ? getMatch(matchId) : undefined
  const view = (params.get('view') as 'map' | 'list') ?? 'list'
  const selected = params.get('v') ?? undefined

  const f: VenueFilters = {
    dist: Number(params.get('dist') ?? 0),
    sound: params.get('sound') === '1',
    avail: params.get('avail') === '1',
    verified: params.get('verified') === '1',
    vibes: (params.get('vibe')?.split(',').filter(Boolean) as Atmosphere[]) ?? [],
    sort: (params.get('sort') as VenueFilters['sort']) ?? DEFAULT_VENUE_FILTERS.sort,
  }

  const set = useCallback(
    (patch: Record<string, string | null>, replace = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === '' || v === '0') next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace },
      )
    },
    [setParams],
  )

  const [hovered, setHovered] = useState<string>()
  const [expanded, setExpanded] = useState<string>()
  const [picking, setPicking] = useState(false)
  const [geo, setGeo] = useState<'idle' | 'finding' | 'failed' | 'unsupported' | 'done'>('idle')
  const listRef = useRef<HTMLDivElement>(null)

  const list = useBroadcasts()
  const all = useMemo(() => venueRows(list, prefs.city, origin, now, match?.id), [list, prefs.city, origin.lat, origin.lng, now, match?.id]) // eslint-disable-line
  const rows = useMemo(() => filterRows(all, f), [all, f.dist, f.sound, f.avail, f.verified, f.vibes.join(), f.sort]) // eslint-disable-line
  const selRow = rows.find((r) => r.venue.id === selected)

  // Keep the chosen venue visible in the list.
  useEffect(() => {
    if (!selected) return
    const node = document.getElementById(`venue-${selected}`)
    if (node && listRef.current) {
      const box = listRef.current
      const top = node.offsetTop - box.offsetTop - 12
      if (box.scrollHeight > box.clientHeight) box.scrollTo({ top, behavior: 'smooth' })
    }
  }, [selected])

  // Drop selection if a filter hides it.
  useEffect(() => {
    if (selected && !rows.some((r) => r.venue.id === selected)) set({ v: null })
  }, [rows, selected, set])

  const select = (id: string) => {
    set({ v: id === selected ? null : id })
    setExpanded(id)
  }

  const locate = () => {
    if (!('geolocation' in navigator)) return setGeo('unsupported')
    setGeo('finding')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        prefs.setHere({ lat: p.coords.latitude, lng: p.coords.longitude })
        setGeo('done')
      },
      () => setGeo('failed'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }
  const geoMsg =
    geo === 'finding'
      ? 'Finding you…'
      : geo === 'failed'
        ? 'Couldn’t get your location — measuring from the city centre.'
        : geo === 'unsupported'
          ? 'Location isn’t available in this browser.'
          : geo === 'done' && !origin.gps
            ? `You’re not in ${city.name} — distances are from the city centre.`
            : undefined

  const activeCount =
    (f.dist ? 1 : 0) + (f.sound ? 1 : 0) + (f.avail ? 1 : 0) + (f.verified ? 1 : 0) + f.vibes.length
  const totalFans = rows.reduce((n, r) => n + (r.broadcast?.fans ?? 0), 0)

  return (
    <div className={`mappage view-${view}`}>
      {/* -------- game selector + summary -------- */}
      <section className="mp-head">
        <div className="wrap">
          <button className="gamepick" onClick={() => setPicking(true)} aria-haspopup="dialog">
            {match ? <GameBadge m={match} /> : <span className="gamepick-all">All games · next 36 hours</span>}
            <span className="gamepick-change">
              Change <IconChevronDown size={14} />
            </span>
          </button>
          <p className="mp-summary">
            <b>{rows.length}</b> {rows.length === 1 ? 'bar' : 'bars'} in {city.name}
            {match && (
              <>
                {' '}
                · ~<b>{totalFans.toLocaleString('en-GB')}</b> fans expected
              </>
            )}
            <span className="mp-origin">
              · distances from {origin.gps ? 'you' : origin.label}
              <button className="linkish" onClick={locate}>
                {origin.gps ? 'Update' : 'Use my location'}
              </button>
            </span>
          </p>
          {geoMsg && <p className="mp-geo">{geoMsg}</p>}
        </div>
      </section>

      {/* -------- filters -------- */}
      <div className="mp-filters">
        <div className="wrap">
          <div className="chips chips-scroll" role="group" aria-label="Venue filters">
            <label className="chip chip-select">
              <IconPin size={15} />
              <select value={f.dist} onChange={(e) => set({ dist: e.target.value })} aria-label="Distance">
                {DISTANCES.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <Toggle on={f.sound} onClick={() => set({ sound: f.sound ? null : '1' })}>
              Sound on
            </Toggle>
            <Toggle on={f.avail} onClick={() => set({ avail: f.avail ? null : '1' })}>
              Tables free
            </Toggle>
            <Toggle on={f.verified} onClick={() => set({ verified: f.verified ? null : '1' })}>
              Venue-verified
            </Toggle>
            <span className="chip-sep" aria-hidden="true" />
            {ATMOSPHERES.map((a) => {
              const on = f.vibes.includes(a.id)
              return (
                <Toggle
                  key={a.id}
                  on={on}
                  title={a.blurb}
                  onClick={() =>
                    set({ vibe: (on ? f.vibes.filter((x) => x !== a.id) : [...f.vibes, a.id]).join(',') || null })
                  }
                >
                  {a.label}
                </Toggle>
              )
            })}
            <span className="chip-sep" aria-hidden="true" />
            <label className="chip chip-select">
              <span className="chip-select-k">Sort</span>
              <select value={f.sort} onChange={(e) => set({ sort: e.target.value === 'distance' ? null : e.target.value })} aria-label="Sort">
                <option value="distance">Nearest</option>
                <option value="fans">Most fans</option>
                <option value="tables">Most tables</option>
              </select>
            </label>
            {activeCount > 0 && (
              <button
                className="chip chip-clear"
                onClick={() => set({ dist: null, sound: null, avail: null, verified: null, vibe: null })}
              >
                <IconX size={14} /> Clear {activeCount}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* -------- list + map -------- */}
      <div className="mp-split">
        <div className="mp-list" ref={listRef} aria-label="Venues">
          {rows.length === 0 ? (
            <div className="empty">
              <p className="empty-title">
                No bar <em>fits.</em>
              </p>
              <p className="muted">Loosen a filter — distance and “tables free” are usually the tight ones.</p>
              <button className="btn btn-ghost" onClick={() => set({ dist: null, sound: null, avail: null, verified: null, vibe: null })}>
                Clear filters
              </button>
            </div>
          ) : (
            rows.map((r, i) => (
              <VenueCard
                key={r.venue.id}
                row={r}
                index={i}
                showMatch={!match}
                originLabel={origin.label}
                selected={r.venue.id === selected}
                expanded={expanded === r.venue.id}
                onSelect={() => select(r.venue.id)}
                onHover={(on) => setHovered(on ? r.venue.id : undefined)}
                onToggle={() => setExpanded((e) => (e === r.venue.id ? undefined : r.venue.id))}
              />
            ))
          )}
          <p className="fine">Venues, broadcasts and fan counts are demo data. Venue names are illustrative, not real partners.</p>
        </div>

        <div className="mp-map">
          <MapView
            rows={rows}
            center={city}
            zoom={city.zoom}
            selected={selected}
            hovered={hovered}
            origin={origin}
            fitKey={`${prefs.city}:${match?.id ?? 'all'}`}
            onSelect={(id) => select(id)}
          />
          {selRow && (
            <div className="mp-preview" key={selRow.venue.id}>
              <button className="icon-btn mp-preview-x" onClick={() => set({ v: null })} aria-label="Close preview">
                <IconX size={16} />
              </button>
              <VenueCard row={selRow} showMatch={!match} originLabel={origin.label} selected />
            </div>
          )}
        </div>
      </div>

      {/* -------- mobile map/list switch -------- */}
      <div className="viewswitch" role="tablist" aria-label="View">
        <span className="viewswitch-thumb" aria-hidden="true" />
        <button role="tab" aria-selected={view === 'list'} onClick={() => set({ view: null })}>
          List
        </button>
        <button role="tab" aria-selected={view === 'map'} onClick={() => set({ view: 'map' })}>
          Map
        </button>
      </div>

      <GamePicker
        open={picking}
        onClose={() => setPicking(false)}
        current={match?.id}
        onPick={(id) => {
          set({ match: id, v: null }, false)
          setPicking(false)
        }}
      />
    </div>
  )
}

function Toggle({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button className={`chip${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on} title={title}>
      {children}
    </button>
  )
}

function GameBadge({ m }: { m: Match }) {
  const now = useMinute()
  const h = getTeam(m.home)
  const a = getTeam(m.away)
  const live = statusOf(m, now) === 'live'
  return (
    <span className="gamebadge">
      <span className="gamebadge-crests">
        {h ? <Crest team={h} size={28} /> : <Monogram label={m.participants?.[0] ?? m.title ?? ''} size={28} />}
        {a ? <Crest team={a} size={28} /> : m.participants ? <Monogram label={m.participants[1]} size={28} /> : null}
      </span>
      <span className="gamebadge-text">
        <span className="gamebadge-title">{matchTitle(m)}</span>
        <span className="gamebadge-sub">
          {live ? (
            <>
              <span className="live-dot" /> Live now
            </>
          ) : (
            `${relativeDay(m.start, now)} · ${fmtTime(m.start)}`
          )}{' '}
          · {getLeague(m.league).short}
        </span>
      </span>
    </span>
  )
}

function GamePicker({
  open,
  onClose,
  onPick,
  current,
}: {
  open: boolean
  onClose: () => void
  onPick: (id: string | null) => void
  current?: string
}) {
  const prefs = usePrefs()
  const now = useMinute()
  const [q, setQ] = useState('')
  const list = useBroadcasts()
  const games = gamesInCity(list, prefs.city, now).filter(
    (m) => !q || matchTitle(m).toLowerCase().includes(q.toLowerCase()) || getLeague(m.league).name.toLowerCase().includes(q.toLowerCase()),
  )
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={`Showing in ${getCity(prefs.city).name}`}
      title={
        <>
          Which <em>game?</em>
        </>
      }
    >
      <label className="picker-search">
        <IconSearch size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Team or league" aria-label="Filter games" />
      </label>
      <ul className="gamelist">
        <li>
          <button className={`gameopt${!current ? ' on' : ''}`} onClick={() => onPick(null)}>
            <span className="gameopt-all">All games · next 36 hours</span>
          </button>
        </li>
        {games.map((m) => {
          const s = showingsOf(list, m.id).find((x) => x.city === prefs.city)
          return (
            <li key={m.id}>
              <button className={`gameopt${current === m.id ? ' on' : ''}`} onClick={() => onPick(m.id)}>
                <SportIcon sport={m.sport} size={18} className="gameopt-icon" />
                <GameBadge m={m} />
                {s && (
                  <span className="gameopt-n">
                    {s.venues} bars
                    <FanStack fans={s.fans} compact />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="fine">
        Not seeing your game? <Link to="/games">Search the full schedule</Link>.
      </p>
    </Sheet>
  )
}
