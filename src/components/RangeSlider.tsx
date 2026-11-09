import type { Range } from '../filter.ts';

interface Props {
  label: string;
  bounds: Range;
  value: Range;
  step: number;
  format: (n: number) => string;
  onChange: (r: Range) => void;
}

/** Two native range inputs stacked on one track. */
export function RangeSlider({ label, bounds: [lo, hi], value: [a, b], step, format, onChange }: Props) {
  const pct = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;
  return (
    <div className="range">
      <div className="range-head">
        <span>{label}</span>
        <span className="muted">
          {format(a)} – {format(b)}
          {b === hi ? '+' : ''}
        </span>
      </div>
      <div className="range-track">
        <div className="range-fill" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
        <input type="range" min={lo} max={hi} step={step} value={a} aria-label={`${label} minimum`}
          onChange={(e) => onChange([Math.min(+e.target.value, b), b])} />
        <input type="range" min={lo} max={hi} step={step} value={b} aria-label={`${label} maximum`}
          onChange={(e) => onChange([a, Math.max(+e.target.value, a)])} />
      </div>
    </div>
  );
}
