/**
 * resolveSport.js
 * Resolves a sports prediction market as the contract owner.
 *
 * Usage:
 *   node scripts/resolveSport.js <marketId> <winner>
 *
 * <winner>: 1 = Team A wins, 2 = Team B wins, 3 = Draw
 *
 * Requires DEPLOYER_PRIVATE_KEY in agent/.env (the contract owner's key).
 */
import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ── Config ────────────────────────────────────────────────────────────────────
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const RPC_URL              = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const MARKET_ADDRESS       = process.env.AGENT_MARKET_ADDRESS;

if (!DEPLOYER_PRIVATE_KEY) {
  console.error("Error: DEPLOYER_PRIVATE_KEY not set in .env");
  console.error("Add it as: DEPLOYER_PRIVATE_KEY=0x... (the contract owner's private key)");
  process.exit(1);
}
if (!MARKET_ADDRESS) {
  console.error("Error: AGENT_MARKET_ADDRESS not set in .env");
  process.exit(1);
}

// ── ABI fragments ─────────────────────────────────────────────────────────────
const MARKET_ABI = [
  {
    name: "resolveSportsMarket",
    type: "function",
    inputs: [
      { name: "marketId",      type: "uint256" },
      { name: "winningOption", type: "uint8"   },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "markets",
    type: "function",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "id",            type: "uint256" },
      { name: "marketType",    type: "uint8"   },
      { name: "question",      type: "string"  },
      { name: "openPrice",     type: "int256"  },
      { name: "closePrice",    type: "int256"  },
      { name: "deadline",      type: "uint256" },
      { name: "createdAt",     type: "uint256" },
      { name: "totalOptionA",  type: "uint256" },
      { name: "totalOptionB",  type: "uint256" },
      { name: "totalPot",      type: "uint256" },
      { name: "status",        type: "uint8"   },
      { name: "winningOption", type: "uint8"   },
      { name: "oracleAddress", type: "address" },
    ],
    stateMutability: "view",
  },
];

// ── Parse CLI args ────────────────────────────────────────────────────────────
const [,, rawMarketId, rawWinner] = process.argv;

if (!rawMarketId || !rawWinner) {
  console.error("Usage: node scripts/resolveSport.js <marketId> <winner>");
  console.error("  winner: 1 = Team A, 2 = Team B, 3 = Draw");
  process.exit(1);
}

const marketId = BigInt(rawMarketId);
const winner   = Number(rawWinner);

if (isNaN(winner) || ![1, 2, 3].includes(winner)) {
  console.error("Error: winner must be 1 (Team A), 2 (Team B), or 3 (Draw)");
  process.exit(1);
}

// ── Viem clients ──────────────────────────────────────────────────────────────
const account = privateKeyToAccount(DEPLOYER_PRIVATE_KEY);

const publicClient = createPublicClient({
  chain:     baseSepolia,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain:     baseSepolia,
  transport: http(RPC_URL),
});

// ── Status labels ─────────────────────────────────────────────────────────────
const STATUS_LABELS  = { 0: "OPEN", 1: "ACTIVE", 2: "SETTLED", 3: "CANCELLED" };
const WINNER_LABELS  = { 1: "Team A", 2: "Team B", 3: "Draw" };

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Deployer wallet: ${account.address}`);
  console.log(`Market contract: ${MARKET_ADDRESS}`);
  console.log(`Resolving market #${marketId} with winner: ${WINNER_LABELS[winner]} (${winner})\n`);

  // Fetch market info from chain
  console.log("Fetching market from chain...");
  const market = await publicClient.readContract({
    address:      MARKET_ADDRESS,
    abi:          MARKET_ABI,
    functionName: "markets",
    args:         [marketId],
  });

  const [
    id, marketType, question, openPrice, closePrice,
    deadline, createdAt, totalOptionA, totalOptionB,
    totalPot, status, currentWinningOption, oracleAddress,
  ] = market;

  const deadlineDate = new Date(Number(deadline) * 1000).toISOString();
  const statusLabel  = STATUS_LABELS[Number(status)] || String(status);

  console.log(`  Market ID:     ${id}`);
  console.log(`  Type:          ${marketType === 1 ? "SPORTS_MATCH" : String(marketType)}`);
  console.log(`  Question:      ${question}`);
  console.log(`  Deadline:      ${deadlineDate}`);
  console.log(`  Status:        ${statusLabel}`);
  console.log(`  Option A pool: ${Number(totalOptionA) / 1e6} USDC`);
  console.log(`  Option B pool: ${Number(totalOptionB) / 1e6} USDC`);
  console.log(`  Total pot:     ${Number(totalPot) / 1e6} USDC\n`);

  if (Number(status) === 2) {
    console.error("Error: Market is already settled.");
    process.exit(1);
  }
  if (Number(status) === 3) {
    console.error("Error: Market is cancelled.");
    process.exit(1);
  }

  // Call resolveSportsMarket
  console.log(`Calling resolveSportsMarket(${marketId}, ${winner})...`);
  const hash = await walletClient.writeContract({
    address:      MARKET_ADDRESS,
    abi:          MARKET_ABI,
    functionName: "resolveSportsMarket",
    args:         [marketId, winner],
  });

  console.log(`Tx submitted: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    console.error(`Transaction reverted. Hash: ${hash}`);
    process.exit(1);
  }

  console.log(`\nSuccess! Market #${marketId} resolved.`);
  console.log(`  Question: ${question}`);
  console.log(`  Winner:   ${WINNER_LABELS[winner]} (option ${winner})`);
  console.log(`  Explorer: https://base-sepolia.blockscout.com/tx/${hash}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
