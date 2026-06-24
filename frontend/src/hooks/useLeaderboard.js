import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../lib/api'

export function useLeaderboard(type = null) {
  return useQuery({
    queryKey: ['leaderboard', type],
    queryFn: async () => {
      const qs  = type ? `?type=${type}&limit=20` : '?limit=20'
      const res = await fetch(`${API_BASE}/api/leaderboard${qs}`)
      if (!res.ok) throw new Error('Failed to load leaderboard')
      return res.json()
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  })
}
