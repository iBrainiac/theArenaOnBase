import { ethers } from "ethers";
import {
  upsertMarket, updateMarketStatus,
  getPositionsForMarket, incrementStreak, resetStreak, recordHistory,
  markWithdrawn, pruneMarketsNotIn, replacePosition,
} from "./db.js";

const MARKET_ABI = [
  "event MarketCreated(uint256 indexed marketId, address indexed creator, uint8 marketType, uint8 option, uint256 amount)",
  "event MarketJoined(uint256 indexed marketId, address indexed participant, uint8 option, uint256 amount)",
  "event MarketSettled(uint256 indexed marketId, uint8 winningOption)",
  "event MarketCancelled(uint256 indexed marketId)",
  "function marketCount() external view returns (uint256)",
  "function getParticipants(uint256) external view returns (address[])",
  "function getPosition(uint256,address) external view returns (uint256 amount, uint8 option, bool withdrawn)",
  "function markets(uint256) external view returns (uint256 id, uint8 marketType, string question, int256 openPrice, int256 closePrice, uint256 deadline, uint256 createdAt, uint256 totalOptionA, uint256 totalOptionB, uint256 totalOptionC, uint256 totalPot, uint8 status, uint8 winningOption, address oracleAddress)",
  "event Withdrawn(uint256 indexed marketId, address indexed participant, uint256 amount)",
  "event Refunded(uint256 indexed marketId, address indexed participant, uint256 amount)",
];

const KNOWN_AGENTS = new Set(
  (process.env.AGENT_WALLETS || "").split(",").map((a) => a.toLowerCase().trim()).filter(Boolean)
);

const DEFAULT_POLL_MS = Number(process.env.LISTENER_POLL_MS || 8000);
const DEFAULT_LOOKBACK = Number(process.env.LISTENER_LOOKBACK_BLOCKS || 50_000);
const LOG_CHUNK = Number(process.env.LISTENER_LOG_CHUNK || 2_000);

function participantType(addr) {
  return KNOWN_AGENTS.has(addr.toLowerCase()) ? "agent" : "human";
}

function toMarketRow(chainId, marketId, m) {
  return {
    chainId,
    marketId: Number(marketId),
    marketType: Number(m.marketType),
    question: m.question,
    totalOptionA: m.totalOptionA,
    totalOptionB: m.totalOptionB,
    totalOptionC: m.totalOptionC,
    totalPot: m.totalPot,
    status: Number(m.status),
    winningOption: Number(m.winningOption),
    deadline: Number(m.deadline),
    createdAt: Number(m.createdAt),
    oracleAddress: m.oracleAddress,
  };
}

async function syncPosition(contract, chainId, marketId, wallet) {
  const pos = await contract.getPosition(marketId, wallet);
  if (pos.amount === 0n && !pos.withdrawn) return;
  replacePosition(
    chainId,
    Number(marketId),
    wallet,
    Number(pos.option),
    pos.amount,
    participantType(wallet),
    Boolean(pos.withdrawn)
  );
}

async function handleCreated(contract, chainId, tag, marketId, creator, option, amount) {
  console.log(`[${tag}] MarketCreated #${marketId} by ${creator}`);
  const m = await contract.markets(marketId);
  upsertMarket(toMarketRow(chainId, marketId, m));
  await syncPosition(contract, chainId, marketId, creator);
}

async function handleJoined(contract, chainId, tag, marketId, participant, option, amount) {
  console.log(`[${tag}] MarketJoined #${marketId} by ${participant}`);
  const m = await contract.markets(marketId);
  upsertMarket(toMarketRow(chainId, marketId, m));
  await syncPosition(contract, chainId, marketId, participant);
}

async function getLogsChunked(provider, address, fromBlock, toBlock) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK) {
    const end = Math.min(start + LOG_CHUNK - 1, toBlock);
    const part = await provider.getLogs({ address, fromBlock: start, toBlock: end });
    logs.push(...part);
  }
  return logs;
}

async function syncMarkets(contract, chainId, tag) {
  const count = Number(await contract.marketCount());
  const keepIds = [];
  for (let id = 1; id <= count; id++) {
    const m = await contract.markets(id);
    if (!m.question && Number(m.createdAt) === 0) continue;
    upsertMarket(toMarketRow(chainId, id, m));
    keepIds.push(id);
    try {
      const parts = await contract.getParticipants(id);
      for (const addr of parts) {
        await syncPosition(contract, chainId, id, addr);
      }
    } catch (e) {
      console.warn(`[${tag}] getParticipants #${id}:`, e.shortMessage || e.message);
    }
  }
  pruneMarketsNotIn(chainId, keepIds);
  return count;
}

async function handleSettled(chainId, tag, marketId, winningOption) {
  console.log(`[${tag}] MarketSettled #${marketId} — winner option ${winningOption}`);
  updateMarketStatus(chainId, Number(marketId), 2, Number(winningOption));
  const positions = getPositionsForMarket(chainId, Number(marketId));
  for (const pos of positions) {
    if (Number(winningOption) === 3) continue;
    const type = participantType(pos.wallet_address);
    if (pos.option === Number(winningOption)) {
      incrementStreak(pos.wallet_address, type);
      recordHistory(chainId, Number(marketId), pos.wallet_address, "win", pos.amount);
    } else {
      resetStreak(pos.wallet_address, type);
      recordHistory(chainId, Number(marketId), pos.wallet_address, "loss", pos.amount);
    }
  }
}

export function startListener({ rpc, address, chainId, name, pollMs }) {
  if (!address) {
    console.warn(`[${name || chainId}] market address not set — listener not started`);
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const contract = new ethers.Contract(address, MARKET_ABI, provider);
  const tag = name || `chain ${chainId}`;
  const basePollMs = pollMs || DEFAULT_POLL_MS;
  const lookback = Number(process.env.LISTENER_LOOKBACK_BLOCKS || DEFAULT_LOOKBACK);

  let fromBlock = null;
  let ticking = false;
  let delayMs = basePollMs;
  let timer = null;
  let lastCount = -1;

  async function dispatch(parsed) {
    const a = parsed.args;
    switch (parsed.name) {
      case "MarketCreated":
        await handleCreated(contract, chainId, tag, a.marketId, a.creator, a.option, a.amount);
        break;
      case "MarketJoined":
        await handleJoined(contract, chainId, tag, a.marketId, a.participant, a.option, a.amount);
        break;
      case "MarketSettled":
        await handleSettled(chainId, tag, a.marketId, a.winningOption);
        break;
      case "MarketCancelled":
        console.log(`[${tag}] MarketCancelled #${a.marketId}`);
        updateMarketStatus(chainId, Number(a.marketId), 3);
        break;
      case "Withdrawn":
        console.log(`[${tag}] Withdrawn #${a.marketId} by ${a.participant}`);
        markWithdrawn(chainId, Number(a.marketId), a.participant);
        break;
      case "Refunded":
        console.log(`[${tag}] Refunded #${a.marketId} by ${a.participant}`);
        markWithdrawn(chainId, Number(a.marketId), a.participant);
        break;
      default:
        break;
    }
  }

  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      const count = await syncMarkets(contract, chainId, tag);
      if (count !== lastCount) {
        console.log(`[${tag}] Synced ${count} on-chain market(s)`);
        lastCount = count;
      }

      const latest = await provider.getBlockNumber();
      if (fromBlock == null) {
        fromBlock = Math.max(0, latest - Math.min(lookback, 128));
      }
      if (latest >= fromBlock) {
        try {
          const logs = await getLogsChunked(provider, address, fromBlock, latest);
          for (const log of logs) {
            const parsed = contract.interface.parseLog(log);
            if (parsed) await dispatch(parsed);
          }
        } catch (logErr) {
          console.warn(`[${tag}] getLogs skipped:`, logErr.shortMessage || logErr.message);
        }
        fromBlock = latest + 1;
      }
      delayMs = basePollMs;
    } catch (err) {
      delayMs = Math.min(delayMs * 2, 60_000);
      console.error(`[${tag}] poll error (retry ${delayMs}ms):`, err.shortMessage || err.message);
    } finally {
      ticking = false;
      if (timer) clearTimeout(timer);
      timer = setTimeout(tick, delayMs);
    }
  }

  tick();
  console.log(`[${tag}] Polling AgentMarket events at ${address} every ${basePollMs}ms (1 getLogs)`);
}
