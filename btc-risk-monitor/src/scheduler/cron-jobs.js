const cron = require('node-cron');
const logger = require('../utils/logger');
const riskEngine = require('../scoring/risk-engine');
const flashCrash = require('../alerts/flash-crash');
const newsScanner = require('../data/news-scanner');
const telegramBot = require('../alerts/telegram-bot');
const db = require('../db/sqlite');

function startAllJobs() {
  logger.info('Starting scheduled jobs...');

  // 1. Risk score calculation every 6 hours (IST: 6:00, 12:00, 18:00, 00:00)
  //    Cron runs in server timezone, but we calculate IST offset
  //    Using UTC times: 0:30, 6:30, 12:30, 18:30 = IST 6:00, 12:00, 18:00, 00:00
  cron.schedule('30 0,6,12,18 * * *', async () => {
    logger.info('Cron: 6-hour risk score calculation');
    try {
      const result = await riskEngine.calculateRiskScore();
      await telegramBot.sendScheduledAlert(result);
    } catch (err) {
      logger.error('Cron: Risk score calculation failed', { error: err.message });
    }
  });

  // 2. Flash crash detector every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await flashCrash.checkForFlashCrash(telegramBot.sendCrashAlert);
    } catch (err) {
      logger.error('Cron: Flash crash check failed', { error: err.message });
    }
  });

  // 3. News scan every 2 hours
  cron.schedule('15 */2 * * *', async () => {
    logger.info('Cron: News scan');
    try {
      await newsScanner.scanFeeds();
    } catch (err) {
      logger.error('Cron: News scan failed', { error: err.message });
    }
  });

  // 4. Database cleanup once daily at 3:30 AM UTC (9:00 AM IST)
  cron.schedule('30 3 * * *', () => {
    logger.info('Cron: Database cleanup');
    try {
      db.cleanupOldData();
    } catch (err) {
      logger.error('Cron: Database cleanup failed', { error: err.message });
    }
  });

  logger.info('All scheduled jobs started');
  logger.info('  - Risk score: every 6 hours (IST 6:00, 12:00, 18:00, 00:00)');
  logger.info('  - Flash crash: every 5 minutes');
  logger.info('  - News scan: every 2 hours');
  logger.info('  - DB cleanup: daily at 9:00 AM IST');
}

module.exports = { startAllJobs };
