const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { formatIST } = require('../utils/time');

const coingecko = require('../data/coingecko');
const feargreed = require('../data/feargreed');
const etfFlows = require('../data/etf-flows');
const openInterest = require('../data/open-interest');
const macroEvents = require('../data/macro-events');
const db = require('../db/sqlite');

const SUPPORT_LEVELS_PATH = path.join(__dirname, '..', 'config', 'support-levels.json');

// --- Scoring Functions ---

function scoreFearGreed(fgi) {
  if (fgi > 25) return 0;
  if (fgi > 15) return 3;
  if (fgi > 10) return 7;
  return 10; // Extreme fear below 10
}

function scoreETFFlows(flowMillions) {
  if (flowMillions > 0) return 0;        // Inflow
  if (flowMillions > -200) return 3;     // Small outflow
  if (flowMillions > -500) return 6;     // Medium outflow
  return 10;                              // Heavy outflow >$500M
}

function score200DMA(currentPrice, ma200, maTrend) {
  if (!currentPrice || !ma200) return 5; // default if no data
  if (currentPrice > ma200 && maTrend === 'rising') return 0;
  if (currentPrice > ma200 && maTrend === 'falling') return 3;
  if (currentPrice < ma200 && maTrend === 'rising') return 5;
  if (currentPrice < ma200 && maTrend === 'falling') return 8;
  return 5;
}

function scoreSupportDistance(currentPrice) {
  if (!currentPrice) return 5;

  let supports;
  try {
    const raw = fs.readFileSync(SUPPORT_LEVELS_PATH, 'utf-8');
    supports = JSON.parse(raw).supports;
  } catch {
    supports = [60000, 58000, 50000, 40000];
  }

  // Sort descending to find nearest support below current price
  const sortedSupports = supports.sort((a, b) => b - a);
  const nearestSupport = sortedSupports.find(s => s < currentPrice) || sortedSupports[sortedSupports.length - 1];
  const distancePercent = ((currentPrice - nearestSupport) / currentPrice) * 100;

  if (distancePercent > 10) return 0;
  if (distancePercent > 5) return 3;
  if (distancePercent > 2) return 7;
  return 10; // At or very near support
}

function scoreOIChange(oiChangePercent) {
  if (Math.abs(oiChangePercent) < 5) return 0;   // Normal
  if (oiChangePercent > 20) return 8;              // Dangerous (check before > 10)
  if (oiChangePercent > 10) return 5;              // Spiking
  if (oiChangePercent < -15) return 4;             // Deleveraging
  return 3;
}

function scoreMacroEvents(events) {
  let score = 0;
  for (const event of events) {
    if (event.hoursAway > 48) continue;
    switch (event.type) {
      case 'FOMC': score += 6; break;
      case 'TARIFF': score += 8; break;
      case 'CPI': score += 4; break;
      case 'NFP': score += 4; break;
      case 'EARNINGS': score += 3; break;
      case 'OPTIONS_EXPIRY': score += 3; break;
      case 'GEOPOLITICAL': score += 5; break;
      default: score += 2; break;
    }
  }
  return Math.min(score, 10);
}

function scoreDayOfWeek() {
  // Use IST day
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60000);
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  if (day >= 2 && day <= 4) return 0;  // Tue-Thu: best liquidity
  if (day === 1) return 2;              // Monday
  if (day === 5) return 4;              // Friday
  return 7;                              // Weekend
}

// --- Main Calculation ---

async function calculateRiskScore() {
  logger.info('Calculating risk score...');
  const errors = [];

  // Fetch all data in parallel
  const [btcData, fgiData, oiData] = await Promise.all([
    coingecko.getBTCData().catch(err => { errors.push('btc_price'); return null; }),
    feargreed.fetchFearGreedIndex().catch(err => { errors.push('fear_greed'); return null; }),
    openInterest.fetchOpenInterest().catch(err => { errors.push('open_interest'); return null; })
  ]);

  const etfData = etfFlows.getLatestETFFlow();
  const upcomingEvents = macroEvents.getUpcomingEvents(48);

  // Extract values with fallbacks
  const btcPrice = btcData?.price || null;
  const ma200 = btcData?.ma200 || null;
  const maTrend = btcData?.maTrend || 'rising';
  const fgi = fgiData?.value ?? 50;
  const etfFlow = etfData?.flowMillions ?? 0;
  const oiChange = oiData?.oiChangePercent ?? 0;

  // Calculate individual scores
  const scores = {
    fearGreed: scoreFearGreed(fgi),
    etfFlows: scoreETFFlows(etfFlow),
    movingAverage: score200DMA(btcPrice, ma200, maTrend),
    supportDistance: scoreSupportDistance(btcPrice),
    openInterest: scoreOIChange(oiChange),
    macroEvents: scoreMacroEvents(upcomingEvents),
    dayOfWeek: scoreDayOfWeek()
  };

  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  // Check for manual override
  const manualOverride = db.getSetting('manual_override');

  let signal;
  if (manualOverride && manualOverride !== 'none') {
    signal = manualOverride;
  } else if (total <= 15) {
    signal = 'GREEN';
  } else if (total <= 30) {
    signal = 'YELLOW';
  } else if (total <= 45) {
    signal = 'ORANGE';
  } else {
    signal = 'RED';
  }

  const signalText = {
    GREEN: 'SAFE TO DEPLOY',
    YELLOW: 'DEPLOY WITH CAUTION (half size)',
    ORANGE: 'DO NOT DEPLOY new capital',
    RED: 'PAUSE STRATEGY'
  };

  const result = {
    scores,
    total,
    signal,
    signalText: signalText[signal] || signal,
    maxScore: 70,
    timestamp: formatIST(new Date()),
    manualOverride: manualOverride !== 'none' ? manualOverride : null,
    rawData: {
      btcPrice,
      ma200,
      maTrend,
      fgi,
      fgiClassification: fgiData?.classification,
      etfFlow,
      etfFlowSource: etfData?.source,
      oiChange,
      change24h: btcData?.change24h || 0,
      change7d: btcData?.change7d || 0,
      upcomingEvents,
      errors
    }
  };

  // Save to database
  db.saveRiskScore(result);

  // Save price history
  if (btcPrice) {
    db.savePriceHistory({
      timestamp: result.timestamp,
      price: btcPrice,
      change24h: btcData?.change24h || 0,
      change7d: btcData?.change7d || 0,
      ma200
    });
  }

  logger.info(`Risk score calculated: ${total}/70 - ${signal}`);
  return result;
}

function updateSupportLevels(levels) {
  const sorted = levels.sort((a, b) => b - a);
  const data = {
    supports: sorted,
    updatedAt: formatIST(new Date())
  };
  fs.writeFileSync(SUPPORT_LEVELS_PATH, JSON.stringify(data, null, 2));
  logger.info(`Support levels updated: ${sorted.join(', ')}`);
  return data;
}

function getSupportLevels() {
  try {
    const raw = fs.readFileSync(SUPPORT_LEVELS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { supports: [60000, 58000, 50000, 40000] };
  }
}

function setManualOverride(signal) {
  const valid = ['GREEN', 'YELLOW', 'ORANGE', 'RED', 'none'];
  if (!valid.includes(signal)) return false;
  db.setSetting('manual_override', signal);
  logger.info(`Manual override set: ${signal}`);
  return true;
}

module.exports = {
  calculateRiskScore,
  updateSupportLevels,
  getSupportLevels,
  setManualOverride,
  // Export individual scoring functions for testing
  scoreFearGreed,
  scoreETFFlows,
  score200DMA,
  scoreSupportDistance,
  scoreOIChange,
  scoreMacroEvents,
  scoreDayOfWeek
};
