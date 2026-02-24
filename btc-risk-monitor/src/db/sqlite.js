const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'risk-monitor.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

function initTables() {
  const d = getDb();

  d.exec(`
    CREATE TABLE IF NOT EXISTS risk_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      total_score INTEGER NOT NULL,
      signal TEXT NOT NULL,
      fear_greed INTEGER,
      etf_flows INTEGER,
      moving_average INTEGER,
      support_distance INTEGER,
      open_interest INTEGER,
      macro_events INTEGER,
      day_of_week INTEGER,
      btc_price REAL,
      ma200 REAL,
      fgi_value INTEGER,
      etf_flow_value REAL,
      oi_change_value REAL,
      manual_override TEXT
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      price REAL NOT NULL,
      change_24h REAL,
      change_7d REAL,
      ma200 REAL
    );

    CREATE TABLE IF NOT EXISTS news_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      title TEXT NOT NULL,
      link TEXT,
      source TEXT,
      matched_keywords TEXT
    );

    CREATE TABLE IF NOT EXISTS etf_flows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      flow_millions REAL NOT NULL,
      source TEXT DEFAULT 'manual'
    );

    CREATE TABLE IF NOT EXISTS flash_crash_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      severity TEXT NOT NULL,
      drop_percent REAL NOT NULL,
      timeframe TEXT NOT NULL,
      price_at_alert REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_risk_scores_timestamp ON risk_scores(timestamp);
    CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_news_items_timestamp ON news_items(timestamp);
  `);

  // Initialize default settings
  const insertSetting = d.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  insertSetting.run('alerts_enabled', 'true');
  insertSetting.run('manual_override', 'none');

  logger.info('Database initialized successfully');
}

// Risk Scores
function saveRiskScore(scoreData) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO risk_scores (
      timestamp, total_score, signal,
      fear_greed, etf_flows, moving_average, support_distance,
      open_interest, macro_events, day_of_week,
      btc_price, ma200, fgi_value, etf_flow_value, oi_change_value, manual_override
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    scoreData.timestamp,
    scoreData.total,
    scoreData.signal,
    scoreData.scores.fearGreed,
    scoreData.scores.etfFlows,
    scoreData.scores.movingAverage,
    scoreData.scores.supportDistance,
    scoreData.scores.openInterest,
    scoreData.scores.macroEvents,
    scoreData.scores.dayOfWeek,
    scoreData.rawData?.btcPrice || null,
    scoreData.rawData?.ma200 || null,
    scoreData.rawData?.fgi || null,
    scoreData.rawData?.etfFlow || null,
    scoreData.rawData?.oiChange || null,
    scoreData.manualOverride || null
  );
}

function getRecentScores(days = 30) {
  const d = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d.prepare(`
    SELECT * FROM risk_scores
    WHERE timestamp > ?
    ORDER BY timestamp DESC
  `).all(cutoff.toISOString());
}

function getLatestScore() {
  const d = getDb();
  return d.prepare('SELECT * FROM risk_scores ORDER BY timestamp DESC LIMIT 1').get();
}

// Price History
function savePriceHistory(priceData) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO price_history (timestamp, price, change_24h, change_7d, ma200)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(
    priceData.timestamp,
    priceData.price,
    priceData.change24h,
    priceData.change7d,
    priceData.ma200
  );
}

function getRecentPrices(days = 30) {
  const d = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d.prepare(`
    SELECT * FROM price_history
    WHERE timestamp > ?
    ORDER BY timestamp ASC
  `).all(cutoff.toISOString());
}

function getLatestPrice() {
  const d = getDb();
  return d.prepare('SELECT * FROM price_history ORDER BY timestamp DESC LIMIT 1').get();
}

// News Items
function saveNewsItem(item) {
  const d = getDb();
  // Check for duplicate by title
  const existing = d.prepare('SELECT id FROM news_items WHERE title = ?').get(item.title);
  if (existing) return null;

  const stmt = d.prepare(`
    INSERT INTO news_items (timestamp, title, link, source, matched_keywords)
    VALUES (?, ?, ?, ?, ?)
  `);
  return stmt.run(
    item.timestamp,
    item.title,
    item.link,
    item.source,
    item.matchedKeywords
  );
}

function getRecentNews(limit = 10) {
  const d = getDb();
  return d.prepare(`
    SELECT * FROM news_items
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit);
}

// ETF Flows
function saveETFFlow(date, flowMillions, source = 'manual') {
  const d = getDb();
  // Upsert for the date
  const existing = d.prepare('SELECT id FROM etf_flows WHERE date = ?').get(date);
  if (existing) {
    d.prepare('UPDATE etf_flows SET flow_millions = ?, source = ? WHERE date = ?')
      .run(flowMillions, source, date);
  } else {
    d.prepare('INSERT INTO etf_flows (date, flow_millions, source) VALUES (?, ?, ?)')
      .run(date, flowMillions, source);
  }
}

function getLatestETFFlow() {
  const d = getDb();
  return d.prepare('SELECT * FROM etf_flows ORDER BY date DESC LIMIT 1').get();
}

// Flash Crash Alerts
function saveFlashCrashAlert(alert) {
  const d = getDb();
  d.prepare(`
    INSERT INTO flash_crash_alerts (timestamp, severity, drop_percent, timeframe, price_at_alert)
    VALUES (?, ?, ?, ?, ?)
  `).run(alert.timestamp, alert.severity, alert.dropPercent, alert.timeframe, alert.priceAtAlert);
}

// Settings
function getSetting(key) {
  const d = getDb();
  const row = d.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  const d = getDb();
  d.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// Cleanup old data (keep 90 days)
function cleanupOldData() {
  const d = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const iso = cutoff.toISOString();

  d.prepare('DELETE FROM risk_scores WHERE timestamp < ?').run(iso);
  d.prepare('DELETE FROM price_history WHERE timestamp < ?').run(iso);
  d.prepare('DELETE FROM news_items WHERE timestamp < ?').run(iso);
  d.prepare('DELETE FROM flash_crash_alerts WHERE timestamp < ?').run(iso);

  logger.info('Old data cleaned up (older than 90 days)');
}

module.exports = {
  getDb,
  initTables,
  saveRiskScore,
  getRecentScores,
  getLatestScore,
  savePriceHistory,
  getRecentPrices,
  getLatestPrice,
  saveNewsItem,
  getRecentNews,
  saveETFFlow,
  getLatestETFFlow,
  saveFlashCrashAlert,
  getSetting,
  setSetting,
  cleanupOldData
};
