/**
 * Generate the PWA icons.
 *
 *   node scripts/make-icons.mjs
 *
 * Writes:
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *
 * A document glyph on the app's plum field: a white page with a folded corner
 * and three rose text bars. Drawn from primitives and 4x supersampled, so the
 * edges are clean at 192px without shipping a design tool's export.
 *
 * No image library: the PNG is assembled with raw deflate and hand-written
 * chunks, the same way scripts/make-placeholder-avatar.mjs does it.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Palette, straight from index.css.
const PLUM = [20, 7, 21]; // #140715
const PAPER = [253, 242, 248]; // #fdf2f8
const ROSE = [225, 29, 72]; // #e11d48
const BLUSH = [251, 113, 133]; // #fb7185

const SS = 4; // supersampling factor

/** Rounded rectangle test, in normalised 0..1 space. */
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/**
 * The glyph, in normalised coordinates. Everything sits inside the maskable
 * safe zone (a centred circle of radius 0.4), so Android may crop it freely.
 */
function pixelAt(x, y) {
  const inPage = inRoundRect(x, y, 0.28, 0.20, 0.72, 0.80, 0.05);
  if (!inPage) return PLUM;

  // Folded corner: the top-right triangle of the page is turned over.
  // Boundary runs diagonally from (0.60, 0.20) to (0.72, 0.32).
  if (x > 0.60 && y < 0.32) {
    if (x - 0.60 > 0.32 - y) return PLUM; // the cut-away corner
    return BLUSH; // the flap
  }

  // Text bars.
  if (inRoundRect(x, y, 0.36, 0.42, 0.64, 0.455, 0.017)) return ROSE;
  if (inRoundRect(x, y, 0.36, 0.51, 0.64, 0.545, 0.017)) return ROSE;
  if (inRoundRect(x, y, 0.36, 0.60, 0.56, 0.635, 0.017)) return ROSE;

  return PAPER;
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const n = size * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Box-filter downsample of an SSxSS block.
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x * SS + sx + 0.5) / n;
          const ny = (y * SS + sy + 0.5) / n;
          const c = pixelAt(nx, ny);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const samples = SS * SS;
      const i = (y * size + x) * 4;
      px[i] = Math.round(r / samples);
      px[i + 1] = Math.round(g / samples);
      px[i + 2] = Math.round(b / samples);
      px[i + 3] = 255;
    }
  }
  return px;
}

// --- PNG encoding ---------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    px.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- write ----------------------------------------------------------------

const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const png = encodePng(size, render(size));
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`public/icons/icon-${size}.png  ${size}x${size}  ${png.length} bytes`);
}
