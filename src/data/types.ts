export const GRADES = ['A', 'A/B', 'B', 'B/C', 'C', 'C/D', 'D', 'D/E', 'E'] as const;
export type Grade = (typeof GRADES)[number];

/** A=1 … E=5, combined grades sit halfway (A/B=1.5). */
export const gradeNum = (g: Grade): number => GRADES.indexOf(g) / 2 + 1;

export interface Route {
  id: string;
  name: string;
  grade: Grade;
  gradeMin: number;
  lengthM: number | null;
  elevationM: number | null;
  ferrataMin: number | null;
  totalMin: number | null;
  ferrataRaw?: string | null;
  totalRaw?: string | null;
  isMain?: boolean;
}

export interface Ferrata {
  id: string;
  name: string;
  /** Short place description, e.g. "Peștera Muierilor, Cheile Galbenului, Baia de Fier". */
  area: string;
  county: string;
  coords: [number, number]; // [lng, lat]
  coordsVerified: boolean;
  paid: boolean | null;
  sourceUrl: string;
  routes: Route[];
}

export interface FerrataData {
  source: string;
  scrapedAt: string;
  ferratas: Ferrata[];
}
