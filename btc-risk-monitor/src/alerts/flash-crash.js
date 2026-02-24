const logger = require('../utils/logger');
const { formatIST } = require('../utils/time');
const coingecko = require('../data/coingecko');
const db = require('../db/sqlite');

// Price history for crash detection (in-memory ring buffer)
const priceBuffer = [];
const MAX_BUFFER_SIZE = 300; // ~25 hours at 5-min intervals

function addPricePoint(price) {
  priceBuffer.push({
    price,
    timestamp: Date.now()
  });
  // Keep buffer manageable
  if (priceBuffer.length > MAX_BUFFER_SIZE) {
    priceBuffer.shift();
  }
}

function getPriceAtTimeAgo(minutesAgo) {
  const target = Date.now() - (minutesAgo * 60 * 1000);
  // Find the closest price point to the target time
  let closest = null;
  let minDiff = Infinity;

  for (const point of priceBuffer) {
    const diff = Math.abs(point.timestamp - target);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  // Only return if within 10 minutes of target
  if (closest && minDiff < 10 * 60 * 1000) {
    return closest.price;
  }
  return null;
}

async function checkForFlashCrash(sendAlert) {
  try {
    const priceData = await coingecko.fetchBTCPrice();
    if (!priceData || !priceData.price) {
      logger.warn('Flash crash check: no price data');
      return null;
    }

    const currentPrice = priceData.price;
    addPricePoint(currentPrice);

    const alerts = [];

    // Check 1-hour drop (>3%)
    const price1hAgo = getPriceAtTimeAgo(60);
    if (price1hAgo) {
      const drop1h = ((price1hAgo - currentPrice) / price1hAgo) * 100;
      if (drop1h > 3) {
        alerts.push({
          severity: 'WARNING',
          dropPercent: Math.round(drop1h * 100) / 100,
          timeframe: '1 hour',
          priceAtAlert: currentPrice,
          priceFrom: price1hAgo
        });
      }
    }

    // Check 4-hour drop (>5%)
    const price4hAgo = getPriceAtTimeAgo(240);
    if (price4hAgo) {
      const drop4h = ((price4hAgo - currentPrice) / price4hAgo) * 100;
      if (drop4h > 5) {
        alerts.push({
          severity: 'CRITICAL',
          dropPercent: Math.round(drop4h * 100) / 100,
          timeframe: '4 hours',
          priceAtAlert: currentPrice,
          priceFrom: price4hAgo
        });
      }
    }

    // Check 24-hour drop (>8%) using API's 24h change
    const change24h = priceData.change24h || 0;
    if (change24h < -8) {
      alerts.push({
        severity: 'EMERGENCY',
        dropPercent: Math.round(Math.abs(change24h) * 100) / 100,
        timeframe: '24 hours',
        priceAtAlert: currentPrice,
        priceFrom: null
      });
    }

    // Process alerts
    for (const alert of alerts) {
      const timestamp = formatIST(new Date());
      db.saveFlashCrashAlert({
        timestamp,
        severity: alert.severity,
        dropPercent: alert.dropPercent,
        timeframe: alert.timeframe,
        priceAtAlert: alert.priceAtAlert
      });

      logger.warn(`Flash crash detected: ${alert.severity} - ${alert.dropPercent}% in ${alert.timeframe}`);

      if (sendAlert) {
        await sendAlert(alert);
      }
    }

    return alerts.length > 0 ? alerts : null;
  } catch (err) {
    logger.error('Flash crash check failed', { error: err.message });
    return null;
  }
}

function formatCrashAlert(alert) {
  const emoji = {
    WARNING: '\u26A0\uFE0F',
    CRITICAL: '\u{1F6A8}',
    EMERGENCY: '\u{1F198}'
  };

  const icon = emoji[alert.severity] || '\u26A0\uFE0F';
  let msg = `${icon} FLASH CRASH ${alert.severity} ${icon}\n\n`;
  msg += `BTC dropped ${alert.dropPercent}% in ${alert.timeframe}\n`;
  msg += `Current Price: $${alert.priceAtAlert.toLocaleString()}\n`;

  if (alert.priceFrom) {
    msg += `Price ${alert.timeframe} ago: $${alert.priceFrom.toLocaleString()}\n`;
  }

  if (alert.severity === 'CRITICAL' || alert.severity === 'EMERGENCY') {
    msg += `\n\u{1F6D1} RECOMMENDED: PAUSE STRATEGY IMMEDIATELY`;
  }

  return msg;
}

module.exports = { checkForFlashCrash, formatCrashAlert, addPricePoint };
