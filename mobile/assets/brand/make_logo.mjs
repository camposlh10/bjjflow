/**
 * BJJ Flow logo: a thick coral zig-zag stroke with round caps and joins, and a
 * slightly darker lip underneath, on the app's near-black background.
 *
 * The mark is three line segments drawn with a round pen, so it is rendered
 * from its distance field: no image libraries needed (only Node's zlib).
 *
 *     node mobile/assets/brand/make_logo.mjs     # writes every asset + logo.svg
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = dirname(HERE);
const DESKTOP_PUBLIC = join(ASSETS, '..', '..', 'desktop', 'public');

const BG = [13, 13, 16]; // palette.background (dark)
const CORAL = [240, 95, 87];
const LIP = [201, 67, 63];

// Geometry on a 1024 canvas (the full icon). Centre line of the stroke:
// top-right cap → left join → right join → bottom-left cap.
const POINTS = [
  [657, 235],
  [372, 517],
  [641, 523],
  [385, 786],
];
// Half the stroke width, per segment (an even pen today; a thinner middle bar
// leaves visible dents at the joins).
const RADII = [77, 77, 77];
const RADIUS = Math.max(...RADII);
const LIP_OFFSET = [0, 8]; // the darker edge peeks out below

/** Bounding box of the mark (stroke + lip), for centring it on its own. */
const BOX = (() => {
  const xs = POINTS.map((p) => p[0]);
  const ys = POINTS.map((p) => p[1]);
  return {
    x0: Math.min(...xs) - RADIUS,
    x1: Math.max(...xs) + RADIUS + LIP_OFFSET[0],
    y0: Math.min(...ys) - RADIUS,
    y1: Math.max(...ys) + RADIUS + LIP_OFFSET[1],
  };
})();

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Signed distance to the stroke's edge, in design units (negative = inside). */
function edgeDist(x, y) {
  let d = Infinity;
  for (let i = 0; i < POINTS.length - 1; i++) d = Math.min(d, segDist(x, y, POINTS[i], POINTS[i + 1]) - RADII[i]);
  return d;
}

/**
 * Renders the mark into an RGBA buffer of `size` px. `place` maps the 1024
 * design space onto the output: scale `s` and offset (ox, oy) in output px.
 */
function render(size, { s, ox, oy }, { background = null, color = CORAL, lip = LIP } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const aa = 1 / s; // one output pixel, in design units
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // centre of the output pixel, in design space
      const dx = (x + 0.5 - ox) / s;
      const dy = (y + 0.5 - oy) / s;
      const main = Math.max(0, Math.min(1, -edgeDist(dx, dy) / aa + 0.5));
      const under = lip
        ? Math.max(0, Math.min(1, -edgeDist(dx - LIP_OFFSET[0], dy - LIP_OFFSET[1]) / aa + 0.5))
        : 0;
      // composite: background, then lip, then the stroke (straight alpha)
      let r = 0, g = 0, b = 0, a = 0;
      const over = (c, ca) => {
        const na = ca + a * (1 - ca);
        if (na > 0) {
          r = (c[0] * ca + r * a * (1 - ca)) / na;
          g = (c[1] * ca + g * a * (1 - ca)) / na;
          b = (c[2] * ca + b * a * (1 - ca)) / na;
        }
        a = na;
      };
      if (background) over(background, 1);
      if (under) over(lip, under);
      if (main) over(color, main);
      const i = (y * size + x) * 4;
      px[i] = Math.round(r);
      px[i + 1] = Math.round(g);
      px[i + 2] = Math.round(b);
      px[i + 3] = Math.round(a * 255);
    }
  }
  return px;
}

/** The whole 1024 design (icon composition) scaled to `size`. */
const iconPlace = (size) => ({ s: size / 1024, ox: 0, oy: 0 });

/** The mark alone, centred, its longer side at `fraction` of `size`. */
function markPlace(size, fraction) {
  const w = BOX.x1 - BOX.x0;
  const h = BOX.y1 - BOX.y0;
  const s = (size * fraction) / Math.max(w, h);
  return { s, ox: size / 2 - ((BOX.x0 + BOX.x1) / 2) * s, oy: size / 2 - ((BOX.y0 + BOX.y1) / 2) * s };
}

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** RGBA buffer → PNG. `alpha: false` writes RGB (the iOS icon must not have alpha). */
function png(size, rgba, { alpha = true } = {}) {
  const channels = alpha ? 4 : 3;
  const raw = Buffer.alloc(size * (size * channels + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * channels + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (size * channels + 1) + 1 + x * channels;
      for (let c = 0; c < channels; c++) raw[dst + c] = rgba[src + c];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function save(path, size, place, opts = {}, { alpha = true } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png(size, render(size, place, opts), { alpha }));
}

// --- SVG source (same geometry) --------------------------------------------

function svg() {
  const rgb = (c) => `rgb(${c.join(',')})`;
  // One round-capped line per segment, each with its own width.
  const stroke = (color, dx, dy) =>
    `<g transform="translate(${dx} ${dy})" stroke="${rgb(color)}" stroke-linecap="round">` +
    POINTS.slice(1)
      .map((b, i) => {
        const a = POINTS[i];
        return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${RADII[i] * 2}"/>`;
      })
      .join('') +
    '</g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${rgb(BG)}"/>
  ${stroke(LIP, LIP_OFFSET[0], LIP_OFFSET[1])}
  ${stroke(CORAL, 0, 0)}
</svg>
`;
}

// --- Outputs (same set the previous logo script wrote) ---------------------

const icon = { background: BG };
save(join(ASSETS, 'icon.png'), 1024, iconPlace(1024), icon, { alpha: false });
save(join(ASSETS, 'favicon.png'), 48, iconPlace(48), icon, { alpha: false });

// Splash: the mark alone on transparent; the splash background is #0D0D10.
save(join(ASSETS, 'splash-icon.png'), 1024, markPlace(1024, 0.9));

// Android adaptive icon: mark inside the 66% safe zone, solid background.
save(join(ASSETS, 'android-icon-foreground.png'), 1024, markPlace(1024, 0.6));
save(join(ASSETS, 'android-icon-background.png'), 1024, iconPlace(1024), { background: BG, color: BG, lip: null }, { alpha: false });
save(join(ASSETS, 'android-icon-monochrome.png'), 1024, markPlace(1024, 0.6), { color: [255, 255, 255], lip: null });

// Brand files: the icon, the mark alone, and the vector source.
save(join(HERE, 'bjjflow-icon-512.png'), 512, iconPlace(512), icon, { alpha: false });
save(join(HERE, 'bjjflow-mark-512.png'), 512, markPlace(512, 0.92));
writeFileSync(join(HERE, 'logo.svg'), svg());

// CRM (desktop): favicon and a small logo for the sidebar/login.
save(join(DESKTOP_PUBLIC, 'favicon.png'), 64, iconPlace(64), icon, { alpha: false });
save(join(DESKTOP_PUBLIC, 'logo.png'), 256, iconPlace(256), icon, { alpha: false });
save(join(DESKTOP_PUBLIC, 'apple-touch-icon.png'), 180, iconPlace(180), icon, { alpha: false });
console.log('ok');
