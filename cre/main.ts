# Sketch — adapt after `cre workflow init`. Not WASM-ready as-is.
# Secrets: FD_TOKEN in Vault DON / local .env (never commit).

import { cre } from '@chainlink/cre-sdk'
import { encodeAbiParameters, parseAbiItem } from 'viem'
import config from './config.json'

const FINISHED = new Set(['FINISHED', 'AWARDED'])

function outcomeFromScore(home, away) {
  if (home > away) return 1
  if (home < away) return 2
  return 3
}

export async function main() {
  const evm = new cre.evm.EVMClient(config.chainSelectorName)

  const trigger = evm.logTrigger({
    addresses: [config.agentMarket],
    topics: [
      // SportsResultRequested(uint256 indexed marketId, uint256 fixtureId)
      '0x', // fill with keccak of the event after deploy
    ],
  })

  cre.handler(trigger, async (runtime, log) => {
    const marketId = BigInt(log.topics[1])
    const fixtureId = BigInt(log.data)

    const token = await runtime.getSecret({ id: 'FD_TOKEN' }).result()
    const res = await runtime.http
      .sendRequest({
        url: `${config.footballDataUrl}/${fixtureId}`,
        method: 'GET',
        headers: { 'X-Auth-Token': token },
      })
      .result()

    const body = res.json()
    const status = body.status || body.match?.status
    if (!FINISHED.has(status)) {
      runtime.log(`skip: match ${fixtureId} status ${status}`)
      return
    }

    const ft = body.score?.fullTime || body.match?.score?.fullTime
    const home = Number(ft.home)
    const away = Number(ft.away)
    if (!Number.isFinite(home) || !Number.isFinite(away)) {
      throw new Error('missing full-time score')
    }

    const outcome = outcomeFromScore(home, away)
    const payload = encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint8' }],
      [marketId, outcome],
    )

    const report = await runtime.report(payload).result()
    await evm
      .writeReport({
        receiver: config.sportsConsumer,
        report,
        gasLimit: '300000',
      })
      .result()
  })

  return cre.workflow()
}
