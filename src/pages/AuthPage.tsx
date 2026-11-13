import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Wordmark } from '../components/Layout'
import { errText } from '../components/Social'
import { useSession } from '../state/session'

export function AuthPage({ mode }: { mode: 'signin' | 'join' }) {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { login, register } = useSession()
  const venueMode = params.get('venue') === '1'
  const next = params.get('next') || (venueMode ? '/owner' : '/me')
  const why = params.get('why')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [venueCode, setVenueCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      const u =
        mode === 'signin'
          ? await login(email, password)
          : await register({ name, email, password, venueCode: venueMode ? venueCode : undefined })
      nav(u.role === 'venue' && !params.get('next') ? '/owner' : next, { replace: true })
    } catch (e2) {
      setErr(errText(e2))
    } finally {
      setBusy(false)
    }
  }

  const q = (m: 'signin' | 'join') => `/${m}?${new URLSearchParams({ ...(params.get('next') ? { next } : {}), ...(venueMode ? { venue: '1' } : {}) })}`

  return (
    <section className="auth">
      <div className="auth-card">
        <div className="auth-arch" aria-hidden="true">
          <Wordmark />
        </div>
        <p className="eyebrow">{venueMode ? 'For venues' : mode === 'signin' ? 'Welcome back' : 'Join the crowd'}</p>
        <h1 className="display display-sm">
          {venueMode ? (
            <>
              Run your <em>room.</em>
            </>
          ) : mode === 'signin' ? (
            <>
              Sign <em>in.</em>
            </>
          ) : (
            <>
              Cheer <em>together.</em>
            </>
          )}
        </h1>
        {why && <p className="auth-why">{why}</p>}

        <div className="seg" role="tablist">
          <Link to={q('signin')} role="tab" aria-selected={mode === 'signin'} replace>
            Sign in
          </Link>
          <Link to={q('join')} role="tab" aria-selected={mode === 'join'} replace>
            Create account
          </Link>
        </div>

        <form onSubmit={submit} className="form" noValidate>
          {mode === 'join' && (
            <label className="field">
              <span>{venueMode ? 'Your name' : 'Name'}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={60} />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
            />
            {mode === 'join' && <small>At least 8 characters.</small>}
          </label>
          {mode === 'join' && venueMode && (
            <label className="field">
              <span>Venue code</span>
              <input value={venueCode} onChange={(e) => setVenueCode(e.target.value)} placeholder="From your Cheers & Cheer partner pack" required />
              <small>Links this account to your venue. Each code works once.</small>
            </label>
          )}
          {err && (
            <p className="form-err" role="alert">
              {err}
            </p>
          )}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : venueMode ? 'Create venue account' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {venueMode ? (
            <Link to={`/${mode}`}>I’m a fan, not a venue</Link>
          ) : (
            <Link to={`/${mode}?venue=1`}>Run a sports bar? Venue sign-in →</Link>
          )}
        </p>
      </div>
    </section>
  )
}
