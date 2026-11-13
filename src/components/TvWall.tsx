import { Link } from 'react-router-dom'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { MATCHES, SPORTS, getCity, getLeague, getTeam } from '../data/demo'
import { liveState, matchTitle, statusOf } from '../lib/match'
import { countdownParts, countdownShort, fmtTime, pad, relativeDay, useMinute, useNow } from '../lib/time'
import { useShowing } from '../state/live'
import { usePrefs } from '../state/prefs'
import type { Match, SportId } from '../types'
import { StatusPill } from './Countdown'
import { Crest, Monogram } from './Crest'
import { Field } from './Field'
import { IconPin, SportIcon } from './Icons'

type Channel = 'all' | 'live' | SportId
const SCREENS = 9

/** Neutral pairs for events without two teams, so the screen still glows. */
const SPORT_TONE: Record<SportId, [string, string]> = {
  football: ['#2f6e55', '#efe3cc'],
  basketball: ['#a8693b', '#7a1f2b'],
  tennis: ['#a2482f', '#efe3cc'],
  motorsport: ['#8e2a2a', '#efe3cc'],
  'american-football': ['#24533f', '#7a1f2b'],
}

function colorsOf(m: Match): [string, string] {
  const h = getTeam(m.home)
  const a = getTeam(m.away)
  return h && a ? [h.colors[0], a.colors[0]] : SPORT_TONE[m.sport]
}

/**
 * The bar's wall of screens: the signature of the product.
 * Every screen is a real game from the schedule (live first, then the next
 * kick-offs). The remote re-tunes the whole wall; hovering a screen turns it
 * up and spills its light onto the brick; clicking opens the game and the bars
 * showing it.
 */
export function TvWall({ onCheer }: { onCheer?: (on: boolean) => void }) {
  const now = useMinute()
  const { city } = usePrefs()
  const [channel, setChannel] = useState<Channel>('all')

  const pool = useMemo(
    () =>
      MATCHES.filter((m) => statusOf(m, now) !== 'finished').sort((a, b) => {
        const la = statusOf(a, now) === 'live' ? 0 : 1
        const lb = statusOf(b, now) === 'live' ? 0 : 1
        return la - lb || a.start.getTime() - b.start.getTime()
      }),
    [now],
  )
  const liveCount = pool.filter((m) => statusOf(m, now) === 'live').length
  const tuned = pool.filter((m) => (channel === 'all' ? true : channel === 'live' ? statusOf(m, now) === 'live' : m.sport === channel))
  // Put the biggest crowd on the main screen so the wall leads with tonight's game.
  const games = useMemo(() => {
    const first = tuned.slice(0, SCREENS)
    const live = first.filter((m) => statusOf(m, now) === 'live')
    const lead = (live.length ? live : first.slice(0, 3)).reduce<Match | undefined>(
      (best, m) => (!best || (m.showings.find((s) => s.city === city)?.fans ?? 0) > (best.showings.find((s) => s.city === city)?.fans ?? 0) ? m : best),
      undefined,
    )
    return lead ? [lead, ...first.filter((m) => m !== lead)] : first
  }, [tuned, now, city])

  const channels: { id: Channel; label: string; n: number }[] = [
    { id: 'all', label: 'All channels', n: pool.length },
    { id: 'live', label: 'Live', n: liveCount },
    ...SPORTS.map((s) => ({ id: s.id as Channel, label: s.name, n: pool.filter((m) => m.sport === s.id).length })),
  ]

  return (
    <div className="wall">
      <Remote channels={channels} channel={channel} onTune={setChannel} />

      <div className="tvwall" key={channel} aria-label={`On screens in ${getCity(city).name}`} onPointerLeave={() => onCheer?.(false)}>
        {Array.from({ length: SCREENS }).map((_, i) =>
          games[i] ? (
            <Screen key={games[i].id} m={games[i]} i={i} onCheer={onCheer} />
          ) : (
            <OffAir key={'off' + i} i={i} />
          ),
        )}
      </div>
    </div>
  )
}

/**
 * The remote: one dock-style capsule. A cream thumb glides to the tuned
 * channel, a softer ghost follows the pointer, and arrow keys move along it.
 */
function Remote({
  channels,
  channel,
  onTune,
}: {
  channels: { id: Channel; label: string; n: number }[]
  channel: Channel
  onTune: (c: Channel) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  const put = (el: HTMLElement | null | undefined, prefix: 'on' | 'hv') => {
    const r = ref.current
    if (!r) return
    if (!el) return void r.style.setProperty(`--${prefix}-o`, '0')
    r.style.setProperty(`--${prefix}-x`, `${el.offsetLeft}px`)
    r.style.setProperty(`--${prefix}-w`, `${el.offsetWidth}px`)
    r.style.setProperty(`--${prefix}-o`, '1')
  }
  const toTuned = () => {
    const el = ref.current?.querySelector<HTMLElement>('.remote-btn.on')
    put(el, 'on')
    // keep the tuned channel in view when the dock scrolls on small screens
    if (el && ref.current && ref.current.scrollWidth > ref.current.clientWidth)
      ref.current.scrollTo({ left: el.offsetLeft - (ref.current.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
  }

  useLayoutEffect(toTuned, [channel])
  useEffect(() => {
    document.fonts?.ready.then(toTuned)
    window.addEventListener('resize', toTuned)
    return () => window.removeEventListener('resize', toTuned)
  }, [])

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.remote-btn:not(:disabled)') ?? [])]
    const at = btns.indexOf(document.activeElement as HTMLButtonElement)
    const next = btns[(at + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length]
    next?.focus()
    e.preventDefault()
  }

  return (
    <div className="remote-wrap">
      <div
        className="remote"
        role="toolbar"
        aria-label="Tune the screens"
        ref={ref}
        onKeyDown={onKey}
        onPointerLeave={() => put(null, 'hv')}
      >
        <span className="remote-label" aria-hidden="true">
          <i />
          On the wall
        </span>
        <span className="remote-thumb" aria-hidden="true" />
        <span className="remote-ghost" aria-hidden="true" />
        {channels.map((c, i) => (
          <button
            key={c.id}
            className={`remote-btn${channel === c.id ? ' on' : ''}${c.id === 'live' ? ' is-live' : ''}`}
            onClick={() => onTune(c.id)}
            onPointerEnter={(e) => put(e.currentTarget, 'hv')}
            onFocus={(e) => put(e.currentTarget, 'hv')}
            onBlur={() => put(null, 'hv')}
            aria-pressed={channel === c.id}
            disabled={c.n === 0}
            title={`Channel ${pad(i)} · ${c.n} ${c.n === 1 ? 'game' : 'games'}`}
          >
            <span className="remote-ico" aria-hidden="true">
              {c.id === 'live' ? (
                <span className="live-dot" />
              ) : c.id === 'all' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
                  <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
                  <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
                  <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
                </svg>
              ) : (
                <SportIcon sport={c.id} size={14} />
              )}
            </span>
            <span className="remote-txt">{c.id === 'all' ? 'All' : c.label}</span>
            <sup className="remote-n">{c.n}</sup>
          </button>
        ))}
      </div>
    </div>
  )
}

function Screen({ m, i, onCheer }: { m: Match; i: number; onCheer?: (on: boolean) => void }) {
  const now = useNow()
  const { city } = usePrefs()
  const local = useShowing(m.id, city)
  const st = statusOf(m, now)
  const s = liveState(m, now)
  const h = getTeam(m.home)
  const a = getTeam(m.away)
  const colors = colorsOf(m)
  const live = st === 'live'
  const main = i === 0
  const cd = countdownParts(m.start, now)
  const soon = !live && cd.total < 3 * 3_600_000

  return (
    <Link
      to={`/match/${m.id}`}
      className={`tv tv-s${i}${main ? ' tv-main' : ''}${live ? ' is-live' : ''}`}
      style={{ '--i': i, '--glow': colors[0], '--glow-2': colors[1] } as CSSProperties}
      onPointerEnter={() => onCheer?.(live)}
      onFocus={() => onCheer?.(live)}
      onBlur={() => onCheer?.(false)}
      aria-label={`${matchTitle(m)}, ${getLeague(m.league).name}, ${live ? `live now, ${s.clock}` : `starts ${relativeDay(m.start, now)} ${fmtTime(m.start)}`}`}
    >
      <span className="tv-mount" aria-hidden="true" />
      <span className="tv-bezel">
        <span className="tv-screen">
          <Field sport={m.sport} live={live} colors={colors} />
          <span className="tv-shade" aria-hidden="true" />

          {/* Broadcast graphics */}
          <span className="tv-chan" aria-hidden="true">
            <SportIcon sport={m.sport} size={main ? 13 : 11} />
            {getLeague(m.league).short}
          </span>
          {live ? (
            <span className="tv-onair" aria-hidden="true">
              <i /> {s.clock || 'Live'}
            </span>
          ) : (
            <span className="tv-ko" aria-hidden="true">
              {relativeDay(m.start, now) === 'Today' ? fmtTime(m.start) : `${relativeDay(m.start, now).slice(0, 3)} ${fmtTime(m.start)}`}
            </span>
          )}

          {live ? (
            <span className="tv-bug" aria-hidden="true">
              {h && a ? (
                <>
                  <span className="tv-bug-team" style={{ '--c': h.colors[0] } as CSSProperties}>{h.short}</span>
                  <span className="tv-bug-score">
                    {s.score?.[0] ?? 0}<i>–</i>{s.score?.[1] ?? 0}
                  </span>
                  <span className="tv-bug-team" style={{ '--c': a.colors[0] } as CSSProperties}>{a.short}</span>
                </>
              ) : (
                <>
                  <span className="tv-bug-team tv-bug-event">{m.participants && m.participants[0] !== 'TBD' ? `${m.participants[0].split(' ').pop()} v ${m.participants[1].split(' ').pop()}` : m.title}</span>
                  {s.score && <span className="tv-bug-score">{s.score[0]}<i>–</i>{s.score[1]}</span>}
                </>
              )}
            </span>
          ) : (
            <span className="tv-slate" aria-hidden="true">
              <span className="tv-slate-teams">
                {h && a ? (
                  <>
                    <Crest team={h} size={main ? 46 : 26} />
                    <b>{main ? h.name : h.short}</b>
                    <em>v</em>
                    <b>{main ? a.name : a.short}</b>
                    <Crest team={a} size={main ? 46 : 26} />
                  </>
                ) : (
                  <>
                    {m.participants && main && <Monogram label={m.participants[0]} size={34} />}
                    <b className="tv-slate-event">{m.title ?? matchTitle(m)}</b>
                    {m.participants && main && <Monogram label={m.participants[1]} size={34} />}
                  </>
                )}
              </span>
              <span className={`tv-count${soon ? ' is-soon' : ''}`}>
                {soon ? (
                  <>
                    <small>Kick-off in</small>
                    {cd.hours > 0 && <>{cd.hours}<i>h</i></>}
                    {pad(cd.minutes)}<i>m</i>
                    {main && <>{pad(cd.seconds)}<i>s</i></>}
                  </>
                ) : (
                  <>
                    <small>{relativeDay(m.start, now)}</small>
                    {fmtTime(m.start)}
                  </>
                )}
              </span>
            </span>
          )}

          {/* Lower third: slides up on hover/focus; always on for the main screen */}
          <span className="tv-lower" aria-hidden="true">
            <span className="tv-lower-title">{matchTitle(m)}</span>
            <span className="tv-lower-meta">
              {m.stage}
              <span className="tv-lower-sep">·</span>
              {local ? (
                <>
                  <IconPin size={11} /> {local.venues} bars · ~{local.fans} expected
                  {local.confirmed ? ` · ${local.confirmed} confirmed` : ''}
                </>
              ) : (
                <>Not listed in {getCity(city).name} yet</>
              )}
            </span>
            <span className="tv-lower-cta">Where to watch →</span>
          </span>

          <span className="tv-glass" aria-hidden="true" />
          <span className="tv-scan" aria-hidden="true" />
          <span className="tv-static" aria-hidden="true" />
        </span>
      </span>
      <span className="tv-led" aria-hidden="true" />
    </Link>
  )
}

function OffAir({ i }: { i: number }) {
  return (
    <div className={`tv tv-s${i} tv-off${i === 0 ? ' tv-main' : ''}`} style={{ '--i': i } as CSSProperties} aria-hidden="true">
      <span className="tv-mount" />
      <span className="tv-bezel">
        <span className="tv-screen">
          <span className="tv-bars" />
          <span className="tv-offair">Off air</span>
          <span className="tv-glass" />
        </span>
      </span>
      <span className="tv-led" />
    </div>
  )
}

/** The silhouetted crowd in front of the screens. Arms go up when a live game is lit. */
export function Crowd() {
  const heads = [
    [4, 0.9],
    [13, 1.08],
    [22, 0.95],
    [31, 1.12],
    [41, 0.98],
    [50, 1.15],
    [60, 1],
    [69, 1.1],
    [78, 0.94],
    [87, 1.06],
    [96, 0.92],
  ]
  return (
    <svg className="crowd" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true">
      {heads.map(([x, s], i) => (
        <g key={i} className={`fan fan-${i % 4}`} style={{ '--d': `${(i % 5) * 0.09}s` } as CSSProperties}>
          {i % 3 !== 2 && (
            <>
              <rect className="arm arm-l" x={x - 3.4} y={4} width={1.1} height={7} rx={0.5} />
              <rect className="arm arm-r" x={x + 2.3} y={4} width={1.1} height={7} rx={0.5} />
            </>
          )}
          <path d={`M${x - 3.6 * s} 14 C${x - 3.6 * s} ${14 - 3.6 * s} ${x - 2.6 * s} ${14 - 4.3 * s} ${x} ${14 - 4.4 * s} C${x + 2.6 * s} ${14 - 4.3 * s} ${x + 3.6 * s} ${14 - 3.6 * s} ${x + 3.6 * s} 14Z`} />
          <rect x={x - 0.7 * s} y={14 - 5.2 * s} width={1.4 * s} height={1.2 * s} />
          <ellipse cx={x} cy={14 - 6.9 * s} rx={1.55 * s} ry={1.95 * s} />
        </g>
      ))}
    </svg>
  )
}

/** Sports-TV crawl of live scores and next kick-offs. */
export function ScoreTicker() {
  const now = useMinute()
  const items = useMemo(
    () =>
      MATCHES.filter((m) => statusOf(m, now) !== 'finished')
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .slice(0, 14),
    [now],
  )
  if (!items.length) return null
  const row = (dup: boolean) => (
    <ul className="ticker-row" aria-hidden={dup || undefined}>
      {items.map((m) => {
        const st = statusOf(m, now)
        const s = liveState(m, now)
        const h = getTeam(m.home)
        const a = getTeam(m.away)
        return (
          <li key={m.id}>
            <Link to={`/match/${m.id}`} tabIndex={dup ? -1 : undefined} className={st === 'live' ? 'is-live' : ''}>
              <span className="ticker-lg">{getLeague(m.league).short}</span>
              {h && a ? (
                <>
                  <b>{h.short}</b>
                  {s.score ? (
                    <span className="ticker-sc">
                      {s.score[0]}–{s.score[1]}
                    </span>
                  ) : (
                    <span className="ticker-v">v</span>
                  )}
                  <b>{a.short}</b>
                </>
              ) : (
                <b>{m.title}</b>
              )}
              <span className="ticker-t">{st === 'live' ? s.clock || 'LIVE' : `${relativeDay(m.start, now) === 'Today' ? '' : relativeDay(m.start, now).slice(0, 3) + ' '}${fmtTime(m.start)}`}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
  return (
    <nav className="ticker" aria-label="Scores and kick-offs">
      <span className="ticker-tag">
        <i /> Scores
      </span>
      <div className="ticker-track">
        {row(false)}
        {row(true)}
      </div>
    </nav>
  )
}

/** Vintage match-bill poster for the headline games of the night. */
export function FeaturedGame({ match: m, index }: { match: Match; index: number }) {
  const now = useNow()
  const { city } = usePrefs()
  const local = useShowing(m.id, city)
  const st = statusOf(m, now)
  const s = liveState(m, now)
  const h = getTeam(m.home)
  const a = getTeam(m.away)
  const nowMin = useMinute()
  return (
    <article className={`feat feat-${m.sport}${st === 'live' ? ' is-live' : ''}`} style={{ '--i': index, '--c1': colorsOf(m)[0], '--c2': colorsOf(m)[1] } as CSSProperties}>
      <span className="feat-pin" aria-hidden="true" />
      <header className="feat-head">
        <span className="feat-league">
          <SportIcon sport={m.sport} size={14} /> {getLeague(m.league).name}
        </span>
        <StatusPill match={m} />
      </header>
      <p className="feat-no" aria-hidden="true">
        No. {pad(index + 1)}
      </p>
      <div className="feat-versus">
        <span className="feat-side">
          {h ? <Crest team={h} size={62} /> : <Monogram label={m.participants?.[0] ?? ''} size={52} />}
          <b>{h?.name}</b>
        </span>
        <span className="feat-mid">
          {s.score ? (
            <span className="feat-score">
              {s.score[0]}
              <i>–</i>
              {s.score[1]}
            </span>
          ) : (
            <span className="feat-vs">versus</span>
          )}
        </span>
        <span className="feat-side">
          {a ? <Crest team={a} size={62} /> : <Monogram label={m.participants?.[1] ?? ''} size={52} />}
          <b>{a?.name}</b>
        </span>
      </div>
      <p className="feat-when">
        {st === 'live' ? (
          <>{s.clock}</>
        ) : (
          <>
            <span>{relativeDay(m.start, nowMin)}</span>
            <b>{fmtTime(m.start)}</b>
            <span>{countdownShort(m.start, nowMin)}</span>
          </>
        )}
      </p>
      <p className="feat-stage">{m.stage}</p>
      <footer className="feat-foot">
        {local ? (
          <span className="feat-where">
            <IconPin size={14} /> {local.venues} bars in {getCity(city).name} · ~{local.fans} expected
            {local.confirmed ? ` · ${local.confirmed} confirmed` : ''}
          </span>
        ) : (
          <span className="feat-where">Not listed in {getCity(city).name} yet</span>
        )}
        <span className="feat-cta">
          <Link to={`/match/${m.id}`} className="btn btn-ink btn-sm">
            Details
          </Link>
          {local && (
            <Link to={`/map?match=${m.id}`} className="btn btn-wine btn-sm">
              Find a bar
            </Link>
          )}
        </span>
      </footer>
    </article>
  )
}
