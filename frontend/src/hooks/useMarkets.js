import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'

export function useMarkets(chainId) {
  return useQuery({
    queryKey: ['markets', chainId],
    queryFn: async () => {
      const qs = chainId ? `?chainId=${chainId}` : ''
      const res = await fetch(`${API_BASE}/api/markets${qs}`)
      if (!res.ok) throw new Error('Failed to load markets')
      return res.json()
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}
