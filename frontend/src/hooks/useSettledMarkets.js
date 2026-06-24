import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'

export function useSettledMarkets() {
  return useQuery({
    queryKey: ['markets', 'settled'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/markets/settled?limit=50`)
      if (!res.ok) throw new Error('Failed to load results')
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
