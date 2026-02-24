import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea
} from 'recharts';

function ScoreHistory({ scoreHistory }) {
  if (!scoreHistory || scoreHistory.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Risk Score History (30 Days)</h2>
        <p className="text-gray-500 text-sm">No score history available yet.</p>
      </div>
    );
  }

  // Process data - take latest score per day
  const dailyScores = {};
  // scoreHistory comes DESC from API, reverse for chart
  const sorted = [...scoreHistory].reverse();
  for (const s of sorted) {
    const date = s.timestamp.split('T')[0];
    dailyScores[date] = {
      date: new Date(s.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      score: s.total_score,
      signal: s.signal
    };
  }

  const chartData = Object.values(dailyScores);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const score = payload[0].value;
      let signal = 'GREEN';
      if (score > 45) signal = 'RED';
      else if (score > 30) signal = 'ORANGE';
      else if (score > 15) signal = 'YELLOW';

      return (
        <div className="bg-gray-800 border border-gray-700 rounded p-2 text-sm">
          <p className="text-gray-400">{label}</p>
          <p className={`font-bold ${signal === 'GREEN' ? 'text-green-400' : signal === 'YELLOW' ? 'text-yellow-400' : signal === 'ORANGE' ? 'text-orange-400' : 'text-red-400'}`}>
            Score: {score}/70 ({signal})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Risk Score History (30 Days)</h2>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
          {/* Zone background colors */}
          <ReferenceArea y1={0} y2={15} fill="#22c55e" fillOpacity={0.05} />
          <ReferenceArea y1={15} y2={30} fill="#eab308" fillOpacity={0.05} />
          <ReferenceArea y1={30} y2={45} fill="#f97316" fillOpacity={0.05} />
          <ReferenceArea y1={45} y2={70} fill="#ef4444" fillOpacity={0.05} />

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
            domain={[0, 70]}
            ticks={[0, 15, 30, 45, 70]}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Zone thresholds */}
          <ReferenceLine y={15} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={30} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={45} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.5} />

          <Area
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span><span className="text-gray-500">0-15 Safe</span></span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full"></span><span className="text-gray-500">16-30 Caution</span></span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-full"></span><span className="text-gray-500">31-45 No Deploy</span></span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span><span className="text-gray-500">46-70 Pause</span></span>
      </div>
    </div>
  );
}

export default ScoreHistory;
