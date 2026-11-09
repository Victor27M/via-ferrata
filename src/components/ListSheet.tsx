import { useMemo, useState } from 'react';
import type { Ferrata } from '../data/types.ts';
import type { Completion } from '../storage/types.ts';
import { GradeBadge, IconCheck, fmtDate, maxGrade, today } from '../ui.tsx';
import { BottomSheet } from './BottomSheet.tsx';

interface Props {
  sites: Ferrata[]; // already filtered
  total: number;
  matches: Map<string, Set<string>>;
  done: Map<string, Completion>;
  onOpen: (siteId: string, routeId?: string) => void;
  onMark: (routeId: string, date: string) => void;
  onUnmark: (routeId: string) => void;
  onClose: () => void;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Every via ferrata (respecting the active filters) with completion status; multi-route sites expand to their routes. */
export function ListSheet({ sites, total, matches, done, onOpen, onMark, onUnmark, onClose }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const needle = fold(q.trim());
  const siteHit = (s: Ferrata) => fold(`${s.name} ${s.area} ${s.county}`).includes(needle);
  const rows = useMemo(() => {
    return [...sites]
      .filter((s) => !needle || fold(`${s.name} ${s.area} ${s.county} ${s.routes.map((r) => r.name).join(' ')}`).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'ro'));
  }, [sites, needle]);

  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <BottomSheet title={<h2>All via ferratas</h2>} onClose={onClose} modal full>
      <input className="search" type="search" placeholder="Search name, area, county…" value={q} onChange={(e) => setQ(e.target.value)} />
      <p className="muted small">
        {rows.length} of {total} sites{sites.length < total ? ' (filters active)' : ''}
      </p>

      <ul className="list">
        {rows.map((s) => {
          const doneCount = s.routes.filter((r) => done.has(r.id)).length;
          const all = doneCount === s.routes.length;
          const multi = s.routes.length > 1;
          const expanded = open.has(s.id) || (!!q.trim() && multi);
          return (
            <li key={s.id}>
              <div className="list-row">
                <span className={`status${all ? ' all' : doneCount ? ' some' : ''}`} aria-label={all ? 'Completed' : `${doneCount} of ${s.routes.length} done`}>
                  {all ? <IconCheck /> : doneCount ? `${doneCount}/${s.routes.length}` : ''}
                </span>
                <button className="list-main" onClick={() => onOpen(s.id)}>
                  <span className="route-name">{s.name}</span>
                  <span className="muted small">{s.county}{multi ? ` · ${s.routes.length} routes` : ''}</span>
                </button>
                <GradeBadge g={maxGrade(s)} />
                {multi ? (
                  <button className="chev" aria-expanded={expanded} aria-label={expanded ? 'Hide routes' : 'Show routes'} onClick={() => toggle(s.id)}>
                    {expanded ? '−' : '+'}
                  </button>
                ) : (
                  <Tick c={done.get(s.routes[0].id)} onMark={() => onMark(s.routes[0].id, today())} onUnmark={() => onUnmark(s.routes[0].id)} />
                )}
              </div>
              {multi && expanded && (
                <ul className="sublist">
                  {[...s.routes]
                    .filter((r) => !needle || siteHit(s) || fold(r.name).includes(needle)) // searching a route name shows just that route
                    .sort((a, b) => a.gradeMin - b.gradeMin || a.name.localeCompare(b.name)).map((r) => {
                    const c = done.get(r.id);
                    return (
                      <li key={r.id} className={`list-row sub${matches.get(s.id)?.has(r.id) ? '' : ' dim'}`}>
                        <GradeBadge g={r.grade} />
                        <button className="list-main" onClick={() => onOpen(s.id, r.id)}>
                          <span>{r.name}</span>
                          {c && <span className="muted small">{fmtDate(c.date)}</span>}
                        </button>
                        <Tick c={c} onMark={() => onMark(r.id, today())} onUnmark={() => onUnmark(r.id)} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="muted">Nothing matches.</p>}
    </BottomSheet>
  );
}

function Tick({ c, onMark, onUnmark }: { c?: Completion; onMark: () => void; onUnmark: () => void }) {
  return (
    <button className={`check sm${c ? ' on' : ''}`} aria-pressed={!!c} aria-label={c ? 'Mark as not done' : 'Mark as completed'}
      onClick={() => (c ? onUnmark() : onMark())}>
      <IconCheck />
    </button>
  );
}
