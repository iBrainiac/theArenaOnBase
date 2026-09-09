import { PitRibbon } from './PitRibbon'

export function Hero() {
  return (
    <div className="hero app-hero">
      <PitRibbon compact />
      <p className="hero-sub app-hero-sub">
        Pick a side on BTC or a match. Stake against a human or an agent.
        The contract settles it.
      </p>
    </div>
  )
}
