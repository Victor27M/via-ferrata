// Shared by the page and the service worker: tile URLs, cache names, tile math.

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
export const OFM_HOST = 'tiles.openfreemap.org';
export const DEM_TEMPLATE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
/** Terrarium over Romania is ~30 m SRTM data; z13 (~13 m/px) already holds all of it, higher zooms are upsampled. */
export const DEM_MAXZOOM = 13;

export const CACHE_META = 'map-meta'; // style, TileJSON, sprites, fonts
export const CACHE_RUNTIME = 'tiles-runtime'; // tiles seen while browsing (trimmed)
export const areaCache = (id: string) => `area-${id}`; // tiles from "download area" (never trimmed)

export const isTileUrl = (u: URL) =>
  (u.hostname === OFM_HOST && /\/planet\/[^/]+\/\d+\/\d+\/\d+\.pbf$/.test(u.pathname)) ||
  (u.hostname === 's3.amazonaws.com' && u.pathname.startsWith('/elevation-tiles-prod/terrarium/'));

/**
 * OpenFreeMap tile URLs contain a weekly build id (/planet/20261101_080013_pt/z/x/y.pbf).
 * Cache them under a version-free key, so tiles downloaded last month still match next month's URLs offline.
 */
export const tileKey = (url: string) => url.replace(/\/planet\/[^/]+\/(\d+\/\d+\/\d+\.pbf)$/, '/planet/_/$1');

export type Tile = [z: number, x: number, y: number];

const lng2x = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** z);
};

/** Tiles covering a lng/lat box at zooms [minZ, maxZ]. */
export function tilesInBounds([w, s, e, n]: [number, number, number, number], minZ: number, maxZ: number): Tile[] {
  const out: Tile[] = [];
  for (let z = minZ; z <= maxZ; z++)
    for (let x = lng2x(w, z); x <= lng2x(e, z); x++)
      for (let y = lat2y(n, z); y <= lat2y(s, z); y++) out.push([z, x, y]);
  return out;
}

/** Square box of ±km around a point. */
export function boxAround([lng, lat]: [number, number], km: number): [number, number, number, number] {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

export const fill = (template: string, [z, x, y]: Tile) =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
