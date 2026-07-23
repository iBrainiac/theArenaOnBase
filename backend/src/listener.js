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

// Known agent wallets — add your agent addresses here
const KNOWN_AGENTS = new Set(
  (process.env.AGENT_WALLETS || "").split(",").map((a) => a.toLowerCase().trim()).filter(Boolean)
);

function participantType(addr) {
  return KNOWN_AGENTS.has(addr.toLowerCase()) ? "agent" : "human";
}

export function startListener() {
  const rpc      = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  const address  = process.env.AGENT_MARKET_ADDRESS;

  if (!address) {
    console.warn("AGENT_MARKET_ADDRESS not set — listener not started");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpc);
  const contract = new ethers.Contract(address, MARKET_ABI, provider);

  contract.on("MarketCreated", async (marketId, creator, marketType, option, amount) => {
    console.log(`[Event] MarketCreated #${marketId} by ${creator}`);
    try {
      const m = await contract.markets(marketId);
      upsertMarket({
        marketId:     Number(marketId),
        marketType:   Number(marketType),
        question:     m.question,
        totalOptionA: m.totalOptionA,
        totalOptionB: m.totalOptionB,
        totalOptionC: m.totalOptionC,
        totalPot:     m.totalPot,
        status:       Number(m.status),
        winningOption: 0,
        deadline:     Number(m.deadline),
        createdAt:    Number(m.createdAt),
        oracleAddress: m.oracleAddress,
      });
      upsertPosition(
        Number(marketId), creator, Number(option),
        amount, participantType(creator)
      );
    } catch (err) {
      console.error("MarketCreated handler error:", err.message);
    }
  });

  contract.on("MarketJoined", async (marketId, participant, option, amount) => {
    console.log(`[Event] MarketJoined #${marketId} by ${participant}`);
    try {
      const m = await contract.markets(marketId);
      upsertMarket({
        marketId:     Number(marketId),
        marketType:   Number(m.marketType),
        question:     m.question,
        totalOptionA: m.totalOptionA,
        totalOptionB: m.totalOptionB,
        totalOptionC: m.totalOptionC,
        totalPot:     m.totalPot,
        status:       Number(m.status),
        winningOption: 0,
        deadline:     Number(m.deadline),
        createdAt:    Number(m.createdAt),
        oracleAddress: m.oracleAddress,
      });
      upsertPosition(
        Number(marketId), participant, Number(option),
        amount, participantType(participant)
      );
    } catch (err) {
      console.error("MarketJoined handler error:", err.message);
    }
  });

  contract.on("MarketSettled", async (marketId, winningOption) => {
    console.log(`[Event] MarketSettled #${marketId} — winner option ${winningOption}`);
    try {
      updateMarketStatus(Number(marketId), 2 /* SETTLED */, Number(winningOption));

      const positions = getPositionsForMarket(Number(marketId));
      for (const pos of positions) {
        const won =
          Number(winningOption) === 3 ||            // DRAW — everyone gets refund, not a streak win
          pos.option === Number(winningOption);

        if (Number(winningOption) === 3) continue;  // DRAW — no streak change

        const type = participantType(pos.wallet_address);
        if (won) {
          incrementStreak(pos.wallet_address, type);
          recordHistory(Number(marketId), pos.wallet_address, "win", pos.amount);
        } else {
          resetStreak(pos.wallet_address, type);
          recordHistory(Number(marketId), pos.wallet_address, "loss", pos.amount);
        }
      }
    } catch (err) {
      console.error("MarketSettled handler error:", err.message);
    }
  });

  contract.on("MarketCancelled", (marketId) => {
    console.log(`[Event] MarketCancelled #${marketId}`);
    updateMarketStatus(Number(marketId), 3 /* CANCELLED */);
  });

  contract.on("Withdrawn", (marketId, participant) => {
    console.log(`[Event] Withdrawn #${marketId} by ${participant}`);
    markWithdrawn(Number(marketId), participant);
  });

  contract.on("Refunded", (marketId, participant) => {
    console.log(`[Event] Refunded #${marketId} by ${participant}`);
    markWithdrawn(Number(marketId), participant);
  });

  console.log(`Listening for AgentMarket events at ${address}`);
}
