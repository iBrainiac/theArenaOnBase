# CRE workflow (not deployed)

Chainlink Functions is sunset. This folder is a **sketch** of the CRE TypeScript workflow that:

1. Triggers on `SportsResultRequested(marketId, fixtureId)` from AgentMarket
2. `GET https://api.football-data.org/v4/matches/{fixtureId}` with Vault secret `FD_TOKEN`
3. Maps FINISHED full-time score → `1 | 2 | 3`
4. `writeReport` to `SportsResultConsumer` with `abi.encode(marketId, outcome)`

Install later: `cre` CLI + `@chainlink/cre-sdk`. Do not treat these files as a compiled project until `cre workflow init` is run and bindings match.

## You must provide

- football-data.org API token (put in CRE Vault as `FD_TOKEN`, never in git)
- CRE account and `cre workflow deploy` on Base Sepolia
- Deployed `AgentMarket` + `SportsResultConsumer` addresses after `DeploySportsOracle.s.sol`

## Config placeholders

See `config.example.json`.
