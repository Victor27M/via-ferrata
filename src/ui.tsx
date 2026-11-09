import type { Ferrata, Grade } from './data/types.ts';

/** A→E scale. Validated (dataviz validate_palette.js, dark surface): lightness band, CVD + normal-vision separation, contrast.
 *  Combined grades use the upper letter's colour. Letters are always shown too, so colour is never the only cue. */
export const GRADE_COLORS = { A: '#2ba84a', B: '#3d8fe0', C: '#b98a0a', D: '#9b6ff0', E: '#e8445a' } as const;
export const gradeColor = (g: Grade) => GRADE_COLORS[(g.split('/').at(-1) ?? 'A') as keyof typeof GRADE_COLORS];
export const maxGrade = (f: Ferrata) => f.routes.reduce((m, r) => (r.gradeMin > m.gradeMin ? r : m)).grade;

export const fmtMin = (m: number | null) => (m == null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`);
export const fmtM = (m: number | null) => (m == null ? '—' : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
export const today = () => new Date().toLocaleDateString('sv'); // YYYY-MM-DD, local time
export const fmtDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const GradeBadge = ({ g }: { g: Grade }) => (
  <span className="grade" style={{ background: gradeColor(g) }}>
    {g}
  </span>
);

const icon = (d: string) => () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
export const IconFilter = icon('M3 5h18M6 12h12M10 19h4');
export const IconGear = icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z');
export const IconMountain = icon('M3 20l6-11 4 7 3-4 5 8z');
export const IconCheck = icon('M5 12l5 5 9-10');
export const IconChart = icon('M4 20V10M10 20V4M16 20v-7M22 20H2');
export const IconNote = icon('M5 3h10l4 4v14H5zM9 9h6M9 13h6M9 17h4');
export const IconCamera = icon('M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z');
export const IconRoute = icon('M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8');
export const IconX = icon('M6 6l12 12M18 6L6 18');
export const IconExternal = icon('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5');
