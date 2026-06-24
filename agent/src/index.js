import "dotenv/config";
import cron from "node-cron";
import { getBTCPrice, getBTCHistory, calcMomentum } from "./price.js";
import { getMarketDecision } from "./claude.js";
import {
  getOpenMarkets, createMarket, joinMarket,
  settleMarket, withdraw, refund,
  scanMyMarketsForAction, getUSDCBalance,
} from "./market.js";
import { sportsProposalLoop, sportsFinalizationLoop } from "./sportsProposal.js";
import { account } from "./wallet.js";
import { MIN_BET_RAW, MAX_OPEN_POSITIONS, OPTION } from "./config.js";

// Pick timeframe based on momentum — more volatile = shorter market
function pickDuration(pct) {
  const abs = Math.abs(pct)
  if (abs >= 1.5) return 300    // 5m  — explosive move
  if (abs >= 0.8) return 900    // 15m — strong momentum
  if (abs >= 0.3) return 1800   // 30m — moderate
  return 3600                   // 1h  — calm market
}

let activePositions = 0;

// Runs every 5 min: settle expired markets, withdraw winnings, refund dead markets
async function settleLoop() {
  try {
    const actions = await scanMyMarketsForAction();
    for (const { type, marketId } of actions) {
      try {
        if (type === "settle")   await settleMarket(marketId);
        if (type === "withdraw") await withdraw(marketId);
        if (type === "refund")   await refund(marketId);
      } catch (err) {
        console.error(`Action ${type} on market #${marketId} failed:`, err.message);
      }
    }
  } catch (err) {
    console.error("Settle loop error:", err.message);
  }
}

// Runs every hour: fetch price, ask LLM, create or join market
async function tradingLoop() {
  console.log(`\n[${new Date().toISOString()}] Trading loop starting...`);
  console.log(`Wallet: ${account.address}`);

  try {
    const balance = await getUSDCBalance();
    const balanceHuman = Number(balance) / 1_000_000;
    console.log(`USDC balance: ${balanceHuman.toFixed(2)}`);

    if (balance < MIN_BET_RAW) {
      console.warn("Insufficient USDC — skipping bet this round");
      return;
    }

    if (activePositions >= MAX_OPEN_POSITIONS) {
      console.log(`At position cap (${MAX_OPEN_POSITIONS}) — skipping new bet`);
      return;
    }

    console.log("Fetching BTC price data...");
    const [currentPrice, candles] = await Promise.all([getBTCPrice(), getBTCHistory()]);
    const { pct, signal: momentumSignal } = calcMomentum(candles);
    console.log(`BTC: $${currentPrice.toLocaleString()} | Momentum: ${momentumSignal} (${pct}%)`);

    const duration = pickDuration(pct);
    const durationLabel = duration < 3600 ? `${duration / 60}m` : `${duration / 3600}h`;
    console.log(`Selected timeframe: ${durationLabel} (|momentum| = ${Math.abs(pct).toFixed(2)}%)`);

    console.log("Asking Claude...");
    const direction = await getMarketDecision(candles, currentPrice);
    const label = direction === OPTION.UP ? "UP" : "DOWN";
    console.log(`Claude decision: ${label}`);

    const openMarkets = await getOpenMarkets();
    const targetMarket = openMarkets.find((m) => {
      const notFull = m.totalOptionA === 0n || m.totalOptionB === 0n;
      return notFull;
    });

    if (targetMarket) {
      console.log(`Joining market #${targetMarket.marketId} with ${label}`);
      await joinMarket(targetMarket.marketId, direction);
    } else {
      console.log(`No suitable market found — creating ${durationLabel} BTC ${label} market`);
      await createMarket(direction, duration);
      activePositions++;
    }

  } catch (err) {
    console.error("Trading loop error:", err.message);
  }
}

async function sportsLoop() {
  await sportsProposalLoop();
  await sportsFinalizationLoop();
}

console.log("Agent starting...");
await settleLoop();
await tradingLoop();
await sportsLoop();

// BTC: settle every 5min, trade every hour
// Sports: check for proposals + finalizations every 10min
cron.schedule("*/5 * * * *", settleLoop);
cron.schedule("0 * * * *", tradingLoop);
cron.schedule("*/10 * * * *", sportsLoop);
console.log("Agent scheduled — BTC: settle/5min trade/1h | Sports: propose+finalize/10min");
