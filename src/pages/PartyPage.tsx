import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { siteUrl } from '../lib/origin'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, type Party } from '../api/client'
import { Sheet } from '../components/Sheet'
import { errText, shareLink, toast, useAuthed } from '../components/Social'
import { VenueArt } from '../components/VenueArt'
import { getMatch, getTeam, getVenue } from '../data/demo'
import { countdownShort, fmtDate, fmtTime, useNow } from '../lib/time'
import { refreshLive } from '../state/live'
import { useSession } from '../state/session'
import type { Match, Venue } from '../types'
import { NotFound } from './NotFound'

const DOTS = ['#B8935A', '#C9A45C', '#8A5433', '#E4CFB3', '#5A6B8C', '#7A1F2B', '#3A7D5F']

export function PartyPage() {
  const { slug } = useParams()
  const { user, ready } = useSession()
  const authed = useAuthed()
  const now = useNow()
  const [p, setP] = useState<Party | null>(null)
  const [missing, setMissing] = useState(false)
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ready) return
    api<{ party: Party }>('GET', `/parties/${slug}`)
      .then((r) => setP(r.party))
      .catch(() => setMissing(true))
  }, [slug, ready, user?.id])

  if (missing) return <NotFound what="watch party" />
  if (!p) return <div className="page-loading" />

  const v = getVenue(p.venueId)
  const m = getMatch(p.matchId)
  const start = new Date(p.matchStart)
  const url = siteUrl(`/party/${p.slug}`)

  const act = (path: string, msg: string) =>
    authed(async () => {
      setBusy(true)
      try {
        const r = await api<{ party: Party }>('POST', `/parties/${p.slug}/${path}`)
        setP(r.party)
        toast(msg)
        void refreshLive()
      } catch (e) {
        toast(errText(e), 'err')
      } finally {
        setBusy(false)
      }
    }, 'Sign in to join the watch party')

  const sendInvite = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const r = await api<{ party: Party }>('POST', `/parties/${p.slug}/invite`, { email: invite })
      setP(r.party)
      toast(`Invite saved — ${invite} will see it when they sign in`)
      setInvite('')
    } catch (e2) {
      toast(errText(e2), 'err')
    }
  }

  return (
    <div className="partypage">
      <section className="pp-hero">
        {v && <VenueArt venue={v} sport={m?.sport} className="pp-art" />}
        <div className="pp-shade" />
        <div className="wrap pp-in">
          <p className="eyebrow">Watch party · hosted by {p.host}</p>
          <h1 className="display display-sm">{p.title}</h1>
          <p className="pp-game">
            <b>{p.matchTitle}</b>
            <span>
              {fmtDate(start)} · {fmtTime(start)} · {start.getTime() > now ? countdownShort(start, now) : 'on now'}
            </span>
          </p>
          <p className="pp-venue">
            at{' '}
            <Link to={`/venue/${p.venueId}?match=${p.matchId}`}>
              {p.venueName}
              {v ? ` · ${v.area}` : ''}
            </Link>
          </p>
        </div>
      </section>

      <section className="wrap pp-body">
        <div className="pp-crowd">
          <p className="eyebrow">Who’s in · {p.members.length}</p>
          <ul className="crowd">
            {p.members.map((n, i) => (
              <li key={n + i} style={{ '--i': i, '--c': DOTS[i % DOTS.length] } as CSSProperties}>
                <span className="crowd-av">{n[0]}</span>
                <span className="crowd-n">{n}</span>
              </li>
            ))}
          </ul>
          {p.note && <blockquote className="pp-note">“{p.note}” — {p.host}</blockquote>}

          <div className="pp-cta">
            {p.joined ? (
              <>
                <span className="going on">
                  <span className="going-check">✓</span> You’re in
                </span>
                {!p.isHost && (
                  <button className="btn btn-ghost" onClick={() => act('leave', 'You left the watch party')} disabled={busy}>
                    Leave
                  </button>
                )}
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => act('join', 'You’re in! See you there.')} disabled={busy}>
                Join the crowd
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => shareLink(url, `${p.title} — Cheers & Cheer`)}>
              Share link
            </button>
            {m && v && (
              <Link className="btn btn-ghost" to={`/venue/${v.id}?match=${m.id}&book=1`}>
                Book a table
              </Link>
            )}
          </div>
        </div>

        {p.joined && (
          <div className="pp-invite">
            <p className="eyebrow">Invite friends</p>
            <form onSubmit={sendInvite} className="invite-form">
              <input type="email" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="friend@email.com" required aria-label="Friend’s email" />
              <button className="btn btn-primary">Invite</button>
            </form>
            <p className="fine">
              Invites appear in your friend’s account when they sign in with that email. Or just share the link — anyone with it can join.
            </p>
            {p.invites && p.invites.length > 0 && (
              <ul className="invite-list">
                {p.invites.map((i) => (
                  <li key={i.email}>
                    {i.email} <span className={`inv inv-${i.status}`}>{i.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/** Create-a-watch-party sheet (used on venue pages). */
export function PartySheet({ open, onClose, venue, match }: { open: boolean; onClose: () => void; venue: Venue; match: Match }) {
  const nav = useNavigate()
  const home = getTeam(match.home)
  const [title, setTitle] = useState(`${home ? home.name : match.title ?? 'Game'} night at ${venue.name}`)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const r = await api<{ party: Party }>('POST', '/parties', { matchId: match.id, venueId: venue.id, title, note })
      void refreshLive()
      onClose()
      nav(`/party/${r.party.slug}`)
      toast('Watch party created — share the link with your crew')
    } catch (e2) {
      setErr(errText(e2))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={`${venue.name} · ${fmtTime(match.start)}`}
      title={
        <>
          Start a watch <em>party.</em>
        </>
      }
    >
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Name it</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
        </label>
        <label className="field">
          <span>A note for your crew (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} rows={3} placeholder="Wear the away kit. First round’s on me." />
        </label>
        {err && <p className="form-err">{err}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating…' : 'Create & get the link'}
        </button>
        <p className="fine">You’ll get a link anyone can open. You can also invite friends by email.</p>
      </form>
    </Sheet>
  )
}
