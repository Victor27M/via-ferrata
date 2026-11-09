import { LETTERS, defaultFilters, type Bounds, type Filters, type Status } from '../filter.ts';
import { GRADE_COLORS, fmtM, fmtMin } from '../ui.tsx';
import { BottomSheet } from './BottomSheet.tsx';
import { RangeSlider } from './RangeSlider.tsx';

interface Props {
  filters: Filters;
  bounds: Bounds;
  resultCount: number;
  onChange: (f: Filters) => void;
  onClose: () => void;
}

const STATUSES: [Status, string][] = [['all', 'All'], ['todo', 'Not done'], ['done', 'Completed']];

export function FilterSheet({ filters: f, bounds: b, resultCount, onChange, onClose }: Props) {
  const set = (p: Partial<Filters>) => onChange({ ...f, ...p });
  return (
    <BottomSheet title="Filters" onClose={onClose} modal>
      <h3 className="label">Difficulty</h3>
      <div className="grade-picker">
        {LETTERS.map((g) => {
          const on = f.grades.includes(g);
          return (
            <button key={g} className={`grade-toggle${on ? ' on' : ''}`} style={{ '--c': GRADE_COLORS[g] } as React.CSSProperties}
              aria-pressed={on} onClick={() => set({ grades: on ? f.grades.filter((x) => x !== g) : [...f.grades, g] })}>
              {g}
            </button>
          );
        })}
      </div>
      <p className="hint">Combined grades like B/C match both B and C.</p>

      <RangeSlider label="Ferrata duration" bounds={b.duration} value={f.duration} step={5} format={fmtMin}
        onChange={(duration) => set({ duration })} />
      <RangeSlider label="Length" bounds={b.length} value={f.length} step={10} format={fmtM} onChange={(length) => set({ length })} />
      <p className="hint">Routes with no published length/time are hidden while that slider is narrowed.</p>

      <h3 className="label">Status</h3>
      <div className="segmented">
        {STATUSES.map(([v, l]) => (
          <button key={v} className={f.status === v ? 'on' : ''} onClick={() => set({ status: v })}>
            {l}
          </button>
        ))}
      </div>

      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => onChange(defaultFilters(b))}>Reset</button>
        <button className="btn primary" onClick={onClose}>Show {resultCount} {resultCount === 1 ? 'site' : 'sites'}</button>
      </div>
    </BottomSheet>
  );
}
