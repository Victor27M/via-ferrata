import { AttributionControl, GeolocateControl, Map as MLMap, NavigationControl, setWorkerUrl, type ExpressionSpecification, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';
import type { Ferrata } from '../data/types.ts';
import { centroid, regionRing, spread } from '../geo.ts';
import { DEM_MAXZOOM, DEM_TEMPLATE, STYLE_URL } from '../tiles.ts';
import { maxGrade } from '../ui.tsx';

// MapLibre resolves its worker relative to its own module, which Vite's bundling breaks.
setWorkerUrl(workerUrl);

const ROMANIA: [[number, number], [number, number]] = [[20.2, 43.6], [29.8, 48.3]];
/** From this zoom, multi-route sites split into one pin per route inside a region outline. */
const ROUTES_ZOOM = 14;
const WHITE = '#ffffff';
const BLACK = '#000000';
const FONT = ['Noto Sans Regular'];

export interface Selection {
  siteId: string;
  routeId?: string;
}

interface Props {
  sites: Ferrata[]; // already filtered
  matches: Map<string, Set<string>>; // siteId → matching route ids
  doneRoutes: Set<string>;
  doneSites: Set<string>;
  selected: Selection | null;
  terrain3d: boolean;
  onSelect: (s: Selection | null) => void;
}

const letterOf = (g: string) => g.split('/').at(-1)!;
/** Sites whose routes have their own start coordinates get split into route pins when zoomed in. */
const routePoints = (s: Ferrata) => s.routes.filter((r) => r.coords);
const isSpread = (s: Ferrata) => routePoints(s).length >= 2;

type FC = GeoJSON.FeatureCollection;
const fc = (features: GeoJSON.Feature[]): FC => ({ type: 'FeatureCollection', features });
const point = (coordinates: [number, number], properties: Record<string, unknown>): GeoJSON.Feature =>
  ({ type: 'Feature', geometry: { type: 'Point', coordinates }, properties });

function sitesData(sites: Ferrata[], doneSites: Set<string>): FC {
  return fc(sites.map((s) => point(s.coords, { id: s.id, name: s.name, letter: letterOf(maxGrade(s)), done: doneSites.has(s.id), spread: isSpread(s) })));
}

function routesData(sites: Ferrata[], matches: Props['matches'], doneRoutes: Set<string>): FC {
  return fc(sites.filter(isSpread).flatMap((s) => {
    const rs = routePoints(s);
    const pos = spread(rs.map((r) => r.coords!));
    return rs.flatMap((r, i) => (matches.get(s.id)?.has(r.id)
      ? [point(pos[i], { id: r.id, siteId: s.id, name: `${r.name} · ${r.grade}`, letter: letterOf(r.grade), done: doneRoutes.has(r.id), approx: !!r.coordsApprox })]
      : []));
  }));
}

function regionsData(sites: Ferrata[]): FC {
  return fc(sites.filter(isSpread).flatMap((s) => {
    const ring = regionRing(routePoints(s).map((r) => r.coords!));
    const top = ring.reduce((a, b) => (b[1] > a[1] ? b : a));
    return [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { siteId: s.id } } as GeoJSON.Feature,
      point([centroid(ring)[0], top[1]], { siteId: s.id, label: s.name.toUpperCase(), kind: 'label' }),
    ];
  }));
}

/** Check mark for completed pins (black on the white pin). */
function checkImage() {
  const c = document.createElement('canvas');
  c.width = c.height = 40;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = 5;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(11, 21);
  ctx.lineTo(17, 27);
  ctx.lineTo(29, 14);
  ctx.stroke();
  return ctx.getImageData(0, 0, 40, 40);
}

/** One pin style everywhere: open pin = black with white ring + grade letter; done = solid white with a check. */
function addPins(m: MLMap, id: string, source: string, filter: ExpressionSpecification, zoom: { minzoom?: number; maxzoom?: number }, small = false) {
  const done: ExpressionSpecification = ['all', filter, ['get', 'done']];
  const open: ExpressionSpecification = ['all', filter, ['!', ['get', 'done']]];
  // route pins grow as you zoom in, so dense walls stay readable at every zoom
  const radius: ExpressionSpecification = small ? ['interpolate', ['linear'], ['zoom'], 14, 7, 16, 9.5, 18, 13] : ['interpolate', ['linear'], ['zoom'], 6, 9, 14, 12];
  m.addLayer({ id, type: 'circle', source, filter, ...zoom,
    paint: {
      'circle-radius': radius,
      'circle-color': ['case', ['get', 'done'], WHITE, BLACK],
      // approximate positions (no published start) get a grey ring
      'circle-stroke-color': ['case', ['boolean', ['get', 'approx'], false], '#7a7a7a', WHITE],
      'circle-stroke-width': 1.75,
    } });
  m.addLayer({ id: `${id}-check`, type: 'symbol', source, filter: done, ...zoom,
    layout: { 'icon-image': 'check', 'icon-size': small ? ['interpolate', ['linear'], ['zoom'], 14, 0.6, 18, 1.1] : 0.95, 'icon-allow-overlap': true } });
  m.addLayer({ id: `${id}-letter`, type: 'symbol', source, filter: open, ...zoom,
    layout: { 'text-field': ['get', 'letter'], 'text-font': FONT, 'text-size': small ? ['interpolate', ['linear'], ['zoom'], 14, 9, 18, 14] : 12, 'text-allow-overlap': true },
    paint: { 'text-color': WHITE } });
}

function addLabels(m: MLMap, id: string, source: string, filter: ExpressionSpecification, zoom: { minzoom?: number; maxzoom?: number }) {
  m.addLayer({ id, type: 'symbol', source, filter, ...zoom,
    layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': 12, 'text-variable-anchor': ['top', 'right', 'left', 'bottom'],
      'text-radial-offset': 1.25, 'text-justify': 'auto', 'text-optional': true },
    paint: { 'text-color': WHITE, 'text-halo-color': BLACK, 'text-halo-width': 1.5 } });
}

export function MapView({ sites, matches, doneRoutes, doneSites, selected, terrain3d, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef({ sites, matches, doneRoutes, doneSites, selected, terrain3d, onSelect });
  latest.current = { sites, matches, doneRoutes, doneSites, selected, terrain3d, onSelect };

  // init once
  useEffect(() => {
    const m = new MLMap({ container: el.current!, style: STYLE_URL, bounds: ROMANIA, fitBoundsOptions: { padding: 20 }, maxPitch: 80, attributionControl: false });
    map.current = m;
    if (import.meta.env.DEV || location.search.includes('debug')) Object.assign(window, { __map: m }); // e2e checks / on-device debugging
    m.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    m.addControl(new NavigationControl({ showZoom: false, visualizePitch: true }), 'top-right'); // pinch to zoom; compass resets rotation
    m.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');

    m.on('load', () => {
      const { sites, matches, doneRoutes, doneSites } = latest.current;
      const firstSymbol = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;

      m.addSource('dem', { type: 'raster-dem', tiles: [DEM_TEMPLATE], tileSize: 256, maxzoom: DEM_MAXZOOM, encoding: 'terrarium',
        attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen/AWS</a>' });
      m.addLayer({ id: 'hillshade', type: 'hillshade', source: 'dem',
        paint: { 'hillshade-exaggeration': 0.8, 'hillshade-shadow-color': BLACK, 'hillshade-highlight-color': 'rgba(255,255,255,0.22)', 'hillshade-accent-color': '#111111' } }, firstSymbol);

      m.addImage('check', checkImage(), { pixelRatio: 2 });
      m.addSource('sites', { type: 'geojson', data: sitesData(sites, doneSites), cluster: true, clusterRadius: 36, clusterMaxZoom: 8,
        attribution: 'Data: <a href="https://www.via-ferrata.ro">via-ferrata.ro</a>' });
      m.addSource('routes', { type: 'geojson', data: routesData(sites, matches, doneRoutes) });
      m.addSource('regions', { type: 'geojson', data: regionsData(sites) });

      // site regions (multi-route walls), visible as you zoom in
      const regionZoom = { minzoom: ROUTES_ZOOM - 1.5 };
      m.addLayer({ id: 'region-fill', type: 'fill', source: 'regions', filter: ['==', ['geometry-type'], 'Polygon'], ...regionZoom,
        paint: { 'fill-color': WHITE, 'fill-opacity': 0.05 } });
      m.addLayer({ id: 'region-line', type: 'line', source: 'regions', filter: ['==', ['geometry-type'], 'Polygon'], ...regionZoom,
        paint: { 'line-color': WHITE, 'line-opacity': 0.55, 'line-width': 1.25, 'line-dasharray': [2, 2] } });
      m.addLayer({ id: 'region-label', type: 'symbol', source: 'regions', filter: ['==', ['get', 'kind'], 'label'], ...regionZoom,
        layout: { 'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 12, 'text-letter-spacing': 0.15, 'text-anchor': 'bottom', 'text-offset': [0, -0.4] },
        paint: { 'text-color': WHITE, 'text-halo-color': BLACK, 'text-halo-width': 1.5 } });

      // clusters
      m.addLayer({ id: 'clusters', type: 'circle', source: 'sites', filter: ['has', 'point_count'],
        paint: { 'circle-color': BLACK, 'circle-radius': ['step', ['get', 'point_count'], 16, 5, 20], 'circle-stroke-color': WHITE, 'circle-stroke-width': 1 } });
      m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'sites', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': FONT, 'text-size': 13, 'text-allow-overlap': true },
        paint: { 'text-color': WHITE } });

      // selection rings
      const ring = { 'circle-radius': 18, 'circle-color': 'rgba(255,255,255,0.12)', 'circle-stroke-color': WHITE, 'circle-stroke-width': 1 };
      m.addLayer({ id: 'site-selected', type: 'circle', source: 'sites', filter: ['==', ['get', 'id'], ''], paint: ring });
      m.addLayer({ id: 'route-selected', type: 'circle', source: 'routes', filter: ['==', ['get', 'id'], ''], minzoom: ROUTES_ZOOM, paint: { ...ring, 'circle-radius': 15 } });

      // pins: single-route sites always; multi-route sites until ROUTES_ZOOM, then their routes
      const unclustered: ExpressionSpecification = ['!', ['has', 'point_count']];
      addPins(m, 'site', 'sites', ['all', unclustered, ['!', ['get', 'spread']]], {});
      addPins(m, 'site-spread', 'sites', ['all', unclustered, ['get', 'spread']], { maxzoom: ROUTES_ZOOM });
      addPins(m, 'route', 'routes', ['has', 'id'], { minzoom: ROUTES_ZOOM }, true);
      addLabels(m, 'site-label', 'sites', ['all', unclustered, ['!', ['get', 'spread']]], { minzoom: 8 });
      addLabels(m, 'site-spread-label', 'sites', ['all', unclustered, ['get', 'spread']], { minzoom: 8, maxzoom: ROUTES_ZOOM - 1.5 });
      addLabels(m, 'route-label', 'routes', ['has', 'id'], { minzoom: ROUTES_ZOOM + 0.5 });

      const tappable = ['route', 'site', 'site-spread', 'clusters', 'region-fill'];
      m.on('click', async (e) => {
        const hit = m.queryRenderedFeatures(e.point, { layers: tappable })
          .sort((a, b) => tappable.indexOf(a.layer.id) - tappable.indexOf(b.layer.id))[0];
        const p = hit?.properties;
        if (!hit) latest.current.onSelect(null);
        else if (hit.layer.id === 'route') latest.current.onSelect({ siteId: p.siteId, routeId: p.id });
        else if (hit.layer.id === 'region-fill') latest.current.onSelect({ siteId: p.siteId });
        else if (hit.layer.id === 'clusters') {
          const zoom = await (m.getSource('sites') as GeoJSONSource).getClusterExpansionZoom(p.cluster_id);
          m.easeTo({ center: (hit.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.5 });
        } else latest.current.onSelect({ siteId: p.id });
      });
      for (const l of tappable.slice(0, 4)) {
        m.on('mouseenter', l, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', l, () => (m.getCanvas().style.cursor = ''));
      }
      // compact attribution starts expanded on small screens; collapse it
      m.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      ready.current = true;
      applyTerrain(m, latest.current.terrain3d, false);
    });
    return () => m.remove();
  }, []);

  // data / filter / completion changes
  useEffect(() => {
    const m = map.current;
    if (!ready.current || !m) return;
    (m.getSource('sites') as GeoJSONSource).setData(sitesData(sites, doneSites));
    (m.getSource('routes') as GeoJSONSource).setData(routesData(sites, matches, doneRoutes));
    (m.getSource('regions') as GeoJSONSource).setData(regionsData(sites));
  }, [sites, matches, doneRoutes, doneSites]);

  // selection: highlight + bring it above the bottom sheet (multi-route sites zoom in to show their routes)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    m.setFilter('site-selected', ['==', ['get', 'id'], selected && !selected.routeId ? selected.siteId : '']);
    m.setFilter('route-selected', ['==', ['get', 'id'], selected?.routeId ?? '']);
    const s = latest.current.sites.find((x) => x.id === selected?.siteId);
    if (!s) return;
    const route = s.routes.find((r) => r.id === selected?.routeId);
    const spreadSite = isSpread(s);
    const center = route?.coords ?? (spreadSite ? centroid(routePoints(s).map((r) => r.coords!)) : s.coords);
    const zoom = Math.max(m.getZoom(), route ? 16.5 : spreadSite ? ROUTES_ZOOM + 1 : 10.5);
    // keep the pin/region in the strip above the bottom sheet (which can be up to ~82% tall)
    const padding = innerWidth >= 768 ? { left: 420, top: 0, right: 0, bottom: 0 } : { bottom: innerHeight * 0.66, top: 0, left: 0, right: 0 };
    m.easeTo({ center, zoom, padding });
  }, [selected?.siteId, selected?.routeId]);

  useEffect(() => {
    if (ready.current) applyTerrain(map.current!, terrain3d, true);
  }, [terrain3d]);

  return <div ref={el} className="map" />;
}

function applyTerrain(m: MLMap, on: boolean, animate: boolean) {
  m.setTerrain(on ? { source: 'dem', exaggeration: 1.4 } : null);
  if (animate) m.easeTo({ pitch: on ? 60 : 0, duration: 800 });
}
