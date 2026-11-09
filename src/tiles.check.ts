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
