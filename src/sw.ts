/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';
import { CACHE_META, CACHE_RUNTIME, OFM_HOST, isTileUrl, tileKey } from './tiles.ts';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();

// App shell: JS, CSS, HTML, icons, map worker.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Map tiles: any cache first (downloaded areas + recently seen), else network into the trimmed runtime cache.
// The area downloader fetches with cache: 'no-store' and stores tiles itself, so those skip the runtime cache.
const RUNTIME_MAX = 2500;
let puts = 0;

async function tileHandler(request: Request): Promise<Response> {
  const key = tileKey(request.url);
  const hit = await caches.match(key, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok && request.cache !== 'no-store') {
      const cache = await caches.open(CACHE_RUNTIME);
      await cache.put(key, res.clone());
      if (++puts % 100 === 0) {
        const keys = await cache.keys();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - RUNTIME_MAX)).map((k) => cache.delete(k)));
      }
    }
    return res;
  } catch {
    return new Response(null, { status: 504, statusText: 'Offline' });
  }
}

registerRoute(({ url }) => isTileUrl(url), ({ request }) => tileHandler(request));

// Style, TileJSON, sprites, fonts: serve cached instantly, refresh in the background.
registerRoute(({ url }) => url.hostname === OFM_HOST, new StaleWhileRevalidate({ cacheName: CACHE_META }));
