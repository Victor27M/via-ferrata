import assert from 'node:assert/strict';
import { boxAround, isTileUrl, tileKey, tilesInBounds } from './tiles.ts';

// z0 is one tile, z1 the whole world is 4
assert.equal(tilesInBounds([-179, -80, 179, 80], 0, 0).length, 1);
assert.equal(tilesInBounds([-179, -80, 179, 80], 1, 1).length, 4);
// Baia de Fier: 10 km radius, z10–14 stays far below OpenFreeMap's 3000-tile cap
const box = boxAround([23.754, 45.1924], 10);
const n = tilesInBounds(box, 10, 14).length;
assert.ok(n > 150 && n < 400, `tile count ${n}`);
// the centre tile at z14 is the one tile servers return for that point
assert.ok(tilesInBounds(box, 14, 14).some(([, x, y]) => x === 9273 && y === 5881));
assert.equal(tileKey('https://tiles.openfreemap.org/planet/20261101_080013_pt/14/9273/5881.pbf'), 'https://tiles.openfreemap.org/planet/_/14/9273/5881.pbf');
assert.ok(isTileUrl(new URL('https://tiles.openfreemap.org/planet/20261101_080013_pt/14/9273/5881.pbf')));
assert.ok(!isTileUrl(new URL('https://tiles.openfreemap.org/planet')));
assert.ok(isTileUrl(new URL('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/4636/2931.png')));
console.log('tile checks ok');

// geo helpers
import { metres, regionRing, spread } from './geo.ts';
const same: [number, number][] = [[23.754, 45.19239], [23.754, 45.19239], [23.754, 45.19239], [23.7552, 45.19223]];
const sp = spread(same);
assert.equal(new Set(sp.map((p) => p.join())).size, 4, 'shared starts are fanned out');
assert.ok(metres(sp[3], same[3]) < 1, 'far-apart points stay put');
assert.ok(Math.abs(sp[0][1] - same[0][1]) < 0.0004, 'fan-out stays within metres');
const near = spread([[23.75636, 45.189578], [23.75633, 45.18973], [23.75647, 45.1895]]); // Laura / Virus / Iulia, 8–20 m apart
const gaps = [metres(near[0], near[1]), metres(near[1], near[2]), metres(near[0], near[2])];
assert.ok(Math.min(...gaps) > 21, `close starts are pushed apart (${gaps.map(Math.round)})`);
const ring = regionRing([[23.754, 45.192], [23.756, 45.187]]);
assert.deepEqual(ring[0], ring.at(-1), 'ring is closed');
const lats = ring.map((p) => p[1]);
assert.ok(Math.min(...lats) < 45.187 && Math.max(...lats) > 45.192, 'ring encloses the points');
console.log('geo checks ok');
