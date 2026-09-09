import { useChainId } from 'wagmi'
import { getChainConfig } from '../chains'

export function useArenaChain() {
  const chainId = useChainId()
  const cfg = getChainConfig(chainId)
  return {
    chainId,
    cfg,
    supported: !!cfg,
    sportsOnly: !!cfg?.sportsOnly,
    market: cfg?.market,
    usdc: cfg?.usdc,
    btcOracle: cfg?.btcOracle,
    explorer: cfg?.explorer,
    name: cfg?.name,
  }
}
