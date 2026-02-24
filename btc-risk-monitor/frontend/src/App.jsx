import React, { useState, useEffect, useCallback } from 'react';
import RiskGauge from './components/RiskGauge';
import ScoreBreakdown from './components/ScoreBreakdown';
import PriceChart from './components/PriceChart';
import ScoreHistory from './components/ScoreHistory';
import MacroCalendar from './components/MacroCalendar';
import NewsFeed from './components/NewsFeed';
import { getStatus, getScoreHistory, getPriceHistory, getCalendar, getNews, forceCalculate } from './api';

function App() {
  const [status, setStatus] = useState(null);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async (fresh = false) => {
    try {
      setError(null);
      const [statusData, scores, prices, cal, newsData] = await Promise.all([
        fresh ? forceCalculate() : getStatus(),
        getScoreHistory(30),
        getPriceHistory(30),
        getCalendar(14),
        getNews(10)
      ]);
      setStatus(statusData);
      setScoreHistory(scores);
      setPriceHistory(prices);
      setCalendar(cal);
      setNews(newsData);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchAll(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleForceRefresh = () => {
    setLoading(true);
    fetchAll(true);
  };

  if (loading && !status) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading risk data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top Bar */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-orange-500">BTC Risk Monitor</span>
            {status && (
              <span className="text-sm text-gray-400">
                BTC: ${status.rawData?.btcPrice?.toLocaleString() || '---'}
                <span className={`ml-2 ${(status.rawData?.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(status.rawData?.change24h || 0) >= 0 ? '+' : ''}{(status.rawData?.change24h || 0).toFixed(1)}%
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-gray-500">
                Updated: {lastRefresh.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
              </span>
            )}
            <button
              onClick={handleForceRefresh}
              disabled={loading}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            Error: {error}. Data may be stale.
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Risk Gauge + Score Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RiskGauge status={status} />
          <ScoreBreakdown status={status} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PriceChart priceHistory={priceHistory} status={status} />
          <ScoreHistory scoreHistory={scoreHistory} />
        </div>

        {/* Calendar + News */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MacroCalendar events={calendar} />
          <NewsFeed news={news} />
        </div>
      </main>

      <footer className="text-center text-gray-600 text-xs py-4 border-t border-gray-900">
        BTC Options Strategy Risk Monitor &middot; All times in IST
      </footer>
    </div>
  );
}

export default App;
