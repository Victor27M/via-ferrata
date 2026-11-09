import { useEffect, useState } from 'react';
import type { Ferrata } from '../data/types.ts';
import { describe, getForecast, isThunder, type Forecast } from '../weather.ts';

const weekday = (d: string) => new Date(d + 'T12:00').toLocaleDateString(undefined, { weekday: 'short' });
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export function Weather({ site }: { site: Ferrata }) {
  const [state, setState] = useState<{ fc: Forecast; stale: boolean } | 'loading' | 'error'>('loading');

  useEffect(() => {
    let live = true;
    setState('loading');
    getForecast(site.id, site.coords).then((r) => live && setState(r), () => live && setState('error'));
    return () => { live = false; };
  }, [site.id, site.coords]);

  if (state === 'loading') return <p className="muted small">Loading forecast…</p>;
  if (state === 'error') return <p className="muted small">Forecast unavailable offline.</p>;

  const { fc, stale } = state;
  const storms = fc.days.filter((d) => isThunder(d.code));
  return (
    <>
      {storms.length > 0 && (
        <p className="warn">⚡ Thunderstorms forecast {storms.map((d) => weekday(d.date)).join(', ')}. Stay off the cable.</p>
      )}
      <div className="wx">
        {fc.days.map((d) => {
          const [emoji, label] = describe(d.code);
          return (
            <div key={d.date} className={`wx-day${isThunder(d.code) ? ' storm' : ''}`}>
              <span className="muted small">{weekday(d.date)}</span>
              <span className="wx-icon" role="img" aria-label={label} title={label}>{emoji}</span>
              <span className="wx-temp">{Math.round(d.tmax)}°<span className="muted"> {Math.round(d.tmin)}°</span></span>
              <span className="small" title="Precipitation">{d.precip > 0 ? `${d.precip.toFixed(d.precip < 10 ? 1 : 0)} mm` : '—'}</span>
              <span className={`small${d.gust >= 50 ? ' windy' : ' muted'}`} title="Max wind gusts">💨{Math.round(d.gust)}</span>
            </div>
          );
        })}
      </div>
      <p className="muted small">
        {stale || !navigator.onLine ? 'Offline · ' : ''}Updated {ago(fc.fetchedAt)} · gusts in km/h · <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>
      </p>
    </>
  );
}
