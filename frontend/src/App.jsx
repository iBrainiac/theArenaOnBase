import '@rainbow-me/rainbowkit/styles.css'
import './styles/index.css'

import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

import { config } from './wagmiConfig'
import { Nav } from './components/Nav'
import { MarketsPage } from './pages/Markets'
import { LeaderboardPage } from './pages/Leaderboard'
import { ResultsPage } from './pages/Results'
import { AdminPage } from './pages/Admin'

const queryClient = new QueryClient()

const rktTheme = darkTheme({
  accentColor: '#F5A623',
  accentColorForeground: '#06070A',
  borderRadius: 'medium',
  overlayBlur: 'small',
})

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rktTheme}>
          <BrowserRouter>
            <Nav />
            <main>
              <Routes>
                <Route path="/"            element={<MarketsPage />} />
                <Route path="/results"     element={<ResultsPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/admin"       element={<AdminPage />} />
              </Routes>
            </main>
            <footer style={{ borderTop: '1px solid var(--border)' }}>
              <div className="footer">
                <span className="footer-text">The Arena · Base Sepolia Testnet · No house, no edge</span>
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
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
