import assert from 'node:assert/strict';
import type { Route } from './data/types.ts';
import { defaultFilters, routeMatches, type Bounds } from './filter.ts';

const b: Bounds = { length: [0, 700], duration: [0, 150] };
const r = (grade: Route['grade'], lengthM: number | null, ferrataMin: number | null) =>
  ({ id: 'x', name: 'x', grade, gradeMin: 0, lengthM, elevationM: null, ferrataMin, totalMin: null }) as Route;
const f = defaultFilters(b);

assert.ok(routeMatches(r('B/C', null, null), f, b, false), 'default filter matches everything');
assert.ok(routeMatches(r('B/C', 200, 40), { ...f, grades: ['C'] }, b, false), 'combined grade matches upper');
assert.ok(routeMatches(r('B/C', 200, 40), { ...f, grades: ['B'] }, b, false), 'combined grade matches lower');
assert.ok(!routeMatches(r('B/C', 200, 40), { ...f, grades: ['A', 'D'] }, b, false));
assert.ok(!routeMatches(r('B', null, 40), { ...f, length: [100, 700] }, b, false), 'unknown length excluded once narrowed');
assert.ok(routeMatches(r('B', 300, 40), { ...f, length: [100, 300] }, b, false), 'range is inclusive');
assert.ok(!routeMatches(r('B', 300, 90), { ...f, duration: [0, 60] }, b, false));
assert.ok(!routeMatches(r('B', 300, 40), { ...f, status: 'done' }, b, false));
assert.ok(routeMatches(r('B', 300, 40), { ...f, status: 'todo' }, b, false));
console.log('filter checks ok');

// stats
import { computeStats } from './stats.ts';
const site = (id: string, routes: Route[]) => ({ id, name: id, area: '', county: '', coords: [0, 0] as [number, number], coordsVerified: true, paid: null, sourceUrl: '', routes });
const rt = (id: string, grade: Route['grade'], elevationM: number | null) => ({ ...r(grade, 100, 30), id, elevationM });
const fs = [site('s1', [rt('a', 'A', 50), rt('b', 'C/D', null)]), site('s2', [rt('c', 'B', 100)])];
const cs = [{ id: '1', routeId: 'a', date: '2025-06-01', updatedAt: 0 }, { id: '2', routeId: 'b', date: '2026-07-01', updatedAt: 0 }];
const st = computeStats(fs, cs);
assert.equal(st.routesDone, 2);
assert.equal(st.sitesDone, 1);
assert.equal(st.elevationM, 50, 'unknown elevation counts as 0');
assert.equal(st.hardest, 'C/D');
assert.deepEqual(st.byGrade.find((g) => g.letter === 'D'), { letter: 'D', done: 1, total: 1 });
assert.deepEqual(st.byYear, [{ year: '2025', count: 1 }, { year: '2026', count: 1 }]);
assert.equal(computeStats(fs, cs, '2025').routesDone, 1);
console.log('stats checks ok');
