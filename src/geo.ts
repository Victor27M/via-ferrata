// Small geometry helpers for route pins and site regions (metres ↔ degrees near Romania is fine with a flat approximation).
type LngLat = [number, number];

const M_PER_DEG = 111_320;
const offset = ([lng, lat]: LngLat, dx: number, dy: number): LngLat => [
  lng + dx / (M_PER_DEG * Math.cos((lat * Math.PI) / 180)),
  lat + dy / M_PER_DEG,
];

export const metres = ([a, b]: LngLat, [c, d]: LngLat) =>
  Math.hypot((c - a) * M_PER_DEG * Math.cos((b * Math.PI) / 180), (d - b) * M_PER_DEG);

/**
 * Routes whose starts are identical or a few metres apart (common on multi-route walls) are nudged apart until every
 * pair is at least `minM` metres away, so each pin is tappable at walking-map zooms. Points that are already far apart don't move.
 */
export function spread(points: LngLat[], minM = 22): LngLat[] {
  // work in local metres around the first point
  const [lng0, lat0] = points[0] ?? [0, 0];
  const kx = M_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
  const xy = points.map(([lng, lat], i) => {
    // identical starts get a tiny deterministic offset so they have a direction to separate in
    const a = i * 2.39996; // golden angle
    return [(lng - lng0) * kx + Math.cos(a) * 0.01, (lat - lat0) * M_PER_DEG + Math.sin(a) * 0.01];
  });
  for (let iter = 0; iter < 60; iter++) { // ponytail: O(n² · iter) relaxation, fine for ≤ ~50 routes per site
    let moved = false;
    for (let i = 0; i < xy.length; i++)
      for (let j = i + 1; j < xy.length; j++) {
        const dx = xy[j][0] - xy[i][0], dy = xy[j][1] - xy[i][1];
        const d = Math.hypot(dx, dy);
        if (d >= minM) continue;
        const push = (minM - d) / 2 / d;
        xy[i][0] -= dx * push; xy[i][1] -= dy * push;
        xy[j][0] += dx * push; xy[j][1] += dy * push;
        moved = true;
      }
    if (!moved) break;
  }
  return xy.map(([x, y]) => [lng0 + x / kx, lat0 + y / M_PER_DEG]);
}

/** Convex hull (monotone chain), counter-clockwise, no repeated first point. */
function hull(ps: LngLat[]): LngLat[] {
  const s = [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: LngLat, a: LngLat, b: LngLat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (pts: LngLat[]) => {
    const h: LngLat[] = [];
    for (const p of pts) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  return [...half(s), ...half([...s].reverse())];
}

/** Rounded outline around a set of points: hull of a small circle drawn around each point. Returns a closed ring. */
export function regionRing(points: LngLat[], paddingM = 60): LngLat[] {
  const circle = (p: LngLat) => Array.from({ length: 16 }, (_, i) => {
    const a = (2 * Math.PI * i) / 16;
    return offset(p, paddingM * Math.cos(a), paddingM * Math.sin(a));
  });
  const ring = hull(points.flatMap(circle));
  return [...ring, ring[0]];
}

export const centroid = (ps: LngLat[]): LngLat => [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length];
