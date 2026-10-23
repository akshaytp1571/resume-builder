/**
 * Hosting build for BotKeep (or any static host).
 *
 * Produces a clean dist/ you can upload or point a static host at:
 *
 *   npm run build:static
 *
 * Differences from `npm run build`:
 *   - Copies 404.html (a real 404 page, not a blank error)
 *   - Copies _headers (Cache-Control rules for Netlify/Cloudflare-style hosts)
 *   - Writes DEPLOY.txt with the exact file inventory and SHA-256 digests, so
 *     you can verify an upload landed intact
 *
 * The job-discovery / apply agent is NOT deployed. It needs a locally
 * installed Google Chrome and holds job-board credentials, so it runs on your
 * own machine. See DEPLOY.md.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');

/** Recursively list every file under `dir`, as POSIX-ish relative paths. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// 1. Supporting files that the Vite build does not emit.
const extras = [
  { from: 'public/404.html', to: '404.html', required: false },
  { from: 'public/_headers', to: '_headers', required: false },
];

for (const extra of extras) {
  const src = join(root, extra.from);
  const dest = join(distDir, extra.to);
  if (!statSync(src, { throwIfNoEntry: false })) {
    if (extra.required) {
      console.error(`missing required file: ${extra.from}`);
      process.exit(1);
    }
    console.warn(`skip (not present): ${extra.from}`);
    continue;
  }
  copyFileSync(src, dest);
  console.log(`copied ${extra.to}`);
}

// 2. PWA artifacts. Vite copies public/ into dist/ itself, and the service
// worker is emitted by the plugin in vite.config.js — but a static build that
// silently loses either one would ship an app that is not installable, so
// assert them rather than assume.
//
// Neither is fatal: the app runs perfectly well online without a manifest or a
// worker. A hard failure here would block a deploy for a bonus feature.
const pwaArtifacts = [
  { path: 'manifest.webmanifest', why: 'app is not installable' },
  { path: 'sw.js', why: 'offline support disabled' },
  { path: 'icons/icon-192.png', why: 'manifest icon missing' },
  { path: 'icons/icon-512.png', why: 'manifest icon missing' },
];

for (const artifact of pwaArtifacts) {
  const full = join(distDir, artifact.path);
  if (statSync(full, { throwIfNoEntry: false })) {
    console.log(`pwa  ${artifact.path.padEnd(24)} ${fmtBytes(statSync(full).size)}`);
  } else {
    console.warn(`pwa  MISSING ${artifact.path} - ${artifact.why}`);
  }
}

// The worker's precache list is baked in at build time. If it disagrees with
// what actually landed in dist/, an offline load would 404 on a missing asset.
const swPath = join(distDir, 'sw.js');
if (statSync(swPath, { throwIfNoEntry: false })) {
  const sw = readFileSync(swPath, 'utf8');
  // [^\S\n] rather than \s: \s matches newlines, which makes each list entry
  // match twice and reports a doubled count.
  const listed = [...sw.matchAll(/^[^\S\n]*"(\/[^"]*)"[,]?$/gm)].map((m) => m[1]);
  const unique = [...new Set(listed)];
  const missing = unique.filter((url) => !statSync(join(distDir, url.slice(1)), { throwIfNoEntry: false }));
  if (missing.length) {
    console.warn(`pwa  worker precaches ${missing.length} URL(s) not in dist/: ${missing.slice(0, 3).join(', ')}`);
  } else {
    console.log(`pwa  worker precache verified (${unique.length} URLs present)`);
  }
}

// 3. Inventory with digests, so an interrupted upload is detectable.
const files = walk(distDir)
  .map((f) => relative(distDir, f).split(sep).join('/'))
  .sort();

let totalBytes = 0;
const lines = [
  'Precision Resume Studio - static build manifest',
  `Generated: ${new Date().toISOString()}`,
  '',
  'Upload the CONTENTS of this folder (not the folder itself).',
  'Entry point: index.html',
  '',
  `${'SHA-256'.padEnd(64)}  ${'BYTES'.padStart(10)}  FILE`,
  '-'.repeat(88),
];

for (const rel of files) {
  const full = join(distDir, rel);
  const size = statSync(full).size;
  totalBytes += size;
  lines.push(`${sha256(full)}  ${String(size).padStart(10)}  ${rel}`);
}

lines.push('-'.repeat(88));
lines.push(`${String(files.length).padStart(76)} files  ${fmtBytes(totalBytes)}`);
lines.push('');

writeFileSync(join(distDir, 'DEPLOY.txt'), lines.join('\n'));

console.log(`\n${files.length} files, ${fmtBytes(totalBytes)} total`);
console.log(`manifest written to dist/DEPLOY.txt`);
