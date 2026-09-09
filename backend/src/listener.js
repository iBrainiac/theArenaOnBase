import { ethers } from "ethers";
import {
  upsertMarket, upsertPosition, updateMarketStatus,
  getPositionsForMarket, incrementStreak, resetStreak, recordHistory,
  markWithdrawn,
} from "./db.js";

const MARKET_ABI = [
  "event MarketCreated(uint256 indexed marketId, address indexed creator, uint8 marketType, uint8 option, uint256 amount)",
  "event MarketJoined(uint256 indexed marketId, address indexed participant, uint8 option, uint256 amount)",
  "event MarketSettled(uint256 indexed marketId, uint8 winningOption)",
  "event MarketCancelled(uint256 indexed marketId)",
  "function markets(uint256) external view returns (uint256 id, uint8 marketType, string question, int256 openPrice, int256 closePrice, uint256 deadline, uint256 createdAt, uint256 totalOptionA, uint256 totalOptionB, uint256 totalOptionC, uint256 totalPot, uint8 status, uint8 winningOption, address oracleAddress)",
  "event Withdrawn(uint256 indexed marketId, address indexed participant, uint256 amount)",
  "event Refunded(uint256 indexed marketId, address indexed participant, uint256 amount)",
];

const KNOWN_AGENTS = new Set(
  (process.env.AGENT_WALLETS || "").split(",").map((a) => a.toLowerCase().trim()).filter(Boolean)
);

const DEFAULT_POLL_MS = Number(process.env.LISTENER_POLL_MS || 8000);

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
    winningOption: 0,
    deadline: Number(m.deadline),
    createdAt: Number(m.createdAt),
    oracleAddress: m.oracleAddress,
  };
}

async function handleCreated(contract, chainId, tag, marketId, creator, option, amount) {
  console.log(`[${tag}] MarketCreated #${marketId} by ${creator}`);
  const m = await contract.markets(marketId);
  upsertMarket(toMarketRow(chainId, marketId, m));
  upsertPosition(chainId, Number(marketId), creator, Number(option), amount, participantType(creator));
}

async function handleJoined(contract, chainId, tag, marketId, participant, option, amount) {
  console.log(`[${tag}] MarketJoined #${marketId} by ${participant}`);
  const m = await contract.markets(marketId);
  upsertMarket(toMarketRow(chainId, marketId, m));
  upsertPosition(chainId, Number(marketId), participant, Number(option), amount, participantType(participant));
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

  let fromBlock = null;
  let ticking = false;
  let delayMs = basePollMs;
  let timer = null;

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
      const latest = await provider.getBlockNumber();
      if (fromBlock == null) {
        fromBlock = latest + 1;
        delayMs = basePollMs;
        return;
      }
      if (latest < fromBlock) return;

      const toBlock = latest;
      const logs = await provider.getLogs({
        address,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const parsed = contract.interface.parseLog(log);
        if (parsed) await dispatch(parsed);
      }

      fromBlock = toBlock + 1;
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
