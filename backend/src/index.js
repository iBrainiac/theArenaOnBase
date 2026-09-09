import "dotenv/config";
import express from "express";
import cors from "cors";
import { paymentMiddleware } from "x402-express";
import marketsRouter from "./routes/markets.js";
import streaksRouter from "./routes/streaks.js";
import { startListener } from "./listener.js";
import { LISTENERS } from "./chains.js";

const app  = express();
const PORT = process.env.PORT || 3001;

// Allow the deployed frontend origin plus localhost dev
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (allowedOrigins.some((o) => origin.startsWith(o))) return cb(null, true)
    if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json());

// ── x402 — protects agent write endpoints ────────────────────────────────────
// Agents that POST to these endpoints pay 1 USDC via x402 before the backend
// can relay the action. For Phase 2 testnet the agent calls the contract directly;
// these endpoints exist for future production use.
if (process.env.TREASURY_ADDRESS) {
  app.use(
    paymentMiddleware(
      process.env.TREASURY_ADDRESS,
      {
        "/api/action/createMarket": {
          price: "$1",
          network: "base-sepolia",
          config: { description: "Create a BTC prediction market" },
        },
        "/api/action/joinMarket": {
          price: "$1",
          network: "base-sepolia",
          config: { description: "Join a BTC prediction market" },
        },
      },
      { facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator" }
    )
  );
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/markets", marketsRouter);
app.use("/api", streaksRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// x402 relay stubs — agent calls contract directly in Phase 2, these forward data only
app.post("/api/action/createMarket", (req, res) => {
  // x402 already validated by middleware above
  const agentAddress = req.payment?.payload?.authorization?.from;
  res.json({ status: "received", agent: agentAddress, note: "Call contract directly in Phase 2" });
});

app.post("/api/action/joinMarket", (req, res) => {
  const agentAddress = req.payment?.payload?.authorization?.from;
  res.json({ status: "received", agent: agentAddress, note: "Call contract directly in Phase 2" });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

for (const listener of LISTENERS) {
  startListener(listener);
}
