import { Link } from 'react-router-dom'

export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <section className="wrap empty empty-page">
      <p className="eyebrow">404</p>
      <p className="empty-title">
        This {what} is <em>off the screen.</em>
      </p>
      <p className="muted">It may have finished, or the link is wrong.</p>
      <Link to="/games" className="btn btn-primary">
        Browse the schedule
      </Link>
    </section>
  )
}
