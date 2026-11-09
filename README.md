# Via Ferrata Romania — personal map & climb tracker

> Work in progress — Phases 1–3 done (data, map, filters, completion tracking, backup, logbook + photos, stats, directions, weather).

## Run

```sh
npm install
npm run dev        # http://localhost:5173, also on your LAN (shown in the terminal) for a quick look on the phone
npm run build      # type-check + production build into dist/
npm run check      # parser / overrides / filter self-checks
npm run icons      # regenerate the PWA icons in public/
```

Deploy and iPhone install: see [DEPLOY.md](DEPLOY.md).

Code map: `src/data/` (types, scraped JSON, overrides merge) · `src/filter.ts` (filter logic) ·
`src/storage/` (`StorageAdapter` interface + Dexie implementation and backups) · `src/stats.ts` · `src/weather.ts`
(Open-Meteo, 1 h cache) · `src/photos.ts` (client-side JPEG compression) · `src/components/` (map, sheets).

## Data

```sh
npm install
npm run scrape          # live fetch from via-ferrata.ro (~20 requests, 1.1 s apart) → src/data/ferratas.json
npm run scrape:cached   # re-parse the cached HTML in scripts/.cache, no network
npm run check:parse     # parser + overrides self-checks
```

The scraper prints a validation report (sites, routes, missing fields, coordinate sources, warnings).

**Coordinates**: from each route page's "GPS Start" line. If a page has none, they come from `scripts/map.kml`,
a copy of the site's Google My Map (Google's robots.txt disallows automated fetching of `/maps/`, so the scraper
doesn't download it). To refresh it, open
`https://www.google.com/maps/d/kml?mid=1Dr4vPSgmzKTMmafC3al0HNWbdgQ&forcekml=1` in a browser and save it over
`scripts/map.kml`. Page "GPS acces" (parking) is the last resort.

**Fixing / adding data**: edit `src/data/manual-overrides.json` — never `ferratas.json` (it's regenerated).

```json
{
  "sites": {
    "pericolul-caprelor": {
      "routes": [{ "id": "pericolul-caprelor-brat-2", "name": "Brațul 2", "grade": "B/C",
                   "lengthM": null, "elevationM": null, "ferrataMin": 20, "totalMin": 40 }]
    },
    "astragalus": { "routes": [{ "id": "astragalus-traseul-4", "lengthM": 250 }] },
    "my-new-ferrata": { "name": "…", "area": "…", "county": "…", "coords": [lng, lat], "paid": false,
                        "sourceUrl": "…", "routes": [{ "id": "my-new-ferrata", "name": "…", "grade": "B",
                        "lengthM": 200, "elevationM": 100, "ferrataMin": 40, "totalMin": 90 }] }
  },
  "remove": []
}
```

`gradeMin` is computed for you. Data: [via-ferrata.ro](https://www.via-ferrata.ro) — only short facts are stored,
always with a link back.
