import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parseSportsQuestion, FLAGS, MARKET_ABI, CONTRACT_OWNER } from '../constants'
import { API_BASE } from '../lib/api'
import { ARC_TESTNET_ID, BASE_SEPOLIA_ID, ensureWalletChain, getChainConfig } from '../chains'

const toUSDC = (raw) => (Number(raw || 0) / 1_000_000).toFixed(2)

function useResolveQueue() {
  return useQuery({
    queryKey: ['resolve-queue', 'both'],
    queryFn: async () => {
      const urls = [BASE_SEPOLIA_ID, ARC_TESTNET_ID].map(
        (id) => `${API_BASE}/api/markets/resolve-queue?chainId=${id}`
      )
      const results = await Promise.all(urls.map(async (url) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed')
        return res.json()
      }))
      return results.flat()
    },
    refetchInterval: 15_000,
  })
}

function ResolveCard({ market }) {
  const { chainId: walletChainId } = useAccount()
  const targetId = Number(market.chain_id) || BASE_SEPOLIA_ID
  const target = getChainConfig(targetId)
  const { switchChainAsync } = useSwitchChain()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(null)
  const [err,  setErr]  = useState(null)

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract()
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash })

  const { teamA, teamB, competition } = parseSportsQuestion(market.question)
  const pot = toUSDC(market.total_pot)
  const deadlinePast = new Date(Number(market.deadline) * 1000)

  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries({ queryKey: ['resolve-queue'] })
      setBusy(null)
    }
  }, [isSuccess, queryClient])

  useEffect(() => {
    if (writeError) {
      setErr(writeError.shortMessage || writeError.message || 'Transaction failed')
      setBusy(null)
    }
  }, [writeError])

  async function requestChainlink() {
    setBusy('cl')
    setErr(null)
    try {
      await ensureWalletChain(switchChainAsync, walletChainId, targetId)
      writeContract({
        address: target.market,
        abi: MARKET_ABI,
        functionName: 'requestSportsResult',
        args: [BigInt(market.market_id)],
        chainId: targetId,
      })
    } catch (e) {
      setErr(e.shortMessage || e.message || 'Request failed')
      setBusy(null)
    }
  }

  async function submitResult(outcome) {
    setBusy(outcome)
    setErr(null)
    try {
      await ensureWalletChain(switchChainAsync, walletChainId, targetId)
      writeContract({
        address: target.market,
        abi: MARKET_ABI,
        functionName: 'resolveSportsMarket',
        args: [BigInt(market.market_id), outcome],
        chainId: targetId,
      })
    } catch (e) {
      setErr(e.shortMessage || e.message || 'Switch network and retry')
      setBusy(null)
    }
  }

  const isBusy = !!busy || isPending || isConfirming

  if (isSuccess) return (
    <article className="admin-card done">
      <p className="admin-done-msg">
        Market #{market.market_id} — resolved on-chain<br />
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          Winners can now claim their winnings
        </span>
      </p>
    </article>
  )

  return (
    <article className="admin-card">
      <div className="admin-card-top">
        <span className="admin-market-id">Market #{market.market_id}</span>
        <span className="admin-comp">{getChainConfig(Number(market.chain_id))?.name || 'Base Sepolia'} · {competition || 'World Cup 2026'}</span>
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

      <p className="admin-resolve-label">Set result → resolves on-chain instantly</p>
      {target?.hasSportsOracle ? (
        <>
          <p className="admin-resolve-label">Request Chainlink result, or set it yourself</p>
          <div className="admin-resolve-btns" style={{ marginBottom: '0.75rem' }}>
            <button
              className={`admin-btn draw${busy === 'cl' ? ' loading' : ''}`}
              onClick={requestChainlink}
              disabled={isBusy}
            >
              {busy === 'cl' && isConfirming ? 'Confirming...' : busy === 'cl' && isPending ? 'Sign...' : 'Request Chainlink result'}
            </button>
          </div>
          <p className="admin-resolve-label">Owner fallback</p>
        </>
      ) : (
        <p className="admin-resolve-label">Set the official full-time result</p>
      )}
      <div className="admin-resolve-btns">
        <button
          className={`admin-btn team-a${busy === 1 ? ' loading' : ''}`}
          onClick={() => submitResult(1)}
          disabled={isBusy}
        >
          {busy === 1 && isConfirming ? 'Confirming...' : busy === 1 && isPending ? 'Sign...' : `${FLAGS[teamA] || ''} ${teamA} wins`}
        </button>
        <button
          className={`admin-btn draw${busy === 3 ? ' loading' : ''}`}
          onClick={() => submitResult(3)}
          disabled={isBusy}
        >
          {busy === 3 && isConfirming ? 'Confirming...' : busy === 3 && isPending ? 'Sign...' : 'Draw'}
        </button>
        <button
          className={`admin-btn team-b${busy === 2 ? ' loading' : ''}`}
          onClick={() => submitResult(2)}
          disabled={isBusy}
        >
          {busy === 2 && isConfirming ? 'Confirming...' : busy === 2 && isPending ? 'Sign...' : `${FLAGS[teamB] || ''} ${teamB} wins`}
        </button>
      </div>

      {err && <p className="admin-err">{err}</p>}
    </article>
  )
}

export function AdminPage() {
  const { address, isConnected } = useAccount()
  const { data: queue = [], isLoading } = useResolveQueue()

  const isOwner = isConnected && address?.toLowerCase() === CONTRACT_OWNER.toLowerCase()

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
          Select the match result to resolve it on-chain instantly (Base or Arc)
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
              <ResolveCard key={`${m.chain_id}-${m.market_id}`} market={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
