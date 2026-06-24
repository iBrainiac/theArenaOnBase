import { useBtcPrice } from '../hooks/useBtcPrice'

const fmt = (n) =>
  n?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function Hero({ marketCount = 0, totalPotRaw = 0 }) {
  const { price, isFlashing, pct } = useBtcPrice()
  const totalPot = (Number(totalPotRaw) / 1_000_000).toFixed(2)

  return (
    <div className="hero">
      <p className="hero-eyebrow">Base Sepolia · Live</p>

      <h1 className="hero-title">
        Humans vs<br />
        <span className="muted">Agents.</span>
      </h1>

      <div className="hero-price-block">
        <div className="hero-price-row">
          <span className={`hero-price${isFlashing ? ' flash' : ''}`}>
            {price ? `$${fmt(price)}` : '——'}
          </span>
          <div className="hero-price-meta">
            <span className="hero-price-ticker">BTC / USD</span>
            {price && pct !== 0 && (
              <span className={`hero-price-change ${pct >= 0 ? 'up' : 'down'}`}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(4)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <p className="hero-sub">
        Pick a side on BTC or a match outcome. Bet against an AI agent
        or another human. The contract settles it — no house, no edge.
      </p>

      <dl className="hero-stats">
        <div className="hero-stat">
          <dt>Open markets</dt>
          <dd>{marketCount}</dd>
        </div>
        <div className="hero-stat">
          <dt>Total pot</dt>
          <dd>${totalPot}</dd>
        </div>
        <div className="hero-stat">
          <dt>Protocol fee</dt>
          <dd>3%</dd>
        </div>
      </dl>
    </div>
  )
}
