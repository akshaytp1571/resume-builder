/**
 * Generate the neutral placeholder avatar used across the app.
 *
 *   node scripts/make-placeholder-avatar.mjs
 *
 * Writes:
 *   public/avatar.png        - favicon and header art
 *   src/assets/defaultPhoto.js - the base64 the resume templates embed
 *
 * The image is drawn from primitives (a circle over a rounded shape), so the
 * repository ships no personal photograph. No image library is needed: the
 * PNG is assembled with raw deflate and hand-written chunks.
 */

import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const W = 400;
const H = 400;
const BG = [226, 232, 240]; // light slate
const FG = [100, 116, 139]; // slate

const px = Buffer.alloc(W * H * 4);

function set(x, y, rgb) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = rgb[0];
  px[i + 1] = rgb[1];
  px[i + 2] = rgb[2];
  px[i + 3] = 255;
}

// Background
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) set(x, y, BG);
}

// Head: circle
const HX = 200;
const HY = 165;
const HR = 78;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = x - HX;
    const dy = y - HY;
    if (dx * dx + dy * dy <= HR * HR) set(x, y, FG);
  }
}

// Shoulders: half-ellipse rising from the bottom edge
const SHOULDER_TOP = 300;
const RX = 145;
const RY = 140;
for (let y = SHOULDER_TOP; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx = (x - 200) / RX;
    const dy = (y - SHOULDER_TOP) / RY;
    if (dx * dx + dy * dy <= 1) set(x, y, FG);
  }
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

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
ihdr[10] = 0; // deflate
ihdr[11] = 0; // adaptive filtering
ihdr[12] = 0; // no interlace

// Raw scanlines, each prefixed with filter type 0 (None)
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

// --- write outputs --------------------------------------------------------

const pngPath = join(root, 'public', 'avatar.png');
writeFileSync(pngPath, png);

const b64 = png.toString('base64');
const jsPath = join(root, 'src', 'assets', 'defaultPhoto.js');
writeFileSync(
  jsPath,
  [
    '// Neutral placeholder avatar, shown when the user has not supplied a photo.',
    '// Generated programmatically by `scripts/make-placeholder-avatar.mjs` - a',
    '// silhouette drawn from primitives, so it contains no personal image data.',
    'export const DEFAULT_PHOTO_BASE64 =',
    `  '${b64}';`,
    '',
    '/** Ready-to-use data URL for the placeholder photo. */',
    "export const DEFAULT_PHOTO_URL = 'data:image/png;base64,' + DEFAULT_PHOTO_BASE64;",
    '',
  ].join('\n')
);

// Confirm the file we just wrote parses back to the same bytes.
const check = readFileSync(pngPath);
console.log(`public/avatar.png            ${png.length} bytes`);
console.log(`src/assets/defaultPhoto.js   ${b64.length} base64 chars`);
console.log(`PNG signature                ${check.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' ? 'valid' : 'INVALID'}`);
