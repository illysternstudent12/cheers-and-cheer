import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeague } from '../data/demo'
import { matchTitle } from '../lib/match'
import { suggest } from '../lib/search'
import { fmtTime, relativeDay, useMinute } from '../lib/time'
import { Crest } from './Crest'
import { IconPin, IconSearch, IconX, SportIcon } from './Icons'

interface Item {
  key: string
  group: string
  label: string
  sub: string
  to: string
  icon: ReactNode
}

interface Props {
  size?: 'hero' | 'compact'
  /** Controlled mode — used on the Games page for live filtering. */
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBox({ size = 'compact', value, onChange, placeholder, autoFocus }: Props) {
  const [inner, setInner] = useState('')
  const q = value ?? inner
  const setQ = (v: string) => (onChange ? onChange(v) : setInner(v))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const nav = useNavigate()
  const now = useMinute()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const items = useMemo<Item[]>(() => {
    const s = suggest(q, now)
    const out: Item[] = []
    for (const m of s.matches)
      out.push({
        key: 'm' + m.id,
        group: 'Games',
        label: matchTitle(m),
        sub: `${getLeague(m.league).short} · ${relativeDay(m.start, now)} ${fmtTime(m.start)}`,
        to: `/match/${m.id}`,
        icon: <SportIcon sport={m.sport} size={18} />,
      })
    for (const t of s.teams)
      out.push({
        key: 't' + t.id,
        group: 'Teams',
        label: t.name,
        sub: getLeague(t.league).name,
        to: `/games?team=${t.id}`,
        icon: <Crest team={t} size={18} />,
      })
    for (const l of s.leagues)
      out.push({
        key: 'l' + l.id,
        group: 'Leagues',
        label: l.name,
        sub: l.region,
        to: `/games?league=${l.id}`,
        icon: <SportIcon sport={l.sport} size={18} />,
      })
    for (const sp of s.sports)
      out.push({
        key: 's' + sp.id,
        group: 'Sports',
        label: sp.name,
        sub: 'All ' + sp.noun,
        to: `/games?sport=${sp.id}`,
        icon: <SportIcon sport={sp.id} size={18} />,
      })
    for (const c of s.cities)
      out.push({
        key: 'c' + c.id,
        group: 'Cities',
        label: c.name,
        sub: c.pilot ? 'Pilot city · verified bars' : c.country,
        to: `/games?city=${c.id}`,
        icon: <IconPin size={18} />,
      })
    return out
  }, [q, now])

  const go = (to: string) => {
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
    nav(to)
  }

  const submit = () => {
    if (active >= 0 && items[active]) return go(items[active].to)
    if (!q.trim()) return
    if (onChange) {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    go(`/games?q=${encodeURIComponent(q.trim())}`)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(-1, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }

  const showList = open && q.trim().length > 0
  let lastGroup = ''

  return (
    <div className={`search search-${size}${showList ? ' is-open' : ''}`}>
      <form
        className="search-field"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <IconSearch size={size === 'hero' ? 22 : 18} className="search-icon" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          autoFocus={autoFocus}
          placeholder={placeholder ?? 'Search a team, league, match or city'}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Search games"
        />
        {q && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQ('')
              inputRef.current?.focus()
            }}
          >
            <IconX size={16} />
          </button>
        )}
        {size === 'hero' && (
          <button type="submit" className="btn btn-primary search-go">
            Find the game
          </button>
        )}
      </form>

      {showList && (
        <div className="search-pop" id={listId} role="listbox">
          {items.length === 0 ? (
            <p className="search-empty">
              No match for “{q}”. Try a team (“Maccabi”), a league (“NBA”) or a city (“London”).
            </p>
          ) : (
            items.map((it, i) => {
              const header = it.group !== lastGroup ? it.group : ''
              lastGroup = it.group
              return (
                <div key={it.key}>
                  {header && <div className="search-group">{header}</div>}
                  <button
                    type="button"
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={`search-item${i === active ? ' active' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(it.to)}
                  >
                    <span className="search-item-icon">{it.icon}</span>
                    <span className="search-item-text">
                      <span className="search-item-label">{highlight(it.label, q)}</span>
                      <span className="search-item-sub">{it.sub}</span>
                    </span>
                  </button>
                </div>
              )
            })
          )}
          {!onChange && items.length > 0 && (
            <button
              type="button"
              className="search-all"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(`/games?q=${encodeURIComponent(q.trim())}`)}
            >
              See all results for “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function highlight(text: string, q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return text
  const i = text.toLowerCase().indexOf(needle)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  )
}

