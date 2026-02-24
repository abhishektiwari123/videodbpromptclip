const logger = require('../utils/logger');
const db = require('../db/sqlite');
const { todayDateIST } = require('../utils/time');

// ETF flow data is primarily manual input via Telegram /etf command
// This module manages storage and retrieval

function setETFFlow(flowMillions, date = null) {
  const targetDate = date || todayDateIST();
  db.saveETFFlow(targetDate, flowMillions, 'manual');
  logger.info(`ETF flow set: ${flowMillions}M for ${targetDate}`);
  return { date: targetDate, flowMillions };
}

function getLatestETFFlow() {
  const latest = db.getLatestETFFlow();
  if (latest) {
    return {
      date: latest.date,
      flowMillions: latest.flow_millions,
      source: latest.source
    };
  }
  // Default to 0 if no data
  return { date: todayDateIST(), flowMillions: 0, source: 'default' };
}

module.exports = { setETFFlow, getLatestETFFlow };
