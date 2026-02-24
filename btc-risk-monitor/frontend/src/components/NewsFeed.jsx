import React from 'react';

function highlightKeywords(text, keywords) {
  if (!keywords) return text;
  const kws = keywords.split(', ');
  let result = text;
  for (const kw of kws) {
    const regex = new RegExp(`(${kw})`, 'gi');
    result = result.replace(regex, '**$1**');
  }
  // Convert **text** to spans
  const parts = result.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="bg-red-500/20 text-red-300 px-1 rounded font-medium">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function NewsFeed({ news }) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h2 className="text-lg font-semibold text-gray-300 mb-4">Flagged News</h2>

      {(!news || news.length === 0) ? (
        <p className="text-gray-500 text-sm">No flagged news items.</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {news.map((item, idx) => (
            <div key={idx} className="border-b border-gray-800 pb-3 last:border-0">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:text-blue-300 transition block mb-1"
              >
                {highlightKeywords(item.title, item.matched_keywords)}
              </a>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{item.source}</span>
                <span>&middot;</span>
                <span>{new Date(item.timestamp).toLocaleDateString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
                {item.matched_keywords && (
                  <>
                    <span>&middot;</span>
                    <span className="text-red-400">
                      Keywords: {item.matched_keywords}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NewsFeed;
