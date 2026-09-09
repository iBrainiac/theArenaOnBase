import { Link } from 'react-router-dom'
import mark from '../assets/the-arena-logo.jpg'

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="nav-logo">
      <img
        className="nav-logo-mark"
        src={mark}
        alt=""
        width={36}
        height={36}
      />
      <span className="nav-logo-name">The Arena</span>
    </Link>
  )
}
