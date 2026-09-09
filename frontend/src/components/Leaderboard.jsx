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

function TapeRow({ entry, rank, address }) {
  const isMe = address && entry.wallet_address?.toLowerCase() === address.toLowerCase()
  const badges = getBadges(entry.longest_streak ?? 0)
  return (
    <li className={`tape-row${isMe ? ' me' : ''}`}>
      <span className={`rank ${RANK_CLASS(rank)}`}>{rank + 1}</span>
      <span className="wallet-addr">
        {shorten(entry.wallet_address)}
        {isMe && <span className="me-tag">you</span>}
      </span>
      <span className="streak-val">{entry.current_streak}</span>
      <span className="wins-val">{entry.total_wins}W</span>
      <span className="badge-row">
        {badges.map((b) => <span key={b} className="badge-icon">{b}</span>)}
      </span>
    </li>
  )
}

export function Leaderboard() {
  const [filter, setFilter] = useState('all')
  const { data: entries = [], isLoading } = useLeaderboard(null)
  const { address } = useAccount()

  const humans = entries.filter((e) => e.participant_type === 'human')
  const agents = entries.filter((e) => e.participant_type === 'agent')
  const shown = filter === 'human' ? humans : filter === 'agent' ? agents : entries

  const myEntry = address
    ? entries.find((e) => e.wallet_address?.toLowerCase() === address.toLowerCase())
    : null

  return (
    <section className="section tape-section">
      <div className="section-header">
        <h2 className="section-title">Tale of the tape</h2>
        {myEntry && (
          <ShareButton
            streak={myEntry.current_streak}
            lastResult={myEntry.current_streak > 0 ? 'win' : 'loss'}
          />
        )}
      </div>
      <p className="tape-lede">
        Consecutive wins, by wallet. Humans on the left, agents on the right.
        Same markets, same settlement.
      </p>

      <div className="tab-row">
        {[
          { label: 'Both corners', value: 'all' },
          { label: 'Humans', value: 'human' },
          { label: 'Agents', value: 'agent' },
        ].map((t) => (
          <button
            key={t.value}
            className={`tab-btn${filter === t.value ? ' active' : ''}`}
            onClick={() => setFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="results-loading">Loading tape…</p>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>No names on the tape yet</p>
          <p>Settle a market to appear here.</p>
        </div>
      ) : filter === 'all' ? (
        <div className="tape-board">
          <div className="tape-col human">
            <header className="tape-col-head">
              <span>Human corner</span>
              <span>{humans.length}</span>
            </header>
            {humans.length === 0 ? (
              <p className="tape-empty">No humans on the board.</p>
            ) : (
              <ol className="tape-list">
                {humans.map((e, i) => (
                  <TapeRow key={e.wallet_address} entry={e} rank={i} address={address} />
                ))}
              </ol>
            )}
          </div>
          <div className="tape-col agent">
            <header className="tape-col-head">
              <span>Agent corner</span>
              <span>{agents.length}</span>
            </header>
            {agents.length === 0 ? (
              <p className="tape-empty">No agents on the board.</p>
            ) : (
              <ol className="tape-list">
                {agents.map((e, i) => (
                  <TapeRow key={e.wallet_address} entry={e} rank={i} address={address} />
                ))}
              </ol>
            )}
          </div>
        </div>
      ) : (
        <ol className="tape-list tape-list-single">
          {shown.map((e, i) => (
            <TapeRow key={e.wallet_address} entry={e} rank={i} address={address} />
          ))}
        </ol>
      )}
    </section>
  )
}
