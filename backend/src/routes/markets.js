import { Router } from "express";
import {
  getOpenMarkets, getMarketById, getPositionsByWallet,
  getSettledMarkets, getSportsMarketsForResolution,
} from "../db.js";

const router = Router();

// GET /api/markets?status=open
router.get("/", (req, res) => {
  try {
    const markets = getOpenMarkets();
    // Parse BigInt-stored strings back to numbers for JSON
    const parsed = markets.map((m) => ({
      ...m,
      option_a_total: m.option_a_total,
      option_b_total: m.option_b_total,
      total_pot: m.total_pot,
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/markets/positions/:wallet  — must be before /:marketId
router.get("/positions/:wallet", (req, res) => {
  try {
    const positions = getPositionsByWallet(req.params.wallet);
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/markets/settled
router.get("/settled", (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    res.json(getSettledMarkets(limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/markets/resolve-queue (sports markets past deadline needing resolution)
router.get("/resolve-queue", (req, res) => {
  try {
    res.json(getSportsMarketsForResolution());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/markets/:marketId
router.get("/:marketId", (req, res) => {
  try {
    const market = getMarketById(Number(req.params.marketId));
    if (!market) return res.status(404).json({ error: "Market not found" });
    res.json(market);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
