import React from 'react';

const COMPONENT_LABELS = {
  fearGreed: { label: 'Fear & Greed Index', key: 'fear_greed' },
  etfFlows: { label: 'ETF Flows', key: 'etf_flows' },
  movingAverage: { label: '200-Day Moving Avg', key: 'moving_average' },
  supportDistance: { label: 'Support Distance', key: 'support_distance' },
  openInterest: { label: 'Open Interest', key: 'open_interest' },
  macroEvents: { label: 'Macro Events (48h)', key: 'macro_events' },
  dayOfWeek: { label: 'Day of Week', key: 'day_of_week' }
};

function getBarColor(score) {
  if (score <= 3) return 'bg-green-500';
  if (score <= 6) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getBarBg(score) {
  if (score <= 3) return 'bg-green-500/10';
  if (score <= 6) return 'bg-yellow-500/10';
  return 'bg-red-500/10';
}

function ScoreBreakdown({ status }) {
  if (!status || !status.scores) return null;

  const scores = status.scores;

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Score Breakdown</h2>

      <div className="space-y-3">
        {Object.entries(COMPONENT_LABELS).map(([key, { label }]) => {
          const score = scores[key] ?? scores[COMPONENT_LABELS[key].key] ?? 0;
          const width = (score / 10) * 100;

          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">{label}</span>
                <span className={`font-mono font-bold ${score <= 3 ? 'text-green-400' : score <= 6 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {score}/10
                </span>
              </div>
              <div className={`w-full h-3 rounded-full ${getBarBg(score)}`}>
                <div
                  className={`h-3 rounded-full ${getBarColor(score)} transition-all duration-500`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Raw data summary */}
      {status.rawData && (
        <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs text-gray-500">
          {status.rawData.fgi !== undefined && (
            <span>F&G: {status.rawData.fgi}</span>
          )}
          {status.rawData.etfFlow !== undefined && (
            <span>ETF: ${status.rawData.etfFlow}M</span>
          )}
          {status.rawData.oiChange !== undefined && (
            <span>OI: {status.rawData.oiChange?.toFixed(1)}%</span>
          )}
          {status.rawData.ma200 && (
            <span>MA200: ${status.rawData.ma200?.toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default ScoreBreakdown;
