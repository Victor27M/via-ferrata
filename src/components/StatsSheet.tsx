import { useMemo, useState } from 'react';
import { FERRATAS } from '../data/index.ts';
import { computeStats } from '../stats.ts';
import type { Completion } from '../storage/types.ts';
import { GRADE_COLORS, GradeBadge, fmtM } from '../ui.tsx';
import { BottomSheet } from './BottomSheet.tsx';

export function StatsSheet({ completions, onClose }: { completions: Completion[]; onClose: () => void }) {
  const years = [...new Set(completions.map((c) => c.date.slice(0, 4)))].sort().reverse();
  const [year, setYear] = useState<string>('');
  const s = useMemo(() => computeStats(FERRATAS, completions, year || undefined), [completions, year]);
  const all = useMemo(() => computeStats(FERRATAS, completions), [completions]);
  const pct = Math.round((s.routesDone / s.routesTotal) * 100);
  const maxYear = Math.max(1, ...all.byYear.map((y) => y.count));

  return (
    <BottomSheet title={<h2>My via ferratas</h2>} onClose={onClose} modal full>
      {years.length > 0 && (
        <div className="segmented scroll">
          <button className={!year ? 'on' : ''} onClick={() => setYear('')}>All time</button>
          {years.map((y) => <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>)}
        </div>
      )}

      <div className="hero">
        <div className="hero-num">{pct}<span>%</span></div>
        <div>
          <div className="hero-title">of Romania's via ferrata routes{year ? ` in ${year}` : ''}</div>
          <div className="muted small">{s.routesDone} of {s.routesTotal} routes · {s.sitesDone} of {s.sitesTotal} sites complete</div>
        </div>
      </div>
      <div className="progress" role="img" aria-label={`${pct}% done`}><div style={{ width: `${pct}%` }} /></div>

      <div className="tiles">
        <div className="tile"><span className="tile-num">{fmtM(s.elevationM)}</span><span className="muted small">climbed (vertical)</span></div>
        <div className="tile"><span className="tile-num">{fmtM(s.lengthM)}</span><span className="muted small">length climbed</span></div>
        <div className="tile"><span className="tile-num">{s.hardest ? <GradeBadge g={s.hardest} /> : '—'}</span><span className="muted small">hardest grade</span></div>
        <div className="tile"><span className="tile-num">{s.routesDone}</span><span className="muted small">routes</span></div>
      </div>

      <h3 className="label">By grade · done / total</h3>
      <div className="gbars">
        {s.byGrade.map((g) => (
          <div key={g.letter} className="gbar" title={`${g.letter}: ${g.done} of ${g.total} routes done`}>
            <span className="grade" style={{ background: GRADE_COLORS[g.letter] }}>{g.letter}</span>
            <div className="gbar-track">
              <div className="gbar-fill" style={{ width: `${g.total ? (g.done / g.total) * 100 : 0}%`, background: GRADE_COLORS[g.letter] }} />
            </div>
            <span className="gbar-num">{g.done}<span className="muted">/{g.total}</span></span>
          </div>
        ))}
      </div>
      <p className="hint">Combined grades (B/C…) count under the harder letter. Metres only include routes with published stats.</p>

      {all.byYear.length > 0 && (
        <>
          <h3 className="label">Routes per year</h3>
          <div className="ybars">
            {all.byYear.map((y) => (
              <button key={y.year} className={`ybar${year === y.year ? ' on' : ''}`} onClick={() => setYear(year === y.year ? '' : y.year)}
                title={`${y.year}: ${y.count} routes`}>
                <span className="ybar-num">{y.count}</span>
                <span className="ybar-col" style={{ height: `${(y.count / maxYear) * 100}%` }} />
                <span className="muted small">{y.year}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {completions.length === 0 && <p className="muted">Mark a route as completed on the map and your stats start here.</p>}
      <p className="muted small brand">Via Ferrata Romania · data via-ferrata.ro</p>
    </BottomSheet>
  );
}
