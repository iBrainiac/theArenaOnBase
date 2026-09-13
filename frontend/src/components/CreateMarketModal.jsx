import { useEffect, useState } from 'react'
import { useAccount, useWriteContract, useReadContract, usePublicClient, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import {
  MARKET_ABI, USDC_ABI, OPTION, DURATIONS, FLAGS,
} from '../constants'
import { ARC_TESTNET_ID, BASE_SEPOLIA_ID, ensureWalletChain, getChainConfig } from '../chains'
import { useFixtures } from '../hooks/useFixtures'

const PHASES = { IDLE: 'idle', APPROVING: 'approving', CREATING: 'creating', DONE: 'done' }

const SPORTS_DURATIONS = [
  { label: '10m', secs: 600    },
  { label: '2h',  secs: 7200   },
  { label: '6h',  secs: 21600  },
  { label: '12h', secs: 43200  },
  { label: '24h', secs: 86400  },
  { label: '48h', secs: 172800 },
]

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

function TypeToggle({ value, onChange, disabled, sportsOnly }) {
  const tabs = sportsOnly
    ? [{ val: 'sports', label: 'Sports Match' }]
    : [
        { val: 'btc', label: 'BTC Price' },
        { val: 'sports', label: 'Sports Match' },
      ]
  return (
    <div className="type-toggle">
      {tabs.map(({ val, label }) => (
        <button
          key={val}
          className={`type-tab${value === val ? ' active' : ''}`}
          onClick={() => !disabled && onChange(val)}
          disabled={disabled}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function TeamSideSelector({ teamA, teamB, value, onChange, disabled }) {
  const labelA = teamA?.trim() || 'Team A'
  const labelB = teamB?.trim() || 'Team B'
  const flagA  = FLAGS[labelA] || '🏳'
  const flagB  = FLAGS[labelB] || '🏳'

  const picks = [
    { val: 1, cls: 'up',   icon: flagA,  name: labelA, hint: 'wins' },
    { val: 3, cls: 'draw', icon: '🤝',   name: 'Draw', hint: 'match level' },
    { val: 2, cls: 'down', icon: flagB,  name: labelB, hint: 'wins' },
  ]

  return (
    <div className="option-grid option-grid-3">
      {picks.map(({ val, cls, icon, name, hint }) => (
        <button
          key={val}
          className={`opt-btn ${cls}${value === val ? ' selected' : ''}`}
          onClick={() => !disabled && onChange(val)}
          disabled={disabled}
        >
          <span className="opt-label">{icon}</span>
          <span className="opt-team">{name}</span>
          <span className="opt-hint">{hint}</span>
        </button>
      ))}
    </div>
  )
}

export function CreateMarketModal({ onClose }) {
  const { address, chainId: walletChainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const queryClient  = useQueryClient()
  const { writeContractAsync } = useWriteContract()

  const sportsOnly = Number(walletChainId) === ARC_TESTNET_ID

  const [marketType, setMarketType] = useState(sportsOnly ? 'sports' : 'btc')
  const [direction,  setDirection]  = useState(null)
  const [duration,   setDuration]   = useState(DURATIONS[4])
  const [amount,     setAmount]     = useState('1')
  const [phase,      setPhase]      = useState(PHASES.IDLE)
  const [error,      setError]      = useState(null)

  // Sports-only fields
  const [teamA,       setTeamA]       = useState('')
  const [teamB,       setTeamB]       = useState('')
  const [competition, setCompetition] = useState('')
  const [sportsDur,   setSportsDur]   = useState(SPORTS_DURATIONS[1])
  const [fixtureId,   setFixtureId]   = useState('')
  const [matchQuery,  setMatchQuery]  = useState('')

  const { data: fixtureData, isLoading: fixturesLoading } = useFixtures(isSports)
  const fixtures = fixtureData?.fixtures || []

  const isSports = marketType === 'sports'
  const targetId = isSports
    ? (getChainConfig(walletChainId) ? Number(walletChainId) : ARC_TESTNET_ID)
    : BASE_SEPOLIA_ID
  const target   = getChainConfig(targetId)
  const publicClient = usePublicClient({ chainId: targetId })

  useEffect(() => {
    if (sportsOnly) setMarketType('sports')
  }, [sportsOnly])

  const amountRaw = (() => {
    try { return parseUnits(amount || '0', 6) } catch { return 0n }
  })()

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: target.usdc,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: [address, target.market],
    chainId: targetId,
    query: { enabled: !!address && !!target?.usdc && !!target?.market },
  })

  const validAmount = parseFloat(amount) >= 1 && amountRaw > 0n
  const fixtureNum = Number(fixtureId)
  const validFixture = Number.isInteger(fixtureNum) && fixtureNum > 0
  const needsOnchainFixture = !!target?.hasSportsOracle
  const validSports = isSports && teamA.trim().length > 0 && teamB.trim().length > 0 && !!direction
    && (!needsOnchainFixture || validFixture)
  const canSubmit   = validAmount && (isSports ? validSports : !!direction)
  const needsApproval = allowance < amountRaw
  const isBusy      = phase === PHASES.APPROVING || phase === PHASES.CREATING
  const isDone       = phase === PHASES.DONE

  function resetSportsOnTypeChange(type) {
    setMarketType(type)
    setDirection(null)
    setError(null)
    if (type === 'btc')    setDuration(DURATIONS[4])
    if (type === 'sports') {
      setSportsDur(SPORTS_DURATIONS[1])
      setTeamA('')
      setTeamB('')
      setCompetition('')
      setFixtureId('')
      setMatchQuery('')
    }
  }

  async function handleSubmit() {
    if (!canSubmit || isBusy || isDone) return
    setError(null)

    try {
      if (!target) throw new Error('Unknown network')
      await ensureWalletChain(switchChainAsync, walletChainId, targetId)

      if (needsApproval) {
        setPhase(PHASES.APPROVING)
        const hash = await writeContractAsync({
          address: target.usdc, abi: USDC_ABI,
          functionName: 'approve',
          args: [target.market, amountRaw],
          chainId: targetId,
        })
        await publicClient.waitForTransactionReceipt({ hash })
        await refetchAllowance()
        setPhase(PHASES.IDLE)
        return
      }

      setPhase(PHASES.CREATING)

      let question, durationSecs
      let hash
      if (isSports) {
        const comp = competition.trim() || 'Match'
        question = `${teamA.trim()} vs ${teamB.trim()} | ${comp}`
        durationSecs = BigInt(sportsDur.secs)
        if (target.hasSportsOracle) {
          hash = await writeContractAsync({
            address: target.market, abi: MARKET_ABI,
            functionName: 'createSportsMarket',
            args: [question, durationSecs, direction, amountRaw, BigInt(fixtureNum)],
            chainId: targetId,
          })
        } else {
          hash = await writeContractAsync({
            address: target.market, abi: MARKET_ABI,
            functionName: 'createMarket',
            args: [1, question, durationSecs, direction, amountRaw, ZERO_ADDRESS],
            chainId: targetId,
          })
        }
      } else {
        const dirLabel = direction === OPTION.UP ? 'UP' : 'DOWN'
        question = `BTC ${dirLabel} in ${duration.label} — ${new Date().toISOString()}`
        durationSecs = BigInt(duration.secs)
        hash = await writeContractAsync({
          address: target.market, abi: MARKET_ABI,
          functionName: 'createMarket',
          args: [0, question, durationSecs, direction, amountRaw, target.btcOracle],
          chainId: targetId,
        })
      }
      await publicClient.waitForTransactionReceipt({ hash })
      setPhase(PHASES.DONE)
      // Close modal after brief success flash
      setTimeout(() => onClose(), 2200)
      // Keep polling until the backend listener has indexed the new market
      queryClient.invalidateQueries({ queryKey: ['positions', address] })
      ;[3000, 6000, 12000, 20000].forEach((delay) => {
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ['markets'] }), delay)
      })
    } catch (err) {
      setError(err.shortMessage || err.message?.slice(0, 80) || 'Transaction failed')
      setPhase(PHASES.IDLE)
    }
  }

  const btnLabel =
    isDone                        ? 'Created! ✓'
    : phase === PHASES.APPROVING  ? 'Approving USDC...'
    : phase === PHASES.CREATING   ? 'Confirming...'
    : needsApproval && validAmount ? 'Approve USDC'
    : 'Create market'

  const hint =
    phase === PHASES.APPROVING ? 'Confirm USDC approval in your wallet'
    : phase === PHASES.CREATING  ? 'Confirm the market creation in your wallet'
    : isDone                     ? (isSports ? 'Match created — waiting for bets' : 'Market created — waiting for a counterparty')
    : null

  const durations = isSports ? SPORTS_DURATIONS : DURATIONS
  const activeDur = isSports ? sportsDur : duration
  const setDur    = isSports ? setSportsDur : setDuration

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !isBusy && onClose()}>
      <div className="modal modal-wide modal-create">
        <div className="modal-head">
          <h2 className="modal-title">Create a market</h2>
          <p className="modal-subtitle">
            {isSports
              ? 'Open a match. Your stake starts the pot.'
              : 'Open a Bitcoin market. Your stake starts the pot.'}
          </p>
          <TypeToggle value={marketType} onChange={resetSportsOnTypeChange} disabled={isBusy || isDone} sportsOnly={sportsOnly} />
        </div>

        <div className="modal-scroll">
        {isSports ? (
          <>
            <p className="field-label">Teams</p>
            <div className="teams-input-row">
              <div className="team-input-wrap">
                <span className="team-input-flag">{FLAGS[teamA.trim()] || '🏳'}</span>
                <input
                  className="team-input"
                  placeholder="Team A (e.g. Brazil)"
                  value={teamA}
                  onChange={(e) => { setTeamA(e.target.value); setDirection(null) }}
                  disabled={isBusy || isDone}
                />
              </div>
              <span className="teams-vs">vs</span>
              <div className="team-input-wrap">
                <span className="team-input-flag">{FLAGS[teamB.trim()] || '🏳'}</span>
                <input
                  className="team-input"
                  placeholder="Team B (e.g. Germany)"
                  value={teamB}
                  onChange={(e) => { setTeamB(e.target.value); setDirection(null) }}
                  disabled={isBusy || isDone}
                />
              </div>
            </div>

            <div className="form-row-2">
              <div>
                <p className="field-label">Competition</p>
                <input
                  className="competition-input"
                  placeholder="League or cup"
                  value={competition}
                  onChange={(e) => setCompetition(e.target.value)}
                  disabled={isBusy || isDone}
                />
              </div>
              <div>
                <p className="field-label">Fixture id</p>
                <input
                  className="competition-input"
                  placeholder="327863"
                  value={fixtureId}
                  onChange={(e) => setFixtureId(e.target.value.replace(/\D/g, ''))}
                  disabled={isBusy || isDone}
                />
              </div>
            </div>
            <p className="tx-hint">Team A must be the home side.</p>

            <p className="field-label">Your pick</p>
            <TeamSideSelector
              teamA={teamA} teamB={teamB}
              value={direction} onChange={setDirection}
              disabled={isBusy || isDone}
            />
          </>
        ) : (
          <>
            <p className="field-label">Direction</p>
            <div className="option-grid">
              {[
                { val: OPTION.UP,   cls: 'up',   label: 'UP',   hint: 'price rises' },
                { val: OPTION.DOWN, cls: 'down',  label: 'DOWN', hint: 'price falls' },
              ].map(({ val, cls, label, hint: h }) => (
                <button
                  key={val}
                  className={`opt-btn ${cls}${direction === val ? ' selected' : ''}`}
                  onClick={() => !isBusy && !isDone && setDirection(val)}
                  disabled={isBusy || isDone}
                >
                  <span className="opt-label">{label}</span>
                  <span className="opt-hint">{h}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <p className="field-label">{isSports ? 'Match window' : 'Timeframe'}</p>
        <div className="duration-grid">
          {durations.map((d) => (
            <button
              key={d.secs}
              className={`dur-btn${activeDur.secs === d.secs ? ' selected' : ''}`}
              onClick={() => !isBusy && !isDone && setDur(d)}
              disabled={isBusy || isDone}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="amount-label">
          <span>Your opening stake</span>
          <span>Min 1 USDC</span>
        </div>
        <div className="amount-wrap">
          <input
            className="amount-input"
            type="number" min="1" step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="1"
            disabled={isBusy || isDone}
          />
          <span className="amount-unit">USDC</span>
        </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isBusy || isDone}
          >
            {btnLabel}
          </button>
          <button className="btn-ghost" onClick={onClose} disabled={isBusy}>Cancel</button>
          {hint  && <p className={`tx-hint${isDone ? ' success' : ''}`}>{hint}</p>}
          {error && <p className="tx-hint error">{error}</p>}
        </div>
      </div>
    </div>
  )
}
