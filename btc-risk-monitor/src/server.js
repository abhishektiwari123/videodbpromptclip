require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const logger = require('./utils/logger');
const db = require('./db/sqlite');
const riskEngine = require('./scoring/risk-engine');
const coingecko = require('./data/coingecko');
const feargreed = require('./data/feargreed');
const openInterest = require('./data/open-interest');
const etfFlows = require('./data/etf-flows');
const macroEvents = require('./data/macro-events');
const newsScanner = require('./data/news-scanner');
const telegramBot = require('./alerts/telegram-bot');
const cronJobs = require('./scheduler/cron-jobs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve React frontend (built files)
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// --- API Routes ---

// GET /api/status — Current risk score (latest from DB or calculate fresh)
app.get('/api/status', async (req, res) => {
  try {
    const fresh = req.query.fresh === 'true';
    if (fresh) {
      const result = await riskEngine.calculateRiskScore();
      return res.json(result);
    }

    const latest = db.getLatestScore();
    if (latest) {
      return res.json({
        total: latest.total_score,
        signal: latest.signal,
        timestamp: latest.timestamp,
        scores: {
          fearGreed: latest.fear_greed,
          etfFlows: latest.etf_flows,
          movingAverage: latest.moving_average,
          supportDistance: latest.support_distance,
          openInterest: latest.open_interest,
          macroEvents: latest.macro_events,
          dayOfWeek: latest.day_of_week
        },
        rawData: {
          btcPrice: latest.btc_price,
          ma200: latest.ma200,
          fgi: latest.fgi_value,
          etfFlow: latest.etf_flow_value,
          oiChange: latest.oi_change_value
        },
        manualOverride: latest.manual_override,
        maxScore: 70,
        signalText: getSignalText(latest.signal)
      });
    }

    // No data yet, calculate fresh
    const result = await riskEngine.calculateRiskScore();
    res.json(result);
  } catch (err) {
    logger.error('API /status error', { error: err.message });
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// POST /api/calculate — Force fresh calculation
app.post('/api/calculate', async (req, res) => {
  try {
    const result = await riskEngine.calculateRiskScore();
    res.json(result);
  } catch (err) {
    logger.error('API /calculate error', { error: err.message });
    res.status(500).json({ error: 'Calculation failed' });
  }
});

// GET /api/price — Current BTC price data
app.get('/api/price', async (req, res) => {
  try {
    const btcData = await coingecko.getBTCData();
    res.json(btcData);
  } catch (err) {
    logger.error('API /price error', { error: err.message });
    res.status(500).json({ error: 'Failed to get price' });
  }
});

// GET /api/scores/history — Historical risk scores
app.get('/api/scores/history', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const scores = db.getRecentScores(Math.min(days, 90));
    res.json(scores);
  } catch (err) {
    logger.error('API /scores/history error', { error: err.message });
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// GET /api/prices/history — Historical price data
app.get('/api/prices/history', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const prices = db.getRecentPrices(Math.min(days, 90));
    res.json(prices);
  } catch (err) {
    logger.error('API /prices/history error', { error: err.message });
    res.status(500).json({ error: 'Failed to get price history' });
  }
});

// GET /api/calendar — Upcoming macro events
app.get('/api/calendar', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const events = macroEvents.getEventsInRange(days);
    res.json(events);
  } catch (err) {
    logger.error('API /calendar error', { error: err.message });
    res.status(500).json({ error: 'Failed to get calendar' });
  }
});

// GET /api/news — Recent flagged news
app.get('/api/news', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const news = newsScanner.getRecentFlaggedNews(Math.min(limit, 50));
    res.json(news);
  } catch (err) {
    logger.error('API /news error', { error: err.message });
    res.status(500).json({ error: 'Failed to get news' });
  }
});

// GET /api/support — Get support levels
app.get('/api/support', (req, res) => {
  try {
    const levels = riskEngine.getSupportLevels();
    res.json(levels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get support levels' });
  }
});

// PUT /api/support — Update support levels
app.put('/api/support', (req, res) => {
  try {
    const { supports } = req.body;
    if (!Array.isArray(supports)) {
      return res.status(400).json({ error: 'supports must be an array of numbers' });
    }
    const result = riskEngine.updateSupportLevels(supports);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update support levels' });
  }
});

// POST /api/etf — Set ETF flow
app.post('/api/etf', (req, res) => {
  try {
    const { flow, date } = req.body;
    if (typeof flow !== 'number') {
      return res.status(400).json({ error: 'flow must be a number (in millions)' });
    }
    const result = etfFlows.setETFFlow(flow, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to set ETF flow' });
  }
});

// POST /api/override — Set manual override
app.post('/api/override', (req, res) => {
  try {
    const { signal } = req.body;
    const success = riskEngine.setManualOverride(signal);
    if (success) {
      res.json({ success: true, signal });
    } else {
      res.status(400).json({ error: 'Invalid signal. Use GREEN, YELLOW, ORANGE, RED, or none' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to set override' });
  }
});

// SPA fallback — serve frontend for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

// Helper
function getSignalText(signal) {
  const map = {
    GREEN: 'SAFE TO DEPLOY',
    YELLOW: 'DEPLOY WITH CAUTION (half size)',
    ORANGE: 'DO NOT DEPLOY new capital',
    RED: 'PAUSE STRATEGY'
  };
  return map[signal] || signal;
}

// --- Start Server ---
async function start() {
  // Initialize database
  db.initTables();

  // Start Express server
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  // Initialize Telegram bot
  telegramBot.initBot();

  // Start cron jobs
  cronJobs.startAllJobs();

  // Run initial news scan
  newsScanner.scanFeeds().catch(err => {
    logger.warn('Initial news scan failed', { error: err.message });
  });

  // Run initial risk score calculation
  try {
    const result = await riskEngine.calculateRiskScore();
    logger.info(`Initial risk score: ${result.total}/${result.maxScore} - ${result.signal}`);
  } catch (err) {
    logger.warn('Initial risk score calculation failed', { error: err.message });
  }
}

start().catch(err => {
  logger.error('Failed to start server', { error: err.message, stack: err.stack });
  process.exit(1);
});
