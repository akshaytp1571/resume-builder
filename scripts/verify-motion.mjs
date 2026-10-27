/**
 * Motion and print invariants — the two properties a unit test cannot see.
 *
 * Run against a built `dist/`:
 *   node scripts/verify-motion.mjs
 *
 * Checks, in order:
 *  1. prefers-reduced-motion collapses every transition/animation to <=1ms
 *  2. the sheet and its wrapper carry no filter or backdrop-filter
 *  3. the sheet is never inside a transformed ancestor during print
 *  4. no element on the page uses backdrop-filter (the glass tell)
 *  5. the gauge stops counting under reduced motion
 *  6. print hides every chrome surface and leaks no chrome text
 *  7. the dot grid is the ONLY background image on the bench
 *
 * Exits non-zero on the first failure so it can gate a commit. This is a
 * verification script, not part of `npm test` — it needs a browser.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

let failures = 0;
const check = (name, ok, detail) => {
  if (ok) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

if (!existsSync(DIST)) {
  console.error('dist/ missing. Run `npm run build` first.');
  process.exit(1);
}

const server = createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  let f = join(DIST, p);
  if (!existsSync(f)) f = join(DIST, 'index.html');
  try {
    const body = readFileSync(f);
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(4180, r));

const browser = await chromium.launch();

// ---------------------------------------------------------------- normal motion
{
  console.log('\nnormal motion');
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto('http://127.0.0.1:4180/#/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const glass = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if (cs.backdropFilter && cs.backdropFilter !== 'none') {
        bad.push(el.tagName + '.' + (el.className || '').toString().slice(0, 30));
      }
    }
    return bad;
  });
  check('no backdrop-filter anywhere (glass is gone)', glass.length === 0, glass.slice(0, 3).join(', '));

  const sheetFilters = await page.evaluate(() => {
    const paper = document.querySelector('.resume-paper');
    const wrap = document.querySelector('#resume-print-wrapper');
    const read = (el) => (el ? { filter: getComputedStyle(el).filter, bd: getComputedStyle(el).backdropFilter } : null);
    return { paper: read(paper), wrap: read(wrap) };
  });
  check(
    'the sheet carries no filter',
    sheetFilters.paper?.filter === 'none' && sheetFilters.paper?.bd === 'none',
    JSON.stringify(sheetFilters.paper)
  );
  check(
    'the print wrapper carries no filter',
    sheetFilters.wrap?.filter === 'none' && sheetFilters.wrap?.bd === 'none',
    JSON.stringify(sheetFilters.wrap)
  );

  const benchBg = await page.evaluate(() => {
    const b = document.querySelector('.dt-bench');
    return b ? getComputedStyle(b).backgroundImage : null;
  });
  check(
    'the bench uses exactly one background image (the dot grid)',
    benchBg && benchBg.split('url(').length === 1 && benchBg.includes('radial-gradient'),
    (benchBg || '').slice(0, 60)
  );

  // gauge counts up
  await page.getByRole('button', { name: /open ats score breakdown/i }).click();
  await page.waitForTimeout(700);
  const gauge = await page.evaluate(() => {
    const m = document.querySelector('[role="meter"]');
    if (!m) return null;
    const ticks = m.querySelectorAll('span');
    const filled = Array.from(ticks).filter((t) => getComputedStyle(t).backgroundColor === 'rgb(216, 255, 62)').length;
    return { now: m.getAttribute('aria-valuenow'), ticks: ticks.length, filled };
  });
  check('gauge exposes role=meter with a value', Boolean(gauge?.now), String(gauge?.now));
  check('gauge renders 40 ticks', gauge?.ticks === 40, String(gauge?.ticks));
  check(
    'gauge fill matches its value',
    gauge && Math.abs(gauge.filled - Math.round((Number(gauge.now) / 100) * 40)) <= 1,
    `filled ${gauge?.filled} for ${gauge?.now}%`
  );

  // Close the ATS dialog before touching the navbar's export button.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // ---- the export sweep -------------------------------------------------
  // Gated on sweepCount, not on isExporting: the vector path resolves in a
  // single tick, so gating on the busy flag meant React never painted a frame
  // with the line present and the animation was never seen at all.
  const sawSweep = page
    .waitForSelector('.dt-sweep-line', { timeout: 6000 })
    .then(() => true)
    .catch(() => false);
  await page.getByRole('button', { name: /export resume as vector pdf/i }).click();
  const swept = await sawSweep;
  check('the export sweep renders', swept);

  if (swept) {
    const sweep = await page.evaluate(() => {
      const line = document.querySelector('.dt-sweep-line');
      const wrap = document.querySelector('#resume-print-wrapper');
      return {
        bg: getComputedStyle(line).backgroundColor,
        anim: getComputedStyle(line).animationName,
        // THE invariant: the sheet must never be inside the animated node, or
        // a capture taken mid-animation comes out off-register.
        paperInsideSweep: Boolean(document.querySelector('.dt-sweep #resume-preview')),
        // and the wrapper itself carries only the user's zoom
        wrapTransform: getComputedStyle(wrap).transform,
      };
    });
    check('the sweep is the signal colour', sweep.bg === 'rgb(216, 255, 62)', sweep.bg);
    check('the sweep actually animates', sweep.anim === 'dt-sweep', sweep.anim);
    check('the sheet is NOT inside the animated sweep node', !sweep.paperInsideSweep);
    check(
      'the print wrapper carries only the user zoom',
      sweep.wrapTransform === 'matrix(0.85, 0, 0, 0.85, 0, 0)',
      sweep.wrapTransform
    );
  }
}

// ------------------------------------------------------------- reduced motion
{
  console.log('\nprefers-reduced-motion: reduce');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:4180/#/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const durations = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      const t = parseFloat(cs.transitionDuration) || 0;
      const a = parseFloat(cs.animationDuration) || 0;
      if (t > 0.002 || a > 0.002) {
        // 1ms == 0.001s; allow one frame of slack
        bad.push(`${el.tagName}.${(el.className || '').toString().slice(0, 24)} t=${cs.transitionDuration} a=${cs.animationDuration}`);
      }
    }
    return bad;
  });
  check('every transition and animation collapses to ~1ms', durations.length === 0, durations.slice(0, 3).join(' | '));

  const entrance = await page.evaluate(() => {
    const el = document.querySelector('.dt-enter-sheet');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform, animation: cs.animationName };
  });
  check(
    'the sheet entrance is disabled, not merely fast',
    entrance && entrance.opacity === '1' && entrance.transform === 'none',
    JSON.stringify(entrance)
  );

  await page.getByRole('button', { name: /open ats score breakdown/i }).click();
  // Deliberately short: under reduced motion the numeral must already be final.
  await page.waitForTimeout(60);
  const immediate = await page.evaluate(() => {
    const m = document.querySelector('[role="meter"]');
    const num = m?.parentElement?.querySelector('span[aria-hidden="true"]');
    return { now: m?.getAttribute('aria-valuenow'), shown: num?.textContent?.trim() };
  });
  check(
    'the gauge shows its final value immediately, no counting',
    immediate?.shown === immediate?.now,
    `showed ${immediate?.shown} for ${immediate?.now}`
  );
}

// ------------------------------------------------------------------------ print
{
  console.log('\nprint');
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto('http://127.0.0.1:4180/#/app', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);

  const print = await page.evaluate(() => {
    const shown = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return false;
      const cs = getComputedStyle(e);
      return cs.display !== 'none' && cs.visibility !== 'hidden';
    };
    const paper = document.querySelector('.resume-paper');
    const wrap = document.querySelector('#resume-print-wrapper');
    const cs = paper ? getComputedStyle(paper) : null;
    const ws = wrap ? getComputedStyle(wrap) : null;
    const text = document.body.innerText;
    const chrome = [
      'Plate 01', 'EXPORT_PDF', 'UPLOAD', 'PRINT', 'TRACKER', 'MATCH',
      'Set default', 'Resume variants', 'MY RESUME', 'JSON RESUME', 'PROOF',
    ];
    return {
      header: shown('header'),
      rail: shown('aside'),
      crops: shown('.dt-crop'),
      furniture: shown('.dt-bench-furniture'),
      paperBg: cs?.backgroundColor,
      paperShadow: cs?.boxShadow,
      paperTransform: cs?.transform,
      wrapTransform: ws?.transform,
      leaks: chrome.filter((w) => text.includes(w)),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });

  check('the header is hidden in print', !print.header);
  check('the editor rail is hidden in print', !print.rail);
  check('crop marks are hidden in print', !print.crops);
  check('bench furniture is hidden in print', !print.furniture);
  check('the sheet prints white', print.paperBg === 'rgb(255, 255, 255)', print.paperBg);
  check('the sheet prints with no shadow', print.paperShadow === 'none', print.paperShadow);
  check('the page background prints white', print.bodyBg === 'rgb(255, 255, 255)', print.bodyBg);
  check(
    'no zoom transform survives into print',
    print.paperTransform === 'matrix(1, 0, 0, 1, 0, 0)' && print.wrapTransform === 'matrix(1, 0, 0, 1, 0, 0)',
    `paper ${print.paperTransform} / wrap ${print.wrapTransform}`
  );
  check('no chrome text leaks onto the page', print.leaks.length === 0, print.leaks.join(', '));
}

// ---------------------------------------------------------------- landing page
// The landing page is a second surface with its own motion, and it is the one
// a visitor sees first. It gets the same treatment: entrances must actually
// start hidden, the reduced-motion path must resolve rather than merely speed
// up, and the hero gauge must count.
{
  console.log('\nlanding page');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const res = await page.goto('http://127.0.0.1:4180/#/', { waitUntil: 'networkidle' });
  check('the landing page serves', res?.status() === 200, String(res?.status()));

  const bare = await page.evaluate(() => window.location.hash);
  check('a bare URL normalises to an explicit #/ route', bare === '#/', bare);

  // Entrances start hidden, so they must actually be hidden before they fire.
  // Elements already carrying .is-in are excluded on purpose: the hero readout
  // group starts visible because the gauge inside it runs its own observer, and
  // a parent at opacity:0 would stop that observer from ever firing.
  const beforeReveal = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.landing-rise')].filter(
      (e) => !e.classList.contains('is-in')
    );
    return { total: els.length, hidden: els.filter((e) => getComputedStyle(e).opacity === '0').length };
  });
  check('entrance elements exist', beforeReveal.total > 0, String(beforeReveal.total));
  check(
    'entrances start hidden rather than already settled',
    beforeReveal.hidden === beforeReveal.total,
    `${beforeReveal.hidden}/${beforeReveal.total} hidden`
  );

  await page.waitForTimeout(2200);
  const afterReveal = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.landing-rise')];
    return els.filter((e) => getComputedStyle(e).opacity !== '0').length;
  });
  check('hero entrances resolve without scrolling', afterReveal > 0, String(afterReveal));

  // THE regression this guarded: the count-up sits at y=870 in a 900px viewport,
  // so any bottom rootMargin inset excluded it and the gauge sat at 0 forever.
  const gauge = await page.evaluate(() => {
    const el = document.querySelector('[role="img"][aria-label*="ATS score"]');
    return {
      present: Boolean(el),
      value: Number((el?.getAttribute('aria-label') || '').match(/(\d+) out of/)?.[1] ?? -1),
      litTicks: el ? [...el.querySelectorAll('.landing-tick')].filter((t) => t.classList.contains('is-on')).length : 0,
    };
  });
  check('the hero gauge exists', gauge.present);
  check('the hero gauge counted up to its target', gauge.value === 92, String(gauge.value));
  check('the gauge lit ticks to match', gauge.litTicks > 25, String(gauge.litTicks));

  const ticker = await page.evaluate(() => {
    const t = document.querySelector('.landing-ticker');
    return t ? getComputedStyle(t).animationName : null;
  });
  check('the capability ticker is running', ticker === 'landing-ticker', String(ticker));

  // Reduced motion: resolved, not accelerated.
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const rpage = await rctx.newPage();
  await rpage.goto('http://127.0.0.1:4180/#/', { waitUntil: 'networkidle' });
  await rpage.waitForTimeout(500);
  const reduced = await rpage.evaluate(() => {
    const els = [...document.querySelectorAll('.landing-rise')];
    const t = document.querySelector('.landing-ticker');
    const g = document.querySelector('[role="img"][aria-label*="ATS score"]');
    return {
      allShown: els.length > 0 && els.every((e) => getComputedStyle(e).opacity === '1'),
      anyTransition: els.some((e) => parseFloat(getComputedStyle(e).transitionDuration) > 0.002),
      tickerAnim: t ? getComputedStyle(t).animationName : 'none',
      gauge: Number((g?.getAttribute('aria-label') || '').match(/(\d+) out of/)?.[1] ?? -1),
      scanHidden: (() => {
        const s = document.querySelector('.landing-scan');
        return s ? getComputedStyle(s).display === 'none' : true;
      })(),
    };
  });
  check('reduced motion shows every entrance immediately', reduced.allShown);
  check('reduced motion removes entrance transitions entirely', !reduced.anyTransition);
  check('reduced motion stops the ticker', reduced.tickerAnim === 'none', String(reduced.tickerAnim));
  check('reduced motion hides the decorative scan line', reduced.scanHidden);
  check('reduced motion still shows the real gauge value', reduced.gauge === 92, String(reduced.gauge));

  await rctx.close();
  await ctx.close();
}

await browser.close();
server.close();

console.log('');
if (failures) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All motion and print invariants hold.');
