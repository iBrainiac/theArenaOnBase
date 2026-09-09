import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useMarkets } from '../hooks/useMarkets'
import { useArenaChain } from '../hooks/useArenaChain'
import { MarketCard } from './MarketCard'
import { JoinModal } from './JoinModal'
import { CreateMarketModal } from './CreateMarketModal'
import { MARKET_TYPE } from '../constants'

export function MarketGrid() {
  const { address } = useAccount()
  const { chainId, sportsOnly } = useArenaChain()
  const { data: markets = [], isLoading, error } = useMarkets(chainId)
  const [joining,  setJoining]  = useState(null)
  const [creating, setCreating] = useState(false)
  const [tab,      setTab]      = useState(sportsOnly ? 'sports' : 'all')

  useEffect(() => {
    setTab(sportsOnly ? 'sports' : 'all')
  }, [sportsOnly])

  const btcCount    = markets.filter(m => m.market_type !== MARKET_TYPE.SPORTS_MATCH).length
  const sportsCount = markets.filter(m => m.market_type === MARKET_TYPE.SPORTS_MATCH).length

  const filtered = markets.filter(m => {
    if (tab === 'btc')    return m.market_type !== MARKET_TYPE.SPORTS_MATCH
    if (tab === 'sports') return m.market_type === MARKET_TYPE.SPORTS_MATCH
    return true
  })

  return (
    <>
      <section className="section">
        <div className="section-header" style={{ marginBottom: '1rem' }}>
          <h2 className="section-title">Open cards</h2>
          <button
            className="btn-create"
            onClick={() => setCreating(true)}
            disabled={!address}
            title={!address ? 'Connect wallet to create a market' : undefined}
          >
            + Create market
          </button>
        </div>

        <div className="market-filter-row">
          <div className="market-tabs">
            {!sportsOnly && (
              <>
                <button className={`market-tab${tab === 'all'    ? ' active' : ''}`} onClick={() => setTab('all')}>
                  All {markets.length > 0 && `· ${markets.length}`}
                </button>
                <button className={`market-tab${tab === 'btc'    ? ' active' : ''}`} onClick={() => setTab('btc')}>
                  BTC {btcCount > 0 && `· ${btcCount}`}
                </button>
              </>
            )}
            <button className={`market-tab${tab === 'sports' ? ' active' : ''}`} onClick={() => setTab('sports')}>
              Sports {sportsCount > 0 && `· ${sportsCount}`}
            </button>
          </div>
        </div>

        <div className="market-grid">
          {isLoading ? (
            <div className="empty-state">
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-2)' }}>Loading...</p>
            </div>
          ) : error ? (
            <div className="empty-state">
              <p>Backend offline</p>
              <p>Start the backend server and refresh.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p>No {tab === 'sports' ? 'sports' : tab === 'btc' ? 'BTC' : 'open'} markets</p>
              <p>{tab === 'sports' ? 'Sports markets will appear here.' : 'Create one or wait for the agent.'}</p>
            </div>
          ) : (
            filtered.map((m) => (
              <MarketCard key={`${m.chain_id}-${m.market_id}`} market={m} onJoin={setJoining} />
            ))
          )}
        </div>
      </section>

      {joining  && <JoinModal market={joining} onClose={() => setJoining(null)} />}
      {creating && <CreateMarketModal onClose={() => setCreating(false)} />}
    </>
  )
}
