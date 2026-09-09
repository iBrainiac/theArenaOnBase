import { Router } from "express";
import {
  getOpenMarkets, getMarketById, getPositionsByWallet,
  getSettledMarkets, getSportsMarketsForResolution,
} from "../db.js";

const router = Router();

function parseChainId(req) {
  const raw = req.query.chainId;
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

router.get("/", (req, res) => {
  try {
    const markets = getOpenMarkets(parseChainId(req));
    res.json(markets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/positions/:wallet", (req, res) => {
  try {
    const positions = getPositionsByWallet(req.params.wallet, parseChainId(req));
    res.json(positions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/settled", (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 100);
    res.json(getSettledMarkets(limit, parseChainId(req)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/resolve-queue", (req, res) => {
  try {
    res.json(getSportsMarketsForResolution(parseChainId(req)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:marketId", (req, res) => {
  try {
    const market = getMarketById(Number(req.params.marketId), parseChainId(req));
    if (!market) return res.status(404).json({ error: "Market not found" });
    res.json(market);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
