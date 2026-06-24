/**
 * createSportsMarkets.js
 * Creates 5 FIFA World Cup 2026 Group Stage prediction markets on-chain.
 * Run: node scripts/createSportsMarkets.js
 */
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ── Config ────────────────────────────────────────────────────────────────────
const PRIVATE_KEY       = process.env.PRIVATE_KEY;
const RPC_URL           = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
const MARKET_ADDRESS    = process.env.AGENT_MARKET_ADDRESS;
const USDC_ADDRESS      = process.env.USDC_ADDRESS;

if (!PRIVATE_KEY)    throw new Error("PRIVATE_KEY not set in .env");
if (!MARKET_ADDRESS) throw new Error("AGENT_MARKET_ADDRESS not set in .env");
if (!USDC_ADDRESS)   throw new Error("USDC_ADDRESS not set in .env");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE_USDC     = 1_000_000n;   // 1 USDC (6 decimals)
const TEN_USDC     = 10_000_000n;  // 10 USDC approval headroom
const FIVE_USDC    = 5_000_000n;   // threshold to re-approve

// ── ABI fragments ─────────────────────────────────────────────────────────────
const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
];

const MARKET_ABI = [
  {
    name: "createMarket",
    type: "function",
    inputs: [
      { name: "marketType",    type: "uint8"   },
      { name: "question",      type: "string"  },
      { name: "duration",      type: "uint256" },
      { name: "option",        type: "uint8"   },
      { name: "amount",        type: "uint256" },
      { name: "oracleAddress", type: "address" },
    ],
    outputs: [{ name: "marketId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "marketId",   type: "uint256", indexed: true  },
      { name: "creator",    type: "address", indexed: true  },
      { name: "marketType", type: "uint8",   indexed: false },
      { name: "option",     type: "uint8",   indexed: false },
      { name: "amount",     type: "uint256", indexed: false },
    ],
  },
];

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Kickoffs staggered 1h, 2h, 3h, 4h, 5h from now.
// Agent bets: Team A (1), Team B (2), alternating per spec.
const NOW = Math.floor(Date.now() / 1000);

const FIXTURES = [
  {
    question:    "Brazil vs Colombia | FIFA World Cup 2026 · Group G",
    kickoffIn:   1 * 3600,   // 1h from now
    initialOption: 1,        // Team A = Brazil
  },
  {
    question:    "England vs Slovenia | FIFA World Cup 2026 · Group C",
    kickoffIn:   2 * 3600,
    initialOption: 2,        // Team B = Slovenia
  },
  {
    question:    "Spain vs Germany | FIFA World Cup 2026 · Group E",
    kickoffIn:   3 * 3600,
    initialOption: 1,        // Team A = Spain
  },
  {
    question:    "France vs Poland | FIFA World Cup 2026 · Group D",
    kickoffIn:   4 * 3600,
    initialOption: 2,        // Team B = Poland
  },
  {
    question:    "Argentina vs Chile | FIFA World Cup 2026 · Group H",
    kickoffIn:   5 * 3600,
    initialOption: 1,        // Team A = Argentina
  },
];

// ── Viem clients ──────────────────────────────────────────────────────────────
const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain:     baseSepolia,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain:     baseSepolia,
  transport: http(RPC_URL),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function checkBalance() {
  const balance = await publicClient.readContract({
    address:      USDC_ADDRESS,
    abi:          USDC_ABI,
    functionName: "balanceOf",
    args:         [account.address],
  });
  console.log(`USDC balance: ${Number(balance) / 1e6} USDC`);
  if (balance < BigInt(FIXTURES.length) * ONE_USDC) {
    throw new Error(
      `Insufficient USDC. Need ${FIXTURES.length} USDC, have ${Number(balance) / 1e6}`
    );
  }
  return balance;
}

async function ensureAllowance() {
  const allowance = await publicClient.readContract({
    address:      USDC_ADDRESS,
    abi:          USDC_ABI,
    functionName: "allowance",
    args:         [account.address, MARKET_ADDRESS],
  });
  console.log(`Current USDC allowance: ${Number(allowance) / 1e6} USDC`);

  if (allowance < FIVE_USDC) {
    console.log("Allowance < 5 USDC — approving 10 USDC...");
    const hash = await walletClient.writeContract({
      address:      USDC_ADDRESS,
      abi:          USDC_ABI,
      functionName: "approve",
      args:         [MARKET_ADDRESS, TEN_USDC],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(`Approve tx reverted: ${hash}`);
    console.log(`Approved. Tx: ${hash}`);
  } else {
    console.log("Allowance sufficient, skipping approve.");
  }
}

async function createMarket(fixture) {
  // duration = seconds until kickoff + 7200 (90-min match + extra-time buffer)
  const duration = BigInt(fixture.kickoffIn + 7200);

  const hash = await walletClient.writeContract({
    address:      MARKET_ADDRESS,
    abi:          MARKET_ABI,
    functionName: "createMarket",
    args: [
      1,                 // marketType = SPORTS_MATCH
      fixture.question,
      duration,
      fixture.initialOption,
      ONE_USDC,
      ZERO_ADDRESS,      // no oracle for sports markets
    ],
  });

  console.log(`  Tx submitted: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`createMarket reverted: ${hash}`);

  // Parse MarketCreated event to get marketId
  const logs = parseEventLogs({
    abi:  MARKET_ABI,
    logs: receipt.logs,
  });
  const event = logs.find((l) => l.eventName === "MarketCreated");
  const marketId = event ? event.args.marketId : "unknown";

  return { marketId, hash };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Agent wallet: ${account.address}`);
  console.log(`Market contract: ${MARKET_ADDRESS}`);
  console.log(`Network: Base Sepolia\n`);

  await checkBalance();
  await ensureAllowance();

  console.log(`\nCreating ${FIXTURES.length} World Cup 2026 markets...\n`);

  for (let i = 0; i < FIXTURES.length; i++) {
    const fixture = FIXTURES[i];
    const kickoffTime = new Date((NOW + fixture.kickoffIn) * 1000).toISOString();
    const betLabel    = fixture.initialOption === 1 ? "Team A" : "Team B";

    console.log(`[${i + 1}/${FIXTURES.length}] ${fixture.question}`);
    console.log(`  Kickoff: ~${kickoffTime}`);
    console.log(`  Agent bets: ${betLabel} (option ${fixture.initialOption})`);

    try {
      const { marketId, hash } = await createMarket(fixture);
      console.log(`  Market ID: ${marketId}`);
      console.log(`  Explorer: https://base-sepolia.blockscout.com/tx/${hash}\n`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}\n`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
