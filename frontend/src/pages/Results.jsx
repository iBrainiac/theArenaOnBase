import { useState } from 'react'
import { useSettledMarkets } from '../hooks/useSettledMarkets'
import { useMyPositions } from '../hooks/useMyPositions'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useAccount } from 'wagmi'
import { MARKET_TYPE, parseSportsQuestion, FLAGS } from '../constants'

const toUSDC  = (raw) => (Number(raw || 0) / 1_000_000).toFixed(2)
const fmtDate = (ts) => ts
  ? new Date(Number(ts) * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  : '—'

function shareWin({ isSports, teamA, teamB, competition, question, winner, myAmount, streak }) {
  let text
  if (isSports) {
    const outcome = winner === 3 ? 'Draw' : winner === 1 ? `${teamA} wins` : `${teamB} wins`
    text = streak >= 3
      ? `${streak}-win streak on The Arena! Called ${outcome} — ${competition || 'World Cup 2026'} on Base.`
      : `Called it on The Arena! ${outcome} — ${competition || 'World Cup 2026'}. Won ${myAmount} USDC on Base.`
  } else {
    const dir = winner === 1 ? 'UP' : 'DOWN'
    text = streak >= 3
      ? `${streak}-win streak on The Arena! BTC went ${dir} just like I predicted. Humans > Agents.`
      : `Called BTC ${dir} on The Arena and won ${myAmount} USDC. Humans vs AI agents on Base.`
  }
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
}

function ResultCard({ market, myPosition, streak }) {
  const isSports  = market.market_type === MARKET_TYPE.SPORTS_MATCH
  const winner    = market.winning_option
  const isDraw    = winner === 3

  let teamA = '', teamB = '', competition = ''
  if (isSports) {
    const p = parseSportsQuestion(market.question)
    teamA = p.teamA; teamB = p.teamB; competition = p.competition
  }

  const aWon = winner === 1
  const bWon = winner === 2

  const myOpt    = myPosition?.option
  const myAmount = myPosition ? (Number(myPosition.amount) / 1_000_000).toFixed(2) : null
  const iWon     = !!myOpt && myOpt === winner
  const iDraw    = !!myOpt && isDraw
  const iLost    = !!myOpt && !iWon && !iDraw

  return (
    <article className={`result-card${iWon ? ' result-win' : iLost ? ' result-loss' : ''}`}>
      {isSports ? (
        <>
          <div className="result-top">
            <span className="result-comp">{competition || 'World Cup 2026'}</span>
            <span className="result-date">{fmtDate(market.created_at)}</span>
          </div>
          <div className="result-matchup">
            <div className={`result-team${aWon ? ' won' : (bWon || isDraw) ? ' lost' : ''}`}>
              <span className="result-flag">{FLAGS[teamA] || '🏳'}</span>
              <span className="result-team-name">{teamA}</span>
              {aWon && <span className="result-winner-badge">Winner</span>}
            </div>
            <div className={`result-vs-col${isDraw ? ' draw' : ''}`}>
              {isDraw ? 'DRAW' : 'VS'}
            </div>
            <div className={`result-team right${bWon ? ' won' : (aWon || isDraw) ? ' lost' : ''}`}>
              {bWon && <span className="result-winner-badge">Winner</span>}
              <span className="result-team-name">{teamB}</span>
              <span className="result-flag">{FLAGS[teamB] || '🏳'}</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="result-top">
            <span className="result-comp">BTC · Price</span>
            <span className="result-date">{fmtDate(market.created_at)}</span>
          </div>
          <p className="result-question">{market.question}</p>
          <div className="result-btc-outcome">
            <span className={`result-dir-badge ${winner === 1 ? 'up' : winner === 2 ? 'down' : 'draw'}`}>
              {winner === 1 ? '▲ UP won' : winner === 2 ? '▼ DOWN won' : '— Draw'}
            </span>
          </div>
        </>
      )}

      <div className="result-footer">
        <span className="result-pot">Pot: {toUSDC(market.total_pot)} USDC</span>
        <div className="result-footer-right">
          {myPosition && (
            <span className={`result-pnl${iWon ? ' win' : iDraw ? ' draw' : iLost ? ' loss' : ''}`}>
              {iWon  ? `+${myAmount} USDC` :
               iDraw ? `~${myAmount} USDC` :
               iLost ? `-${myAmount} USDC` : ''}
            </span>
          )}
          {iWon && (
            <button
              className="result-share-btn"
              onClick={() => shareWin({ isSports, teamA, teamB, competition, question: market.question, winner, myAmount, streak })}
            >
              𝕏 Share
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export function ResultsPage() {
  const { address } = useAccount()
  const { data: settled = [],    isLoading }  = useSettledMarkets()
  const { data: myPositions = [] }            = useMyPositions(address)
  const { data: leaderboard = [] }            = useLeaderboard()
  const [tab, setTab]                         = useState('all')

  const posMap  = Object.fromEntries(myPositions.map((p) => [p.market_id, p]))
  const myStats = leaderboard.find(e => e.wallet_address?.toLowerCase() === address?.toLowerCase())
  const streak  = myStats?.streak || 0

  const sports  = settled.filter(m => m.market_type === MARKET_TYPE.SPORTS_MATCH)
  const btc     = settled.filter(m => m.market_type !== MARKET_TYPE.SPORTS_MATCH)
  const shown   = tab === 'sports' ? sports : tab === 'btc' ? btc : settled

  const myWins   = myPositions.filter(p => p.status === 2 && p.option === p.winning_option).length
  const myLosses = myPositions.filter(p => p.status === 2 && p.option !== p.winning_option && p.winning_option !== 3).length

  return (
    <div className="page-wrap">
      <div className="results-hero">
        <h1 className="results-title">Settled</h1>
        <p className="results-sub">Outcomes on-chain · same pot for both corners</p>
        <div className="results-stats">
          <div className="rstat"><div className="rstat-val">{settled.length}</div><div className="rstat-label">Total</div></div>
          <div className="rstat"><div className="rstat-val">{sports.length}</div><div className="rstat-label">Matches</div></div>
          <div className="rstat"><div className="rstat-val">{btc.length}</div><div className="rstat-label">BTC</div></div>
          {address && (
            <>
              <div className="rstat"><div className="rstat-val" style={{ color: 'var(--up)' }}>{myWins}</div><div className="rstat-label">My wins</div></div>
              <div className="rstat"><div className="rstat-val" style={{ color: 'var(--down)' }}>{myLosses}</div><div className="rstat-label">My losses</div></div>
              {streak >= 2 && <div className="rstat"><div className="rstat-val" style={{ color: 'var(--amber)' }}>{streak}</div><div className="rstat-label">Streak</div></div>}
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="results-loading">Loading results...</p>
      ) : settled.length === 0 ? (
        <div className="results-empty">
          <p>No settled markets yet</p>
          <p>Results appear here once matches end and BTC markets are settled.</p>
        </div>
      ) : (
        <section className="section">
          <div className="results-filter-row">
            <div className="market-tabs">
              <button className={`market-tab${tab === 'all'    ? ' active' : ''}`} onClick={() => setTab('all')}>All · {settled.length}</button>
              <button className={`market-tab${tab === 'sports' ? ' active' : ''}`} onClick={() => setTab('sports')}>Sports · {sports.length}</button>
              <button className={`market-tab${tab === 'btc'    ? ' active' : ''}`} onClick={() => setTab('btc')}>BTC · {btc.length}</button>
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="results-empty"><p>No {tab} results yet</p><p></p></div>
          ) : (
            <div className="results-grid">
              {shown.map((m) => (
                <ResultCard key={m.market_id} market={m} myPosition={posMap[m.market_id]} streak={streak} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
