import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterSheet } from './components/FilterSheet.tsx';
import { LogSheet } from './components/LogSheet.tsx';
import { MapView, type Selection } from './components/MapView.tsx';
import { SettingsSheet } from './components/SettingsSheet.tsx';
import { SiteSheet } from './components/SiteSheet.tsx';
import { StatsSheet } from './components/StatsSheet.tsx';
import { FERRATAS, ROUTE_SITE } from './data/index.ts';
import { activeChips, defaultFilters, getBounds, matchSites, type Filters } from './filter.ts';
import { storage } from './storage/index.ts';
import { newId, type Completion } from './storage/types.ts';
import { IconChart, IconFilter, IconGear, IconMountain, IconX, fmtM, fmtMin } from './ui.tsx';

const BOUNDS = getBounds(FERRATAS);
const DAY = 86_400_000;
const pref = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const setPref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };

export function App() {
  const [filters, setFilters] = useState<Filters>(() => defaultFilters(BOUNDS));
  const [sheet, setSheet] = useState<'filters' | 'settings' | 'stats' | null>(null);
  const [logRouteId, setLogRouteId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [terrain3d, setTerrain3d] = useState(() => pref('terrain3d') === '1');
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [lastBackup, setLastBackup] = useState<string>();
  const [reminderHidden, setReminderHidden] = useState(false);

  const reload = useCallback(async () => {
    setCompletions(await storage.listCompletions());
    setLastBackup(await storage.getMeta('lastBackupAt'));
  }, []);
  useEffect(() => void reload(), [reload]);

  const done = useMemo(() => new Map(completions.map((c) => [c.routeId, c])), [completions]);
  const doneRouteIds = useMemo(() => new Set(done.keys()), [done]);
  const doneSites = useMemo(() => new Set(FERRATAS.filter((f) => f.routes.every((r) => done.has(r.id))).map((f) => f.id)), [done]);
  const matches = useMemo(() => matchSites(FERRATAS, filters, BOUNDS, doneRouteIds), [filters, doneRouteIds]);
  const visible = useMemo(() => FERRATAS.filter((f) => matches.has(f.id)), [matches]);
  const chips = activeChips(filters, BOUNDS, fmtM, fmtMin);
  const selected = FERRATAS.find((f) => f.id === selection?.siteId);

  const mark = async (routeId: string, date: string) => {
    await storage.saveCompletion({ id: done.get(routeId)?.id ?? newId(), routeId, date });
    await reload();
  };
  const saveCompletion = async (c: Completion) => {
    await storage.saveCompletion(c);
    await reload();
  };
  const unmark = async (routeId: string) => {
    const c = done.get(routeId);
    if (c) await storage.removeCompletion(c.id);
    setLogRouteId(null);
    await reload();
  };
  const logCompletion = logRouteId ? done.get(logRouteId) : undefined;
  const logSite = logRouteId ? ROUTE_SITE.get(logRouteId) : undefined;

  // Gentle nudge: data exists and nothing backed up for 30+ days.
  const since = lastBackup ? Date.parse(lastBackup) : Math.min(...completions.map((c) => c.updatedAt));
  const showReminder = !reminderHidden && completions.length > 0 && Date.now() - since > 30 * DAY;

  return (
    <>
      <MapView sites={visible} matches={matches} doneRoutes={doneRouteIds} doneSites={doneSites} selected={selection} terrain3d={terrain3d} onSelect={setSelection} />

      <div className="top">
        {showReminder && (
          <div className="toast">
            <span>{lastBackup ? `Last backup ${Math.floor((Date.now() - since) / DAY)} days ago.` : 'Your climbs are not backed up yet.'}</span>
            <button className="link" onClick={() => setSheet('settings')}>Back up</button>
            <button className="icon-btn" onClick={() => setReminderHidden(true)} aria-label="Dismiss"><IconX /></button>
          </div>
        )}
        {chips.length > 0 && (
          <div className="chips">
            {chips.map((c) => (
              <button key={c.key} className="chip" onClick={() => setFilters({ ...filters, ...c.reset })}>
                {c.label} <IconX />
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="bar">
        <button className="bar-btn grow" onClick={() => setSheet('filters')}>
          <IconFilter /> Filters {chips.length > 0 && <span className="count">{chips.length}</span>}
          <span className="muted small" aria-label={`${visible.length} of ${FERRATAS.length} sites shown`}>{visible.length}/{FERRATAS.length}</span>
        </button>
        <button className="bar-btn" onClick={() => setSheet('stats')} aria-label="Stats"><IconChart /></button>
        <button className={`bar-btn${terrain3d ? ' on' : ''}`} aria-pressed={terrain3d} onClick={() => {
          setTerrain3d(!terrain3d);
          setPref('terrain3d', terrain3d ? '0' : '1');
        }}>
          <IconMountain /> 3D
        </button>
        <button className="bar-btn" onClick={() => setSheet('settings')} aria-label="Settings"><IconGear /></button>
      </nav>

      {selected && !sheet && !logCompletion && (
        <SiteSheet site={selected} matching={matches.get(selected.id)} done={done} highlight={selection?.routeId} onMark={mark} onOpenLog={setLogRouteId} onClose={() => setSelection(null)} />
      )}
      {logCompletion && logSite && (
        <LogSheet key={logCompletion.id} site={logSite} route={logSite.routes.find((r) => r.id === logRouteId)!} completion={logCompletion}
          onSave={saveCompletion} onRemove={() => unmark(logRouteId!)} onClose={() => setLogRouteId(null)} />
      )}
      {sheet === 'stats' && <StatsSheet completions={completions} onClose={() => setSheet(null)} />}
      {sheet === 'filters' && (
        <FilterSheet filters={filters} bounds={BOUNDS} resultCount={visible.length} onChange={setFilters} onClose={() => setSheet(null)} />
      )}
      {sheet === 'settings' && (
        <SettingsSheet lastBackup={lastBackup} completionCount={completions.length} onBackedUp={reload} onImported={reload} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
