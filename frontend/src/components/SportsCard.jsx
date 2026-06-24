import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { STATUS, parseSportsQuestion, FLAGS } from '../constants'

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

const OUTCOME_LABEL = { 1: 'Team A wins', 2: 'Team B wins', 3: 'Draw' }

function ResolutionBanner({ market, teamA, teamB }) {
  const hasAssertion  = !!market.assertion_id
  const hasPending    = market.pending_result != null
  if (!hasPending && !hasAssertion) return null

  const outcomeLabel = market.pending_result === 1 ? teamA + ' wins'
    : market.pending_result === 2 ? teamB + ' wins'
    : market.pending_result === 3 ? 'Draw'
    : null

  if (hasAssertion) {
    const expiresAt = Number(market.assertion_expires_at)
    const secsLeft  = Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
    const hLeft     = Math.floor(secsLeft / 3600)
    const mLeft     = Math.floor((secsLeft % 3600) / 60)
    const timeLabel = secsLeft === 0 ? 'finalizing soon'
      : hLeft > 0 ? `~${hLeft}h ${mLeft}m dispute window`
      : `~${mLeft}m dispute window`
    return (
      <div className="resolution-banner disputed">
        <span className="resolution-icon">⏳</span>
        <span>UMA dispute window open · {timeLabel}</span>
      </div>
    )
  }

  return (
    <div className="resolution-banner pending">
      <span className="resolution-icon">✓</span>
      <span>Result submitted: <strong>{outcomeLabel}</strong> · agent proposing via UMA</span>
    </div>
  )
}

export function SportsCard({ market, onJoin }) {
  const { address } = useAccount()
  const { teamA, teamB, competition } = parseSportsQuestion(market.question)
  const { label: timer, urgent } = useCountdown(Number(market.deadline))

  const isOpen    = market.status === STATUS.OPEN
  const isLive    = market.status === STATUS.LIVE
  const isSettled = market.status === STATUS.SETTLED
  const hasPendingResult = market.pending_result != null || !!market.assertion_id
  const canJoin   = (isOpen || isLive) && !hasPendingResult && !!address

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
    : hasPendingResult ? 'Resolving'
    : isLive ? 'Live' : 'Open'

  const statusClass = hasPendingResult && !isSettled ? 'resolving' : isLive ? 'live' : isOpen ? 'open' : 'settled'

  return (
    <article className="sports-card">
      <div className="sports-card-top">
        <span className="sports-comp-pill">{competition || 'World Cup 2026'}</span>
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

      {!isSettled && <ResolutionBanner market={market} teamA={teamA} teamB={teamB} />}

      {!isSettled && !hasPendingResult && (
        <div className="sports-card-footer">
          <span className="sports-pot">
            Pot: <strong>{(aTotal + cTotal + bTotal).toFixed(2)} USDC</strong>
          </span>
          <button
            className="btn-join"
            onClick={() => onJoin(market)}
            disabled={!canJoin}
            title={!address ? 'Connect wallet to join' : undefined}
          >
            {!address ? 'Connect to bet' : 'Pick a side'}
          </button>
        </div>
      )}

      {!isSettled && hasPendingResult && (
        <div className="sports-card-footer">
          <span className="sports-pot">
            Pot: <strong>{(aTotal + cTotal + bTotal).toFixed(2)} USDC</strong>
          </span>
        </div>
      )}
    </article>
  )
}
