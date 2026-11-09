// Builds src/data/ferratas.json from https://www.via-ferrata.ro
//   npm run scrape          – live fetch (≥1 s between requests), refreshes scripts/.cache
//   npm run scrape:cached   – re-parse from scripts/.cache (no network)
import * as cheerio from 'cheerio';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { applyOverrides, type Overrides } from '../src/data/merge.ts';
import { gradeNum, type Ferrata, type FerrataData, type Grade, type Route } from '../src/data/types.ts';
import { norm, parseDecimalCoords, parseDuration, parseGrade, parseMeters, slugify } from './parse.ts';

const BASE = 'https://www.via-ferrata.ro';
const UA = 'ViaFerrataRO-PersonalMap/0.1 (personal non-commercial map; 1 req/s)';
const ROOT = new URL('..', import.meta.url).pathname;
const CACHE = ROOT + 'scripts/.cache/';
const KML = ROOT + 'scripts/map.kml'; // optional, saved by hand from the site's Google My Map
const OUT = ROOT + 'src/data/ferratas.json';
const OVERRIDES = ROOT + 'src/data/manual-overrides.json';
const cached = process.argv.includes('--cached');

// ---------- fetching ----------
let last = 0;
async function get(path: string): Promise<string> {
  const file = CACHE + (slugify(path) || 'index') + '.html';
  if (cached && existsSync(file)) return readFileSync(file, 'utf8');
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const res = await fetch(BASE + path, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  const html = await res.text();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, html);
  return html;
}

/** Minimal robots.txt check for `User-agent: *` Disallow rules. */
async function assertAllowed(paths: string[]) {
  const txt = await get('/robots.txt');
  let star = false;
  const disallow: string[] = [];
  for (const line of txt.split('\n')) {
    const [k, ...v] = line.split(':');
    const val = v.join(':').trim();
    if (/^user-agent$/i.test(k.trim())) star = val === '*';
    else if (star && /^disallow$/i.test(k.trim()) && val) disallow.push(val);
  }
  const bad = paths.filter((p) => disallow.some((d) => p.startsWith(d)));
  if (bad.length) throw new Error(`robots.txt disallows: ${bad.join(', ')}`);
}

// ---------- list page ----------
interface ListItem {
  slug: string;
  title: string;
  grades: string;
  count: number;
  mainGrade: Grade | null;
  lengthM: number | null;
  elevationM: number | null;
  ferrataRaw: string | null;
  totalRaw: string | null;
}

function parseList(html: string): ListItem[] {
  const $ = cheerio.load(html);
  return $('li.listing-item')
    .toArray()
    .map((li) => {
      const a = $(li).find('a.title');
      const ex = $(li).find('.excerpt').text().replace(/\s+/g, ' ');
      return {
        slug: new URL(a.attr('href')!).pathname.replace(/\//g, ''),
        title: a.text().trim(),
        grades: $(li).find('.excerpt strong').first().text().trim(),
        count: +(ex.match(/(\d+)\s*trasee/)?.[1] ?? 1),
        mainGrade: parseGrade(ex.match(/Traseu principal:\s*([A-E/]+)/)?.[1] ?? ''),
        lengthM: parseMeters(ex.match(/↔\s*\d+\s*m/)?.[0]),
        elevationM: parseMeters(ex.match(/↑\s*\d+\s*m/)?.[0]),
        ferrataRaw: ex.match(/⏱\s*(.+?)\s*vf/)?.[1] ?? null,
        totalRaw: ex.match(/\(([^)]+?)\s*total\)/)?.[1] ?? null,
      };
    });
}

// ---------- route page ----------
/** entry-content as plain lines; headings prefixed "## ". */
function pageLines($: cheerio.CheerioAPI): string[] {
  const out: string[] = [];
  $('.entry-content br').replaceWith('\n');
  $('.entry-content')
    .find('h2,h3,h4,h5,h6,p,li')
    .each((_, el) => {
      const pre = /^h/.test(el.tagName) ? '## ' : '';
      for (const l of $(el).text().replace(/ /g, ' ').split('\n')) {
        const t = l.replace(/\s+/g, ' ').trim();
        if (t) out.push(pre + t);
      }
    });
  return out;
}

interface RawRoute {
  name: string;
  grade: Grade | null;
  lengthM: number | null;
  elevationM: number | null;
  ferrataRaw: string | null;
  totalRaw: string | null;
  coords?: [number, number] | null;
}
const blank = (name: string): RawRoute => ({ name, grade: null, lengthM: null, elevationM: null, ferrataRaw: null, totalRaw: null });
const after = (s: string) => s.replace(/^[^:]*:\s*/, '').trim();

/**
 * Sub-routes on multi-route pages. The site uses three layouts:
 *  1. heading "Traseul 7 – „Amfiteatrul Zmeilor”" or an <h4> name, then "Dificultate / Lungime / Durata …" lines (Baia de Fier, Șuncuiuș)
 *  2. "Traseul 2 (primul perete): B/C." + a separate "Traseul 2: 45min – 1h15min" timings list (Astragalus)
 *  3. "Falco Peregrinus ușor : B/C – 45 min" (Piatra Șoimilor)
 */
function parseRoutes(lines: string[]): RawRoute[] {
  const routes: RawRoute[] = [];
  const byNum = new Map<string, RawRoute>();
  let cur: RawRoute | null = null;

  lines.forEach((line, i) => {
    const quoted = line.match(/^(?:## )?Traseul?\s+\d+\s*[–-]\s*[„"“]([^”"]+)[”"]/);
    const h4 =
      line.startsWith('## ') && !/^## (Pe scurt|Acces)/i.test(line) && lines.slice(i + 1, i + 4).some((l) => /^(Dificultate|Grad)/.test(l))
        ? line.slice(3).split(/\s+[–-]\s+/)[0]
        : null;
    if (quoted || h4) {
      routes.push((cur = blank(quoted?.[1] ?? h4!)));
      return;
    }

    const numbered = line.match(/^Traseu(?:l)?\s+(\d+)\b(.*)$/);
    if (numbered) {
      const [, n, rest] = numbered;
      let r = byNum.get(n);
      if (!r) byNum.set(n, (r = blank(`Traseul ${n}`)));
      if (/\d+\s*(h|min)/.test(rest)) r.ferrataRaw = after(rest);
      else {
        r.grade ??= parseGrade(rest.replace(/^[^:,]*?(?=:)/, ''));
        const desc = rest.match(/^\s*\(([^)]+)\)/)?.[1] ?? rest.match(/^\s*,\s*([^,:]+)/)?.[1];
        if (desc) r.name = `Traseul ${n} (${desc.trim()})`;
      }
      return;
    }

    const inline = line.match(/^([^:]{3,40}?)\s*:\s*([A-E](?:\/[A-E])?)\s*[–-]\s*(.+)$/);
    if (inline && !/^Dificultate/i.test(inline[1])) {
      routes.push({ ...blank(inline[1]), grade: parseGrade(inline[2]), ferrataRaw: inline[3] });
      cur = null;
      return;
    }

    if (!cur) return;
    if (/GPS Start/i.test(line)) cur.coords ??= parseDecimalCoords(line);
    else if (/^Lungime/i.test(line)) cur.lengthM ??= parseMeters(line);
    else if (/^Diferen[tț][aă] de nivel/i.test(line)) cur.elevationM ??= parseMeters(line);
    else if (/^(Dificultate|Grad)/i.test(line)) cur.grade ??= parseGrade(line.replace(/^(Dificultate|Grad( de dificultate)?)[^:A-E]*:?/i, ' '));
    else if (/^(Durata (de parcurs|via ferrata)|Timp de parcurgere)/i.test(line)) cur.ferrataRaw ??= line.includes(':') ? after(line) : line.replace(/^Timp de parcurgere\s*/i, '');
    else if (/^Timp total/i.test(line)) cur.totalRaw ??= after(line);
  });
  return [...routes, ...byNum.values()];
}

// ---------- title → name / area / county ----------
function splitTitle(title: string) {
  const t = title.replace(/^Via Ferrata\s+(din\s+)?/i, '').replace(/\s*\([^)]*\)\s*$/, '');
  const quoted = t.match(/[“"„]([^”"]+)[”"]/)?.[1];
  const name = quoted ?? t.split(/\s+[–-]\s+|,\s*/)[0];
  const parts = t
    .replace(/[“"„][^”"]+[”"]/, '')
    .split(/\s*[–,]\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const judIdx = parts.findIndex((p) => /^jud\.\s*/.test(p));
  const county = judIdx >= 0 ? parts[judIdx].replace(/^jud\.\s*/, '') : parts.at(-1)!;
  const area = parts
    .filter((p, i) => i !== (judIdx >= 0 ? judIdx : parts.length - 1) && p !== name)
    .join(', ');
  return { name, area, county };
}

// ---------- optional KML (cross-check / fallback for coordinates) ----------
function readKml(): { label: string; coords: [number, number] }[] {
  if (!existsSync(KML)) return [];
  const $ = cheerio.load(readFileSync(KML, 'utf8'), { xml: true });
  return $('Placemark')
    .toArray()
    .map((p) => {
      const name = $(p).find('name').first().text().replace(/\s+-\s+[A-E][A-E/,\s]*$/, '');
      const [lng, lat] = $(p).find('coordinates').text().trim().split(',').map(Number);
      return { label: norm(name.split(/\s+-\s+|,/)[0]), coords: [lng, lat] as [number, number] };
    });
}

const km = ([a, b]: [number, number], [c, d]: [number, number]) => {
  const r = Math.PI / 180;
  const x = (c - a) * r * Math.cos(((b + d) / 2) * r);
  return Math.hypot(x, (d - b) * r) * 6371;
};

// ---------- main ----------
const warnings: string[] = [];
const coordSource: Record<string, string> = {};

await assertAllowed(['/trasee/']);
const list = parseList(await get('/trasee/'));
await assertAllowed(list.map((l) => `/${l.slug}/`));
const kml = readKml();
const ferratas: Ferrata[] = [];

for (const item of list) {
  const $ = cheerio.load(await get(`/${item.slug}/`));
  const lines = pageLines($);
  const tags = $('a[rel=tag]').toArray().map((a) => $(a).text().toLowerCase());
  const { name, area, county } = splitTitle(item.title);

  // coordinates: page "GPS Start" > site map (KML) > page "GPS acces" (parking, can be far away)
  const gps = (re: RegExp) => lines.filter((l) => re.test(l)).map(parseDecimalCoords).find(Boolean) ?? null;
  const start = gps(/GPS Start|Start via ferrata/i);
  const k = kml.find((p) => norm(item.title).includes(p.label));
  const access = gps(/GPS acces|Acces \/ Parcare/i);
  const pageCoords = start ?? (k ? null : access);
  const coords = pageCoords ?? k?.coords ?? null;
  coordSource[item.slug] = start ? 'page start' : k ? 'site map' : access ? 'page access' : 'none';
  if (pageCoords && k && km(pageCoords, k.coords) > 2)
    warnings.push(`${item.slug}: page GPS and site map differ by ${km(pageCoords, k.coords).toFixed(1)} km`);

  // routes
  let raw = parseRoutes(lines).filter((r) => r.grade);
  const single = raw.length < 2;
  if (single) raw = [{ ...blank(name), grade: parseGrade(item.grades) }];
  if (item.count > 1 && item.count !== raw.length)
    warnings.push(`${item.slug}: site lists ${item.count} routes, parsed ${raw.length}${single ? ' (kept as one main route)' : ''}`);
  if (/,/.test(item.grades) && single) warnings.push(`${item.slug}: grade "${item.grades}" covers several lines, stored as ${raw[0].grade}`);

  const mainIdx = single ? 0 : raw.findIndex((r) => r.grade === item.mainGrade);
  const seen = new Set<string>();
  const routes: Route[] = raw.map((r, i) => {
    const main = i === mainIdx;
    const fill = <T,>(v: T | null, fallback: T | null) => v ?? (main ? fallback : null);
    let id = single ? item.slug : `${item.slug}-${slugify(r.name)}`;
    while (seen.has(id)) id += '-2';
    seen.add(id);
    const ferrataRaw = fill(r.ferrataRaw, item.ferrataRaw);
    const totalRaw = fill(r.totalRaw, item.totalRaw);
    const [t, f] = [parseDuration(totalRaw), parseDuration(ferrataRaw)];
    if (t != null && f != null && t < f)
      warnings.push(`${item.slug}/${r.name}: total "${totalRaw}" is shorter than ferrata "${ferrataRaw}" (upper bound of a range)`);
    return {
      id,
      name: r.name,
      grade: r.grade!,
      gradeMin: gradeNum(r.grade!),
      lengthM: fill(r.lengthM, item.lengthM),
      elevationM: fill(r.elevationM, item.elevationM),
      ferrataMin: parseDuration(ferrataRaw),
      totalMin: parseDuration(totalRaw),
      ferrataRaw,
      totalRaw,
      ...(main ? { isMain: true } : {}),
      ...(!single && r.coords ? { coords: r.coords } : {}),
    };
  });

  ferratas.push({
    id: item.slug,
    name,
    area,
    county,
    coords: coords ?? [0, 0],
    coordsVerified: !!coords,
    paid: tags.includes('acces cu plata') ? true : tags.includes('acces gratuit') ? false : null,
    sourceUrl: `${BASE}/${item.slug}/`,
    routes,
  });
}

for (const p of kml) if (!ferratas.some((f) => norm(f.name + ' ' + f.area).includes(p.label) || norm(list.find((l) => l.slug === f.id)!.title).includes(p.label)))
  warnings.push(`site map has "${p.label}" with no matching route page`);

const data: FerrataData = { source: BASE, scrapedAt: new Date().toISOString(), ferratas };
writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
if (!existsSync(OVERRIDES)) writeFileSync(OVERRIDES, JSON.stringify({ sites: {}, remove: [] }, null, 2) + '\n');

// ---------- report ----------
const overrides: Overrides = JSON.parse(readFileSync(OVERRIDES, 'utf8'));
const merged = applyOverrides(ferratas, overrides);
const allRoutes = merged.flatMap((f) => f.routes.map((r) => ({ f, r })));
const missing = (k: keyof Route) => allRoutes.filter(({ r }) => r[k] == null).map(({ r }) => r.id);

console.log(`\n=== via-ferrata.ro scrape report (${cached ? 'cached' : 'live'}) ===`);
console.log(`Sites: ${merged.length}   Routes: ${allRoutes.length}   Overrides applied: ${Object.keys(overrides.sites ?? {}).length}\n`);
console.table(
  merged.map((f) => ({
    id: f.id,
    name: f.name,
    county: f.county,
    routes: f.routes.length,
    grades: [...new Set(f.routes.map((r) => r.grade))].join(' '),
    coords: coordSource[f.id] ?? 'override',
    paid: f.paid,
  })),
);
for (const k of ['lengthM', 'elevationM', 'ferrataMin', 'totalMin'] as const) {
  const m = missing(k);
  console.log(`Missing ${k}: ${m.length}/${allRoutes.length}${m.length ? '  → ' + m.join(', ') : ''}`);
}
const unverified = merged.filter((f) => !f.coordsVerified).map((f) => f.id);
const unknownPaid = merged.filter((f) => f.paid == null).map((f) => f.id);
console.log(`Unverified coords: ${unverified.length ? unverified.join(', ') : 'none'}`);
console.log(`Paid unknown: ${unknownPaid.length ? unknownPaid.join(', ') : 'none'}`);
console.log(`\nWarnings (${warnings.length}):\n` + warnings.map((w) => '  • ' + w).join('\n'));
console.log(`\nWrote ${OUT.replace(ROOT, '')}`);
