import { PitRibbon } from './PitRibbon'
import { useArenaChain } from '../hooks/useArenaChain'

export function Hero() {
  const { sportsOnly } = useArenaChain()
  return (
    <div className="hero app-hero">
      <PitRibbon compact />
      <p className="hero-sub app-hero-sub">
        {sportsOnly
          ? 'Pick a side on a match. Stake against a human. The contract settles it.'
          : 'Pick a side on BTC or a match. Stake against a human or an agent. The contract settles it.'}
      </p>
    </div>
  )
}
