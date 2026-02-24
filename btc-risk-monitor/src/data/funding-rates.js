const fetch = require('node-fetch');
const logger = require('../utils/logger');

let cache = {
  data: null,
  lastFetch: 0
};

const CACHE_TTL = 300000; // 5 minutes

async function fetchFundingRates() {
  if (cache.data && Date.now() - cache.lastFetch < CACHE_TTL) {
    return cache.data;
  }

  try {
    const apiKey = process.env.COINGLASS_API_KEY;
    const headers = apiKey ? { 'coinglassSecret': apiKey } : {};

    const url = 'https://open-api.coinglass.com/public/v2/funding';
    logger.info('API call: Coinglass Funding Rates');
    const res = await fetch(url, { headers, timeout: 10000 });

    if (!res.ok) {
      throw new Error(`Coinglass funding API returned ${res.status}`);
    }

    const data = await res.json();

    if (data.code === '0' && data.data) {
      // Find BTC funding rate
      const btcData = data.data.find(d => d.symbol === 'BTC');
      if (btcData) {
        const result = {
          symbol: 'BTC',
          rate: btcData.uMarginList?.[0]?.rate || 0,
          exchangeRates: btcData.uMarginList?.map(e => ({
            exchange: e.exchangeName,
            rate: e.rate
          })) || [],
          fetchedAt: new Date().toISOString()
        };
        cache.data = result;
        cache.lastFetch = Date.now();
        return result;
      }
    }

    throw new Error('BTC funding rate not found in response');
  } catch (err) {
    logger.error('Funding rates fetch failed', { error: err.message });
    if (cache.data) {
      logger.warn('Using cached funding rate data');
      return { ...cache.data, cached: true };
    }
    return { symbol: 'BTC', rate: 0, exchangeRates: [], cached: true, error: true };
  }
}

module.exports = { fetchFundingRates };
