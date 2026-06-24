import { useState } from 'react'
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi'
import { parseUnits } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import { MARKET_ADDRESS, USDC_ADDRESS, MARKET_ABI, USDC_ABI, OPTION, MARKET_TYPE, parseSportsQuestion, FLAGS } from '../constants'

const PHASES = { IDLE: 'idle', APPROVING: 'approving', JOINING: 'joining', DONE: 'done' }

export function JoinModal({ market, onClose }) {
  const { address }   = useAccount()
  const publicClient  = usePublicClient()
  const queryClient   = useQueryClient()
  const { writeContractAsync } = useWriteContract()

  const [option, setOption] = useState(null)
  const [amount, setAmount] = useState('1')
  const [phase,  setPhase]  = useState(PHASES.IDLE)
  const [error,  setError]  = useState(null)

  const amountRaw = (() => {
    try { return parseUnits(amount || '0', 6) } catch { return 0n }
  })()

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: [address, MARKET_ADDRESS],
    query: { enabled: !!address },
  })

  const validAmount   = parseFloat(amount) >= 1 && amountRaw > 0n
  const needsApproval = allowance < amountRaw
  const isBusy        = phase === PHASES.APPROVING || phase === PHASES.JOINING
  const isDone        = phase === PHASES.DONE

  async function handleSubmit() {
    if (!option || !validAmount || isBusy || isDone) return
    setError(null)

    try {
      if (needsApproval) {
        setPhase(PHASES.APPROVING)
        const hash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [MARKET_ADDRESS, amountRaw],
        })
        await publicClient.waitForTransactionReceipt({ hash })
        await refetchAllowance()
        setPhase(PHASES.IDLE)
        return
      }

      setPhase(PHASES.JOINING)
      const hash = await writeContractAsync({
        address: MARKET_ADDRESS,
        abi: MARKET_ABI,
        functionName: 'joinMarket',
        args: [BigInt(market.market_id), option, amountRaw],
      })
      await publicClient.waitForTransactionReceipt({ hash })
      setPhase(PHASES.DONE)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['markets'] })
        onClose()
      }, 2200)
    } catch (err) {
      setError(err.shortMessage || err.message?.slice(0, 80) || 'Transaction failed')
      setPhase(PHASES.IDLE)
    }
  }

  const btnLabel =
    isDone             ? 'Joined! ✓'
    : phase === PHASES.APPROVING ? 'Approving USDC...'
    : phase === PHASES.JOINING   ? 'Confirming...'
    : needsApproval && validAmount ? 'Approve USDC'
    : 'Join market'

  const hint =
    phase === PHASES.APPROVING ? 'Confirm USDC approval in your wallet'
    : phase === PHASES.JOINING  ? 'Confirm the join transaction in your wallet'
    : isDone                    ? 'Position opened successfully'
    : null

  const isSports = market.market_type === MARKET_TYPE.SPORTS_MATCH
  const { teamA, teamB } = isSports ? parseSportsQuestion(market.question) : {}
  const sides = isSports
    ? [
        { val: 1, cls: 'up',   label: `${FLAGS[teamA] || ''} ${teamA}`, hint: 'Team A wins' },
        { val: 3, cls: 'draw', label: '🤝 Draw', hint: 'Match ends level' },
        { val: 2, cls: 'down', label: `${FLAGS[teamB] || ''} ${teamB}`, hint: 'Team B wins' },
      ]
    : [
        { val: 1, cls: 'up',   label: 'UP',   hint: 'price rises' },
        { val: 2, cls: 'down', label: 'DOWN', hint: 'price falls' },
      ]

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !isBusy && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{isSports ? 'Pick a side' : 'Take a position'}</h2>
        <p className="modal-subtitle">{market.question}</p>

        <div className="option-grid">
          {sides.map(({ val, cls, label, hint: h }) => (
            <button
              key={val}
              className={`opt-btn ${cls}${option === val ? ' selected' : ''}`}
              onClick={() => !isBusy && !isDone && setOption(val)}
              disabled={isBusy || isDone}
            >
              <span className="opt-label">{label}</span>
              <span className="opt-hint">{h}</span>
            </button>
          ))}
        </div>

        <div className="amount-label">
          <span>Amount</span>
          <span>Min 1 USDC</span>
        </div>
        <div className="amount-wrap">
          <input
            className="amount-input"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
            disabled={isBusy || isDone}
          />
          <span className="amount-unit">USDC</span>
        </div>

        <div className="modal-actions">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!option || !validAmount || isBusy || isDone}
          >
            {btnLabel}
          </button>
          <button className="btn-ghost" onClick={onClose} disabled={isBusy}>
            Cancel
          </button>
        </div>

        {hint  && <p className={`tx-hint${isDone ? ' success' : ''}`}>{hint}</p>}
        {error && <p className="tx-hint error">{error}</p>}
      </div>
    </div>
  )
}
