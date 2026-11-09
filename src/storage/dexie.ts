import Dexie, { type Table } from 'dexie';
import type { Backup, Completion, Photo, StorageAdapter } from './types.ts';

class DB extends Dexie {
  completions!: Table<Completion, string>;
  meta!: Table<{ key: string; value: string }, string>;
  photos!: Table<Photo, string>;
  constructor() {
    super('via-ferrata-ro');
    this.version(1).stores({ completions: 'id, routeId, updatedAt', meta: 'key' });
    this.version(2).stores({ photos: 'id, completionId, updatedAt' });
  }
}

// Blobs (photos, GPX — later phases) travel as base64 data URLs inside the JSON backup.
type Encoded = { __blob: string };
const isEncoded = (v: unknown): v is Encoded => typeof v === 'object' && v !== null && '__blob' in v;

async function encode(v: unknown): Promise<unknown> {
  if (v instanceof Blob)
    return { __blob: await new Promise<string>((ok, err) => {
      const r = new FileReader();
      r.onload = () => ok(r.result as string);
      r.onerror = () => err(r.error);
      r.readAsDataURL(v);
    }) };
  if (Array.isArray(v)) return Promise.all(v.map(encode));
  if (v && typeof v === 'object')
    return Object.fromEntries(await Promise.all(Object.entries(v).map(async ([k, x]) => [k, await encode(x)])));
  return v;
}

async function decode(v: unknown): Promise<unknown> {
  if (isEncoded(v)) return (await fetch(v.__blob)).blob();
  if (Array.isArray(v)) return Promise.all(v.map(decode));
  if (v && typeof v === 'object')
    return Object.fromEntries(await Promise.all(Object.entries(v).map(async ([k, x]) => [k, await decode(x)])));
  return v;
}

export class DexieStorage implements StorageAdapter {
  private db = new DB();

  async listCompletions() {
    return (await this.db.completions.toArray()).filter((c) => !c.deleted);
  }
  async saveCompletion(c: Omit<Completion, 'updatedAt'>) {
    await this.db.completions.put({ ...c, deleted: false, updatedAt: Date.now() });
  }
  async removeCompletion(id: string) {
    await this.db.transaction('rw', this.db.completions, this.db.photos, async () => {
      await this.db.completions.update(id, { deleted: true, updatedAt: Date.now() });
      await this.db.photos.where('completionId').equals(id).modify({ deleted: true, blob: null, updatedAt: Date.now() });
    });
  }
  async listPhotos(completionId: string) {
    return (await this.db.photos.where('completionId').equals(completionId).sortBy('updatedAt')).filter((p) => !p.deleted);
  }
  async addPhoto(p: Omit<Photo, 'updatedAt'>) {
    await this.db.photos.put({ ...p, deleted: false, updatedAt: Date.now() });
  }
  async removePhoto(id: string) {
    await this.db.photos.update(id, { deleted: true, blob: null, updatedAt: Date.now() });
  }
  async getMeta(key: string) {
    return (await this.db.meta.get(key))?.value;
  }
  async setMeta(key: string, value: string) {
    await this.db.meta.put({ key, value });
  }

  async exportBackup(): Promise<Backup> {
    const tables: Backup['tables'] = {};
    for (const t of this.db.tables) tables[t.name] = (await encode(await t.toArray())) as unknown[];
    return { app: 'via-ferrata-ro', version: 1, exportedAt: new Date().toISOString(), tables };
  }

  async importBackup(b: Backup) {
    if (b?.app !== 'via-ferrata-ro' || b.version !== 1 || typeof b.tables !== 'object') throw new Error('Not a Via Ferrata backup file');
    const decoded = Object.fromEntries(
      await Promise.all(this.db.tables.map(async (t) => [t.name, (await decode(b.tables[t.name] ?? [])) as unknown[]])),
    );
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const t of this.db.tables) {
        await t.clear();
        await t.bulkPut(decoded[t.name]);
      }
    });
  }
}
