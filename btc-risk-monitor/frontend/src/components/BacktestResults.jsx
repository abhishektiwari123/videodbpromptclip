import React, { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, Legend
} from 'recharts';

const SIGNAL_COLORS = {
  GREEN: '#22c55e',
  YELLOW: '#eab308',
  ORANGE: '#f97316',
  RED: '#ef4444'
};

function BacktestResults() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/backtest');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!data && !loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Strategy Backtest</h2>
        <p className="text-gray-500 text-sm mb-4">
          Run a backtest on your historical trade data (Oct 2025 - Jan 2026) to see how the risk monitor signals correlate with actual P&L.
        </p>
        <button
          onClick={runBacktest}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
        >
          Run Backtest
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Strategy Backtest</h2>
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <p className="text-gray-400 text-sm">Fetching historical data and running backtest...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Strategy Backtest</h2>
        <p className="text-red-400 text-sm mb-3">Error: {error}</p>
        <button onClick={runBacktest} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">
          Retry
        </button>
      </div>
    );
  }

  const { results, analytics } = data;
  const a = analytics;
  const s = a.scenarios;

  // Prepare chart data: daily P&L bars colored by signal + risk score line
  const chartData = results.map(r => ({
    date: r.date.substring(5), // MM-DD
    pnl: r.pnl,
    riskScore: r.riskScore,
    signal: r.signal,
    btcPrice: r.marketData?.btcPrice
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const d = payload[0]?.payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded p-2 text-xs">
          <p className="text-gray-400 font-medium">{d?.date}</p>
          <p className={d?.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
            P&L: ${d?.pnl}
          </p>
          <p className="text-blue-400">Risk Score: {d?.riskScore}/70</p>
          <p style={{ color: SIGNAL_COLORS[d?.signal] }}>Signal: {d?.signal}</p>
          {d?.btcPrice && <p className="text-gray-400">BTC: ${d.btcPrice?.toLocaleString()}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-300">Strategy Backtest</h2>
          <button
            onClick={runBacktest}
            disabled={loading}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
          >
            Re-run
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total P&L" value={`$${a.totalPnl}`} color={a.totalPnl >= 0 ? 'green' : 'red'} />
          <StatCard label="Win Rate" value={`${a.winRate}%`} sub={`${a.wins}W / ${a.losses}L`} color="blue" />
          <StatCard label="Avg Win" value={`+$${a.avgWin}`} color="green" />
          <StatCard label="Avg Loss" value={`$${a.avgLoss}`} color="red" />
        </div>

        {/* Risk Score Correlation */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <p className="text-xs text-green-400 mb-1">Avg Score on WIN Days</p>
            <p className="text-xl font-bold text-green-300">{a.avgScoreWin}<span className="text-sm text-green-500">/70</span></p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-xs text-red-400 mb-1">Avg Score on LOSS Days</p>
            <p className="text-xl font-bold text-red-300">{a.avgScoreLoss}<span className="text-sm text-red-500">/70</span></p>
          </div>
        </div>

        {/* Signal Performance Table */}
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Performance by Signal</h3>
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2">Signal</th>
                <th className="text-right py-2">Days</th>
                <th className="text-right py-2">Win Rate</th>
                <th className="text-right py-2">Total P&L</th>
                <th className="text-right py-2">Avg P&L</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(a.signalAnalysis).map(([signal, d]) => {
                if (d.count === 0) return null;
                return (
                  <tr key={signal} className="border-b border-gray-800/50">
                    <td className="py-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: SIGNAL_COLORS[signal] }}></span>
                      <span style={{ color: SIGNAL_COLORS[signal] }}>{signal}</span>
                    </td>
                    <td className="text-right text-gray-300">{d.count}</td>
                    <td className="text-right text-gray-300">{d.winRate}%</td>
                    <td className={`text-right font-medium ${d.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${d.totalPnl}
                    </td>
                    <td className={`text-right ${d.avgPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${d.avgPnl}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* What-If Scenarios */}
        <h3 className="text-sm font-semibold text-gray-400 mb-2">What-If Scenarios</h3>
        <div className="space-y-2 mb-6">
          <ScenarioRow
            label="Actual (all days)"
            days={s.actual.days}
            pnl={s.actual.pnl}
            winRate={s.actual.winRate}
            highlight={false}
          />
          <ScenarioRow
            label="GREEN + YELLOW only"
            days={s.greenYellowOnly.days}
            pnl={s.greenYellowOnly.pnl}
            winRate={s.greenYellowOnly.winRate}
            skipped={s.greenYellowOnly.skippedDays}
            skippedPnl={s.greenYellowOnly.skippedPnl}
            highlight={true}
          />
          <ScenarioRow
            label="GREEN only"
            days={s.greenOnly.days}
            pnl={s.greenOnly.pnl}
            winRate={s.greenOnly.winRate}
            highlight={false}
          />
        </div>

        {/* Monthly breakdown */}
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Monthly Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left py-2">Month</th>
                <th className="text-right py-2">P&L</th>
                <th className="text-right py-2">Win Rate</th>
                <th className="text-right py-2">Avg Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(a.monthly).map(([month, d]) => (
                <tr key={month} className="border-b border-gray-800/50">
                  <td className="py-2 text-gray-300">{month}</td>
                  <td className={`text-right font-medium ${d.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${d.totalPnl}
                  </td>
                  <td className="text-right text-gray-300">{d.winRate}%</td>
                  <td className="text-right text-gray-300">{d.avgScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* P&L + Risk Score Chart */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">Daily P&L vs Risk Score</h3>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={10}
              tickLine={false}
              interval={Math.floor(chartData.length / 12)}
            />
            <YAxis
              yAxisId="pnl"
              stroke="#6b7280"
              fontSize={10}
              tickFormatter={v => `$${v}`}
            />
            <YAxis
              yAxisId="score"
              orientation="right"
              stroke="#6b7280"
              fontSize={10}
              domain={[0, 70]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            <ReferenceLine yAxisId="pnl" y={0} stroke="#6b7280" strokeDasharray="3 3" />

            <Bar yAxisId="pnl" dataKey="pnl" name="Daily P&L" barSize={6}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'}
                  fillOpacity={0.7}
                />
              ))}
            </Bar>

            <Line
              yAxisId="score"
              type="monotone"
              dataKey="riskScore"
              stroke="#3b82f6"
              dot={false}
              strokeWidth={2}
              name="Risk Score"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-sm"></span> Profit day
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 rounded-sm"></span> Loss day
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Risk Score (0-70)
          </span>
        </div>
      </div>

      {/* Biggest Loss Days */}
      {a.biggestLossDays.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Biggest Loss Days Analysis</h3>
          <div className="space-y-2">
            {a.biggestLossDays.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                <div>
                  <span className="text-sm text-gray-300 font-medium">{d.date}</span>
                  <span className="text-red-400 font-bold ml-3">${d.pnl}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">Score: {d.riskScore}/70</span>
                  <span style={{ color: SIGNAL_COLORS[d.signal] }}>{d.signal}</span>
                  <span className="text-gray-500">F&G: {d.fgi}</span>
                  {d.btcPrice && <span className="text-gray-500">BTC: ${d.btcPrice?.toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  const colors = {
    green: 'text-green-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
    gray: 'text-gray-300'
  };
  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colors[color] || colors.gray}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function ScenarioRow({ label, days, pnl, winRate, skipped, skippedPnl, highlight }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg ${highlight ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-gray-800/30 border border-gray-800'}`}>
      <span className={`text-sm ${highlight ? 'text-blue-300 font-medium' : 'text-gray-400'}`}>
        {label}
      </span>
      <div className="flex items-center gap-4 text-sm mt-1 sm:mt-0">
        <span className="text-gray-400">{days} days</span>
        <span className={pnl >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
          ${pnl}
        </span>
        <span className="text-gray-400">{winRate}% WR</span>
        {skipped !== undefined && (
          <span className="text-xs text-gray-500">
            ({skipped} skipped, {skippedPnl >= 0 ? '+' : ''}${skippedPnl} avoided)
          </span>
        )}
      </div>
    </div>
  );
}

export default BacktestResults;
