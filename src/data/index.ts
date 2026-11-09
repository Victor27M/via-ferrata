import { applyOverrides, type Overrides } from './merge.ts';
import raw from './ferratas.json';
import overrides from './manual-overrides.json';
import type { FerrataData } from './types.ts';

export const DATA = raw as FerrataData;
export const FERRATAS = applyOverrides(DATA.ferratas, overrides as unknown as Overrides); // JSON may carry _note fields
export const ROUTE_SITE = new Map(FERRATAS.flatMap((f) => f.routes.map((r) => [r.id, f] as const)));
