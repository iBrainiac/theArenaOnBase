import '@rainbow-me/rainbowkit/styles.css'
import './styles/index.css'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

import { config } from './wagmiConfig'
import { explorerAddress, shortAddress } from './chains'
import { useArenaChain } from './hooks/useArenaChain'
import { Nav } from './components/Nav'
import { LandingPage } from './pages/Landing'
import { MarketsPage } from './pages/Markets'
import { LeaderboardPage } from './pages/Leaderboard'
import { ResultsPage } from './pages/Results'
import { AdminPage } from './pages/Admin'

const queryClient = new QueryClient()

const rktTheme = darkTheme({
  accentColor: '#E8A317',
  accentColorForeground: '#100E0C',
  borderRadius: 'small',
  overlayBlur: 'small',
})

function AppShell() {
  const { pathname } = useLocation()
  const { chainId, name, market, supported } = useArenaChain()
  const isLanding = pathname === '/'

  return (
    <>
      {!isLanding && <Nav />}
      <main>
        <Routes>
          <Route path="/"            element={<LandingPage />} />
          <Route path="/app"         element={<MarketsPage />} />
          <Route path="/results"     element={<ResultsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/admin"       element={<AdminPage />} />
        </Routes>
      </main>
      {!isLanding && (
        <footer style={{ borderTop: '1px solid var(--border)' }}>
          <div className="footer">
            <span className="footer-text">The Arena · {supported ? name : 'Unsupported network'} · No house, no edge</span>
            {supported && market && (
              <a
                className="footer-link"
                href={explorerAddress(chainId, market)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {shortAddress(market)} ↗
              </a>
            )}
          </div>
        </footer>
      )}
    </>
  )
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rktTheme}>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
