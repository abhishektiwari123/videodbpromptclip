const fetch = require('node-fetch');
const logger = require('../utils/logger');

let cache = {
  data: null,
  lastFetch: 0,
  previousOI: null
};

const CACHE_TTL = 300000; // 5 minutes

async function fetchOpenInterest() {
  if (cache.data && Date.now() - cache.lastFetch < CACHE_TTL) {
    return cache.data;
  }

  try {
    const apiKey = process.env.COINGLASS_API_KEY;
    const headers = apiKey ? { 'coinglassSecret': apiKey } : {};

    const url = 'https://open-api.coinglass.com/public/v2/open_interest';
    logger.info('API call: Coinglass Open Interest');
    const res = await fetch(url, { headers, timeout: 10000 });

    if (!res.ok) {
      throw new Error(`Coinglass OI API returned ${res.status}`);
    }

    const data = await res.json();

    if (data.code === '0' && data.data) {
      const btcData = data.data.find(d => d.symbol === 'BTC');
      if (btcData) {
        const currentOI = btcData.openInterest || 0;
        const h24Change = btcData.h24Change || 0;

        // Track previous OI for change calculation
        if (cache.data) {
          cache.previousOI = cache.data.openInterest;
        }

        const result = {
          symbol: 'BTC',
          openInterest: currentOI,
          h24Change: h24Change,
          oiChangePercent: h24Change, // Already a percentage from API
          fetchedAt: new Date().toISOString()
        };

        cache.data = result;
        cache.lastFetch = Date.now();
        return result;
      }
    }

    throw new Error('BTC OI not found in response');
  } catch (err) {
    logger.error('Open Interest fetch failed', { error: err.message });
    if (cache.data) {
      logger.warn('Using cached OI data');
      return { ...cache.data, cached: true };
    }
    return { symbol: 'BTC', openInterest: 0, oiChangePercent: 0, cached: true, error: true };
  }
}

module.exports = { fetchOpenInterest };
