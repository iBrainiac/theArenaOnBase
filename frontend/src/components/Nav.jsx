import { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Link, useLocation } from 'react-router-dom'
import { useAccount } from 'wagmi'

const CONTRACT_OWNER = '0x426bE45496911cBdac19750Ff4bd90cE7ecefB48'.toLowerCase()

function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('arena-theme', theme) } catch (_) {}
  }, [theme])

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}

export function Nav() {
  const { pathname } = useLocation()
  const { address }  = useAccount()
  const isOwner      = address?.toLowerCase() === CONTRACT_OWNER

  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <div className="nav-logo-mark">A</div>
        <span className="nav-logo-name">The Arena</span>
      </Link>

      <ul className="nav-links">
        <li><Link to="/"            className={pathname === '/'            ? 'active' : ''}>Markets</Link></li>
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
