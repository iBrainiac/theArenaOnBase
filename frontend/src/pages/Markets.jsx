import { useMarkets } from '../hooks/useMarkets'
import { Hero } from '../components/Hero'
import { MarketGrid } from '../components/MarketGrid'
import { MyPositions } from '../components/MyPositions'

export function MarketsPage() {
  const { data: markets = [] } = useMarkets()
  const totalPotRaw = markets.reduce((sum, m) => sum + Number(m.total_pot || 0), 0)

  return (
    <>
      <Hero marketCount={markets.length} totalPotRaw={totalPotRaw} />
      <MyPositions />
      <MarketGrid />
    </>
  )
}
