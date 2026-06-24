import { Router } from "express";
import {
  getOpenMarkets, getMarketById, getPositionsByWallet,
  getSettledMarkets, getSportsMarketsForResolution,
  recordSportsResult, getPendingProposals, getFinalizableAssertions,
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

// GET /api/markets/pending-proposals — sports markets with admin-entered result, not yet proposed
router.get("/pending-proposals", (req, res) => {
  try {
    res.json(getPendingProposals());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/markets/finalizable-assertions — UMA assertions past liveness, ready to settle
router.get("/finalizable-assertions", (req, res) => {
  try {
    res.json(getFinalizableAssertions());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/markets/:marketId/result — admin records match result for agent to propose
router.post("/:marketId/result", (req, res) => {
  try {
    const marketId = Number(req.params.marketId);
    const { outcome } = req.body;
    if (![1, 2, 3].includes(Number(outcome))) {
      return res.status(400).json({ error: "outcome must be 1 (Team A), 2 (Team B), or 3 (Draw)" });
    }
    recordSportsResult(marketId, Number(outcome));
    res.json({ ok: true, marketId, outcome: Number(outcome) });
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
