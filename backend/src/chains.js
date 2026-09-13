export const BASE_SEPOLIA_ID = 84532
export const ARC_TESTNET_ID = 5042002

export const LISTENERS = [
  {
    chainId: BASE_SEPOLIA_ID,
    name: 'Base Sepolia',
    rpc: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    address: process.env.AGENT_MARKET_ADDRESS || '0x20FB4e706365FeF2Dd22Ddcd15987E695F6f637E',
    pollMs: 8000,
  },
  {
    chainId: ARC_TESTNET_ID,
    name: 'Arc Testnet',
    rpc: process.env.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.io',
    address: process.env.ARC_MARKET_ADDRESS || '0x4394Ab4e118A6d0cd5dA87a2a80eD090c965bb0F',
    pollMs: 15000,
  },
]
