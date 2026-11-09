import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ferrata, Route } from '../data/types.ts';
import { compressImage } from '../photos.ts';
import { storage } from '../storage/index.ts';
import { CONDITIONS, newId, type Completion, type Photo } from '../storage/types.ts';
import { GradeBadge, IconCamera, IconX, today } from '../ui.tsx';
import { BottomSheet } from './BottomSheet.tsx';

const MAX_PHOTOS = 5;

interface Props {
  site: Ferrata;
  route: Route;
  completion: Completion;
  onSave: (c: Completion) => void;
  onRemove: (latest: Completion) => void;
  onClose: () => void;
}

export function LogSheet({ site, route, completion, onSave, onRemove, onClose }: Props) {
  // Local draft so typing stays snappy; persisted 400 ms after the last change and on close.
  const [c, setDraft] = useState(completion);
  const latest = useRef(completion);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    if (timer.current === undefined) return;
    clearTimeout(timer.current);
    timer.current = undefined;
    onSave(latest.current);
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadPhotos = () => storage.listPhotos(c.id).then(setPhotos);
  useEffect(() => void loadPhotos(), [c.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const urls = useMemo(() => new Map(photos.map((p) => [p.id, URL.createObjectURL(p.blob!)])), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const set = (patch: Partial<Completion>) => {
    latest.current = { ...latest.current, ...patch };
    setDraft(latest.current);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 400);
  };

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      for (const f of [...files].slice(0, MAX_PHOTOS - photos.length)) {
        const img = await compressImage(f);
        await storage.addPhoto({ id: newId(), completionId: c.id, ...img });
      }
      if (files.length > MAX_PHOTOS - photos.length) setError(`Only ${MAX_PHOTOS} photos per climb — the rest were skipped.`);
    } catch (e) {
      setError(`Couldn't add photo: ${(e as Error).message}`);
    }
    await loadPhotos();
    setBusy(false);
  }

  async function removePhoto(id: string) {
    if (!confirm('Delete this photo?')) return;
    await storage.removePhoto(id);
    setViewing(null);
    await loadPhotos();
  }

  return (
    <BottomSheet
      modal
      onClose={onClose}
      title={
        <>
          <h2>{route.name}</h2>
          <p className="muted small">{site.routes.length > 1 ? `${site.name} · ` : ''}{site.county}</p>
        </>
      }
    >
      <div className="badges"><GradeBadge g={route.grade} /><span className="pill done">Completed</span></div>

      <label className="field">
        <span className="label">Date</span>
        <input type="date" value={c.date} max={today()} onChange={(e) => e.target.value && set({ date: e.target.value })} />
      </label>

      <label className="field">
        <span className="label">Partners</span>
        <input type="text" placeholder="Who was with you?" value={c.partners ?? ''} autoComplete="off"
          onChange={(e) => set({ partners: e.target.value })} />
      </label>

      <span className="label">Conditions</span>
      <div className="tags">
        {CONDITIONS.map((t) => {
          const on = c.conditions?.includes(t) ?? false;
          return (
            <button key={t} className={`tag${on ? ' on' : ''}`} aria-pressed={on}
              onClick={() => set({ conditions: on ? c.conditions!.filter((x) => x !== t) : [...(c.conditions ?? []), t] })}>
              {t}
            </button>
          );
        })}
      </div>

      <label className="field">
        <span className="label">Notes</span>
        <textarea rows={4} placeholder="How did it go? Tricky bits, gear, approach…" value={c.notes ?? ''}
          onChange={(e) => set({ notes: e.target.value })} />
      </label>

      <span className="label">Photos ({photos.length}/{MAX_PHOTOS})</span>
      <div className="photos">
        {photos.map((p) => (
          <button key={p.id} className="photo" onClick={() => setViewing(p.id)}>
            <img src={urls.get(p.id)} alt="" />
          </button>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className={`photo add${busy ? ' busy' : ''}`}>
            {busy ? '…' : <IconCamera />}
            {/* no `capture` attribute: iOS then offers Take Photo + Photo Library + Files */}
            <input type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
      {error && <p className="small warn">{error}</p>}
      <p className="hint">Saved automatically. Photos are shrunk to 1600 px and included in backups.</p>

      {/* flush first so a pending autosave can't re-create the completion after it's removed */}
      <button className="btn danger" onClick={() => { flush(); onRemove(latest.current); }}>Mark as not done</button>

      {viewing && (
        <div className="viewer" onClick={() => setViewing(null)}>
          <img src={urls.get(viewing)} alt="" />
          <div className="viewer-actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn ghost" onClick={() => removePhoto(viewing)}>Delete</button>
            <button className="icon-btn" onClick={() => setViewing(null)} aria-label="Close photo"><IconX /></button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
