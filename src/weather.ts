// Open-Meteo daily forecast, cached per site in localStorage for an hour (and kept as an offline fallback).
export interface Day {
  date: string;
  code: number;
  tmax: number;
  tmin: number;
  precip: number; // mm
  precipProb: number | null; // %
  gust: number; // km/h
}
export interface Forecast {
  fetchedAt: number;
  days: Day[];
}

const TTL = 60 * 60 * 1000;
const key = (id: string) => `wx:${id}`;
const read = (id: string): Forecast | null => {
  try { return JSON.parse(localStorage.getItem(key(id)) ?? 'null'); } catch { return null; }
};

export async function getForecast(id: string, [lng, lat]: [number, number]): Promise<{ fc: Forecast; stale: boolean }> {
  const cached = read(id);
  if (cached && Date.now() - cached.fetchedAt < TTL) return { fc: cached, stale: false };
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=Europe%2FBucharest&forecast_days=5` +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const d = (await res.json()).daily;
    const fc: Forecast = {
      fetchedAt: Date.now(),
      days: d.time.map((date: string, i: number) => ({
        date, code: d.weather_code[i], tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i],
        precip: d.precipitation_sum[i], precipProb: d.precipitation_probability_max?.[i] ?? null, gust: d.wind_gusts_10m_max[i],
      })),
    };
    try { localStorage.setItem(key(id), JSON.stringify(fc)); } catch { /* storage full / private */ }
    return { fc, stale: false };
  } catch (e) {
    if (cached) return { fc: cached, stale: true };
    throw e;
  }
}

export const isThunder = (code: number) => code >= 95;

/** WMO weather code → emoji + label. */
export function describe(code: number): [string, string] {
  if (code === 0) return ['☀️', 'Clear'];
  if (code <= 2) return ['🌤️', 'Partly cloudy'];
  if (code === 3) return ['☁️', 'Overcast'];
  if (code <= 48) return ['🌫️', 'Fog'];
  if (code <= 57) return ['🌦️', 'Drizzle'];
  if (code <= 67) return ['🌧️', 'Rain'];
  if (code <= 77) return ['🌨️', 'Snow'];
  if (code <= 82) return ['🌦️', 'Showers'];
  if (code <= 86) return ['🌨️', 'Snow showers'];
  return ['⛈️', 'Thunderstorm'];
}
