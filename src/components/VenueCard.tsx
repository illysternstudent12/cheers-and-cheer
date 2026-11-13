import { Link } from 'react-router-dom'
import type { CSSProperties } from 'react'
import { getLeague, getTeam } from '../data/demo'
import { ATMOSPHERES } from '../data/venues'
import { matchTitle, statusOf } from '../lib/match'
import { fmtTime, relativeDay, useMinute } from '../lib/time'
import { availability, fmtKm, type VenueRow } from '../lib/venues'
import { FanStack, PartyBadge, ScreensBadge, SoundBadge, VerifiedBadge } from './Badges'
import { IconChevronDown, IconPin } from './Icons'
import { VenueArt } from './VenueArt'

interface Props {
  row: VenueRow
  selected?: boolean
  expanded?: boolean
  /** Show which game the broadcast is for (when no match is pinned) */
  showMatch?: boolean
  originLabel?: string
  index?: number
  onSelect?: () => void
  onHover?: (on: boolean) => void
  onToggle?: () => void
}

export function VenueCard({ row, selected, expanded, showMatch, originLabel, index = 0, onSelect, onHover, onToggle }: Props) {
  const now = useMinute()
  const { venue: v, broadcast: b, match: m } = row
  const av = b ? availability(b) : null
  const vibe = ATMOSPHERES.find((a) => a.id === v.atmosphere)!
  const live = m && statusOf(m, now) === 'live'
  const href = `/venue/${v.id}${m ? `?match=${m.id}` : ''}`
  const party = b?.watchParty
  const partyTeam = getTeam(party?.team)

  return (
    <article
      id={`venue-${v.id}`}
      className={`vcard${selected ? ' is-selected' : ''}${expanded ? ' is-open' : ''}${party ? ' has-party' : ''}`}
      style={{ '--i': index } as CSSProperties}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <div className="vcard-main" onClick={onSelect}>
        <div className="vcard-art">
          <VenueArt venue={v} sport={m?.sport} animated={false} />
          {live && (
            <span className="vcard-live">
              <span className="live-dot" /> Live
            </span>
          )}
        </div>
        <div className="vcard-body">
          <p className="vcard-meta">
            <span>{v.area}</span>
            <span aria-hidden="true">·</span>
            <span>
              <IconPin size={12} /> {fmtKm(row.distance)}
              {originLabel ? <span className="sr-only"> from {originLabel}</span> : null}
            </span>
            <span aria-hidden="true">·</span>
            <span className={`vibe vibe-${v.atmosphere}`}>{vibe.label}</span>
          </p>
          <h3 className="vcard-name">
            <Link to={href} onClick={(e) => e.stopPropagation()}>
              {v.name}
            </Link>
          </h3>
          {showMatch && m && (
            <p className="vcard-game">
              {live ? 'Now' : `${relativeDay(m.start, now)} ${fmtTime(m.start)}`} · <b>{matchTitle(m)}</b>
            </p>
          )}
          {b ? (
            <div className="vcard-badges">
              <VerifiedBadge b={b} />
              <SoundBadge b={b} />
              <ScreensBadge b={b} />
              <PartyBadge b={b} />
            </div>
          ) : (
            <p className="vcard-game muted">No games in the next 36 hours</p>
          )}
        </div>
      </div>

      {b && (
        <footer className="vcard-foot">
          <FanStack fans={b.fans} confirmed={b.confirmed} compact />
          <span className={`avail avail-${av!.key}`}>{av!.label}</span>
          {onToggle && (
            <button
              className="vcard-toggle"
              onClick={onToggle}
              aria-expanded={!!expanded}
              aria-controls={`vpanel-${v.id}`}
              aria-label={expanded ? 'Hide details' : 'Show details'}
            >
              <IconChevronDown size={18} />
            </button>
          )}
        </footer>
      )}

      {onToggle && (
        <div className={`collapse${expanded ? ' open' : ''}`} id={`vpanel-${v.id}`} inert={!expanded}>
          <div>
          <div className="vcard-panel-in">
            {party && (
              <p className="vcard-party">
                <b>{party.name}</b> hosted by {party.host}
                {partyTeam ? ` · ${partyTeam.name} fans` : ''}
              </p>
            )}
            <dl className="vcard-facts">
              <div>
                <dt>Screens</dt>
                <dd>
                  {v.screens} in the room{v.bigScreen ? ` · ${v.bigScreen}` : ''}
                  {b ? ` · this game on ${b.screens}${b.mainScreen ? ', main screen' : ''}` : ''}
                </dd>
              </div>
              <div>
                <dt>Food &amp; drink</dt>
                <dd>
                  {v.kitchen} · {v.drinks}
                </dd>
              </div>
              <div>
                <dt>Open</dt>
                <dd>{v.hours}</dd>
              </div>
              {m && (
                <div>
                  <dt>Game</dt>
                  <dd>
                    {getLeague(m.league).short} · {relativeDay(m.start, now)} {fmtTime(m.start)}
                  </dd>
                </div>
              )}
            </dl>
            <div className="vcard-actions">
              {m && b && b.tablesLeft > 0 && statusOf(m, now) !== 'finished' ? (
                <Link to={`/venue/${v.id}?match=${m.id}&book=1`} className="btn btn-book">
                  Reserve a table
                </Link>
              ) : null}
              <Link to={href} className="btn btn-ghost">
                View venue
              </Link>
            </div>
          </div>
          </div>
        </div>
      )}
    </article>
  )
}
