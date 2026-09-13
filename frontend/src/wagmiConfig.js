import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'viem'
import { CHAINS, BASE_SEPOLIA_ID, ARC_TESTNET_ID } from './chains'

const bitcoin = CHAINS[BASE_SEPOLIA_ID].viem
const sports = CHAINS[ARC_TESTNET_ID].viem

export const config = getDefaultConfig({
  appName: 'The Arena',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo',
  chains: [bitcoin, sports],
  transports: {
    [bitcoin.id]: http(import.meta.env.VITE_RPC_URL || 'https://sepolia.base.org'),
    [sports.id]: http(import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.io'),
  },
  ssr: false,
})
