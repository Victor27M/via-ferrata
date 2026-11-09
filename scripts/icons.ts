// Generates the PWA icons in public/ (no image tooling needed). Run: npm run icons
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0, 0, 0], BACK = [90, 90, 90], FRONT = [235, 235, 235], SNOW = [255, 255, 255];
type P = [number, number];
const back: P[] = [[0.06, 0.8], [0.32, 0.42], [0.58, 0.8]];
const front: P[] = [[0.2, 0.8], [0.58, 0.2], [0.94, 0.8]];
const inTri = ([x, y]: P, [a, b, c]: P[]) => {
  const s = (p: P, q: P, r: P) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = s([x, y], a, b), d2 = s([x, y], b, c), d3 = s([x, y], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const color = (p: P) => (inTri(p, front) ? (p[1] < 0.36 ? SNOW : FRONT) : inTri(p, back) ? BACK : BG);

function png(size: number): Buffer {
  const ss = 4, raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let i = 0; i < ss * ss; i++) {
        const c = color([(x + ((i % ss) + 0.5) / ss) / size, (y + (Math.floor(i / ss) + 0.5) / ss) / size]);
        c.forEach((v, k) => (acc[k] += v));
      }
      acc.forEach((v, k) => (raw[y * (size * 3 + 1) + 1 + x * 3 + k] = Math.round(v / (ss * ss))));
    }
  const crcT = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (t: string, d: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const out = new URL('../public/', import.meta.url).pathname;
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]] as const)
  writeFileSync(out + name, png(size));
const pts = (t: P[]) => t.map(([x, y]) => `${x * 100},${y * 100}`).join(' ');
writeFileSync(out + 'icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="18" fill="rgb(${BG})"/><polygon points="${pts(back)}" fill="rgb(${BACK})"/><polygon points="${pts(front)}" fill="rgb(${FRONT})"/><clipPath id="c"><rect width="100" height="36"/></clipPath><polygon clip-path="url(#c)" points="${pts(front)}" fill="rgb(${SNOW})"/></svg>\n`);
console.log('icons written');
