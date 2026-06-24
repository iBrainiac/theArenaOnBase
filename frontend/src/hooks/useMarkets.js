import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/markets`)
      if (!res.ok) throw new Error('Failed to load markets')
      return res.json()
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}
