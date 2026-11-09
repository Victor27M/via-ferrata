import type { Ferrata, Route } from './data/types.ts';

export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
export type Letter = (typeof LETTERS)[number];
export type Range = [number, number];
export type Status = 'all' | 'done' | 'todo';

export interface Filters {
  grades: Letter[]; // empty = any
  length: Range;
  duration: Range; // ferrata minutes
  status: Status;
}

export interface Bounds {
  length: Range;
  duration: Range;
}

export function getBounds(fs: Ferrata[]): Bounds {
  const rs = fs.flatMap((f) => f.routes);
  const max = (k: 'lengthM' | 'ferrataMin', step: number) =>
    Math.ceil(Math.max(0, ...rs.map((r) => r[k] ?? 0)) / step) * step;
  return { length: [0, max('lengthM', 50)], duration: [0, max('ferrataMin', 15)] };
}

export const defaultFilters = (b: Bounds): Filters => ({ grades: [], length: b.length, duration: b.duration, status: 'all' });

const narrowed = (r: Range, b: Range) => r[0] > b[0] || r[1] < b[1];
const inRange = (v: number | null, r: Range, b: Range) => !narrowed(r, b) || (v != null && v >= r[0] && v <= r[1]);

/** Combined grades match both neighbours: "B/C" matches B or C. */
export function routeMatches(r: Route, f: Filters, b: Bounds, done: boolean): boolean {
  if (f.grades.length && !r.grade.split('/').some((g) => f.grades.includes(g as Letter))) return false;
  if (f.status === 'done' && !done) return false;
  if (f.status === 'todo' && done) return false;
  return inRange(r.lengthM, f.length, b.length) && inRange(r.ferrataMin, f.duration, b.duration);
}

/** siteId → ids of its routes that match. Sites with no matching route are absent. */
export function matchSites(fs: Ferrata[], f: Filters, b: Bounds, doneRoutes: Set<string>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const s of fs) {
    const ids = s.routes.filter((r) => routeMatches(r, f, b, doneRoutes.has(r.id))).map((r) => r.id);
    if (ids.length) out.set(s.id, new Set(ids));
  }
  return out;
}

/** Labels for active filters, each with a reset patch. */
export function activeChips(f: Filters, b: Bounds, fmtLen: (n: number) => string, fmtDur: (n: number) => string) {
  const chips: { key: keyof Filters; label: string; reset: Partial<Filters> }[] = [];
  if (f.grades.length) chips.push({ key: 'grades', label: f.grades.join(' · '), reset: { grades: [] } });
  if (narrowed(f.length, b.length))
    chips.push({ key: 'length', label: `↔ ${fmtLen(f.length[0])}–${fmtLen(f.length[1])}`, reset: { length: b.length } });
  if (narrowed(f.duration, b.duration))
    chips.push({ key: 'duration', label: `⏱ ${fmtDur(f.duration[0])}–${fmtDur(f.duration[1])}`, reset: { duration: b.duration } });
  if (f.status !== 'all') chips.push({ key: 'status', label: f.status === 'done' ? 'Completed' : 'Not done', reset: { status: 'all' } });
  return chips;
}
