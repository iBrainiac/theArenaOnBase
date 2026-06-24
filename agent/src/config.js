import "dotenv/config";

export const RPC_URL       = process.env.BASE_SEPOLIA_RPC || "https://sepolia.base.org";
export const PRIVATE_KEY   = process.env.PRIVATE_KEY;
export const BACKEND_URL   = process.env.BACKEND_URL || "http://localhost:3001";

export const MARKET_ADDRESS  = process.env.AGENT_MARKET_ADDRESS;
export const USDC_ADDRESS    = process.env.USDC_ADDRESS;
export const CHAINLINK_FEED  = process.env.CHAINLINK_BTC_USD;
export const UMA_ADDRESS     = process.env.UMA_ORACLE_ADDRESS || "0x0F7fC5E6482f096380db6158f978167b57388deE";
export const UMA_BOND        = 5_000_000n; // 5 USDC

export const MIN_BET_USDC       = Number(process.env.MIN_BET_USDC || "1");
export const MIN_BET_RAW        = BigInt(MIN_BET_USDC) * 1_000_000n; // 6 decimals
export const MARKET_DURATION    = Number(process.env.MARKET_DURATION_SECS || "3600");
export const MAX_OPEN_POSITIONS = 3;

// MarketStatus enum mirrors AgentMarket.sol
export const STATUS = { OPEN: 0, LIVE: 1, SETTLED: 2, CANCELLED: 3 };
// Option enum
export const OPTION = { UP: 1, DOWN: 2 };

if (!PRIVATE_KEY)    throw new Error("PRIVATE_KEY missing from .env");
if (!MARKET_ADDRESS) throw new Error("AGENT_MARKET_ADDRESS missing from .env");
if (!USDC_ADDRESS)   throw new Error("USDC_ADDRESS missing from .env");
if (!CHAINLINK_FEED) throw new Error("CHAINLINK_BTC_USD missing from .env");
