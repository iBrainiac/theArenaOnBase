import { Router } from "express";
import { getLeaderboard, getStreak, getBadges } from "../db.js";

const router = Router();

// GET /api/leaderboard?type=human|agent&limit=10
router.get("/leaderboard", (req, res) => {
  try {
    const { type, limit = "10" } = req.query;
    const rows = getLeaderboard(type || null, parseInt(limit, 10));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/streaks/:wallet
router.get("/streaks/:wallet", (req, res) => {
  try {
    const streak = getStreak(req.params.wallet);
    if (!streak) {
      return res.json({
        wallet_address: req.params.wallet.toLowerCase(),
        current_streak: 0,
        longest_streak: 0,
        total_wins: 0,
        total_losses: 0,
        badges: [],
      });
    }
    res.json({ ...streak, badges: getBadges(streak.longest_streak) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
