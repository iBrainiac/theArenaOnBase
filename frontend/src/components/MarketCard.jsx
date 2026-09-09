import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { STATUS, MARKET_TYPE, MARKET_ABI, fmtDuration } from '../constants'
import { useArenaChain } from '../hooks/useArenaChain'
import { SportsCard } from './SportsCard'

function useCountdown(deadlineSecs) {
  const [secs, setSecs] = useState(() => Math.max(0, deadlineSecs - Math.floor(Date.now() / 1000)))

  useEffect(() => {
    const id = setInterval(() => {
      setSecs(Math.max(0, deadlineSecs - Math.floor(Date.now() / 1000)))
    }, 1000)
    return () => clearInterval(id)
  }, [deadlineSecs])

  if (secs === 0) return { label: 'Expired', urgent: false }
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const label = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
  return { label, urgent: secs < 600 }
}

const toUSDC = (raw) => (Number(raw || 0) / 1_000_000).toFixed(2)

export function MarketCard({ market, onJoin }) {
  const { address }    = useAccount()
  const { chainId, market: marketAddr } = useArenaChain()
  const publicClient   = usePublicClient({ chainId })
  const queryClient    = useQueryClient()
  const { writeContractAsync } = useWriteContract()
  const { label: timer, urgent } = useCountdown(Number(market.deadline))
  const [settling, setSettling] = useState(false)
  const [settleErr, setSettleErr] = useState(null)

  if (market.market_type === MARKET_TYPE.SPORTS_MATCH) {
    return <SportsCard market={market} onJoin={onJoin} />
  }

  const now          = Math.floor(Date.now() / 1000)
  const pastDeadline = now >= Number(market.deadline)
  const isLive       = market.status === STATUS.LIVE
  const isOpen       = market.status === STATUS.OPEN
  const canJoin      = (isLive || isOpen) && !pastDeadline && !!address
  const canSettle    = isLive && pastDeadline && !!address
  const marketDuration = market.deadline && market.created_at
    ? fmtDuration(Number(market.deadline) - Number(market.created_at))
    : null

  async function handleSettle() {
    setSettling(true)
    setSettleErr(null)
    try {
      const hash = await writeContractAsync({
        address: marketAddr,
        abi: MARKET_ABI,
        functionName: 'settleMarket',
        args: [BigInt(market.market_id)],
        chainId,
      })
      await publicClient.waitForTransactionReceipt({ hash })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
      queryClient.invalidateQueries({ queryKey: ['markets', 'settled'] })
      queryClient.invalidateQueries({ queryKey: ['positions', address] })
    } catch (err) {
      setSettleErr(err.shortMessage || 'Settle failed')
    }
    setSettling(false)
  }

  return (
    <article className="market-card ticket">
      <div className="card-top">
        <div className="ticket-pills">
          <span className="market-type-pill btc">BTC</span>
          {marketDuration && <span className="duration-pill">{marketDuration}</span>}
        </div>
        <div className={`status-indicator ${isLive ? 'live' : 'open'}`}>
          <div className={`status-dot ${isLive ? 'live' : 'open'}`} />
          <span className="status-text">
            {pastDeadline && isLive ? 'Ready to settle' : isLive ? 'Live' : 'Open'}
          </span>
        </div>
      </div>

      <p className="market-question">{market.question}</p>

      <div className="sides">
        <div className="side up">
          <div className="side-dir">UP</div>
          <div className="side-amt">{toUSDC(market.option_a_total)}<span className="side-unit">USDC</span></div>
        </div>
        <div className="side down">
          <div className="side-dir">DOWN</div>
          <div className="side-amt">{toUSDC(market.option_b_total)}<span className="side-unit">USDC</span></div>
        </div>
      </div>

      <dl className="card-footer">
        <div className="pot-block">
          <dt>Total pot</dt>
          <dd>{toUSDC(market.total_pot)} USDC</dd>
        </div>
        <div className={`timer${urgent ? ' urgent' : ''}`}>{timer}</div>
      </dl>

      {canSettle ? (
        <>
          <button className="btn-settle" onClick={handleSettle} disabled={settling}>
            {settling ? 'Settling...' : 'Settle market'}
          </button>
          {settleErr && <p className="settle-err">{settleErr}</p>}
        </>
      ) : (
        <button
          className="btn-join"
          onClick={() => onJoin(market)}
          disabled={!canJoin}
          title={!address ? 'Connect wallet to join' : pastDeadline ? 'Deadline passed' : undefined}
        >
          {!address ? 'Connect to join' : pastDeadline ? 'Deadline passed' : isLive ? 'Join market' : 'Take position'}
        </button>
      )}
    </article>
  )
}
