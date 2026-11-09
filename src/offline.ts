// "Download area for offline": pre-caches vector + terrain tiles around a site into Cache Storage.
// OpenFreeMap allows this for offline use if each download is ≤3000 tiles / 50 MB with ≤4 parallel requests
// (openfreemap.org/tos). AWS Terrain Tiles are open data with no request limits.
import { useSyncExternalStore } from 'react';
import { CACHE_META, DEM_MAXZOOM, DEM_TEMPLATE, STYLE_URL, areaCache, boxAround, fill, tileKey, tilesInBounds, type Tile } from './tiles.ts';

export const RADIUS_KM = 10;
export const OVERVIEW_ID = 'romania-overview';
const ROMANIA: [number, number, number, number] = [20.2, 43.6, 29.8, 48.3];
const PARALLEL = 4;
const OFM_MAX_TILES = 3000;

export interface Area {
  id: string;
  name: string;
  tiles: number;
  bytes: number;
  createdAt: string;
}
export interface Plan {
  id: string;
  name: string;
  vector: Tile[];
  dem: Tile[];
  estimateBytes: number;
}

// Measured averages (KB) for Romanian mountain areas; only used for the "≈ size" before downloading.
const VECTOR_KB: Record<number, number> = { 5: 200, 6: 200, 7: 180, 8: 150, 9: 130, 10: 115, 11: 60, 12: 25, 13: 12, 14: 13 };
const DEM_KB = 120;

export function planArea(id: string, name: string, coords: [number, number]): Plan {
  const box = boxAround(coords, RADIUS_KM);
  return withEstimate({ id, name, vector: tilesInBounds(box, 10, 14), dem: tilesInBounds(box, 10, DEM_MAXZOOM) });
}

export function planOverview(): Plan {
  return withEstimate({ id: OVERVIEW_ID, name: 'Romania overview (zoomed out)', vector: tilesInBounds(ROMANIA, 5, 8), dem: tilesInBounds(ROMANIA, 5, 7) });
}

function withEstimate(p: Omit<Plan, 'estimateBytes'>): Plan {
  const kb = p.vector.reduce((s, [z]) => s + (VECTOR_KB[z] ?? 15), 0) + p.dem.length * DEM_KB;
  return { ...p, estimateBytes: kb * 1024 };
}

// ---------- area list (localStorage; tiles themselves live in Cache Storage) ----------
const LIST_KEY = 'offline-areas';
let areas: Area[] = (() => { try { return JSON.parse(localStorage.getItem(LIST_KEY) ?? '[]'); } catch { return []; } })();
export type Progress = { id: string; done: number; total: number } | null;
let progress: Progress = null;
let controller: AbortController | null = null;
const listeners = new Set<() => void>();
let snapshot: { areas: Area[]; progress: Progress } = { areas, progress };
const emit = () => {
  snapshot = { areas, progress };
  try { localStorage.setItem(LIST_KEY, JSON.stringify(areas)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
};

export function useOffline() {
  return useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => snapshot);
}

// ---------- download ----------
async function vectorTemplate(): Promise<string> {
  const style = await (await fetch(STYLE_URL)).json();
  const tileJson = await (await fetch(style.sources.openmaptiles.url)).json();
  return tileJson.tiles[0];
}

/** Style, TileJSON, sprites and the glyph ranges the labels use (Latin, Romanian diacritics, Cyrillic, punctuation). */
async function cacheBasics() {
  const style = await (await fetch(STYLE_URL)).json();
  const fonts = new Set<string>(['Noto Sans Regular']);
  const urls = [
    STYLE_URL,
    style.sources.openmaptiles.url,
    ...['.json', '.png', '@2x.json', '@2x.png'].map((s) => style.sprite + s),
    ...[...fonts].flatMap((f) =>
      ['0-255', '256-511', '512-767', '1024-1279', '8192-8447'].map((r) =>
        style.glyphs.replace('{fontstack}', encodeURIComponent(f)).replace('{range}', r))),
  ];
  const cache = await caches.open(CACHE_META);
  await Promise.all(urls.map(async (u) => { const r = await fetch(u); if (r.ok) await cache.put(u, r); }));
}

export async function downloadArea(plan: Plan): Promise<void> {
  if (progress) throw new Error('Another download is running');
  if (plan.vector.length > OFM_MAX_TILES) throw new Error('Area too large for OpenFreeMap’s offline limit');
  controller = new AbortController();
  const { signal } = controller;
  const template = await vectorTemplate();
  const jobs = [...plan.vector.map((t) => fill(template, t)), ...plan.dem.map((t) => fill(DEM_TEMPLATE, t))];
  progress = { id: plan.id, done: 0, total: jobs.length };
  emit();

  const cache = await caches.open(areaCache(plan.id));
  let bytes = 0;
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length && !signal.aborted) {
      const url = jobs[next++];
      try {
        const res = await fetch(url, { signal, cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        bytes += blob.size;
        await cache.put(tileKey(url), new Response(blob, { headers: { 'Content-Type': res.headers.get('Content-Type') ?? '' } }));
      } catch {
        if (signal.aborted) return;
        failed++;
      }
      progress = { ...progress!, done: progress!.done + 1 };
      emit();
    }
  };

  try {
    await cacheBasics();
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    if (signal.aborted) {
      await caches.delete(areaCache(plan.id));
      return;
    }
    if (failed > jobs.length * 0.05) {
      await caches.delete(areaCache(plan.id));
      throw new Error(`${failed} of ${jobs.length} tiles failed — check your connection and try again`);
    }
    areas = [...areas.filter((a) => a.id !== plan.id), { id: plan.id, name: plan.name, tiles: jobs.length, bytes, createdAt: new Date().toISOString() }];
    // first area also grabs the zoomed-out overview, so the offline map isn't blank when you zoom out
    if (plan.id !== OVERVIEW_ID && !areas.some((a) => a.id === OVERVIEW_ID)) {
      progress = null;
      controller = null;
      emit();
      return downloadArea(planOverview());
    }
  } finally {
    progress = null;
    controller = null;
    emit();
  }
}

export const cancelDownload = () => controller?.abort();

export async function deleteArea(id: string) {
  await caches.delete(areaCache(id));
  areas = areas.filter((a) => a.id !== id);
  emit();
}

export const fmtBytes = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(0.1, b / 1e6).toFixed(b < 1e7 ? 1 : 0)} MB`);
