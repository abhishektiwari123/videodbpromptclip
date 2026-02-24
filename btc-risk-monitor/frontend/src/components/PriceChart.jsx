import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

function PriceChart({ priceHistory, status }) {
  if (!priceHistory || priceHistory.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">BTC Price (30 Days)</h2>
        <p className="text-gray-500 text-sm">No price data available yet. Data will appear after the first few scheduled calculations.</p>
      </div>
    );
  }

  const chartData = priceHistory.map(p => ({
    date: new Date(p.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    price: p.price,
    ma200: p.ma200
  }));

  // Get support levels from status if available
  const supports = [];
  try {
    if (status?.rawData?.btcPrice) {
      // Use some representative support levels
      const levels = [60000, 58000, 50000, 40000];
      const minPrice = Math.min(...chartData.map(d => d.price));
      const maxPrice = Math.max(...chartData.map(d => d.price));
      levels.forEach(level => {
        if (level >= minPrice * 0.9 && level <= maxPrice * 1.1) {
          supports.push(level);
        }
      });
    }
  } catch {}

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded p-2 text-sm">
          <p className="text-gray-400">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: ${entry.value?.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">BTC Price (30 Days)</h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#6b7280"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="#6b7280"
            fontSize={11}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Support levels as dashed lines */}
          {supports.map(level => (
            <ReferenceLine
              key={level}
              y={level}
              stroke="#6b7280"
              strokeDasharray="5 5"
              label={{ value: `$${(level / 1000).toFixed(0)}k`, position: 'left', fill: '#6b7280', fontSize: 10 }}
            />
          ))}

          {/* 200-day MA */}
          <Line
            type="monotone"
            dataKey="ma200"
            stroke="#f59e0b"
            dot={false}
            strokeWidth={2}
            strokeDasharray="4 4"
            name="200-day MA"
          />

          {/* BTC Price */}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={2}
            name="BTC Price"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> BTC Price
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-500 inline-block" style={{ borderTop: '2px dashed #f59e0b' }}></span> 200-day MA
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 inline-block" style={{ borderTop: '1px dashed #6b7280' }}></span> Support
        </span>
      </div>
    </div>
  );
}

export default PriceChart;
