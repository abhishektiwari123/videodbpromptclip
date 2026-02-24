import React from 'react';

const EVENT_COLORS = {
  FOMC: 'bg-red-500/20 text-red-400 border-red-500/30',
  CPI: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  NFP: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  EARNINGS: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  OPTIONS_EXPIRY: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  TARIFF: 'bg-red-500/20 text-red-400 border-red-500/30',
  GEOPOLITICAL: 'bg-red-500/20 text-red-400 border-red-500/30'
};

function MacroCalendar({ events }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Macro Calendar (14 Days)</h2>

      {(!events || events.length === 0) ? (
        <p className="text-gray-500 text-sm">No upcoming macro events.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {events.map((event, idx) => {
            const isNear = event.hoursAway <= 48;
            const colors = EVENT_COLORS[event.type] || 'bg-gray-700/20 text-gray-400 border-gray-500/30';

            return (
              <div
                key={idx}
                className={`flex items-center justify-between p-3 rounded-lg border ${isNear ? 'border-red-500/50 bg-red-500/5' : 'border-gray-800 bg-gray-800/30'}`}
              >
                <div className="flex items-center gap-3">
                  {isNear && (
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>
                  )}
                  <div>
                    <p className={`text-sm font-medium ${isNear ? 'text-red-300' : 'text-gray-300'}`}>
                      {event.name}
                    </p>
                    <p className="text-xs text-gray-500">{event.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${colors}`}>
                    {event.type}
                  </span>
                  <span className={`text-xs ${isNear ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                    {event.daysAway < 1
                      ? `${Math.round(event.hoursAway)}h`
                      : `${Math.round(event.daysAway)}d`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MacroCalendar;
