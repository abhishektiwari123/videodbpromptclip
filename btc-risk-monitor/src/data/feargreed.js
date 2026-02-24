const fetch = require('node-fetch');
const logger = require('../utils/logger');

let cache = {
  data: null,
  lastFetch: 0
};

const CACHE_TTL = 300000; // 5 minutes

async function fetchFearGreedIndex() {
  if (cache.data && Date.now() - cache.lastFetch < CACHE_TTL) {
    return cache.data;
  }

  try {
    const url = 'https://api.alternative.me/fng/?limit=1';
    logger.info('API call: Fear & Greed Index');
    const res = await fetch(url, { timeout: 10000 });

    if (!res.ok) {
      throw new Error(`Fear & Greed API returned ${res.status}`);
    }

    const data = await res.json();
    const fng = data.data[0];

    const result = {
      value: parseInt(fng.value, 10),
      classification: fng.value_classification,
      timestamp: fng.timestamp,
      fetchedAt: new Date().toISOString()
    };

    cache.data = result;
    cache.lastFetch = Date.now();
    return result;
  } catch (err) {
    logger.error('Fear & Greed fetch failed', { error: err.message });
    if (cache.data) {
      logger.warn('Using cached Fear & Greed data');
      return { ...cache.data, cached: true };
    }
    return { value: 50, classification: 'Neutral', cached: true, error: true };
  }
}

module.exports = { fetchFearGreedIndex };
