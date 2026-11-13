import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MatchCard } from '../components/MatchCard'
import { SearchBox } from '../components/SearchBox'
import { IconX, SportIcon } from '../components/Icons'
import { DEMO_NOTICE, MATCHES, SPORTS, getCity, getLeague, getTeam } from '../data/demo'
import { applyFilters, dayKey, type DateFilter, type Filters } from '../lib/filters'
import { statusOf } from '../lib/match'
import { dayDiff, fmtDate, relativeDay, useMinute } from '../lib/time'
import type { CityId, Match, SportId } from '../types'

const DATE_CHIPS: { id: DateFilter; label: string }[] = [
  { id: 'all', label: 'All upcoming' },
  { id: 'live', label: 'Live' },
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'week', label: 'Next 7 days' },
]

export function Games() {
  const [params, setParams] = useSearchParams()
  const now = useMinute()

  const f: Filters = {
    q: params.get('q') ?? '',
    sport: (params.get('sport') as SportId) ?? '',
    date: (params.get('date') as DateFilter) ?? 'all',
    league: params.get('league') ?? '',
    team: params.get('team') ?? '',
    city: (params.get('city') as CityId) ?? '',
  }

  const set = (patch: Partial<Filters>, replace = false) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (!v || (k === 'date' && v === 'all')) next.delete(k)
      else next.set(k, String(v))
    }
    setParams(next, { replace })
  }

  const results = useMemo(() => applyFilters(f, now), [f.q, f.sport, f.date, f.league, f.team, f.city, now]) // eslint-disable-line

  // Counts per sport / date ignore their own dimension so chips show what you'd get.
  const sportCount = (s: SportId | '') => applyFilters({ ...f, sport: s }, now).length
  const dateCount = (d: DateFilter) => applyFilters({ ...f, date: d }, now).length
  const liveTotal = MATCHES.filter((m) => statusOf(m, now) === 'live').length

  const days = useMemo(() => {
    const out: { key: string; date: Date; count: number }[] = []
    for (let i = 0; i < 10; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() + i)
      const key = `d:${dayKey(d)}` as DateFilter
      out.push({ key, date: d, count: applyFilters({ ...f, date: key }, now).length })
    }
    return out
  }, [now, f.q, f.sport, f.league, f.team, f.city]) // eslint-disable-line

  const groups = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of results) {
      const k = statusOf(m, now) === 'live' ? 'live' : dayKey(m.start)
      map.set(k, [...(map.get(k) ?? []), m])
    }
    return [...map.entries()]
  }, [results, now])

  const tags: { label: string; clear: Partial<Filters> }[] = []
  if (f.team) tags.push({ label: getTeam(f.team)?.name ?? f.team, clear: { team: '' } })
  if (f.league) tags.push({ label: getLeague(f.league)?.name ?? f.league, clear: { league: '' } })
  if (f.city) tags.push({ label: `Showing in ${getCity(f.city)?.name ?? f.city}`, clear: { city: '' } })

  const anyFilter = f.q || f.sport || f.date !== 'all' || tags.length

  return (
    <div className="games">
      <section className="games-hero">
        <div className="wrap">
          <p className="eyebrow">Schedule · live &amp; upcoming</p>
          <h1 className="display display-sm">
            Every game. <em>This week.</em>
          </h1>
          <SearchBox
            value={f.q}
            onChange={(v) => set({ q: v }, true)}
            placeholder="Filter by team, league, match…"
          />
        </div>
      </section>

      <div className="filterbar">
        <div className="wrap">
          <div className="chips chips-scroll" role="group" aria-label="Sport">
            <button className={`chip${!f.sport ? ' on' : ''}`} onClick={() => set({ sport: '' })}>
              All sports <span className="chip-n">{sportCount('')}</span>
            </button>
            {SPORTS.map((s) => (
              <button
                key={s.id}
                className={`chip${f.sport === s.id ? ' on' : ''}`}
                onClick={() => set({ sport: f.sport === s.id ? '' : s.id })}
                aria-pressed={f.sport === s.id}
              >
                <SportIcon sport={s.id} size={15} />
                {s.name}
                <span className="chip-n">{sportCount(s.id)}</span>
              </button>
            ))}
          </div>
          <div className="chips chips-scroll" role="group" aria-label="When">
            {DATE_CHIPS.map((d) => (
              <button
                key={d.id}
                className={`chip chip-date${f.date === d.id ? ' on' : ''}${d.id === 'live' ? ' chip-live' : ''}`}
                onClick={() => set({ date: d.id })}
                aria-pressed={f.date === d.id}
                disabled={d.id === 'live' && liveTotal === 0}
              >
                {d.id === 'live' && <span className="live-dot" aria-hidden="true" />}
                {d.label}
                {d.id !== 'all' && <span className="chip-n">{dateCount(d.id)}</span>}
              </button>
            ))}
          </div>
          <div className="daystrip" role="group" aria-label="Pick a day">
            {days.map((d) => {
              const on = f.date === d.key
              const diff = dayDiff(d.date, now)
              return (
                <button
                  key={d.key}
                  className={`day${on ? ' on' : ''}${d.count === 0 ? ' is-empty' : ''}`}
                  onClick={() => set({ date: on ? 'all' : (d.key as DateFilter) })}
                  aria-pressed={on}
                  aria-label={`${fmtDate(d.date)}, ${d.count} games`}
                >
                  <span className="day-dow">
                    {diff === 0 ? 'Today' : d.date.toLocaleDateString('en-GB', { weekday: 'short' })}
                  </span>
                  <span className="day-num">{d.date.getDate()}</span>
                  <span className="day-dots" aria-hidden="true">
                    {Array.from({ length: Math.min(3, d.count) }).map((_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="wrap games-body">
        <div className="results-meta">
          <p aria-live="polite">
            <strong>{results.length}</strong> {results.length === 1 ? 'game' : 'games'}
            {f.q && (
              <>
                {' '}
                for “<span className="accent">{f.q}</span>”
              </>
            )}
          </p>
          {tags.map((t) => (
            <button key={t.label} className="tag" onClick={() => set(t.clear)}>
              {t.label}
              <IconX size={14} />
            </button>
          ))}
          {anyFilter ? (
            <button className="linkish" onClick={() => setParams(new URLSearchParams())}>
              Clear all
            </button>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <div className="empty">
            <p className="empty-title">
              No games <em>match.</em>
            </p>
            <p className="muted">
              Try another day, or a broader search like a league name. Live games only show while they’re on.
            </p>
            <button className="btn btn-ghost" onClick={() => setParams(new URLSearchParams())}>
              Show all games
            </button>
          </div>
        ) : (
          groups.map(([key, list]) => (
            <section key={key} className="day-group">
              <h2 className="day-head">
                {key === 'live' ? (
                  <>
                    <span className="live-dot" /> Live now
                  </>
                ) : (
                  <>
                    {relativeDay(list[0].start, now)}
                    {Math.abs(dayDiff(list[0].start, now)) <= 1 && (
                      <span className="day-head-date"> · {fmtDate(list[0].start)}</span>
                    )}
                  </>
                )}
                <span className="day-head-n">{list.length}</span>
              </h2>
              <div className="grid-cards">
                {list.map((m, i) => (
                  <MatchCard key={m.id} match={m} index={i} showDay={false} />
                ))}
              </div>
            </section>
          ))
        )}
        <p className="fine">{DEMO_NOTICE}</p>
      </div>
    </div>
  )
}

