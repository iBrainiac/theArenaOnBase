import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Railway: mount a persistent volume at /data and set DB_PATH=/data/arena.db
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../streaks.db");
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS markets (
    market_id       INTEGER PRIMARY KEY,
    market_type     INTEGER,
    question        TEXT,
    option_a_total  TEXT DEFAULT '0',
    option_b_total  TEXT DEFAULT '0',
    option_c_total  TEXT DEFAULT '0',
    total_pot       TEXT DEFAULT '0',
    status          INTEGER DEFAULT 0,
    winning_option  INTEGER DEFAULT 0,
    deadline        INTEGER,
    created_at      INTEGER,
    oracle_address  TEXT
  );

  CREATE TABLE IF NOT EXISTS positions (
    market_id       INTEGER,
    wallet_address  TEXT,
    option          INTEGER,
    amount          TEXT,
    withdrawn       INTEGER DEFAULT 0,
    participant_type TEXT DEFAULT 'human',
    PRIMARY KEY (market_id, wallet_address)
  );

  CREATE TABLE IF NOT EXISTS streaks (
    wallet_address  TEXT PRIMARY KEY,
    current_streak  INTEGER DEFAULT 0,
    longest_streak  INTEGER DEFAULT 0,
    total_wins      INTEGER DEFAULT 0,
    total_losses    INTEGER DEFAULT 0,
    participant_type TEXT DEFAULT 'human',
    last_updated    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS market_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id       INTEGER,
    wallet_address  TEXT,
    outcome         TEXT,
    amount          TEXT,
    settled_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Markets ───────────────────────────────────────────────────────────────────

// Migration: add option_c_total for existing DBs created before the Draw update
try { db.exec(`ALTER TABLE markets ADD COLUMN option_c_total TEXT DEFAULT '0'`); } catch (_) {}

export function upsertMarket(m) {
  db.prepare(`
    INSERT INTO markets (market_id, market_type, question, option_a_total, option_b_total,
      option_c_total, total_pot, status, winning_option, deadline, created_at, oracle_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(market_id) DO UPDATE SET
      option_a_total = excluded.option_a_total,
      option_b_total = excluded.option_b_total,
      option_c_total = excluded.option_c_total,
      total_pot      = excluded.total_pot,
      status         = excluded.status,
      winning_option = excluded.winning_option
  `).run(
    m.marketId, m.marketType, m.question,
    m.totalOptionA.toString(), m.totalOptionB.toString(), m.totalOptionC.toString(),
    m.totalPot.toString(), m.status, m.winningOption, m.deadline, m.createdAt, m.oracleAddress
  );
}

export function getOpenMarkets() {
  return db.prepare(`
    SELECT m.*,
      sr.outcome        AS pending_result,
      pa.assertion_id   AS assertion_id,
      pa.expires_at     AS assertion_expires_at
    FROM markets m
    LEFT JOIN sports_results sr ON sr.market_id = m.market_id
    LEFT JOIN pending_assertions pa
      ON pa.market_id = m.market_id AND pa.settled = 0
    WHERE
      m.status = 1
      OR (m.status = 0 AND m.deadline > strftime('%s', 'now'))
    ORDER BY m.created_at DESC
  `).all();
}

export function getMarketById(marketId) {
  return db.prepare(`SELECT * FROM markets WHERE market_id = ?`).get(marketId);
}

export function updateMarketStatus(marketId, status, winningOption = 0) {
  db.prepare(
    `UPDATE markets SET status = ?, winning_option = ? WHERE market_id = ?`
  ).run(status, winningOption, marketId);
}

// ── Positions ─────────────────────────────────────────────────────────────────

export function upsertPosition(marketId, wallet, option, amount, type = "human") {
  db.prepare(`
    INSERT INTO positions (market_id, wallet_address, option, amount, participant_type)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(market_id, wallet_address) DO UPDATE SET
      amount = CAST(CAST(amount AS INTEGER) + ? AS TEXT)
  `).run(marketId, wallet.toLowerCase(), option, amount.toString(), type, amount.toString());
}

export function getPositionsForMarket(marketId) {
  return db.prepare(
    `SELECT * FROM positions WHERE market_id = ?`
  ).all(marketId);
}

export function getPositionsByWallet(wallet) {
  return db.prepare(`
    SELECT p.*, m.question, m.market_type, m.status, m.winning_option,
           m.deadline, m.total_pot, m.option_a_total, m.option_b_total, m.option_c_total
    FROM positions p
    JOIN markets m ON p.market_id = m.market_id
    WHERE p.wallet_address = ?
    ORDER BY m.created_at DESC
  `).all(wallet.toLowerCase());
}

// ── Streaks ───────────────────────────────────────────────────────────────────

export function incrementStreak(wallet, type = "human") {
  db.prepare(`
    INSERT INTO streaks (wallet_address, current_streak, longest_streak, total_wins, participant_type)
    VALUES (?, 1, 1, 1, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      current_streak  = current_streak + 1,
      longest_streak  = MAX(longest_streak, current_streak + 1),
      total_wins      = total_wins + 1,
      last_updated    = CURRENT_TIMESTAMP
  `).run(wallet.toLowerCase(), type);
}

export function resetStreak(wallet, type = "human") {
  db.prepare(`
    INSERT INTO streaks (wallet_address, current_streak, total_losses, participant_type)
    VALUES (?, 0, 1, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      current_streak = 0,
      total_losses   = total_losses + 1,
      last_updated   = CURRENT_TIMESTAMP
  `).run(wallet.toLowerCase(), type);
}

export function getStreak(wallet) {
  return db.prepare(
    `SELECT * FROM streaks WHERE wallet_address = ?`
  ).get(wallet.toLowerCase());
}

export function getLeaderboard(type = null, limit = 10) {
  const q = type
    ? `SELECT * FROM streaks WHERE participant_type = ? ORDER BY current_streak DESC LIMIT ?`
    : `SELECT * FROM streaks ORDER BY current_streak DESC LIMIT ?`;
  return db.prepare(q).all(...(type ? [type, limit] : [limit]));
}

export function getBadges(longestStreak) {
  const badges = [];
  if (longestStreak >= 3)  badges.push({ emoji: "🔥", label: "On Fire",  threshold: 3  });
  if (longestStreak >= 7)  badges.push({ emoji: "⚡", label: "Electric", threshold: 7  });
  if (longestStreak >= 14) badges.push({ emoji: "👑", label: "Crowned",  threshold: 14 });
  if (longestStreak >= 30) badges.push({ emoji: "🏆", label: "Legend",   threshold: 30 });
  return badges;
}

export function recordHistory(marketId, wallet, outcome, amount) {
  db.prepare(`
    INSERT INTO market_history (market_id, wallet_address, outcome, amount)
    VALUES (?, ?, ?, ?)
  `).run(marketId, wallet.toLowerCase(), outcome, amount.toString());
}

export function getSettledMarkets(limit = 50) {
  return db.prepare(
    `SELECT * FROM markets WHERE status = 2 ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
}

export function getSportsMarketsForResolution() {
  const now = Math.floor(Date.now() / 1000);
  return db.prepare(
    `SELECT * FROM markets
     WHERE market_type = 1 AND status = 1 AND deadline < ?
     ORDER BY deadline ASC`
  ).all(now);
}

// ── Sports results (admin-entered, queued for agent to propose via UMA) ────────

db.exec(`
  CREATE TABLE IF NOT EXISTS sports_results (
    market_id   INTEGER PRIMARY KEY,
    outcome     INTEGER,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pending_assertions (
    assertion_id    TEXT PRIMARY KEY,
    market_id       INTEGER,
    proposed_option INTEGER,
    proposer        TEXT,
    expires_at      INTEGER,
    settled         INTEGER DEFAULT 0
  );
`);

export function recordSportsResult(marketId, outcome) {
  db.prepare(
    `INSERT OR REPLACE INTO sports_results (market_id, outcome) VALUES (?, ?)`
  ).run(marketId, outcome);
}

export function getPendingProposals() {
  return db.prepare(`
    SELECT sr.market_id, sr.outcome, m.question
    FROM sports_results sr
    JOIN markets m ON sr.market_id = m.market_id
    WHERE m.status = 1
      AND sr.market_id NOT IN (
        SELECT market_id FROM pending_assertions WHERE settled = 0
      )
  `).all();
}

export function recordAssertion(assertionId, marketId, proposedOption, proposer, expiresAt) {
  db.prepare(`
    INSERT OR IGNORE INTO pending_assertions
      (assertion_id, market_id, proposed_option, proposer, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(assertionId, marketId, proposedOption, proposer.toLowerCase(), expiresAt);
}

export function getFinalizableAssertions() {
  const now = Math.floor(Date.now() / 1000);
  return db.prepare(
    `SELECT * FROM pending_assertions WHERE settled = 0 AND expires_at <= ?`
  ).all(now);
}

export function markAssertionSettled(assertionId) {
  db.prepare(
    `UPDATE pending_assertions SET settled = 1 WHERE assertion_id = ?`
  ).run(assertionId);
}

export function markWithdrawn(marketId, walletAddress) {
  db.prepare(
    `UPDATE positions SET withdrawn = 1 WHERE market_id = ? AND wallet_address = ?`
  ).run(marketId, walletAddress.toLowerCase());
}

export default db;
