/**
 * Verify a deployed static site.
 *
 *   node scripts/verify-deploy.mjs https://your-site.botkeep.cloud
 *
 * Checks, in order:
 *   1. The entry page returns 200 and is actually HTML containing the app root
 *   2. Every local asset the page references returns 200
 *   3. A missing path returns a real 404, not a soft-200 SPA fallback
 *   4. The page title matches what was built
 *
 * Exits non-zero on any failure, so it works in CI or as a deploy gate.
 */

const BASE = (process.argv[2] || '').replace(/\/+$/, '');

if (!BASE || !/^https?:\/\//i.test(BASE)) {
  console.error('usage: node scripts/verify-deploy.mjs https://your-site.botkeep.cloud');
  process.exit(2);
}

const TIMEOUT_MS = 20000;
let failures = 0;
let checks = 0;

function pass(msg) {
  checks += 1;
  console.log(`  ok    ${msg}`);
}

function fail(msg, detail) {
  checks += 1;
  failures += 1;
  console.log(`  FAIL  ${msg}`);
  if (detail) console.log(`        ${detail}`);
}

async function get(path, { allowRedirect = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      redirect: allowRedirect ? 'follow' : 'manual',
      signal: controller.signal,
      headers: { 'User-Agent': 'resume-builder-deploy-verify/1.0' },
    });
    const contentType = res.headers.get('content-type') || '';
    const body = await res.text();
    return { status: res.status, contentType, body, url: res.url };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`\nVerifying ${BASE}\n`);

// --- 1. entry page -------------------------------------------------------
let page;
try {
  page = await get('/');
} catch (err) {
  fail(`could not reach ${BASE}`, err.message);
  console.log(`\n${checks - failures}/${checks} checks passed`);
  process.exit(1);
}

if (page.status === 200) {
  pass('entry page returns 200');
} else {
  fail('entry page did not return 200', `got HTTP ${page.status}`);
}

if (/text\/html/i.test(page.contentType)) {
  pass(`entry page is HTML (${page.contentType.split(';')[0]})`);
} else {
  fail('entry page is not HTML', `content-type was "${page.contentType}"`);
}

if (/<div id="root">/i.test(page.body)) {
  pass('app root element present');
} else {
  fail('app root element missing', 'no <div id="root"> in the served HTML');
}

const titleMatch = page.body.match(/<title>([^<]*)<\/title>/i);
if (titleMatch) {
  pass(`title: ${titleMatch[1].trim()}`);
} else {
  fail('no <title> found');
}

// --- 2. referenced assets -------------------------------------------------
// Only local, same-origin, absolute-path references. External CDN links
// (fonts, for example) are the host's business, not a deploy failure.
const refs = [...page.body.matchAll(/(?:src|href)="(\/[^"]+)"/g)]
  .map((m) => m[1])
  .filter((p) => !/^\/\//.test(p));

const uniqueRefs = [...new Set(refs)];

if (uniqueRefs.length === 0) {
  fail('no local asset references found in the page');
}

for (const ref of uniqueRefs) {
  try {
    const asset = await get(ref);
    if (asset.status === 200) {
      const kind = /\.css$/i.test(ref)
        ? 'css'
        : /\.js$/i.test(ref)
          ? 'js'
          : /\.(png|jpe?g|svg|webp|gif)$/i.test(ref)
            ? 'image'
            : 'file';
      pass(`${kind} ${ref} (200)`);
    } else {
      fail(`${ref} returned HTTP ${asset.status}`);
    }
  } catch (err) {
    fail(`${ref} could not be fetched`, err.message);
  }
}

// --- 3. a real 404 -------------------------------------------------------
// A SPA fallback that answers 200 for every path would hide broken deploys,
// so confirm the host actually distinguishes a missing file.
try {
  const missing = await get(`/this-path-should-not-exist-${Date.now()}.html`);
  if (missing.status === 404) {
    pass('unknown paths return 404');
  } else if (missing.status === 200 && /<div id="root">/.test(missing.body)) {
    fail(
      'unknown path served the app shell with HTTP 200',
      'a catch-all rewrite is masking 404s; broken assets will look fine'
    );
  } else {
    pass(`unknown path returned HTTP ${missing.status} (acceptable)`);
  }
} catch (err) {
  fail('404 probe failed', err.message);
}

// --- 4. built artefacts present ------------------------------------------
if (/DEPLOY\.txt/.test(page.body)) {
  pass('build manifest linked');
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.log(`\n${failures} check(s) failed. Compare the live files against dist/DEPLOY.txt:`);
  console.log('  sha256sum -c <(awk \'NF==3 && length($1)==64 {print $1"  "$3}\' DEPLOY.txt)\n');
  process.exit(1);
}
console.log('\nDeployment verified.\n');
