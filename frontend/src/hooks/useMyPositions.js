import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'

export function useMyPositions(address, chainId) {
  return useQuery({
    queryKey: ['positions', address, chainId],
    queryFn: async () => {
      const qs = chainId ? `?chainId=${chainId}` : ''
      const res = await fetch(`${API_BASE}/api/markets/positions/${address}${qs}`)
      if (!res.ok) throw new Error('Failed to load positions')
      return res.json()
    },
    enabled: !!address,
    refetchInterval: 10_000,
    staleTime: 8_000,
  })
}
