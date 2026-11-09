import { GRADES, type Ferrata, type Grade } from './data/types.ts';
import type { Completion } from './storage/types.ts';
import type { Letter } from './filter.ts';

export interface Stats {
  routesDone: number;
  routesTotal: number;
  sitesDone: number;
  sitesTotal: number;
  elevationM: number; // sum over done routes with a known value
  lengthM: number;
  hardest: Grade | null;
  byGrade: { letter: Letter; done: number; total: number }[]; // combined grades count under the upper letter
  byYear: { year: string; count: number }[];
}

const upper = (g: Grade) => g.split('/').at(-1) as Letter;

export function computeStats(fs: Ferrata[], completions: Completion[], year?: string): Stats {
  const cs = year ? completions.filter((c) => c.date.startsWith(year)) : completions;
  const done = new Set(cs.map((c) => c.routeId));
  const routes = fs.flatMap((f) => f.routes);
  const doneRoutes = routes.filter((r) => done.has(r.id));
  const years = new Map<string, number>();
  for (const c of completions) years.set(c.date.slice(0, 4), (years.get(c.date.slice(0, 4)) ?? 0) + 1);

  return {
    routesDone: doneRoutes.length,
    routesTotal: routes.length,
    sitesDone: fs.filter((f) => f.routes.every((r) => done.has(r.id))).length,
    sitesTotal: fs.length,
    elevationM: doneRoutes.reduce((s, r) => s + (r.elevationM ?? 0), 0),
    lengthM: doneRoutes.reduce((s, r) => s + (r.lengthM ?? 0), 0),
    hardest: doneRoutes.reduce<Grade | null>((h, r) => (!h || GRADES.indexOf(r.grade) > GRADES.indexOf(h) ? r.grade : h), null),
    byGrade: (['A', 'B', 'C', 'D', 'E'] as Letter[]).map((letter) => ({
      letter,
      total: routes.filter((r) => upper(r.grade) === letter).length,
      done: doneRoutes.filter((r) => upper(r.grade) === letter).length,
    })),
    byYear: [...years].map(([year, count]) => ({ year, count })).sort((a, b) => a.year.localeCompare(b.year)),
  };
}
