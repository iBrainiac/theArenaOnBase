import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { ShareButton } from './ShareButton'

const shorten = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''

const BADGES = [
  { min: 30, icon: '🏆' },
  { min: 14, icon: '👑' },
  { min: 7,  icon: '⚡' },
  { min: 3,  icon: '🔥' },
]

function getBadges(longest) {
  return BADGES.filter((b) => longest >= b.min).map((b) => b.icon)
}

const RANK_CLASS = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''

export function Leaderboard() {
  const [filter, setFilter] = useState(null)
  const { data: entries = [], isLoading } = useLeaderboard(filter)
  const { address } = useAccount()

  const myEntry = address
    ? entries.find((e) => e.wallet_address?.toLowerCase() === address.toLowerCase())
    : null

  const TABS = [
    { label: 'All',    value: null     },
    { label: 'Humans', value: 'human'  },
    { label: 'Agents', value: 'agent'  },
  ]

  return (
    <section className="section">
      <div className="section-header">
        <h2 className="section-title">Leaderboard</h2>
        {myEntry && (
          <ShareButton
            streak={myEntry.current_streak}
            lastResult={myEntry.current_streak > 0 ? 'win' : 'loss'}
          />
        )}
      </div>

      <div className="tab-row">
        {TABS.map((t) => (
          <button
            key={t.label}
            className={`tab-btn${filter === t.value ? ' active' : ''}`}
            onClick={() => setFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <table className="lb-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Wallet</th>
            <th>Type</th>
            <th>Streak</th>
            <th>Badges</th>
            <th>Wins</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                Loading...
              </td>
            </tr>
          ) : entries.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-2)', fontSize: 14 }}>
                No entries yet. Be the first.
              </td>
            </tr>
          ) : (
            entries.map((e, i) => {
              const isMe = address && e.wallet_address?.toLowerCase() === address.toLowerCase()
              const badges = getBadges(e.longest_streak ?? 0)
              return (
                <tr key={e.wallet_address} style={isMe ? { background: 'rgba(245,166,35,0.035)' } : {}}>
                  <td><span className={`rank ${RANK_CLASS(i)}`}>{i + 1}</span></td>
                  <td>
                    <span className="wallet-addr">{shorten(e.wallet_address)}</span>
                    {isMe && <span className="me-tag">you</span>}
                  </td>
                  <td>
                    <span className={`type-chip ${e.participant_type}`}>{e.participant_type}</span>
                  </td>
                  <td><span className="streak-val">{e.current_streak}</span></td>
                  <td>
                    <div className="badge-row">
                      {badges.map((b) => <span key={b} className="badge-icon">{b}</span>)}
                    </div>
                  </td>
                  <td><span className="wins-val">{e.total_wins}</span></td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </section>
  )
}
