# x402 Implementation Plan

x402 is an HTTP-native payment protocol built on the 402 "Payment Required" status code. It lets any machine — AI agent, bot, or script — pay for an HTTP resource automatically, with no accounts, API keys, or subscriptions. The payer attaches a signed USDC payment authorization to the request header; the server validates it and serves the response.

This document covers every x402 use case identified for this app, ordered by implementation priority, with clear notes on what to build and why it fits the product.

---

## Current State

The backend already has x402 wired at the middleware level (`x402-express`) and two stub endpoints exist:

```
POST /api/action/createMarket  — $1 per call
POST /api/action/joinMarket    — $1 per call
```

Both are inactive unless `TREASURY_ADDRESS` is set in the backend `.env`. When set, the middleware intercepts the request, validates the payment header, and only forwards to the route handler if payment is confirmed. The route handlers currently just acknowledge receipt — they don't relay anything on-chain yet.

The contract is fully permissionless. Agents calling it directly never pay an x402 fee. x402 only applies to agents that choose to use the HTTP relay.

---

## Phase 1 — Participation Fee (Relay Activation)

**What:** Fully wire the two existing stub endpoints so they actually relay the action on-chain after payment is confirmed.

**Endpoints:**
```
POST /api/action/joinMarket
  Payment: $1 USDC
  Body:    { marketId, option, amount }
  Action:  Backend wallet calls joinMarket(marketId, option, amount) on behalf of the agent

POST /api/action/createMarket
  Payment: $1 USDC
  Body:    { option, duration }
  Action:  Backend wallet calls createMarket(...) on behalf of the agent
```

**Why this first:**
It's already half-built. The main work is holding a relay wallet with USDC and gas, signing the contract calls server-side, and returning the transaction hash. Agents that don't want to manage a private key or handle gas can delegate to the relay and just pay $1.

**Simplicity rule:** The relay wallet is a single funded wallet in the backend `.env`. No queuing, no retry logic in Phase 1 — if the tx fails, return the error and the agent retries. Keep it synchronous.

**Revenue model:** $1 flat fee per action regardless of bet size. Volume drives revenue, not percentage.

---

## Phase 2 — Live Market Data API

**What:** Gate real-time and enriched market data behind per-call fees. The free endpoint stays but gets throttled; premium endpoints are fast and unfiltered.

**Endpoints:**
```
GET /api/markets
  Price:   Free
  Returns: Open markets, 15s backend cache
  Limit:   Rate-limited to 10 req/min per IP

GET /api/markets/live
  Price:   $0.01 per call
  Returns: Same data, bypasses cache (fresh from DB)
  For:     Agents that need up-to-the-second pool sizes before betting

GET /api/markets/:id/depth
  Price:   $0.05 per call
  Returns: Full position breakdown — how much is on each side, number of bettors,
           implied probability per option
  For:     Agents doing odds analysis before committing a stake

GET /api/markets/history
  Price:   $0.10 per call
  Query:   ?limit=100&type=sports|btc
  Returns: Full settled market history with final odds and pot sizes
  For:     Agents training or backtesting a strategy
```

**Why this fits:**
The backend already has all this data. It's a config change and a price tag. The free tier keeps the app open for humans and light agent use. Paid tiers are for agents running at scale that need fresh data on every decision loop.

**Simplicity rule:** No API keys. Payment IS the authentication. Each call is independent — no session, no account, no subscription management.

---

## Phase 3 — Agent Intelligence Layer

**What:** Let agents pay to observe what other high-performing agents are doing. The leaderboard already tracks agent wallets separately — this monetizes that data.

**Endpoints:**
```
GET /api/leaderboard/agents
  Price:   Free
  Returns: Top 10 agents by current streak

GET /api/leaderboard/agents/full
  Price:   $0.25 per call
  Returns: Full agent leaderboard — all-time wins, loss rate, average pot size,
           preferred market type (BTC vs sports), average stake per bet
  For:     Agents that want to benchmark themselves or find patterns in winners

GET /api/agents/:wallet/bets
  Price:   $0.50 per call
  Returns: Full bet history for a specific agent wallet — every market joined,
           option picked, stake size, outcome
  For:     Agents that want to mirror or counter a known winning agent's strategy
```

**Why this fits:**
Information asymmetry is valuable in any prediction market. Agents willing to pay for data about other agents' behavior get a real edge. This also creates a natural incentive to perform well — a high-streak agent becomes a paid data product.

**Simplicity rule:** All data is already in the DB. No new indexing needed. The endpoints are read-only queries with a price tag added via middleware.

---

## Phase 4 — Sports Signals

**What:** The admin resolves sports markets with verified real-world outcomes. That knowledge has value before it settles on-chain. Package it as a paid signal feed.

**Endpoints:**
```
GET /api/sports/upcoming
  Price:   $0.10 per call
  Returns: List of all open sports markets with team names, competition,
           deadline, current pool sizes per side, and implied odds
  For:     Agents that want a curated view of what to bet on next

POST /api/sports/signals/subscribe
  Price:   $1.00 per result
  Body:    { marketId, webhookUrl }
  Action:  When admin resolves a market, backend POSTs the result to webhookUrl
           before the on-chain tx confirms — agent gets ~5-15 seconds of lead time
  For:     Agents that want to act on outcome data the moment it's known
```

**Why this fits:**
The admin is already the source of truth for sports outcomes. The signal subscription monetizes that privileged position — agents pay to be notified faster than they can detect it on-chain. The webhook model is simple: no polling, no long-lived connections.

**Simplicity rule:** One webhook per market per agent. No fan-out complexity. If the POST fails, no retry — the agent should also watch the chain as a fallback.

---

## Phase 5 — Agent-to-Agent Payments

**What:** Enable agents to sell services to other agents using x402 as the payment rail. The backend acts as an optional facilitator but is not required — agents can implement x402 on their own HTTP servers.

**Example flow:**
```
Agent A  →  runs a BTC momentum model, exposes an endpoint:
            GET https://agent-a.example.com/tip
            Requires: x402 payment of $0.50 USDC

Agent B  →  calls Agent A's endpoint with x402 header
            Receives: { direction: "UP", confidence: 0.73, timeframe: "15m" }
            Places bet based on the tip
```

**What the app provides to support this:**
```
GET /api/agents/registry
  Price:   Free
  Returns: List of known agent wallets that have participated in markets,
           their on-chain address, and their public stats
  For:     Agents looking for signal providers or counterparties to follow
```

The registry is just the existing agent leaderboard data repackaged as a discovery layer. Agents that want to monetize their signals list themselves; agents that want to buy signals browse the registry and call the provider's endpoint directly.

**Why this fits:**
This is the natural endpoint of the product vision — a fully autonomous economy where agents earn from each other. The app doesn't need to sit in the middle of every transaction. It just needs to be the place where agents find each other.

**Simplicity rule:** The app provides discovery only. Agent-to-agent payments happen off-platform. No escrow, no dispute resolution, no smart contract changes needed.

---

## Implementation Order Summary

| Phase | Feature | Effort | Revenue type |
|-------|---------|--------|--------------|
| 1 | Participation relay | Low | Per action |
| 2 | Live market data API | Low | Per query |
| 3 | Agent intelligence | Low | Per query |
| 4 | Sports signals | Medium | Per result |
| 5 | Agent-to-agent registry | Low | Indirect (drives participation) |

Phases 1–3 are all backend-only changes with no new smart contract work, no frontend changes, and no new infrastructure. Phase 4 adds a webhook dispatcher. Phase 5 adds one read endpoint.

---

## Scaling Principles

**Never break the free path.** Direct contract interaction is always free and always works. x402 is a premium layer on top — it should make things more convenient or more data-rich, never become a gate that blocks participation.

**Flat fees, not percentages.** Percentage-based fees punish large bets and create friction at scale. Flat per-call fees are predictable — agents can budget their API costs independently of their bet sizes.

**No accounts.** Every x402 call is stateless. Payment is the identity. This keeps the backend simple and makes the system accessible to any agent without an onboarding flow.

**Payments to a single treasury.** All x402 revenue flows to `TREASURY_ADDRESS` in `.env`. One address, one place to check revenue. No complex fee splitting until the product needs it.

**Measure before charging.** Before putting a price on any endpoint, log how often it's called for two weeks. Price based on observed demand, not assumptions.
