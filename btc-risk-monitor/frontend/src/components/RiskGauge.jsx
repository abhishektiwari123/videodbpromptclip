import React from 'react';

const SIGNAL_COLORS = {
  GREEN: { bg: 'bg-green-500', text: 'text-green-400', ring: 'ring-green-500' },
  YELLOW: { bg: 'bg-yellow-500', text: 'text-yellow-400', ring: 'ring-yellow-500' },
  ORANGE: { bg: 'bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-500' },
  RED: { bg: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500' }
};

function RiskGauge({ status }) {
  if (!status) return null;

  const { total, maxScore, signal, signalText, manualOverride } = status;
  const colors = SIGNAL_COLORS[signal] || SIGNAL_COLORS.GREEN;
  const percentage = (total / maxScore) * 100;

  // SVG gauge arc
  const radius = 80;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Risk Score</h2>

      <div className="flex flex-col items-center">
        {/* Gauge */}
        <svg width="200" height="120" viewBox="0 0 200 120" className="mb-2">
          {/* Background arc */}
          <path
            d="M 10 110 A 80 80 0 0 1 190 110"
            fill="none"
            stroke="#374151"
            strokeWidth="16"
            strokeLinecap="round"
          />
          {/* Colored arc */}
          <path
            d="M 10 110 A 80 80 0 0 1 190 110"
            fill="none"
            stroke={signal === 'GREEN' ? '#22c55e' : signal === 'YELLOW' ? '#eab308' : signal === 'ORANGE' ? '#f97316' : '#ef4444'}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
          {/* Score text */}
          <text x="100" y="95" textAnchor="middle" fill="white" fontSize="32" fontWeight="bold">
            {total}
          </text>
          <text x="100" y="115" textAnchor="middle" fill="#9ca3af" fontSize="12">
            / {maxScore}
          </text>
        </svg>

        {/* Signal badge */}
        <div className={`px-4 py-2 rounded-full ${colors.bg} bg-opacity-20 border border-opacity-50 ${colors.text} font-bold text-lg mb-2`}>
          {signal}
        </div>

        <p className={`text-center font-medium ${colors.text}`}>
          {signalText}
        </p>

        {manualOverride && (
          <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
            <span>&#9888;</span> Manual override active
          </p>
        )}

        {status.timestamp && (
          <p className="text-xs text-gray-500 mt-2">
            Last calculated: {new Date(status.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </p>
        )}
      </div>
    </div>
  );
}

export default RiskGauge;
