import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// On Railway: mount a persistent volume at /data and set DB_PATH=/data/arena.db
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../../streaks.db");
const db = new Database(DB_PATH);

const BASE_SEPOLIA_ID = 84532;

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

try { db.exec(`ALTER TABLE markets ADD COLUMN option_c_total TEXT DEFAULT '0'`); } catch (_) {}

function tableHasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function migrateChainId() {
  if (!tableHasColumn("markets", "chain_id")) {
    db.exec(`
      CREATE TABLE markets_v2 (
        chain_id        INTEGER NOT NULL,
        market_id       INTEGER NOT NULL,
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
        oracle_address  TEXT,
        PRIMARY KEY (chain_id, market_id)
      );
      INSERT INTO markets_v2 (
        chain_id, market_id, market_type, question, option_a_total, option_b_total,
        option_c_total, total_pot, status, winning_option, deadline, created_at, oracle_address
      )
      SELECT ${BASE_SEPOLIA_ID}, market_id, market_type, question, option_a_total, option_b_total,
        COALESCE(option_c_total, '0'), total_pot, status, winning_option, deadline, created_at, oracle_address
      FROM markets;
      DROP TABLE markets;
      ALTER TABLE markets_v2 RENAME TO markets;

      CREATE TABLE positions_v2 (
        chain_id         INTEGER NOT NULL,
        market_id        INTEGER NOT NULL,
        wallet_address   TEXT NOT NULL,
        option           INTEGER,
        amount           TEXT,
        withdrawn        INTEGER DEFAULT 0,
        participant_type TEXT DEFAULT 'human',
        PRIMARY KEY (chain_id, market_id, wallet_address)
      );
      INSERT INTO positions_v2 (
        chain_id, market_id, wallet_address, option, amount, withdrawn, participant_type
      )
      SELECT ${BASE_SEPOLIA_ID}, market_id, wallet_address, option, amount, withdrawn, participant_type
      FROM positions;
      DROP TABLE positions;
      ALTER TABLE positions_v2 RENAME TO positions;
    `);
  }

  if (!tableHasColumn("market_history", "chain_id")) {
    try { db.exec(`ALTER TABLE market_history ADD COLUMN chain_id INTEGER DEFAULT ${BASE_SEPOLIA_ID}`); } catch (_) {}
  }

  if (!tableHasColumn("sports_results", "chain_id")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sports_results (
        market_id   INTEGER PRIMARY KEY,
        outcome     INTEGER,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE sports_results_v2 (
        chain_id    INTEGER NOT NULL,
        market_id   INTEGER NOT NULL,
        outcome     INTEGER,
        recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chain_id, market_id)
      );
      INSERT INTO sports_results_v2 (chain_id, market_id, outcome, recorded_at)
      SELECT ${BASE_SEPOLIA_ID}, market_id, outcome, recorded_at FROM sports_results;
      DROP TABLE sports_results;
      ALTER TABLE sports_results_v2 RENAME TO sports_results;
    `);
  }

  if (!tableHasColumn("pending_assertions", "chain_id")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pending_assertions (
        assertion_id    TEXT PRIMARY KEY,
        market_id       INTEGER,
        proposed_option INTEGER,
        proposer        TEXT,
        expires_at      INTEGER,
        settled         INTEGER DEFAULT 0
      );
      CREATE TABLE pending_assertions_v2 (
        assertion_id    TEXT PRIMARY KEY,
        chain_id        INTEGER NOT NULL DEFAULT ${BASE_SEPOLIA_ID},
        market_id       INTEGER,
        proposed_option INTEGER,
        proposer        TEXT,
        expires_at      INTEGER,
        settled         INTEGER DEFAULT 0
      );
      INSERT INTO pending_assertions_v2 (
        assertion_id, chain_id, market_id, proposed_option, proposer, expires_at, settled
      )
      SELECT assertion_id, ${BASE_SEPOLIA_ID}, market_id, proposed_option, proposer, expires_at, settled
      FROM pending_assertions;
      DROP TABLE pending_assertions;
      ALTER TABLE pending_assertions_v2 RENAME TO pending_assertions;
    `);
  }
}

migrateChainId();

export function upsertMarket(m) {
  db.prepare(`
    INSERT INTO markets (chain_id, market_id, market_type, question, option_a_total, option_b_total,
      option_c_total, total_pot, status, winning_option, deadline, created_at, oracle_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chain_id, market_id) DO UPDATE SET
      option_a_total = excluded.option_a_total,
      option_b_total = excluded.option_b_total,
      option_c_total = excluded.option_c_total,
      total_pot      = excluded.total_pot,
      status         = excluded.status,
      winning_option = excluded.winning_option
  `).run(
    m.chainId, m.marketId, m.marketType, m.question,
    m.totalOptionA.toString(), m.totalOptionB.toString(), m.totalOptionC.toString(),
    m.totalPot.toString(), m.status, m.winningOption, m.deadline, m.createdAt, m.oracleAddress
  );
}

export function getOpenMarkets(chainId) {
  if (chainId) {
    return db.prepare(`
      SELECT * FROM markets
      WHERE chain_id = ?
        AND (
          status = 1
          OR (status = 0 AND deadline > strftime('%s', 'now'))
        )
      ORDER BY created_at DESC
    `).all(chainId);
  }
  return db.prepare(`
    SELECT * FROM markets
    WHERE
      status = 1
      OR (status = 0 AND deadline > strftime('%s', 'now'))
    ORDER BY created_at DESC
  `).all();
}

export function getMarketById(marketId, chainId) {
  if (chainId) {
    return db.prepare(`SELECT * FROM markets WHERE chain_id = ? AND market_id = ?`).get(chainId, marketId);
  }
  return db.prepare(`SELECT * FROM markets WHERE market_id = ?`).get(marketId);
}

export function updateMarketStatus(chainId, marketId, status, winningOption = 0) {
  db.prepare(
    `UPDATE markets SET status = ?, winning_option = ? WHERE chain_id = ? AND market_id = ?`
  ).run(status, winningOption, chainId, marketId);
}

export function upsertPosition(chainId, marketId, wallet, option, amount, type = "human") {
  db.prepare(`
    INSERT INTO positions (chain_id, market_id, wallet_address, option, amount, participant_type)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(chain_id, market_id, wallet_address) DO UPDATE SET
      amount = CAST(CAST(amount AS INTEGER) + ? AS TEXT)
  `).run(chainId, marketId, wallet.toLowerCase(), option, amount.toString(), type, amount.toString());
}

export function getPositionsForMarket(chainId, marketId) {
  return db.prepare(
    `SELECT * FROM positions WHERE chain_id = ? AND market_id = ?`
  ).all(chainId, marketId);
}

export function getPositionsByWallet(wallet, chainId) {
  if (chainId) {
    return db.prepare(`
      SELECT p.*, m.question, m.market_type, m.status, m.winning_option,
             m.deadline, m.total_pot, m.option_a_total, m.option_b_total, m.option_c_total
      FROM positions p
      JOIN markets m ON p.chain_id = m.chain_id AND p.market_id = m.market_id
      WHERE p.wallet_address = ? AND p.chain_id = ?
      ORDER BY m.created_at DESC
    `).all(wallet.toLowerCase(), chainId);
  }
  return db.prepare(`
    SELECT p.*, m.question, m.market_type, m.status, m.winning_option,
           m.deadline, m.total_pot, m.option_a_total, m.option_b_total, m.option_c_total
    FROM positions p
    JOIN markets m ON p.chain_id = m.chain_id AND p.market_id = m.market_id
    WHERE p.wallet_address = ?
    ORDER BY m.created_at DESC
  `).all(wallet.toLowerCase());
}

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

export function recordHistory(chainId, marketId, wallet, outcome, amount) {
  db.prepare(`
    INSERT INTO market_history (chain_id, market_id, wallet_address, outcome, amount)
    VALUES (?, ?, ?, ?, ?)
  `).run(chainId, marketId, wallet.toLowerCase(), outcome, amount.toString());
}

export function getSettledMarkets(limit = 50, chainId) {
  if (chainId) {
    return db.prepare(
      `SELECT * FROM markets WHERE chain_id = ? AND status = 2 ORDER BY created_at DESC LIMIT ?`
    ).all(chainId, limit);
  }
  return db.prepare(
    `SELECT * FROM markets WHERE status = 2 ORDER BY created_at DESC LIMIT ?`
  ).all(limit);
}

export function getSportsMarketsForResolution(chainId) {
  const now = Math.floor(Date.now() / 1000);
  if (chainId) {
    return db.prepare(
      `SELECT * FROM markets
       WHERE chain_id = ? AND market_type = 1 AND status = 1 AND deadline < ?
       ORDER BY deadline ASC`
    ).all(chainId, now);
  }
  return db.prepare(
    `SELECT * FROM markets
     WHERE market_type = 1 AND status = 1 AND deadline < ?
     ORDER BY deadline ASC`
  ).all(now);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS sports_results (
    chain_id    INTEGER NOT NULL DEFAULT ${BASE_SEPOLIA_ID},
    market_id   INTEGER NOT NULL,
    outcome     INTEGER,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chain_id, market_id)
  );

  CREATE TABLE IF NOT EXISTS pending_assertions (
    assertion_id    TEXT PRIMARY KEY,
    chain_id        INTEGER NOT NULL DEFAULT ${BASE_SEPOLIA_ID},
    market_id       INTEGER,
    proposed_option INTEGER,
    proposer        TEXT,
    expires_at      INTEGER,
    settled         INTEGER DEFAULT 0
  );
`);

export function recordSportsResult(chainId, marketId, outcome) {
  db.prepare(
    `INSERT OR REPLACE INTO sports_results (chain_id, market_id, outcome) VALUES (?, ?, ?)`
  ).run(chainId, marketId, outcome);
}

export function getPendingProposals() {
  return db.prepare(`
    SELECT sr.chain_id, sr.market_id, sr.outcome, m.question
    FROM sports_results sr
    JOIN markets m ON sr.chain_id = m.chain_id AND sr.market_id = m.market_id
    WHERE m.status = 1
      AND NOT EXISTS (
        SELECT 1 FROM pending_assertions pa
        WHERE pa.settled = 0 AND pa.chain_id = sr.chain_id AND pa.market_id = sr.market_id
      )
  `).all();
}

export function recordAssertion(assertionId, chainId, marketId, proposedOption, proposer, expiresAt) {
  db.prepare(`
    INSERT OR IGNORE INTO pending_assertions
      (assertion_id, chain_id, market_id, proposed_option, proposer, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(assertionId, chainId, marketId, proposedOption, proposer.toLowerCase(), expiresAt);
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

export function markWithdrawn(chainId, marketId, walletAddress) {
  db.prepare(
    `UPDATE positions SET withdrawn = 1 WHERE chain_id = ? AND market_id = ? AND wallet_address = ?`
  ).run(chainId, marketId, walletAddress.toLowerCase());
}

export default db;
