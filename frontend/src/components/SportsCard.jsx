import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { STATUS, parseSportsQuestion, FLAGS, MARKET_ABI } from '../constants'
import { getChainConfig } from '../chains'
import { ClaimWinnings } from './ClaimWinnings'

function useCountdown(deadlineSecs) {
  const [secs, setSecs] = useState(() => Math.max(0, deadlineSecs - Math.floor(Date.now() / 1000)))
  useEffect(() => {
    const id = setInterval(() => setSecs(Math.max(0, deadlineSecs - Math.floor(Date.now() / 1000))), 1000)
    return () => clearInterval(id)
  }, [deadlineSecs])
  if (secs === 0) return { label: 'FT', urgent: false }
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const label = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
  return { label, urgent: secs < 600 }
}

const toUSDC = (raw) => Number(raw || 0) / 1_000_000

function StakeBar({ aTotal, cTotal, bTotal, winner }) {
  const total = aTotal + cTotal + bTotal || 1
  const pA = Math.round((aTotal / total) * 100)
  const pC = Math.round((cTotal / total) * 100)
  const pB = 100 - pA - pC

  const settled = winner > 0
  const cls = (opt) => settled ? (winner === opt ? ' won' : ' lost') : ''

  return (
    <div className="stake-bar-wrap">
      <div className="stake-bar">
        <div className={`stake-seg a${cls(1)}`} style={{ width: `${pA}%` }} />
        <div className={`stake-seg c${cls(3)}`} style={{ width: `${pC}%` }} />
        <div className={`stake-seg b${cls(2)}`} style={{ width: `${pB}%` }} />
      </div>
      <div className="stake-pcts">
        <span>{pA}%</span>
        <span>{pC}%</span>
        <span>{pB}%</span>
      </div>
    </div>
  )
}


export function SportsCard({ market, onJoin }) {
  const { address } = useAccount()
  const target = getChainConfig(market.chain_id)
  const { teamA, teamB, competition } = parseSportsQuestion(market.question)
  const { label: timer, urgent } = useCountdown(Number(market.deadline))

  const isOpen    = market.status === STATUS.OPEN
  const isLive    = market.status === STATUS.LIVE
  const isSettled = market.status === STATUS.SETTLED
  const now       = Math.floor(Date.now() / 1000)
  const pastDeadline = now >= Number(market.deadline)
  const pastMatch    = Number(market.created_at) > 0 && now >= Number(market.created_at) + 1800
  const canJoin   = (isOpen || isLive) && !isSettled && !pastDeadline && !pastMatch && !!address
  const joinHint  = !address
    ? 'Connect wallet to join'
    : pastDeadline || pastMatch
      ? 'Betting window closed — create a longer match next time'
      : undefined

  const { data: onchainPos } = useReadContract({
    address: target?.market,
    abi: MARKET_ABI,
    functionName: 'getPosition',
    args: [BigInt(market.market_id), address],
    chainId: Number(market.chain_id),
    query: { enabled: !!address && !!target?.market },
  })

  const myAmount = onchainPos ? onchainPos[0] : 0n
  const myOption = onchainPos ? Number(onchainPos[1]) : 0
  const myWithdrawn = onchainPos ? Boolean(onchainPos[2]) : false

  const aTotal = toUSDC(market.option_a_total)
  const bTotal = toUSDC(market.option_b_total)
  const cTotal = toUSDC(market.option_c_total)
  const winner = market.winning_option || 0

  const flagA = FLAGS[teamA] || '🏳'
  const flagB = FLAGS[teamB] || '🏳'
  const aWon = isSettled && winner === 1
  const bWon = isSettled && winner === 2
  const draw = isSettled && winner === 3
  const drawBettorsWin = draw && cTotal > 0

  const statusText = draw
    ? (drawBettorsWin ? 'Draw — draw bettors win' : 'Draw — refunds available')
    : isSettled ? (aWon ? `${teamA} wins` : `${teamB} wins`)
    : pastDeadline || pastMatch ? 'Window closed'
    : isLive ? 'Live' : 'Open'

  const statusClass = isLive ? 'live' : isOpen ? 'open' : 'settled'

  return (
    <article className="sports-card">
      <div className="sports-card-top">
        <span className="sports-comp-pill">{competition || 'Match'}</span>
        <div className={`status-indicator ${statusClass}`}>
          <div className={`status-dot ${statusClass}`} />
          <span className="status-text">{statusText}</span>
        </div>
      </div>

      <div className={`match-timer-row${urgent ? ' urgent' : ''}`}>{timer}</div>

      <div className="matchup matchup-3col">
        <div className={`team a${aWon ? ' winner' : (bWon || draw) ? ' loser' : ''}`}>
          <div className="team-flag">{flagA}</div>
          <div className="team-name">{teamA}</div>
          <div className="team-stake">{aTotal.toFixed(2)} <span className="team-stake-unit">USDC</span></div>
        </div>

        <div className={`draw-col${draw ? (drawBettorsWin ? ' winner' : ' loser') : ''}`}>
          <div className="draw-icon">🤝</div>
          <div className="draw-label">Draw</div>
          <div className="team-stake">{cTotal.toFixed(2)} <span className="team-stake-unit">USDC</span></div>
        </div>

        <div className={`team b${bWon ? ' winner' : (aWon || draw) ? ' loser' : ''}`}>
          <div className="team-flag">{flagB}</div>
          <div className="team-name">{teamB}</div>
          <div className="team-stake">{bTotal.toFixed(2)} <span className="team-stake-unit">USDC</span></div>
        </div>
      </div>

      <StakeBar aTotal={aTotal} cTotal={cTotal} bTotal={bTotal} winner={winner} />

      <div className="sports-card-footer">
        <span className="sports-pot">
          Pot: <strong>{(aTotal + cTotal + bTotal).toFixed(2)} USDC</strong>
        </span>
        {isSettled ? (
          myAmount > 0n && !myWithdrawn && (
            Number(winner) === myOption ||
            (Number(winner) === 3 && (cTotal === 0 || myOption === 3))
          ) ? (
            <ClaimWinnings chainId={market.chain_id} marketId={market.market_id} />
          ) : myWithdrawn ? (
            <span className="pos-claimed-tag">Claimed</span>
          ) : null
        ) : (
          <button
            className="btn-join"
            onClick={() => onJoin(market)}
            disabled={!canJoin}
            title={joinHint}
          >
            {!address ? 'Connect to bet' : (pastDeadline || pastMatch) ? 'Closed' : 'Pick a side'}
          </button>
        )}
      </div>
    </article>
  )
}
