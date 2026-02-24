// IST (Indian Standard Time) utility
const IST_OFFSET_MS = 330 * 60 * 1000; // +5:30 in milliseconds

function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

function toIST(date) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

function formatIST(date) {
  const ist = date instanceof Date ? toIST(date) : nowIST();
  return ist.toISOString().replace('Z', '+05:30');
}

function todayDateIST() {
  const ist = nowIST();
  return ist.toISOString().split('T')[0];
}

module.exports = { nowIST, toIST, formatIST, todayDateIST };
