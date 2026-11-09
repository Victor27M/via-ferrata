import { AttributionControl, GeolocateControl, Map as MLMap, NavigationControl, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef } from 'react';
import type { Ferrata } from '../data/types.ts';
import { DEM_MAXZOOM, DEM_TEMPLATE, STYLE_URL } from '../tiles.ts';
import { GRADE_COLORS, maxGrade } from '../ui.tsx';

// MapLibre resolves its worker relative to its own module, which Vite's bundling breaks.
setWorkerUrl(workerUrl);

const ROMANIA: [[number, number], [number, number]] = [[20.2, 43.6], [29.8, 48.3]];

interface Props {
  sites: Ferrata[]; // already filtered
  doneSites: Set<string>;
  selectedId: string | null;
  terrain3d: boolean;
  onSelect: (id: string | null) => void;
}

// combined grades take the harder letter's colour (A/B → B), matching the badges
const gradeColor = ['step', ['get', 'maxGrade'], GRADE_COLORS.A, 1.5, GRADE_COLORS.B, 2.5, GRADE_COLORS.C, 3.5, GRADE_COLORS.D, 4.5, GRADE_COLORS.E] as const;

function toGeoJSON(sites: Ferrata[], done: Set<string>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: sites.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: s.coords },
      properties: { id: s.id, name: s.name, maxGrade: Math.max(...s.routes.map((r) => r.gradeMin)), letter: maxGrade(s).split('/').at(-1), done: done.has(s.id) },
    })),
  };
}

/** White-on-transparent check mark used inside completed pins. */
function checkImage() {
  const c = document.createElement('canvas');
  c.width = c.height = 40;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = '#0e1311';
  ctx.lineWidth = 6;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 21);
  ctx.lineTo(17, 28);
  ctx.lineTo(30, 13);
  ctx.stroke();
  return ctx.getImageData(0, 0, 40, 40);
}

export function MapView({ sites, doneSites, selectedId, terrain3d, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const latest = useRef({ sites, doneSites, selectedId, terrain3d, onSelect });
  latest.current = { sites, doneSites, selectedId, terrain3d, onSelect };

  // init once
  useEffect(() => {
    const m = new MLMap({
      container: el.current!,
      style: STYLE_URL,
      bounds: ROMANIA,
      fitBoundsOptions: { padding: 20 },
      maxPitch: 80,
      attributionControl: false,
    });
    map.current = m;
    if (import.meta.env.DEV || location.search.includes('debug')) Object.assign(window, { __map: m }); // e2e checks / on-device debugging
    m.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    m.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    m.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'top-right');

    m.on('load', () => {
      const { sites, doneSites } = latest.current;
      const firstSymbol = m.getStyle().layers.find((l) => l.type === 'symbol')?.id;

      m.addSource('dem', { type: 'raster-dem', tiles: [DEM_TEMPLATE], tileSize: 256, maxzoom: DEM_MAXZOOM, encoding: 'terrarium',
        attribution: '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md">Terrain: Mapzen/AWS</a>' });
      m.addLayer({ id: 'hillshade', type: 'hillshade', source: 'dem',
        paint: { 'hillshade-exaggeration': 0.85, 'hillshade-shadow-color': '#000', 'hillshade-highlight-color': 'rgba(214,226,206,0.32)', 'hillshade-accent-color': '#14251b' } }, firstSymbol);

      m.addImage('check', checkImage(), { pixelRatio: 2 });
      m.addSource('sites', { type: 'geojson', data: toGeoJSON(sites, doneSites), cluster: true, clusterRadius: 36, clusterMaxZoom: 8,
        attribution: 'Data: <a href="https://www.via-ferrata.ro">via-ferrata.ro</a>' });

      m.addLayer({ id: 'clusters', type: 'circle', source: 'sites', filter: ['has', 'point_count'],
        paint: { 'circle-color': 'rgba(14,19,17,0.92)', 'circle-radius': ['step', ['get', 'point_count'], 15, 5, 19], 'circle-stroke-color': '#f5f5f4', 'circle-stroke-width': 2 } });
      m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'sites', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 13, 'text-allow-overlap': true },
        paint: { 'text-color': '#f5f5f4' } });
      m.addLayer({ id: 'selected', type: 'circle', source: 'sites', filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 19, 'circle-color': 'rgba(255,255,255,0.15)', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      // not done: dark centre, coloured ring · done: solid colour + check
      m.addLayer({ id: 'pins', type: 'circle', source: 'sites', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 12, 12],
          'circle-color': ['case', ['get', 'done'], gradeColor, '#0e1311'],
          'circle-stroke-color': ['case', ['get', 'done'], '#ffffff', gradeColor],
          'circle-stroke-width': ['case', ['get', 'done'], 2, 3.5],
        } as never });
      m.addLayer({ id: 'pin-check', type: 'symbol', source: 'sites', filter: ['all', ['!', ['has', 'point_count']], ['get', 'done']],
        layout: { 'icon-image': 'check', 'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.75, 12, 1.1], 'icon-allow-overlap': true } });
      // grade letter inside not-done pins, so colour is never the only cue
      m.addLayer({ id: 'pin-letter', type: 'symbol', source: 'sites', filter: ['all', ['!', ['has', 'point_count']], ['!', ['get', 'done']]],
        layout: { 'text-field': ['get', 'letter'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 12, 13], 'text-allow-overlap': true },
        paint: { 'text-color': '#f5f5f4' } });
      m.addLayer({ id: 'pin-label', type: 'symbol', source: 'sites', filter: ['!', ['has', 'point_count']], minzoom: 8,
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top' },
        paint: { 'text-color': '#f5f5f4', 'text-halo-color': '#0e1311', 'text-halo-width': 1.5 } });

      m.on('click', 'clusters', async (e) => {
        const f = e.features![0];
        const zoom = await (m.getSource('sites') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id);
        m.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom: zoom + 0.5 });
      });
      m.on('click', (e) => {
        const hit = m.queryRenderedFeatures(e.point, { layers: ['pins', 'clusters'] })[0];
        if (!hit) latest.current.onSelect(null);
        else if (hit.layer.id === 'pins') latest.current.onSelect(hit.properties.id);
      });
      for (const l of ['pins', 'clusters']) {
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

  // data / completion changes
  useEffect(() => {
    if (ready.current) (map.current!.getSource('sites') as GeoJSONSource).setData(toGeoJSON(sites, doneSites));
  }, [sites, doneSites]);

  // selection: highlight + bring the pin above the bottom sheet
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    m.setFilter('selected', ['==', ['get', 'id'], selectedId ?? '']);
    const s = latest.current.sites.find((x) => x.id === selectedId);
    if (s) {
      const wide = innerWidth >= 768;
      m.easeTo({ center: s.coords, zoom: Math.max(m.getZoom(), 10.5),
        padding: wide ? { left: 420, top: 0, right: 0, bottom: 0 } : { bottom: innerHeight * 0.5, top: 0, left: 0, right: 0 } });
    }
  }, [selectedId]);

  useEffect(() => {
    if (ready.current) applyTerrain(map.current!, terrain3d, true);
  }, [terrain3d]);

  return <div ref={el} className="map" />;
}

function applyTerrain(m: MLMap, on: boolean, animate: boolean) {
  m.setTerrain(on ? { source: 'dem', exaggeration: 1.4 } : null);
  if (animate) m.easeTo({ pitch: on ? 60 : 0, duration: 800 });
}
