import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'

export function useMyPositions(address) {
  return useQuery({
    queryKey: ['positions', address],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/markets/positions/${address}`)
      if (!res.ok) throw new Error('Failed to load positions')
      return res.json()
    },
    enabled: !!address,
    refetchInterval: 10_000,
    staleTime: 8_000,
  })
}
