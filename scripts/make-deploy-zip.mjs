/**
 * Package dist/ into a ZIP whose ROOT is the site's entry point.
 *
 * BotKeep's ZIP guide is explicit: "When the ZIP is opened, Botkeep should
 * find package.json or requirements.txt without walking through an extra outer
 * folder." The same applies to index.html for a static site - the archive root
 * must BE the site, not contain a folder named dist.
 *
 *   npm run package:zip          -> dist/resume-builder-static.zip
 *
 * No third-party archiver is used. A ZIP is written by hand because the only
 * thing we need is STORE (no compression) on a handful of small files, and the
 * central-directory format is ~40 lines. That avoids adding a dependency for a
 * one-shot build step.
 */

import { deflateRawSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');
const outFile = join(distDir, 'resume-builder-static.zip');

/** CRC-32 (IEEE 802.3), the polynomial ZIP uses. */
const CRC_TABLE = (() => {
  // Uint32Array, not Int32Array: the final XOR flips the high bit, and a
  // signed table hands back a negative CRC that writeUInt32LE rejects.
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

// Everything except the archive we are about to write.
const files = walk(distDir)
  .filter((f) => f !== outFile)
  .map((f) => relative(distDir, f).split(sep).join('/'))
  .sort();

const localChunks = [];
const centralChunks = [];
let offset = 0;

for (const rel of files) {
  const data = readFileSync(join(distDir, rel));
  const nameBytes = Buffer.from(rel, 'utf8');
  const crc = crc32(data);
  const compressed = deflateRawSync(data, { level: 9 });
  // If deflating did not actually help, STORE the original bytes.
  const useDeflate = compressed.length < data.length;
  const payload = useDeflate ? compressed : data;
  const method = useDeflate ? 8 : 0;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4);         // version needed
  local.writeUInt16LE(0x0800, 6);     // UTF-8 filename flag
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(0, 10);         // mod time (fixed: 00:00)
  local.writeUInt16LE(0x0021, 12);    // mod date (fixed: 1980-01-01)
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);         // extra field length

  localChunks.push(local, nameBytes, payload);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // central directory signature
  central.writeUInt16LE(20, 4);         // version made by
  central.writeUInt16LE(20, 6);         // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0x0021, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30);         // extra
  central.writeUInt16LE(0, 32);         // comment
  central.writeUInt16LE(0, 34);         // disk number
  central.writeUInt16LE(0, 36);         // internal attrs
  // Unix mode 0644 in the high 16 bits. `>>> 0` is required: 0x81A40000
  // exceeds 2^31-1, and JS bitwise ops yield a signed int that
  // writeUInt32LE would reject.
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  central.writeUInt32LE(offset, 42);

  centralChunks.push(central, nameBytes);

  offset += local.length + nameBytes.length + payload.length;
}

const centralBuf = Buffer.concat(centralChunks);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);              // EOCD signature
end.writeUInt16LE(0, 4);                       // this disk
end.writeUInt16LE(0, 6);                       // disk with central dir
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);                      // comment length

writeFileSync(outFile, Buffer.concat([...localChunks, centralBuf, end]));

const size = statSync(outFile).size;
console.log(`${files.length} files -> ${outFile.split(sep).pop()}`);
console.log(`size: ${(size / 1024).toFixed(1)} KB`);
console.log(`\nArchive root contains (index.html must be at the root):`);
for (const rel of files.slice(0, 6)) console.log(`  ${rel}`);
if (files.length > 6) console.log(`  ... and ${files.length - 6} more`);
