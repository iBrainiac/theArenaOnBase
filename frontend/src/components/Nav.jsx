import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

const CONTRACT_OWNER = '0x426bE45496911cBdac19750Ff4bd90cE7ecefB48'.toLowerCase()

export function Nav() {
  const { pathname } = useLocation()
  const { address }  = useAccount()
  const isOwner      = address?.toLowerCase() === CONTRACT_OWNER

  return (
    <nav className="nav">
      <Logo to="/app" />

      <ul className="nav-links">
        <li><Link to="/app"         className={pathname === '/app'         ? 'active' : ''}>Markets</Link></li>
        <li><Link to="/results"     className={pathname === '/results'     ? 'active' : ''}>Results</Link></li>
        <li><Link to="/leaderboard" className={pathname === '/leaderboard' ? 'active' : ''}>Leaderboard</Link></li>
        {isOwner && (
          <li><Link to="/admin" className={`admin-link${pathname === '/admin' ? ' active' : ''}`}>Admin</Link></li>
        )}
      </ul>

      <div className="nav-right">
        <ThemeToggle />
        <ConnectButton chainStatus="none" showBalance={false} label="Connect wallet" />
      </div>
    </nav>
  )
}
