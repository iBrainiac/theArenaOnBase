import { useEffect, useRef, useState } from 'react'
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useMyPositions } from '../hooks/useMyPositions'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { ShareButton } from './ShareButton'
import { MARKET_ABI, STATUS } from '../constants'
import { BASE_SEPOLIA_ID, ensureWalletChain, getChainConfig } from '../chains'
import { useArenaChain } from '../hooks/useArenaChain'

const STATUS_LABEL = { 0: 'Open', 1: 'Live', 2: 'Settled', 3: 'Cancelled' }
const OPTION_LABEL = { 1: 'UP', 2: 'DOWN', 3: 'Draw' }
const toUSDC = (raw) => (Number(raw || 0) / 1_000_000).toFixed(2)

function useCountdown(deadlineSecs) {
  const [secs, setSecs] = useState(() => Math.max(0, deadlineSecs - Math.floor(Date.now() / 1000)))
  useEffect(() => {
    const id = setInterval(() => setSecs(Math.max(0, deadlineSecs - Math.floor(Date.now() / 1000))), 1000)
    return () => clearInterval(id)
  }, [deadlineSecs])
  if (secs === 0) return 'Expired'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

function PositionCard({ pos, onToast }) {
  const { address, chainId: walletChainId } = useAccount()
  const targetId = Number(pos.chain_id) || BASE_SEPOLIA_ID
  const target = getChainConfig(targetId)
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: targetId })
  const queryClient = useQueryClient()
  const { writeContractAsync } = useWriteContract()
  const [busy, setBusy] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const timer = useCountdown(Number(pos.deadline))

  const isSettled   = pos.status === STATUS.SETTLED
  const isCancelled = pos.status === STATUS.CANCELLED
  const isDraw      = isSettled && pos.winning_option === 3
  const isWinner    = isSettled && !isDraw && pos.option === pos.winning_option
  const isLoser     = isSettled && !isDraw && pos.option !== pos.winning_option
  const withdrawn   = pos.withdrawn || claimed
  const canWithdraw = isWinner && !withdrawn
  const canRefund   = (isCancelled || pos.status === STATUS.OPEN) && !withdrawn

  const optionLabel = OPTION_LABEL[pos.option] || '?'
  const potUSDC     = toUSDC(pos.total_pot)
  const myUSDC      = toUSDC(pos.amount)

  async function handleClaim(fn) {
    setBusy(true)
    try {
      await ensureWalletChain(switchChainAsync, walletChainId, targetId)
      const hash = await writeContractAsync({
        address: target.market,
        abi: MARKET_ABI,
        functionName: fn,
        args: [BigInt(pos.market_id)],
        chainId: targetId,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setClaimed(true)  // optimistic — hides button immediately
      onToast(fn === 'withdraw' ? 'Winnings claimed!' : 'Refund received!', 'success')
      queryClient.invalidateQueries({ queryKey: ['positions', address] })
    } catch (err) {
      onToast(err.shortMessage || 'Transaction failed', 'error')
    }
    setBusy(false)
  }

  return (
    <div className={`pos-card${isWinner ? ' pos-win' : ''}${isLoser ? ' pos-loss' : ''}`}>
      <div className="pos-card-top">
        <div>
          <span className={`pos-opt-badge ${optionLabel.toLowerCase()}`}>{optionLabel}</span>
          <span className="pos-market-id">Market #{pos.market_id}</span>
        </div>
        <span className={`pos-status-tag status-${pos.status}`}>
          {isWinner ? 'Won' : isLoser ? 'Lost' : isDraw ? 'Draw' : STATUS_LABEL[pos.status]}
        </span>
      </div>

      <p className="pos-question">{pos.question}</p>

      <div className="pos-meta">
        <div>
          <div className="pos-meta-label">Your bet</div>
          <div className="pos-meta-val">{myUSDC} USDC</div>
        </div>
        <div>
          <div className="pos-meta-label">Pot</div>
          <div className="pos-meta-val">{potUSDC} USDC</div>
        </div>
        <div>
          <div className="pos-meta-label">{isSettled ? 'Settled' : 'Closes'}</div>
          <div className="pos-meta-val">{isSettled ? '—' : timer}</div>
        </div>
      </div>

      {canWithdraw && (
        <button className="btn-claim" onClick={() => handleClaim('withdraw')} disabled={busy}>
          {busy ? 'Claiming...' : `Claim ${toUSDC(Math.floor(Number(pos.total_pot) * 0.97))} USDC`}
        </button>
      )}
      {canRefund && (
        <button className="btn-claim refund" onClick={() => handleClaim('refund')} disabled={busy}>
          {busy ? 'Refunding...' : 'Get refund'}
        </button>
      )}
      {withdrawn && isSettled && (
        <p className="pos-claimed-tag">Claimed</p>
      )}
      {withdrawn && !isSettled && (
        <p className="pos-claimed-tag">Refunded</p>
      )}
    </div>
  )
}

function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, 4000)
    return () => clearTimeout(id)
  }, [onDone])
  return <div className={`toast toast-${type}`}>{msg}</div>
}

export function MyPositions() {
  const { address } = useAccount()
  const { chainId } = useArenaChain()
  const { data: positions = [], isLoading } = useMyPositions(address, chainId)
  const { data: leaderboard = [] } = useLeaderboard()
  const [toasts, setToasts] = useState([])
  const prevStatuses = useRef({})

  // Detect settlement and fire toast
  useEffect(() => {
    positions.forEach((p) => {
      const prev = prevStatuses.current[p.market_id]
      if (prev !== undefined && prev !== p.status && p.status === STATUS.SETTLED) {
        const won = p.option === p.winning_option
        const msg = won
          ? `Market #${p.market_id} settled — you won! Claim your USDC below.`
          : `Market #${p.market_id} settled — better luck next time.`
        setToasts((t) => [...t, { id: Date.now(), msg, type: won ? 'success' : 'error' }])
      }
      prevStatuses.current[p.market_id] = p.status
    })
  }, [positions])

  if (!address) return null
  if (isLoading) return null
  if (positions.length === 0) return null

  const addToast = (msg, type) =>
    setToasts((t) => [...t, { id: Date.now(), msg, type }])

  const myStats   = leaderboard.find(e => e.wallet_address?.toLowerCase() === address?.toLowerCase())
  const streak    = myStats?.streak || 0
  const settled   = positions.filter(p => p.status === STATUS.SETTLED)
  const lastPos   = settled[0]
  const lastResult = lastPos
    ? (lastPos.option === lastPos.winning_option ? 'win' : 'loss')
    : null

  return (
    <>
      <section className="section">
        <div className="section-header">
          <div className="section-header-left">
            <h2 className="section-title">My positions</h2>
            <span className="section-badge">{positions.length}</span>
            {streak >= 2 && (
              <span className="streak-badge">
                {streak >= 5 ? '🔥' : '⚡'} {streak}-win streak
              </span>
            )}
          </div>
          {lastResult && (
            <ShareButton streak={streak} lastResult={lastResult} />
          )}
        </div>
        <div className="pos-grid">
          {positions.map((p) => (
            <PositionCard key={`${p.chain_id}-${p.market_id}-${p.wallet_address}`} pos={p} onToast={addToast} />
          ))}
        </div>
      </section>

      <div className="toast-stack">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            msg={t.msg}
            type={t.type}
            onDone={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </>
  )
}
