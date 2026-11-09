/** Every record carries updatedAt (ms) and soft-deletes, so a cloud sync (e.g. Supabase) can merge by last-write-wins. */
export interface SyncRecord {
  id: string;
  updatedAt: number;
  deleted?: boolean;
}

export const CONDITIONS = ['Dry', 'Wet', 'Hot', 'Cold', 'Windy', 'Crowded'] as const;
export type Condition = (typeof CONDITIONS)[number];

export interface Completion extends SyncRecord {
  routeId: string;
  date: string; // YYYY-MM-DD
  partners?: string;
  conditions?: Condition[];
  notes?: string;
}

export interface Photo extends SyncRecord {
  completionId: string;
  blob: Blob | null; // null once deleted (tombstone keeps the id for sync)
  width: number;
  height: number;
}

export interface Backup {
  app: 'via-ferrata-ro';
  version: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** Swap the Dexie implementation for a cloud-backed one without touching the UI. */
export interface StorageAdapter {
  listCompletions(): Promise<Completion[]>; // excludes soft-deleted
  saveCompletion(c: Omit<Completion, 'updatedAt'>): Promise<void>;
  removeCompletion(id: string): Promise<void>; // also removes its photos
  listPhotos(completionId: string): Promise<Photo[]>;
  addPhoto(p: Omit<Photo, 'updatedAt'>): Promise<void>;
  removePhoto(id: string): Promise<void>;
  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
  exportBackup(): Promise<Backup>;
  importBackup(b: Backup): Promise<void>; // replaces all local data
}

export const newId = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
