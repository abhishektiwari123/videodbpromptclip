const BASE_URL = '/api';

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getStatus(fresh = false) {
  return fetchJSON(`/status${fresh ? '?fresh=true' : ''}`);
}

export async function forceCalculate() {
  const res = await fetch(`${BASE_URL}/calculate`, { method: 'POST' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getPrice() {
  return fetchJSON('/price');
}

export async function getScoreHistory(days = 30) {
  return fetchJSON(`/scores/history?days=${days}`);
}

export async function getPriceHistory(days = 30) {
  return fetchJSON(`/prices/history?days=${days}`);
}

export async function getCalendar(days = 14) {
  return fetchJSON(`/calendar?days=${days}`);
}

export async function getNews(limit = 10) {
  return fetchJSON(`/news?limit=${limit}`);
}

export async function getSupportLevels() {
  return fetchJSON('/support');
}
