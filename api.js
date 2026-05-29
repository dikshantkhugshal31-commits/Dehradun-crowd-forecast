// api.js — Fetch weather and prediction data from Flask backend

/**
 * Fetch live weather from our Flask /api/weather endpoint.
 * Falls back gracefully if the request fails.
 */
export async function fetchWeather() {
  const res = await fetch('/api/weather');
  if (!res.ok) throw new Error(`Weather API ${res.status}`);
  return res.json();
}

/**
 * Fetch monthly tourist predictions for the current year.
 * Returns { year, monthly: { "1": N, "2": N, ... } }
 */
export async function fetchMonthlyPredictions() {
  const res = await fetch('/api/predictions/monthly');
  if (!res.ok) throw new Error(`Predictions API ${res.status}`);
  return res.json();
}

/**
 * Fetch daily tourists for a specific month.
 * @param {number} year
 * @param {number} month  (1–12)
 */
export async function fetchDailyPredictions(year, month) {
  const res = await fetch(`/api/predictions/daily?year=${year}&month=${month}`);
  if (!res.ok) throw new Error(`Daily API ${res.status}`);
  return res.json();
}
