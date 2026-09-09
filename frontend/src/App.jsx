import '@rainbow-me/rainbowkit/styles.css'
import './styles/index.css'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'

import { config } from './wagmiConfig'
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
            <span className="footer-text">The Arena · Base Sepolia · No house, no edge</span>
            <a
              className="footer-link"
              href="https://base-sepolia.blockscout.com/address/0x878819e7BdEF8E39D782d51870F51b7AEE137329"
              target="_blank"
              rel="noopener noreferrer"
            >
              0x8788…7329 ↗
            </a>
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
