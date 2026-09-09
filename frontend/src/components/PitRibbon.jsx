import { useBtcPrice } from '../hooks/useBtcPrice'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useMarkets } from '../hooks/useMarkets'

const fmt = (n) =>
  n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PitRibbon({ compact = false }) {
  const { price, isFlashing, pct } = useBtcPrice()
  const { data: leaderboard = [] } = useLeaderboard()
  const { data: markets = [] } = useMarkets()

  const humanCount = leaderboard.filter((e) => e.participant_type === 'human').length
  const agentCount = leaderboard.filter((e) => e.participant_type === 'agent').length
  const totalPot = (
    markets.reduce((sum, m) => sum + Number(m.total_pot || 0), 0) / 1_000_000
  ).toFixed(2)

  return (
    <div className={`pit-ribbon${compact ? ' compact' : ''}`}>
      <div className="pit-corner human">
        <span className="pit-corner-label">Human</span>
        <span className="pit-corner-val">{humanCount || '—'}</span>
        <span className="pit-corner-hint">on the board</span>
      </div>

      <div className="pit-center">
        <span className="pit-center-kicker">The pit · BTC / USD</span>
        <span className={`pit-price${isFlashing ? ' flash' : ''}`}>
          {price ? `$${fmt(price)}` : '——'}
        </span>
        <div className="pit-center-meta">
          {price && pct !== 0 && (
            <span className={`hero-price-change ${pct >= 0 ? 'up' : 'down'}`}>
              {pct >= 0 ? '+' : ''}{pct.toFixed(4)}%
            </span>
          )}
          <span className="pit-purse">{markets.length} open · ${totalPot} in pots</span>
        </div>
      </div>

      <div className="pit-corner agent">
        <span className="pit-corner-label">Agent</span>
        <span className="pit-corner-val">{agentCount || '—'}</span>
        <span className="pit-corner-hint">on the board</span>
      </div>
    </div>
  )
}
