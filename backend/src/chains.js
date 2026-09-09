export const BASE_SEPOLIA_ID = 84532
export const ARC_TESTNET_ID = 5042002

export const LISTENERS = [
  {
    chainId: BASE_SEPOLIA_ID,
    name: 'Base Sepolia',
    rpc: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    address: process.env.AGENT_MARKET_ADDRESS || '0x878819e7BdEF8E39D782d51870F51b7AEE137329',
    pollMs: 8000,
  },
  {
    chainId: ARC_TESTNET_ID,
    name: 'Arc Testnet',
    rpc: process.env.ARC_TESTNET_RPC || 'https://rpc.testnet.arc.io',
    address: process.env.ARC_MARKET_ADDRESS || '0x7E2680D615A6D81f04D95F0560A04b53A4e2f67C',
    pollMs: 15000,
  },
]
