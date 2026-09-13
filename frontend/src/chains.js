import { defineChain } from 'viem'
import { baseSepolia } from 'viem/chains'

export const BASE_SEPOLIA_ID = 84532
export const ARC_TESTNET_ID = 5042002

export const CONTRACT_OWNER = '0x426bE45496911cBdac19750Ff4bd90cE7ecefB48'

export const arcTestnet = defineChain({
  id: ARC_TESTNET_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' },
  },
  testnet: true,
})

export const CHAINS = {
  [BASE_SEPOLIA_ID]: {
    id: BASE_SEPOLIA_ID,
    name: 'Base Sepolia',
    viem: baseSepolia,
    market: '0x20FB4e706365FeF2Dd22Ddcd15987E695F6f637E',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    btcOracle: '0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298',
    explorer: 'https://base-sepolia.blockscout.com',
    sportsOnly: false,
    hasSportsOracle: true,
  },
  [ARC_TESTNET_ID]: {
    id: ARC_TESTNET_ID,
    name: 'Arc Testnet',
    viem: arcTestnet,
    market: '0x4394Ab4e118A6d0cd5dA87a2a80eD090c965bb0F',
    usdc: '0x3600000000000000000000000000000000000000',
    btcOracle: null,
    explorer: 'https://testnet.arcscan.app',
    sportsOnly: true,
    hasSportsOracle: true,
  },
}

export function getChainConfig(chainId) {
  return CHAINS[Number(chainId)] || null
}

export async function ensureWalletChain(switchChainAsync, currentChainId, targetChainId) {
  const target = Number(targetChainId)
  if (Number(currentChainId) === target) return
  await switchChainAsync({ chainId: target })
}

export function explorerAddress(chainId, address) {
  const cfg = getChainConfig(chainId)
  if (!cfg || !address) return '#'
  return `${cfg.explorer}/address/${address}`
}

export function shortAddress(address) {
  if (!address) return ''
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
