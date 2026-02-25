const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const TRADES_PATH = path.join(__dirname, '..', 'config', 'historical-trades.json');
const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'backtest-cache.json');

// Scoring functions (duplicated from risk-engine to avoid circular deps)
function scoreFearGreed(fgi) {
  if (fgi > 25) return 0;
  if (fgi > 15) return 3;
  if (fgi > 10) return 7;
  return 10;
}

function score200DMA(currentPrice, ma200, maTrend) {
  if (!currentPrice || !ma200) return 5;
  if (currentPrice > ma200 && maTrend === 'rising') return 0;
  if (currentPrice > ma200 && maTrend === 'falling') return 3;
  if (currentPrice < ma200 && maTrend === 'rising') return 5;
  if (currentPrice < ma200 && maTrend === 'falling') return 8;
  return 5;
}

function scoreSupportDistance(currentPrice) {
  if (!currentPrice) return 5;
  const supports = [60000, 58000, 50000, 40000];
  const sortedSupports = supports.sort((a, b) => b - a);
  const nearestSupport = sortedSupports.find(s => s < currentPrice) || sortedSupports[sortedSupports.length - 1];
  const distancePercent = ((currentPrice - nearestSupport) / currentPrice) * 100;
  if (distancePercent > 10) return 0;
  if (distancePercent > 5) return 3;
  if (distancePercent > 2) return 7;
  return 10;
}

function scoreDayOfWeek(dateStr) {
  const day = new Date(dateStr + 'T12:00:00Z').getUTCDay();
  if (day >= 2 && day <= 4) return 0;
  if (day === 1) return 2;
  if (day === 5) return 4;
  return 7;
}

function scoreMacroEvents(date, calendar) {
  const events = calendar.events || [];
  let score = 0;
  const targetDate = new Date(date + 'T00:00:00Z');

  for (const event of events) {
    const eventDate = new Date(event.date + 'T00:00:00Z');
    const hoursAway = (eventDate - targetDate) / (3600 * 1000);
    if (hoursAway < -24 || hoursAway > 48) continue;

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

// Fetch historical Fear & Greed data (up to 365 days)
async function fetchHistoricalFGI(days = 200) {
  try {
    logger.info(`Backtest: Fetching ${days} days of Fear & Greed history`);
    const res = await fetch(`https://api.alternative.me/fng/?limit=${days}`, { timeout: 15000 });
    if (!res.ok) throw new Error(`FGI API returned ${res.status}`);
    const data = await res.json();
    // Build date->value map
    const map = {};
    for (const entry of data.data || []) {
      const ts = parseInt(entry.timestamp, 10) * 1000;
      const dateStr = new Date(ts).toISOString().split('T')[0];
      map[dateStr] = parseInt(entry.value, 10);
    }
    return map;
  } catch (err) {
    logger.error('Backtest: FGI history fetch failed', { error: err.message });
    return {};
  }
}

// Fetch historical BTC prices from CoinGecko
async function fetchHistoricalPrices(days = 200) {
  try {
    logger.info(`Backtest: Fetching ${days} days of BTC price history`);
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`,
      { timeout: 15000 }
    );
    if (!res.ok) throw new Error(`CoinGecko market_chart API returned ${res.status}`);
    const data = await res.json();
    // Build date->price map
    const map = {};
    for (const [ts, price] of data.prices || []) {
      const dateStr = new Date(ts).toISOString().split('T')[0];
      map[dateStr] = price;
    }
    return map;
  } catch (err) {
    logger.error('Backtest: Price history fetch failed', { error: err.message });
    return {};
  }
}

// Calculate 200-day MA for a given date from price history
function calculate200DMA(priceMap, dateStr) {
  const allDates = Object.keys(priceMap).sort();
  const idx = allDates.indexOf(dateStr);
  if (idx < 0) {
    // Find nearest earlier date
    const targetDate = new Date(dateStr);
    let nearestIdx = -1;
    for (let i = allDates.length - 1; i >= 0; i--) {
      if (new Date(allDates[i]) <= targetDate) {
        nearestIdx = i;
        break;
      }
    }
    if (nearestIdx < 0) return { ma200: null, maTrend: 'rising' };

    const slice = allDates.slice(0, nearestIdx + 1);
    const prices = slice.map(d => priceMap[d]);
    const ma200 = prices.reduce((s, p) => s + p, 0) / prices.length;

    const recent7 = prices.slice(-7);
    const older7 = prices.slice(-14, -7);
    const recentAvg = recent7.reduce((s, p) => s + p, 0) / recent7.length;
    const olderAvg = older7.length > 0 ? older7.reduce((s, p) => s + p, 0) / older7.length : recentAvg;
    const maTrend = recentAvg >= olderAvg ? 'rising' : 'falling';

    return { ma200, maTrend };
  }

  const slice = allDates.slice(0, idx + 1);
  const prices = slice.map(d => priceMap[d]);
  const ma200 = prices.reduce((s, p) => s + p, 0) / prices.length;

  const recent7 = prices.slice(-7);
  const older7 = prices.slice(-14, -7);
  const recentAvg = recent7.reduce((s, p) => s + p, 0) / recent7.length;
  const olderAvg = older7.length > 0 ? older7.reduce((s, p) => s + p, 0) / older7.length : recentAvg;
  const maTrend = recentAvg >= olderAvg ? 'rising' : 'falling';

  return { ma200, maTrend };
}

// Calculate 24h price change for a given date
function calc24hChange(priceMap, dateStr) {
  const allDates = Object.keys(priceMap).sort();
  const idx = allDates.indexOf(dateStr);
  if (idx <= 0) return 0;
  const today = priceMap[dateStr];
  const yesterday = priceMap[allDates[idx - 1]];
  if (!today || !yesterday) return 0;
  return ((today - yesterday) / yesterday) * 100;
}

// Load or fetch backtest market data with caching
async function getMarketData() {
  // Check if we have cached data less than 24h old
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const cached = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
      const age = Date.now() - (cached.fetchedAt || 0);
      if (age < 24 * 3600 * 1000) {
        logger.info('Backtest: Using cached market data');
        return cached;
      }
    }
  } catch {}

  // Fetch fresh data
  const [priceMap, fgiMap] = await Promise.all([
    fetchHistoricalPrices(200),
    fetchHistoricalFGI(200)
  ]);

  const calPath = path.join(__dirname, '..', 'config', 'macro-calendar.json');
  let calendar = { events: [] };
  try {
    calendar = JSON.parse(fs.readFileSync(calPath, 'utf-8'));
  } catch {}

  const data = { priceMap, fgiMap, calendar, fetchedAt: Date.now() };

  // Cache it
  try {
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data));
  } catch (err) {
    logger.warn('Backtest: Failed to cache data', { error: err.message });
  }

  return data;
}

// Run the backtest
async function runBacktest() {
  logger.info('Backtest: Starting...');

  // Load trade data
  let tradeData;
  try {
    tradeData = JSON.parse(fs.readFileSync(TRADES_PATH, 'utf-8'));
  } catch (err) {
    throw new Error(`Cannot load trade data: ${err.message}`);
  }

  const trades = tradeData.dailyTrades;
  if (!trades || trades.length === 0) {
    throw new Error('No trade data found');
  }

  // Fetch historical market data
  const { priceMap, fgiMap, calendar } = await getMarketData();

  // Calculate risk score for each trade date
  const results = [];
  for (const trade of trades) {
    const date = trade.date;
    const btcPrice = priceMap[date] || null;
    const fgi = fgiMap[date] ?? 50;
    const { ma200, maTrend } = calculate200DMA(priceMap, date);
    const change24h = calc24hChange(priceMap, date);

    const scores = {
      fearGreed: scoreFearGreed(fgi),
      etfFlows: 0, // No historical ETF data available
      movingAverage: score200DMA(btcPrice, ma200, maTrend),
      supportDistance: scoreSupportDistance(btcPrice),
      openInterest: 0, // No historical OI data available
      macroEvents: scoreMacroEvents(date, calendar),
      dayOfWeek: scoreDayOfWeek(date)
    };

    const total = Object.values(scores).reduce((a, b) => a + b, 0);

    let signal;
    if (total <= 15) signal = 'GREEN';
    else if (total <= 30) signal = 'YELLOW';
    else if (total <= 45) signal = 'ORANGE';
    else signal = 'RED';

    results.push({
      date,
      pnl: trade.pnl,
      tradeResult: trade.result,
      riskScore: total,
      signal,
      scores,
      marketData: {
        btcPrice: btcPrice ? Math.round(btcPrice) : null,
        fgi,
        ma200: ma200 ? Math.round(ma200) : null,
        maTrend,
        change24h: Math.round(change24h * 100) / 100
      }
    });
  }

  // Compute analytics
  const analytics = computeAnalytics(results);

  logger.info(`Backtest: Completed. ${results.length} days analyzed.`);
  return { results, analytics, months: tradeData.months };
}

function computeAnalytics(results) {
  const totalDays = results.length;
  const winDays = results.filter(r => r.pnl > 0);
  const lossDays = results.filter(r => r.pnl < 0);
  const breakEvenDays = results.filter(r => r.pnl === 0);

  const totalPnl = results.reduce((s, r) => s + r.pnl, 0);
  const avgPnl = totalPnl / totalDays;
  const avgWin = winDays.length > 0 ? winDays.reduce((s, r) => s + r.pnl, 0) / winDays.length : 0;
  const avgLoss = lossDays.length > 0 ? lossDays.reduce((s, r) => s + r.pnl, 0) / lossDays.length : 0;

  // Group by signal
  const bySignal = { GREEN: [], YELLOW: [], ORANGE: [], RED: [] };
  for (const r of results) {
    if (bySignal[r.signal]) bySignal[r.signal].push(r);
  }

  const signalAnalysis = {};
  for (const [signal, trades] of Object.entries(bySignal)) {
    if (trades.length === 0) {
      signalAnalysis[signal] = { count: 0, winRate: 0, avgPnl: 0, totalPnl: 0 };
      continue;
    }
    const wins = trades.filter(t => t.pnl > 0).length;
    const tPnl = trades.reduce((s, t) => s + t.pnl, 0);
    signalAnalysis[signal] = {
      count: trades.length,
      winRate: Math.round((wins / trades.length) * 100 * 10) / 10,
      avgPnl: Math.round((tPnl / trades.length) * 100) / 100,
      totalPnl: tPnl
    };
  }

  // What if we skipped ORANGE and RED days?
  const greenYellowOnly = results.filter(r => r.signal === 'GREEN' || r.signal === 'YELLOW');
  const skippedDays = results.filter(r => r.signal === 'ORANGE' || r.signal === 'RED');

  const filteredPnl = greenYellowOnly.reduce((s, r) => s + r.pnl, 0);
  const skippedPnl = skippedDays.reduce((s, r) => s + r.pnl, 0);
  const filteredWins = greenYellowOnly.filter(r => r.pnl > 0).length;
  const filteredWinRate = greenYellowOnly.length > 0
    ? Math.round((filteredWins / greenYellowOnly.length) * 100 * 10) / 10
    : 0;

  // What if we skipped all non-GREEN days?
  const greenOnly = results.filter(r => r.signal === 'GREEN');
  const greenPnl = greenOnly.reduce((s, r) => s + r.pnl, 0);
  const greenWins = greenOnly.filter(r => r.pnl > 0).length;
  const greenWinRate = greenOnly.length > 0
    ? Math.round((greenWins / greenOnly.length) * 100 * 10) / 10
    : 0;

  // Average risk score on win vs loss days
  const avgScoreWin = winDays.length > 0
    ? Math.round((winDays.reduce((s, r) => s + r.riskScore, 0) / winDays.length) * 10) / 10
    : 0;
  const avgScoreLoss = lossDays.length > 0
    ? Math.round((lossDays.reduce((s, r) => s + r.riskScore, 0) / lossDays.length) * 10) / 10
    : 0;

  // Biggest loss days analysis
  const biggestLossDays = [...lossDays].sort((a, b) => a.pnl - b.pnl).slice(0, 5);

  // Monthly breakdown
  const monthly = {};
  for (const r of results) {
    const month = r.date.substring(0, 7);
    if (!monthly[month]) {
      monthly[month] = { trades: [], totalPnl: 0, wins: 0, losses: 0, avgScore: 0, scores: [] };
    }
    monthly[month].trades.push(r);
    monthly[month].totalPnl += r.pnl;
    monthly[month].scores.push(r.riskScore);
    if (r.pnl > 0) monthly[month].wins++;
    else if (r.pnl < 0) monthly[month].losses++;
  }
  for (const m of Object.values(monthly)) {
    m.avgScore = Math.round((m.scores.reduce((s, v) => s + v, 0) / m.scores.length) * 10) / 10;
    m.winRate = m.trades.length > 0
      ? Math.round((m.wins / m.trades.length) * 100 * 10) / 10
      : 0;
    delete m.trades;
    delete m.scores;
  }

  return {
    totalDays,
    wins: winDays.length,
    losses: lossDays.length,
    breakevens: breakEvenDays.length,
    winRate: Math.round((winDays.length / totalDays) * 100 * 10) / 10,
    totalPnl,
    avgPnl: Math.round(avgPnl * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    avgScoreWin,
    avgScoreLoss,
    signalAnalysis,
    scenarios: {
      actual: { days: totalDays, pnl: totalPnl, winRate: Math.round((winDays.length / totalDays) * 100 * 10) / 10 },
      greenYellowOnly: { days: greenYellowOnly.length, pnl: filteredPnl, winRate: filteredWinRate, skippedDays: skippedDays.length, skippedPnl },
      greenOnly: { days: greenOnly.length, pnl: greenPnl, winRate: greenWinRate }
    },
    biggestLossDays: biggestLossDays.map(d => ({
      date: d.date,
      pnl: d.pnl,
      riskScore: d.riskScore,
      signal: d.signal,
      btcPrice: d.marketData.btcPrice,
      fgi: d.marketData.fgi
    })),
    monthly
  };
}

module.exports = { runBacktest };
