import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'

export function useSettledMarkets(chainId) {
  return useQuery({
    queryKey: ['markets', 'settled', chainId],
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: '50' })
      if (chainId) qs.set('chainId', String(chainId))
      const res = await fetch(`${API_BASE}/api/markets/settled?${qs}`)
      if (!res.ok) throw new Error('Failed to load results')
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
