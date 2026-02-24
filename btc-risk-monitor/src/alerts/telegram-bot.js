const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const riskEngine = require('../scoring/risk-engine');
const coingecko = require('../data/coingecko');
const etfFlows = require('../data/etf-flows');
const macroEvents = require('../data/macro-events');
const db = require('../db/sqlite');

let bot = null;
let chatId = null;

function initBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) {
    logger.warn('TELEGRAM_BOT_TOKEN not set, Telegram bot disabled');
    return null;
  }

  bot = new TelegramBot(token, { polling: true });
  logger.info('Telegram bot initialized');

  registerCommands();
  return bot;
}

function registerCommands() {
  // /status — Current risk score + breakdown + signal
  bot.onText(/\/status/, async (msg) => {
    if (!isAuthorized(msg)) return;
    try {
      await bot.sendMessage(msg.chat.id, '\u23F3 Calculating risk score...');
      const result = await riskEngine.calculateRiskScore();
      const text = formatRiskScore(result);
      await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('Telegram /status error', { error: err.message });
      await bot.sendMessage(msg.chat.id, '\u274C Error calculating risk score. Check logs.');
    }
  });

  // /price — Current BTC price, 24h change, distance from 200-day MA
  bot.onText(/\/price/, async (msg) => {
    if (!isAuthorized(msg)) return;
    try {
      const btcData = await coingecko.getBTCData();
      const text = formatPrice(btcData);
      await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('Telegram /price error', { error: err.message });
      await bot.sendMessage(msg.chat.id, '\u274C Error fetching price data.');
    }
  });

  // /calendar — Upcoming macro events in next 7 days
  bot.onText(/\/calendar/, async (msg) => {
    if (!isAuthorized(msg)) return;
    try {
      const events = macroEvents.getEventsInRange(7);
      const text = formatCalendar(events);
      await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('Telegram /calendar error', { error: err.message });
      await bot.sendMessage(msg.chat.id, '\u274C Error loading calendar.');
    }
  });

  // /etf <amount> — Manually input today's ETF flow
  bot.onText(/\/etf(?:_flow)?\s+(-?\d+(?:\.\d+)?)/, async (msg, match) => {
    if (!isAuthorized(msg)) return;
    try {
      const amount = parseFloat(match[1]);
      const result = etfFlows.setETFFlow(amount);
      await bot.sendMessage(
        msg.chat.id,
        `\u2705 ETF flow recorded: $${amount}M for ${result.date}`
      );
    } catch (err) {
      logger.error('Telegram /etf error', { error: err.message });
      await bot.sendMessage(msg.chat.id, '\u274C Error setting ETF flow. Usage: /etf -500');
    }
  });

  // /history — Last 7 days of risk scores
  bot.onText(/\/history/, async (msg) => {
    if (!isAuthorized(msg)) return;
    try {
      const scores = db.getRecentScores(7);
      const text = formatHistory(scores);
      await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('Telegram /history error', { error: err.message });
      await bot.sendMessage(msg.chat.id, '\u274C Error loading history.');
    }
  });

  // /support <prices> — Update support levels
  bot.onText(/\/support\s+(.+)/, async (msg, match) => {
    if (!isAuthorized(msg)) return;
    try {
      const levels = match[1].split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      if (levels.length === 0) {
        await bot.sendMessage(msg.chat.id, 'Usage: /support 60000,58000,50000,40000');
        return;
      }
      const result = riskEngine.updateSupportLevels(levels);
      await bot.sendMessage(
        msg.chat.id,
        `\u2705 Support levels updated: ${result.supports.map(s => '$' + s.toLocaleString()).join(', ')}`
      );
    } catch (err) {
      logger.error('Telegram /support error', { error: err.message });
      await bot.sendMessage(msg.chat.id, '\u274C Error updating support levels.');
    }
  });

  // /alert — Toggle alerts on/off
  bot.onText(/\/alert/, async (msg) => {
    if (!isAuthorized(msg)) return;
    try {
      const current = db.getSetting('alerts_enabled');
      const newValue = current === 'true' ? 'false' : 'true';
      db.setSetting('alerts_enabled', newValue);
      const status = newValue === 'true' ? 'ON' : 'OFF';
      await bot.sendMessage(msg.chat.id, `\u{1F514} Alerts turned ${status}`);
    } catch (err) {
      logger.error('Telegram /alert error', { error: err.message });
    }
  });

  // /force — Force immediate risk score recalculation
  bot.onText(/\/force/, async (msg) => {
    if (!isAuthorized(msg)) return;
    try {
      await bot.sendMessage(msg.chat.id, '\u{1F504} Forcing risk score recalculation...');
      const result = await riskEngine.calculateRiskScore();
      const text = formatRiskScore(result);
      await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    } catch (err) {
      logger.error('Telegram /force error', { error: err.message });
      await bot.sendMessage(msg.chat.id, '\u274C Error recalculating.');
    }
  });

  // /override <signal> — Manual override
  bot.onText(/\/override\s+(\w+)/, async (msg, match) => {
    if (!isAuthorized(msg)) return;
    try {
      const signal = match[1].toUpperCase();
      const success = riskEngine.setManualOverride(signal);
      if (success) {
        const text = signal === 'NONE'
          ? '\u2705 Manual override cleared. Automatic scoring resumed.'
          : `\u{1F6A8} Manual override set to ${signal}. Use /override none to clear.`;
        await bot.sendMessage(msg.chat.id, text);
      } else {
        await bot.sendMessage(msg.chat.id, 'Usage: /override RED|ORANGE|YELLOW|GREEN|none');
      }
    } catch (err) {
      logger.error('Telegram /override error', { error: err.message });
    }
  });

  // /help
  bot.onText(/\/help|\/start/, async (msg) => {
    if (!isAuthorized(msg)) return;
    const text = `<b>BTC Risk Monitor Commands</b>\n\n` +
      `/status - Current risk score + signal\n` +
      `/price - BTC price + 200-day MA\n` +
      `/calendar - Macro events (next 7 days)\n` +
      `/etf &lt;amount&gt; - Set ETF flow (e.g., /etf -500)\n` +
      `/history - Last 7 days of scores\n` +
      `/support &lt;prices&gt; - Update support levels\n` +
      `/alert - Toggle alerts on/off\n` +
      `/force - Force recalculation now\n` +
      `/override &lt;signal&gt; - Manual override (RED/ORANGE/YELLOW/GREEN/none)`;
    await bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });
}

function isAuthorized(msg) {
  if (!chatId) return true; // No restriction if CHAT_ID not set
  return msg.chat.id.toString() === chatId.toString();
}

// --- Formatting Functions ---

function formatRiskScore(result) {
  const signalEmoji = {
    GREEN: '\u{1F7E2}',
    YELLOW: '\u{1F7E1}',
    ORANGE: '\u{1F7E0}',
    RED: '\u{1F534}'
  };

  const emoji = signalEmoji[result.signal] || '\u26AA';
  const bar = (score, max = 10) => {
    const filled = Math.round((score / max) * 10);
    return '\u2588'.repeat(filled) + '\u2591'.repeat(10 - filled);
  };

  let text = `${emoji} <b>RISK SCORE: ${result.total}/${result.maxScore}</b> ${emoji}\n`;
  text += `<b>Signal: ${result.signalText}</b>\n`;

  if (result.manualOverride) {
    text += `\u26A0\uFE0F <i>Manual override active: ${result.manualOverride}</i>\n`;
  }

  text += `\n<b>Score Breakdown:</b>\n`;
  text += `Fear & Greed:  ${bar(result.scores.fearGreed)} ${result.scores.fearGreed}/10\n`;
  text += `ETF Flows:     ${bar(result.scores.etfFlows)} ${result.scores.etfFlows}/10\n`;
  text += `200-day MA:    ${bar(result.scores.movingAverage)} ${result.scores.movingAverage}/10\n`;
  text += `Support Dist:  ${bar(result.scores.supportDistance)} ${result.scores.supportDistance}/10\n`;
  text += `Open Interest: ${bar(result.scores.openInterest)} ${result.scores.openInterest}/10\n`;
  text += `Macro Events:  ${bar(result.scores.macroEvents)} ${result.scores.macroEvents}/10\n`;
  text += `Day of Week:   ${bar(result.scores.dayOfWeek)} ${result.scores.dayOfWeek}/10\n`;

  if (result.rawData) {
    text += `\n<b>Data:</b>\n`;
    if (result.rawData.btcPrice) {
      text += `BTC: $${result.rawData.btcPrice.toLocaleString()} (${result.rawData.change24h >= 0 ? '+' : ''}${result.rawData.change24h.toFixed(1)}% 24h)\n`;
    }
    if (result.rawData.fgi !== undefined) {
      text += `F&G Index: ${result.rawData.fgi} (${result.rawData.fgiClassification || 'N/A'})\n`;
    }
    if (result.rawData.ma200) {
      text += `200-day MA: $${result.rawData.ma200.toLocaleString()} (${result.rawData.maTrend})\n`;
    }

    if (result.rawData.errors && result.rawData.errors.length > 0) {
      text += `\n\u26A0\uFE0F <i>Data errors: ${result.rawData.errors.join(', ')}</i>`;
    }
  }

  return text;
}

function formatPrice(btcData) {
  if (!btcData || !btcData.price) {
    return '\u274C Unable to fetch BTC price data.';
  }

  let text = `<b>\u{20BF} BTC Price</b>\n\n`;
  text += `Price: <b>$${btcData.price.toLocaleString()}</b>\n`;
  text += `24h Change: ${btcData.change24h >= 0 ? '\u{1F7E2}' : '\u{1F534}'} ${btcData.change24h >= 0 ? '+' : ''}${btcData.change24h.toFixed(2)}%\n`;
  text += `7d Change: ${btcData.change7d >= 0 ? '\u{1F7E2}' : '\u{1F534}'} ${btcData.change7d >= 0 ? '+' : ''}${btcData.change7d.toFixed(2)}%\n`;

  if (btcData.ma200) {
    const distancePercent = ((btcData.price - btcData.ma200) / btcData.ma200) * 100;
    text += `\n200-day MA: $${btcData.ma200.toLocaleString()}\n`;
    text += `Distance: ${distancePercent >= 0 ? '+' : ''}${distancePercent.toFixed(1)}%\n`;
    text += `Trend: ${btcData.maTrend === 'rising' ? '\u2197\uFE0F Rising' : '\u2198\uFE0F Falling'}`;
  }

  if (btcData.cached) {
    text += `\n\n<i>\u26A0\uFE0F Using cached data</i>`;
  }

  return text;
}

function formatCalendar(events) {
  if (events.length === 0) {
    return '\u{1F4C5} No macro events in the next 7 days.';
  }

  let text = `<b>\u{1F4C5} Macro Calendar (Next 7 Days)</b>\n\n`;

  for (const event of events) {
    const isNear = event.hoursAway <= 48;
    const icon = isNear ? '\u{1F534}' : '\u26AA';
    const daysText = event.daysAway < 1
      ? `${Math.round(event.hoursAway)}h away`
      : `${event.daysAway.toFixed(0)}d away`;
    text += `${icon} <b>${event.date}</b> - ${event.name} [${event.type}] (${daysText})\n`;
  }

  return text;
}

function formatHistory(scores) {
  if (!scores || scores.length === 0) {
    return '\u{1F4CA} No risk score history available.';
  }

  let text = `<b>\u{1F4CA} Risk Score History (Last 7 Days)</b>\n\n`;

  const grouped = {};
  for (const score of scores) {
    const date = score.timestamp.split('T')[0];
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(score);
  }

  for (const [date, dayScores] of Object.entries(grouped).slice(0, 7)) {
    const latest = dayScores[0]; // Already sorted DESC
    const signalEmoji = {
      GREEN: '\u{1F7E2}',
      YELLOW: '\u{1F7E1}',
      ORANGE: '\u{1F7E0}',
      RED: '\u{1F534}'
    };
    const emoji = signalEmoji[latest.signal] || '\u26AA';
    text += `${emoji} ${date}: <b>${latest.total_score}/70</b> ${latest.signal}\n`;
  }

  return text;
}

// --- Alert Sending ---

async function sendScheduledAlert(result) {
  if (!bot || !chatId) return;

  const alertsEnabled = db.getSetting('alerts_enabled');
  if (alertsEnabled !== 'true') {
    logger.info('Alerts disabled, skipping scheduled alert');
    return;
  }

  try {
    const text = `\u{1F551} <b>Scheduled Risk Assessment</b>\n\n` + formatRiskScore(result);
    await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    logger.info('Scheduled alert sent via Telegram');
  } catch (err) {
    logger.error('Failed to send scheduled alert', { error: err.message });
  }
}

async function sendCrashAlert(alert) {
  if (!bot || !chatId) return;

  const alertsEnabled = db.getSetting('alerts_enabled');
  if (alertsEnabled !== 'true') {
    logger.info('Alerts disabled, skipping crash alert');
    return;
  }

  try {
    const { formatCrashAlert } = require('./flash-crash');
    const text = formatCrashAlert(alert);
    await bot.sendMessage(chatId, text);
    logger.info(`Crash alert sent: ${alert.severity}`);
  } catch (err) {
    logger.error('Failed to send crash alert', { error: err.message });
  }
}

module.exports = {
  initBot,
  sendScheduledAlert,
  sendCrashAlert,
  formatRiskScore
};
