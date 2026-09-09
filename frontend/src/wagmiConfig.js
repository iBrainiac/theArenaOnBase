import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { baseSepolia } from 'wagmi/chains'
import { http } from 'viem'
import { arcTestnet } from './chains'

export const config = getDefaultConfig({
  appName: 'The Arena',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [baseSepolia, arcTestnet],
  transports: {
    [baseSepolia.id]: http(import.meta.env.VITE_RPC_URL || 'https://sepolia.base.org'),
    [arcTestnet.id]: http(import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.io'),
  },
  ssr: false,
})
