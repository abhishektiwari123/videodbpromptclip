const RSSParser = require('rss-parser');
const logger = require('../utils/logger');
const db = require('../db/sqlite');

const parser = new RSSParser({
  timeout: 10000
});

const RSS_FEEDS = [
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' }
];

const RISK_KEYWORDS = [
  'tariff', 'sanctions', 'fed', 'fomc', 'rate', 'iran', 'china',
  'shutdown', 'crash', 'liquidation', 'warsh', 'hawkish', 'emergency',
  'recession', 'default', 'bank run', 'contagion', 'collapse',
  'sec', 'regulation', 'ban', 'hack', 'exploit', 'rug pull',
  'black swan', 'circuit breaker', 'margin call', 'delisting',
  'war', 'conflict', 'nuclear', 'attack', 'crisis'
];

async function scanFeeds() {
  const flaggedItems = [];

  for (const feed of RSS_FEEDS) {
    try {
      logger.info(`API call: RSS feed scan - ${feed.source}`);
      const parsed = await parser.parseURL(feed.url);

      for (const item of (parsed.items || []).slice(0, 20)) {
        const title = (item.title || '').toLowerCase();
        const content = (item.contentSnippet || item.content || '').toLowerCase();
        const fullText = `${title} ${content}`;

        const matched = RISK_KEYWORDS.filter(kw => fullText.includes(kw));

        if (matched.length > 0) {
          const newsItem = {
            title: item.title,
            link: item.link,
            source: feed.source,
            matchedKeywords: matched.join(', '),
            timestamp: item.isoDate || new Date().toISOString(),
            pubDate: item.pubDate
          };

          flaggedItems.push(newsItem);
          db.saveNewsItem(newsItem);
        }
      }
    } catch (err) {
      logger.error(`RSS feed scan failed for ${feed.source}`, { error: err.message });
    }
  }

  logger.info(`News scan complete: ${flaggedItems.length} flagged items`);
  return flaggedItems;
}

function getRecentFlaggedNews(limit = 10) {
  return db.getRecentNews(limit);
}

module.exports = { scanFeeds, getRecentFlaggedNews, RISK_KEYWORDS };
