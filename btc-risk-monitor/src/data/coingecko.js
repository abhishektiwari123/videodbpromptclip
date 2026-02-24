const fetch = require('node-fetch');
const logger = require('../utils/logger');

let cache = {
  price: null,
  ohlc: null,
  lastPriceFetch: 0,
  lastOhlcFetch: 0
};

const CACHE_TTL = 60000; // 1 minute for price
const OHLC_CACHE_TTL = 3600000; // 1 hour for OHLC

async function fetchBTCPrice() {
  if (cache.price && Date.now() - cache.lastPriceFetch < CACHE_TTL) {
    return cache.price;
  }

  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_7d_change=true';
    logger.info('API call: CoinGecko price');
    const res = await fetch(url, { timeout: 10000 });

    if (!res.ok) {
      throw new Error(`CoinGecko price API returned ${res.status}`);
    }

    const data = await res.json();
    const result = {
      price: data.bitcoin.usd,
      change24h: data.bitcoin.usd_24h_change || 0,
      change7d: data.bitcoin.usd_7d_change || 0,
      fetchedAt: new Date().toISOString()
    };

    cache.price = result;
    cache.lastPriceFetch = Date.now();
    return result;
  } catch (err) {
    logger.error('CoinGecko price fetch failed', { error: err.message });
    if (cache.price) {
      logger.warn('Using cached price data');
      return { ...cache.price, cached: true };
    }
    return null;
  }
}

async function fetchOHLC() {
  if (cache.ohlc && Date.now() - cache.lastOhlcFetch < OHLC_CACHE_TTL) {
    return cache.ohlc;
  }

  try {
    const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=200';
    logger.info('API call: CoinGecko OHLC (200 days)');
    const res = await fetch(url, { timeout: 15000 });

    if (!res.ok) {
      throw new Error(`CoinGecko OHLC API returned ${res.status}`);
    }

    const data = await res.json();
    // data is array of [timestamp, open, high, low, close]
    cache.ohlc = data;
    cache.lastOhlcFetch = Date.now();
    return data;
  } catch (err) {
    logger.error('CoinGecko OHLC fetch failed', { error: err.message });
    if (cache.ohlc) {
      logger.warn('Using cached OHLC data');
      return cache.ohlc;
    }
    return null;
  }
}

function calculate200DMA(ohlcData) {
  if (!ohlcData || ohlcData.length < 10) return null;

  // Use closing prices (index 4)
  const closes = ohlcData.map(d => d[4]);
  const ma200 = closes.reduce((sum, p) => sum + p, 0) / closes.length;

  // Calculate trend: compare recent MA to MA from ~7 entries ago
  const recentLen = Math.min(7, Math.floor(closes.length / 4));
  const recentCloses = closes.slice(-recentLen);
  const olderCloses = closes.slice(-(recentLen * 2), -recentLen);

  const recentAvg = recentCloses.reduce((s, p) => s + p, 0) / recentCloses.length;
  const olderAvg = olderCloses.length > 0
    ? olderCloses.reduce((s, p) => s + p, 0) / olderCloses.length
    : recentAvg;

  const maTrend = recentAvg >= olderAvg ? 'rising' : 'falling';

  return { ma200: Math.round(ma200 * 100) / 100, maTrend };
}

async function getBTCData() {
  const [priceData, ohlcData] = await Promise.all([
    fetchBTCPrice(),
    fetchOHLC()
  ]);

  const maData = calculate200DMA(ohlcData);

  return {
    price: priceData?.price || null,
    change24h: priceData?.change24h || 0,
    change7d: priceData?.change7d || 0,
    ma200: maData?.ma200 || null,
    maTrend: maData?.maTrend || 'rising',
    cached: priceData?.cached || false,
    ohlcData
  };
}

module.exports = { fetchBTCPrice, fetchOHLC, calculate200DMA, getBTCData };
