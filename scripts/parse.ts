// Pure parsing helpers for the scraper. Checked by parse.check.ts.

import { GRADES, type Grade } from '../src/data/types.ts';

/** First A–E grade token in a string: "B (sau A conform …)" → "B", "C/D (mediu/dificil)" → "C/D". */
export function parseGrade(s: string): Grade | null {
  const m = s.match(/(?:^|[^A-Za-z])([A-E](?:\/[A-E])?)(?![A-Za-z])/);
  return m && (GRADES as readonly string[]).includes(m[1]) ? (m[1] as Grade) : null;
}

/**
 * Duration text → minutes. Ranges use the upper bound.
 * "1h30" → 90, "1h 05" → 65, "45min – 1h15min" → 75, "2-3 ore" → 180, "20min+" → 20, "?" → null.
 */
export function parseDuration(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.replace(/\(.*?\)/g, '').toLowerCase();
  const last = s.split(/\s*[-–—]\s*/).filter((p) => /\d/.test(p)).at(-1);
  if (!last) return null;
  const h = last.match(/(\d+)\s*(?:h|ore|ora|oră)\s*(\d+)?/);
  if (h) return +h[1] * 60 + (h[2] ? +h[2] : 0);
  const m = last.match(/(\d+)\s*min/);
  return m ? +m[1] : null;
}

/** "450m", "450-750m" → 450 (lower bound: the site lists the main line first). */
export function parseMeters(s: string | null | undefined): number | null {
  const m = s?.match(/(\d+)\s*(?:-\s*\d+\s*)?m\b/);
  return m ? +m[1] : null;
}

/** "… sau 45.545250,25.518000 …" → [lng, lat] */
export function parseDecimalCoords(s: string): [number, number] | null {
  const m = s.match(/(4[3-8]\.\d{3,})\s*,\s*(2[0-9]\.\d{3,})/);
  return m ? [+m[2], +m[1]] : null;
}

export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Diacritic-free lowercase, for fuzzy name matching. */
export const norm = (s: string) => slugify(s).replace(/-/g, ' ');
