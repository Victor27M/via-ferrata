import assert from 'node:assert/strict';
import { gradeNum } from '../src/data/types.ts';
import { parseDecimalCoords, parseDuration, parseGrade, parseMeters } from './parse.ts';

const dur: [string | null, number | null][] = [
  ['1h 30min', 90], ['90 min', 90], ['2-3 ore', 180], ['1h30', 90], ['1h 05', 65],
  ['45min – 1h15min', 75], ['1h-1h30', 90], ['20min+', 20], ['2h+', 120],
  ['45 min (din care 10 min este retragerea)', 45], ['?', null], ['…', null], [null, null],
];
for (const [s, want] of dur) assert.equal(parseDuration(s), want, `duration ${s}`);

assert.equal(parseGrade('B (sau A conform Cassio Montana)'), 'B');
assert.equal(parseGrade('Dificultate C/D (mediu/dificil)'), 'C/D');
assert.equal(parseGrade(': D (greu) – impresii'), 'D');
assert.equal(parseGrade('nimic aici'), null);
assert.equal(gradeNum('A'), 1);
assert.equal(gradeNum('A/B'), 1.5);
assert.equal(gradeNum('E'), 5);
assert.equal(parseMeters('↔ 450m'), 450);
assert.equal(parseMeters('450-750m'), 450);
assert.deepEqual(parseDecimalCoords('45°32’N sau 45.545250,25.518000 (geo)'), [25.518, 45.54525]);
console.log('parse checks ok');

// overrides merge
import { applyOverrides } from '../src/data/merge.ts';
const base = [{ id: 's', name: 'S', area: '', county: 'X', coords: [0, 0] as [number, number], coordsVerified: false, paid: null, sourceUrl: '',
  routes: [{ id: 's', name: 'S', grade: 'B' as const, gradeMin: 2, lengthM: null, elevationM: null, ferrataMin: null, totalMin: null }] }];
const m = applyOverrides(base, { sites: { s: { coords: [25, 45], routes: [{ id: 's', grade: 'C' }, { id: 's-2', name: 'S2', grade: 'A/B' } as never] } }, remove: [] });
assert.equal(m[0].coordsVerified, true);
assert.equal(m[0].routes[0].gradeMin, 3);
assert.equal(m[0].routes[1].gradeMin, 1.5);
assert.equal(applyOverrides(base, { remove: ['s'] }).length, 0);
console.log('merge checks ok');
