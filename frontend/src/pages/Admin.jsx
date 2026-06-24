import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parseSportsQuestion, FLAGS } from '../constants'
import { API_BASE } from '../lib/api'

const CONTRACT_OWNER = '0x426bE45496911cBdac19750Ff4bd90cE7ecefB48'.toLowerCase()
const toUSDC = (raw) => (Number(raw || 0) / 1_000_000).toFixed(2)

function useResolveQueue() {
  return useQuery({
    queryKey: ['resolve-queue'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/markets/resolve-queue`)
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    refetchInterval: 15_000,
  })
}

function ResolveCard({ market }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(null)
  const [done, setDone] = useState(false)
  const [err,  setErr]  = useState(null)

  const { teamA, teamB, competition } = parseSportsQuestion(market.question)
  const pot = toUSDC(market.total_pot)
  const deadlinePast = new Date(Number(market.deadline) * 1000)

  async function submitResult(outcome) {
    setBusy(outcome)
    setErr(null)
    try {
      const res = await fetch(`${API_BASE}/api/markets/${market.market_id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      })
      if (!res.ok) throw new Error(await res.text())
      setDone(true)
      queryClient.invalidateQueries({ queryKey: ['resolve-queue'] })
    } catch (e) {
      setErr(e.message || 'Failed to submit result')
    }
    setBusy(null)
  }

  if (done) return (
    <article className="admin-card done">
      <p className="admin-done-msg">
        Market #{market.market_id} — result queued<br />
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          Agent will propose via UMA within 10 min · 2hr dispute window
        </span>
      </p>
    </article>
  )

  return (
    <article className="admin-card">
      <div className="admin-card-top">
        <span className="admin-market-id">Market #{market.market_id}</span>
        <span className="admin-comp">{competition || 'World Cup 2026'}</span>
      </div>

      <div className="admin-matchup">
        <span className="admin-team">{FLAGS[teamA] || '🏳'} {teamA}</span>
        <span className="admin-vs">vs</span>
        <span className="admin-team">{FLAGS[teamB] || '🏳'} {teamB}</span>
      </div>

      <div className="admin-meta">
        <span>Pot: {pot} USDC</span>
        <span>Ended: {deadlinePast.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <p className="admin-resolve-label">Set result → agent proposes via UMA</p>
      <div className="admin-resolve-btns">
        <button
          className={`admin-btn team-a${busy === 1 ? ' loading' : ''}`}
          onClick={() => submitResult(1)}
          disabled={!!busy}
        >
          {busy === 1 ? '...' : `${FLAGS[teamA] || ''} ${teamA} wins`}
        </button>
        <button
          className={`admin-btn draw${busy === 3 ? ' loading' : ''}`}
          onClick={() => submitResult(3)}
          disabled={!!busy}
        >
          {busy === 3 ? '...' : 'Draw'}
        </button>
        <button
          className={`admin-btn team-b${busy === 2 ? ' loading' : ''}`}
          onClick={() => submitResult(2)}
          disabled={!!busy}
        >
          {busy === 2 ? '...' : `${FLAGS[teamB] || ''} ${teamB} wins`}
        </button>
      </div>

      {err && <p className="admin-err">{err}</p>}
    </article>
  )
}

export function AdminPage() {
  const { address, isConnected } = useAccount()
  const { data: queue = [], isLoading } = useResolveQueue()

  const isOwner = isConnected && address?.toLowerCase() === CONTRACT_OWNER

  if (!isConnected) return (
    <div className="admin-gate">
      <p>Connect your wallet to access admin</p>
    </div>
  )

  if (!isOwner) return (
    <div className="admin-gate">
      <p className="admin-gate-title">Owner only</p>
      <p className="admin-gate-sub">
        This panel requires the contract owner wallet.<br />
        Connected: <code>{address?.slice(0, 10)}…</code>
      </p>
    </div>
  )

  return (
    <div className="page-wrap">
      <div className="admin-hero">
        <h1 className="admin-title">Admin</h1>
        <p className="admin-sub">
          Enter match results — agent proposes on-chain via UMA, auto-settles after 2hr dispute window
        </p>
      </div>

      {isLoading ? (
        <p className="results-loading">Loading resolve queue...</p>
      ) : queue.length === 0 ? (
        <div className="results-empty">
          <p>No markets pending resolution</p>
          <p>Markets appear here once they go past their deadline.</p>
        </div>
      ) : (
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Pending resolution</h2>
            <span className="section-badge">{queue.length}</span>
          </div>
          <div className="admin-grid">
            {queue.map((m) => (
              <ResolveCard key={m.market_id} market={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
