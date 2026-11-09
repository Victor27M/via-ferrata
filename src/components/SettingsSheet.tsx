import { useEffect, useState } from 'react';
import { DATA } from '../data/index.ts';
import { deleteArea, fmtBytes, useOffline } from '../offline.ts';
import { storage } from '../storage/index.ts';
import type { Backup } from '../storage/types.ts';
import { IconExternal, today } from '../ui.tsx';
import { BottomSheet } from './BottomSheet.tsx';

interface Props {
  lastBackup: string | undefined;
  completionCount: number;
  onBackedUp: () => void;
  onImported: () => void;
  onClose: () => void;
}

export function SettingsSheet({ lastBackup, completionCount, onBackedUp, onImported, onClose }: Props) {
  const [msg, setMsg] = useState('');
  const { areas } = useOffline();
  const [usage, setUsage] = useState<StorageEstimate>();
  useEffect(() => void navigator.storage?.estimate?.().then(setUsage), [areas]);

  async function exportBackup() {
    const json = JSON.stringify(await storage.exportBackup());
    const file = new File([json], `via-ferrata-backup-${today()}.json`, { type: 'application/json' });
    try {
      // On iPhone the share sheet gives "Save to Files" / AirDrop; desktops get a plain download.
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else {
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      await storage.setMeta('lastBackupAt', new Date().toISOString());
      onBackedUp();
      setMsg('Backup saved.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setMsg(`Export failed: ${(e as Error).message}`);
    }
  }

  async function importBackup(file: File | undefined) {
    if (!file) return;
    try {
      const b = JSON.parse(await file.text()) as Backup;
      const n = (b.tables?.completions ?? []).filter((c) => !(c as { deleted?: boolean }).deleted).length;
      if (!confirm(`Replace ALL data on this device with the backup from ${b.exportedAt?.slice(0, 10)} (${n} completed routes)?`)) return;
      await storage.importBackup(b);
      await storage.setMeta('lastBackupAt', b.exportedAt); // the file itself is a backup as of that moment
      onImported();
      setMsg('Backup restored.');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  }

  return (
    <BottomSheet title={<h2>Settings</h2>} onClose={onClose} modal>
      <h3 className="label">Backup</h3>
      <p className="small">
        Your climbs live only on this device. iOS can clear website data, so export a backup now and then and keep it in
        Files or iCloud Drive.
      </p>
      <p className="muted small">
        {completionCount} completed {completionCount === 1 ? 'route' : 'routes'} · last backup: {lastBackup ? new Date(lastBackup).toLocaleDateString() : 'never'}
      </p>
      <div className="sheet-actions">
        <button className="btn primary" onClick={exportBackup}>Export backup</button>
        <label className="btn ghost">
          Import…
          <input type="file" accept="application/json,.json" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
        </label>
      </div>
      {msg && <p className="small">{msg}</p>}

      <h3 className="label">Offline maps</h3>
      {areas.length === 0 ? (
        <p className="muted small">None yet. Open a ferrata and tap “Download area for offline”.</p>
      ) : (
        <ul className="areas">
          {[...areas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
            <li key={a.id}>
              <div>
                <div>{a.name}</div>
                <div className="muted small">{fmtBytes(a.bytes)} · {a.tiles} tiles · {new Date(a.createdAt).toLocaleDateString()}</div>
              </div>
              <button className="link" onClick={() => confirm(`Delete offline map “${a.name}”?`) && deleteArea(a.id)}>Delete</button>
            </li>
          ))}
        </ul>
      )}
      {usage?.usage != null && (
        <p className="muted small">
          This app uses {fmtBytes(usage.usage)}{usage.quota ? ` of ${fmtBytes(usage.quota)} available` : ''} (maps, photos, app).
        </p>
      )}

      <h3 className="label">About</h3>
      <p className="small">
        Data: <a href="https://www.via-ferrata.ro" target="_blank" rel="noopener">via-ferrata.ro <IconExternal /></a>, updated{' '}
        {new Date(DATA.scrapedAt).toLocaleDateString()}. Always check the source page and local conditions before climbing.
      </p>
      <p className="muted small">Map © OpenFreeMap, OpenMapTiles, OpenStreetMap contributors · Terrain: AWS Terrain Tiles (Mapzen)</p>
    </BottomSheet>
  );
}
