import { Link, useParams } from 'react-router-dom'
import { useSession } from '../state/session'
import { CheckIn } from './OwnerPage'

/**
 * Where a ticket's QR code points. Venue staff who scan it with any phone
 * camera land here and check the guest in; anyone else is told what it is.
 */
export function CheckinPage() {
  const { code = '' } = useParams()
  const { user, ready } = useSession()
  if (!ready) return <div className="page-loading" />
  if (user?.role === 'venue')
    return (
      <section className="wrap ow-body">
        <CheckIn initial={code} />
        <p>
          <Link to="/owner" className="see-all">
            Back to dashboard →
          </Link>
        </p>
      </section>
    )
  return (
    <section className="wrap empty empty-page">
      <p className="eyebrow">Check-in code {code.toUpperCase()}</p>
      <p className="empty-title">
        Show this at the <em>door.</em>
      </p>
      <p className="muted">Venue staff scan this code to check guests in. If it’s your booking, open your ticket.</p>
      <div className="pp-cta">
        <Link to={`/ticket/${code}`} className="btn btn-primary">
          Open ticket
        </Link>
        {!user && (
          <Link to={`/signin?venue=1&next=/checkin/${code}`} className="btn btn-ghost">
            Venue staff sign-in
          </Link>
        )}
      </div>
    </section>
  )
}
