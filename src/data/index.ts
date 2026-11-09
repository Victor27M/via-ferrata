import { applyOverrides, type Overrides } from './merge.ts';
import raw from './ferratas.json';
import overrides from './manual-overrides.json';
import type { FerrataData } from './types.ts';

export const DATA = raw as FerrataData;
// Multi-route sites: routes without a published start are placed at the site's start and marked approximate,
// so every multi-route site gets the same region + one-pin-per-route view (pins are fanned out on the map).
export const FERRATAS = applyOverrides(DATA.ferratas, overrides as unknown as Overrides) // JSON may carry _note fields
  .map((f) => (f.routes.length < 2 ? f : { ...f, routes: f.routes.map((r) => (r.coords ? r : { ...r, coords: f.coords, coordsApprox: true })) }));
export const ROUTE_SITE = new Map(FERRATAS.flatMap((f) => f.routes.map((r) => [r.id, f] as const)));
