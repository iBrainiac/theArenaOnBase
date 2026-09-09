import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'
import { http } from 'viem'

export const config = getDefaultConfig({
  appName: 'The Arena',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(import.meta.env.VITE_RPC_URL || 'https://sepolia.base.org'),
  },
  ssr: false,
})
