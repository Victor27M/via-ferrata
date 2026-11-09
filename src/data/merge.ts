import { gradeNum, type Ferrata, type Route } from './types.ts';

type RoutePatch = Partial<Route> & { id: string };
type SitePatch = Partial<Omit<Ferrata, 'routes'>> & { routes?: RoutePatch[] };
export interface Overrides {
  sites?: Record<string, SitePatch>;
  remove?: string[];
}

const finishRoute = (r: Route): Route => ({ ...r, gradeMin: gradeNum(r.grade) });

/**
 * Applies manual-overrides.json on top of scraped data.
 * Existing site → fields replaced, routes merged by id (unknown route ids are added).
 * Unknown site id → added as a new site (must then be complete).
 */
export function applyOverrides(base: Ferrata[], o: Overrides): Ferrata[] {
  const out = new Map(base.map((f) => [f.id, f]));
  for (const [id, patch] of Object.entries(o.sites ?? {})) {
    const cur = out.get(id);
    const routes = [...(cur?.routes ?? [])];
    for (const rp of patch.routes ?? []) {
      const i = routes.findIndex((r) => r.id === rp.id);
      if (i >= 0) routes[i] = finishRoute({ ...routes[i], ...rp });
      else routes.push(finishRoute(rp as Route));
    }
    const coordsVerified = patch.coordsVerified ?? (patch.coords ? true : cur?.coordsVerified);
    out.set(id, { ...cur, ...patch, id, routes, coordsVerified } as Ferrata);
  }
  for (const id of o.remove ?? []) out.delete(id);
  return [...out.values()];
}
