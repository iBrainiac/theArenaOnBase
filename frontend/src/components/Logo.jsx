import { Link } from 'react-router-dom'

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="nav-logo">
      <span className="nav-logo-mark" aria-hidden="true">
        <span className="mark-human" />
        <span className="mark-agent" />
      </span>
      <span className="nav-logo-name">The Arena</span>
    </Link>
  )
}
