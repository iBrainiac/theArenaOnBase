import { useState } from 'react'
import { useAccount, useWriteContract, usePublicClient, useSwitchChain } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { MARKET_ABI } from '../constants'
import { ensureWalletChain, getChainConfig } from '../chains'

export function ClaimWinnings({ chainId, marketId, label = 'Claim winnings' }) {
  const { address, chainId: walletChainId } = useAccount()
  const target = getChainConfig(chainId)
  const { switchChainAsync } = useSwitchChain()
  const publicClient = usePublicClient({ chainId: Number(chainId) })
  const queryClient = useQueryClient()
  const { writeContractAsync } = useWriteContract()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState(null)

  if (!address || !target?.market) return null

  async function claim() {
    setBusy(true)
    setErr(null)
    try {
      await ensureWalletChain(switchChainAsync, walletChainId, Number(chainId))
      const hash = await writeContractAsync({
        address: target.market,
        abi: MARKET_ABI,
        functionName: 'withdraw',
        args: [BigInt(marketId)],
        chainId: Number(chainId),
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setDone(true)
      queryClient.invalidateQueries({ queryKey: ['positions', address] })
      queryClient.invalidateQueries({ queryKey: ['markets'] })
    } catch (e) {
      setErr(e.shortMessage || e.message?.slice(0, 80) || 'Claim failed')
    }
    setBusy(false)
  }

  if (done) return <p className="pos-claimed-tag">Claimed</p>

  return (
    <div>
      <button className="btn-claim" onClick={claim} disabled={busy}>
        {busy ? 'Claiming...' : label}
      </button>
      {err && <p className="tx-hint error">{err}</p>}
    </div>
  )
}
