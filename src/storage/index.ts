import { DexieStorage } from './dexie.ts';
import type { StorageAdapter } from './types.ts';

export const storage: StorageAdapter = new DexieStorage();

// Ask the browser not to evict our data (honoured for installed PWAs on iOS 17+).
navigator.storage?.persist?.().catch(() => {});
