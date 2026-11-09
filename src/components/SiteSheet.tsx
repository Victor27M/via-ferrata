import type { Ferrata, Route } from '../data/types.ts';
import type { Completion } from '../storage/types.ts';
import { GradeBadge, IconCheck, IconExternal, IconNote, IconRoute, fmtDate, fmtM, fmtMin, today } from '../ui.tsx';
import { BottomSheet } from './BottomSheet.tsx';
import { OfflineArea } from './OfflineArea.tsx';
import { Weather } from './Weather.tsx';

interface Props {
  site: Ferrata;
  matching: Set<string> | undefined;
  done: Map<string, Completion>;
  /** Route tapped on the map: highlighted and scrolled into view. */
  highlight?: string;
  onMark: (routeId: string, date: string) => void;
  onOpenLog: (routeId: string) => void;
  onClose: () => void;
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="stat">
    <span className="stat-value">{value}</span>
    <span className="stat-label">{label}</span>
  </div>
);

export function SiteSheet({ site, matching, done, highlight, onMark, onOpenLog, onClose }: Props) {
  const main = site.routes.find((r) => r.isMain) ?? (site.routes.length === 1 ? site.routes[0] : undefined);
  const doneCount = site.routes.filter((r) => done.has(r.id)).length;
  const grades = [...new Set([...site.routes].sort((a, b) => a.gradeMin - b.gradeMin).map((r) => r.grade))];
  const multi = site.routes.length > 1;
  const [lng, lat] = site.coords;

  return (
    <BottomSheet
      onClose={onClose}
      title={
        <>
          <h2>{site.name}</h2>
          <p className="muted small">{[site.area, site.county].filter(Boolean).join(' · ')}</p>
        </>
      }
    >
      <div className="badges">
        {grades.map((g) => <GradeBadge key={g} g={g} />)}
        <span className="pill">{site.paid == null ? 'Fee unknown' : site.paid ? 'Paid' : 'Free'}</span>
        {multi && <span className="pill">{site.routes.length} routes</span>}
        {doneCount > 0 && <span className={`pill ${doneCount === site.routes.length ? 'done' : ''}`}>{doneCount}/{site.routes.length} done</span>}
      </div>

      {main && (
        <>
          {multi && <h3 className="label">Main route · {main.name}</h3>}
          <div className="stats">
            <Stat label="length" value={fmtM(main.lengthM)} />
            <Stat label="elevation" value={fmtM(main.elevationM)} />
            <Stat label="ferrata" value={fmtMin(main.ferrataMin)} />
            <Stat label="total" value={fmtMin(main.totalMin)} />
          </div>
        </>
      )}

      <div className="directions">
        <a className="btn ghost" href={`https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`} target="_blank" rel="noopener">
          <IconRoute /> Apple Maps
        </a>
        <a className="btn ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener">
          <IconRoute /> Google Maps
        </a>
      </div>
      <p className="hint">To the route start — see the source page for parking.</p>

      <h3 className="label">{multi ? 'Routes' : 'Your climb'}</h3>
      <ul className="routes">
        {[...site.routes].sort((a, b) => a.gradeMin - b.gradeMin).map((r) => (
          <RouteRow key={r.id} r={r} dim={!!matching && !matching.has(r.id)} hl={r.id === highlight} c={done.get(r.id)} onMark={onMark} onOpenLog={onOpenLog} />
        ))}
      </ul>

      <h3 className="label">Weather · next 5 days</h3>
      <Weather site={site} />

      <h3 className="label">Offline map</h3>
      <OfflineArea site={site} />

      <a className="source" href={site.sourceUrl} target="_blank" rel="noopener">
        Full description on via-ferrata.ro <IconExternal />
      </a>
    </BottomSheet>
  );
}

function RouteRow({ r, dim, hl, c, onMark, onOpenLog }: { r: Route; dim: boolean; hl: boolean; c?: Completion } & Pick<Props, 'onMark' | 'onOpenLog'>) {
  const facts = [r.lengthM && `↔ ${fmtM(r.lengthM)}`, r.elevationM && `↑ ${fmtM(r.elevationM)}`, r.ferrataMin && `⏱ ${fmtMin(r.ferrataMin)}`]
    .filter(Boolean)
    .join('  ');
  const logged = c && (c.notes || c.partners || c.conditions?.length);
  return (
    <li className={`route${dim ? ' dim' : ''}${c ? ' is-done' : ''}${hl ? ' hl' : ''}`} ref={hl ? (el) => el?.scrollIntoView({ block: 'center', behavior: 'smooth' }) : undefined}>
      <GradeBadge g={r.grade} />
      {c ? (
        <button className="route-main" onClick={() => onOpenLog(r.id)}>
          <span className="route-name">{r.name}</span>
          <span className="done-date"><IconNote /> {fmtDate(c.date)} · {logged ? 'View log' : 'Add notes & photos'}</span>
        </button>
      ) : (
        <div className="route-main">
          <span className="route-name">{r.name}</span>
          <span className="muted small">{facts || 'No published stats'}</span>
        </div>
      )}
      <button className={`check${c ? ' on' : ''}`} aria-pressed={!!c} aria-label={c ? 'Open log' : 'Mark as completed'}
        onClick={() => (c ? onOpenLog(r.id) : onMark(r.id, today()))}>
        <IconCheck />
      </button>
    </li>
  );
}
