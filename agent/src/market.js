import axios from "axios";
import { publicClient, account, sendContractCall } from "./wallet.js";
import { MARKET_ABI, USDC_ABI } from "./abi.js";
import {
  MARKET_ADDRESS, USDC_ADDRESS, CHAINLINK_FEED,
  MIN_BET_RAW, MARKET_DURATION, BACKEND_URL, STATUS,
} from "./config.js";

// ── USDC helpers ─────────────────────────────────────────────────────────────

async function ensureApproval(amount) {
  const allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: [account.address, MARKET_ADDRESS],
  });

  if (allowance < amount) {
    console.log("Approving USDC spend...");
    await sendContractCall({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "approve",
      args: [MARKET_ADDRESS, amount * 10n], // approve 10x to avoid repeated approvals
    });
  }
}

export async function getUSDCBalance() {
  return publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });
}

// ── Contract writes ───────────────────────────────────────────────────────────

export async function createMarket(option, durationSecs = MARKET_DURATION) {
  const amount = MIN_BET_RAW;
  await ensureApproval(amount);

  const label = option === 1 ? "UP" : "DOWN";
  const durationLabel = durationSecs < 3600
    ? `${durationSecs / 60}m`
    : `${durationSecs / 3600}h`;
  const question = `BTC ${label} in ${durationLabel} — ${new Date().toISOString()}`;

  const receipt = await sendContractCall({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "createMarket",
    args: [
      0,              // MarketType.BTC_PRICE
      question,
      BigInt(durationSecs),
      option,
      amount,
      CHAINLINK_FEED,
    ],
  });

  // Extract marketId from MarketCreated log
  const log = receipt.logs.find(
    (l) => l.topics[0] === "0x" + Buffer.from("MarketCreated(uint256,address,uint8,uint8,uint256)").toString("hex")
  );
  // Fallback: fetch marketCount from contract
  const marketId = await publicClient.readContract({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "marketCount",
  });

  console.log(`Created market #${marketId} — BTC ${label}`);
  return marketId;
}

export async function joinMarket(marketId, option, amount = MIN_BET_RAW) {
  await ensureApproval(amount);
  await sendContractCall({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "joinMarket",
    args: [BigInt(marketId), option, amount],
  });
  console.log(`Joined market #${marketId} with option ${option === 1 ? "UP" : "DOWN"}`);
}

export async function settleMarket(marketId) {
  await sendContractCall({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "settleMarket",
    args: [BigInt(marketId)],
  });
  console.log(`Settled market #${marketId}`);
}

export async function withdraw(marketId) {
  await sendContractCall({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "withdraw",
    args: [BigInt(marketId)],
  });
  console.log(`Withdrew from market #${marketId}`);
}

export async function refund(marketId) {
  await sendContractCall({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "refund",
    args: [BigInt(marketId)],
  });
  console.log(`Refunded from market #${marketId}`);
}

// ── Contract reads ────────────────────────────────────────────────────────────

export async function getMarketData(marketId) {
  return publicClient.readContract({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "markets",
    args: [BigInt(marketId)],
  });
}

export async function getMyPosition(marketId) {
  return publicClient.readContract({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "getPosition",
    args: [BigInt(marketId), account.address],
  });
}

// ── Backend market listing ────────────────────────────────────────────────────

// Returns open markets from the backend cache (avoids reading every market on-chain)
export async function getOpenMarkets() {
  try {
    const { data } = await axios.get(`${BACKEND_URL}/api/markets?status=open`);
    return data; // [{ marketId, option, totalOptionA, totalOptionB, deadline }]
  } catch {
    console.warn("Backend unreachable, reading market count from chain...");
    return scanOpenMarketsOnChain();
  }
}

async function scanOpenMarketsOnChain() {
  const count = await publicClient.readContract({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "marketCount",
  });

  const open = [];
  for (let i = 1n; i <= count; i++) {
    const m = await getMarketData(i);
    // status 0 = OPEN, 1 = LIVE
    if (m.status === 0 || m.status === 1) {
      open.push({ marketId: i, ...m });
    }
  }
  return open;
}

// ── Settlement & cleanup scan ─────────────────────────────────────────────────

// Finds the agent's markets that are past deadline and need action
export async function scanMyMarketsForAction() {
  const count = await publicClient.readContract({
    address: MARKET_ADDRESS,
    abi: MARKET_ABI,
    functionName: "marketCount",
  });

  const now = Math.floor(Date.now() / 1000);
  const actions = [];

  for (let i = 1n; i <= count; i++) {
    const pos = await getMyPosition(i);
    if (pos.amount === 0n) continue; // no position in this market

    const m = await getMarketData(i);

    if (m.status === 1 /* LIVE */ && now >= Number(m.deadline)) {
      actions.push({ type: "settle", marketId: i });
    } else if (m.status === 0 /* OPEN */) {
      const duration = Number(m.deadline) - Number(m.createdAt);
      const refundAfter = Math.max(300, Math.floor(duration * 0.5));
      if (now >= Number(m.createdAt) + refundAfter) {
        actions.push({ type: "refund", marketId: i });
      }
    } else if (m.status === 2 /* SETTLED */ && !pos.withdrawn) {
      const won = m.winningOption === 3 || pos.option === m.winningOption;
      if (won) actions.push({ type: "withdraw", marketId: i });
    }
  }

  return actions;
}
