import { useMemo, useState } from 'react';
import type { Ferrata } from '../data/types.ts';
import { RADIUS_KM, cancelDownload, deleteArea, downloadArea, fmtBytes, planArea, useOffline } from '../offline.ts';

/** Site-card section: download / progress / saved state for this site's area. */
export function OfflineArea({ site }: { site: Ferrata }) {
  const { areas, progress } = useOffline();
  const [error, setError] = useState('');
  const plan = useMemo(() => planArea(site.id, site.name, site.coords), [site]);
  const saved = areas.find((a) => a.id === site.id);
  const mine = progress && progress.id === site.id;
  const tiles = plan.vector.length + plan.dem.length;

  async function start() {
    setError('');
    if (!navigator.onLine) return setError('You are offline — connect to download.');
    try {
      await downloadArea(plan);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (mine || (progress && progress.id === 'romania-overview' && !saved))
    return (
      <div className="offline">
        <div className="progress"><div style={{ width: `${(progress!.done / progress!.total) * 100}%` }} /></div>
        <div className="offline-row">
          <span className="small">
            {progress!.id === site.id ? 'Downloading map + terrain' : 'Adding Romania overview'}… {progress!.done}/{progress!.total}
          </span>
          <button className="link" onClick={cancelDownload}>Cancel</button>
        </div>
        <p className="hint">You can close this card; the download keeps going while the app is open.</p>
      </div>
    );

  if (saved)
    return (
      <div className="offline offline-row">
        <span className="small">✓ Saved offline · {RADIUS_KM} km around · {fmtBytes(saved.bytes)}</span>
        <button className="link" onClick={() => confirm(`Delete offline map for ${site.name}?`) && deleteArea(site.id)}>Delete</button>
      </div>
    );

  return (
    <div className="offline">
      <button className="btn ghost" disabled={!!progress} onClick={start}>
        Download area for offline · ≈ {fmtBytes(plan.estimateBytes)}
      </button>
      <p className="hint">
        Map + 3D terrain within {RADIUS_KM} km ({tiles} tiles). Do it on Wi-Fi before you go — there's often no signal in the gorges.
        {progress && ' Another download is running.'}
      </p>
      {error && <p className="small warn">{error}</p>}
    </div>
  );
}
