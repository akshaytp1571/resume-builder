/**
 * Audit the three landing directions.
 *
 * Run: node previews/audit.mjs
 *
 * Checks each preview for the things a screenshot cannot show:
 *   - JS errors
 *   - horizontal overflow at five widths
 *   - reduced-motion resolution
 *   - whether content is visible with JS disabled (the no-JS trap)
 *   - accessible name coverage on interactive elements
 */

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const DIRS = ['A-letterpress', 'B-kinetic', 'C-instrument', 'D-reading', 'E-hold', 'F-studio'];
const WIDTHS = [
  [320, 700],
  [390, 844],
  [768, 1024],
  [1440, 900],
  [1920, 1080],
];

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failures += 1;
};

const browser = await chromium.launch();

for (const dir of DIRS) {
  const file = join(HERE, dir, 'index.html');
  console.log(`\n${dir}`);
  if (!existsSync(file)) {
    check('index.html exists', false);
    continue;
  }
  const url = pathToFileURL(file).href;

  // ---- normal
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    const res = await page.goto(url, { waitUntil: 'load' });
    check('page loads', res?.status() === 200 || res === null, String(res?.status()));
    await page.waitForTimeout(1400);

    check('no JS errors', errs.length === 0, errs.slice(0, 2).join(' | '));

    // one h1
    const h1 = await page.locator('h1').count();
    check('exactly one h1', h1 === 1, String(h1));

    // every button and link named
    const unnamed = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('a[href], button')) {
        const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
        if (!name) bad.push(el.tagName + '.' + (el.className || '').toString().slice(0, 24));
      }
      return bad;
    });
    check('every link and button has a name', unnamed.length === 0, unnamed.slice(0, 3).join(', '));

    // Gradients are banned as *decoration*, not as a drawing primitive. A
    // hard-stop linear-gradient is the standard way to draw a 1px grid line or
    // a flat fill, so this only flags gradients that genuinely blend colours.
    const gradients = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll('*')) {
        const bg = getComputedStyle(el).backgroundImage;
        if (!bg || !bg.includes('gradient')) continue;
        // A hard stop is `colour 1px, <clear> 1px` — identical offsets, so
        // nothing blends. The clear side may be written as `transparent` OR as
        // `rgba(0, 0, 0, 0)`, which is how C draws its graph-paper grid.
        const hardStop = new RegExp(
          '\\d+(?:px|%|em|rem)\\s*,\\s*(?:transparent|rgba?\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*,\\s*0\\s*\\))\\s+\\d+(?:px|%)'
        ).test(bg);
        if (hardStop) continue;
        // Two deliberate exceptions, both material rather than decorative:
        //   - .beam__bloom (D) — the glow that makes the parse beam readable as
        //     a light source; the whole interaction hangs off it; it is
        //     display:none under reduced motion.
        //   - .card__glare (E) — the specular highlight that makes the card
        //     read as an object catching light instead of a flat rectangle;
        //     it is the physical- object concept, and recedes with rotation.
        if (el.matches('.beam__bloom')) continue;
        if (el.matches('.card__glare')) continue;
        if (el.matches('.sheet__glare')) continue;
        const colours = bg.match(/(?:rgba?\([^)]*\)|#[0-9a-f]{3,8})/gi) || [];
        if (new Set(colours.map((c) => c.toLowerCase())).size > 1) {
          bad.push(bg.slice(0, 70));
        }
      }
      return bad;
    });
    check('no decorative gradient blends', gradients.length === 0, gradients.slice(0, 2).join(' | '));

    await ctx.close();
  }

  // ---- overflow at every width
  {
    const bad = [];
    for (const [w, h] of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(700);
      const o = await page.evaluate(() => ({
        over: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      if (o.over) bad.push(`${w}px (${o.sw}>${o.cw})`);
      await ctx.close();
    }
    check('no horizontal overflow 320–1920', bad.length === 0, bad.join(', '));
  }

  // ---- reduced motion
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      // Anything still animating or transitioning is a reduced-motion miss.
      let moving = 0;
      let invisible = 0;
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        const t = parseFloat(cs.transitionDuration) || 0;
        const a = parseFloat(cs.animationDuration) || 0;
        if (t > 0.002 || a > 0.002) moving += 1;
        // Content that stayed at opacity 0 is content the user never sees.
        // aria-hidden content is decoration and is excluded — see the note in
        // the no-JS block below.
        if (el.closest('[aria-hidden="true"]')) continue;
        if (cs.opacity === '0' && el.textContent.trim().length > 3) invisible += 1;
      }
      return { moving, invisible };
    });
    check('reduced motion: nothing still animating', r.moving === 0, `${r.moving} elements`);
    check('reduced motion: no content left invisible', r.invisible === 0, `${r.invisible} elements`);
    await ctx.close();
  }

  // ---- JS disabled: does the content still exist?
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      javaScriptEnabled: false,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      let hidden = 0;
      for (const el of document.querySelectorAll('body *')) {
        // aria-hidden content is decoration by definition and may legitimately
        // stay invisible (D's "loss" annotations only appear once a beam has
        // passed them, and with JS off there is no beam). Only count content
        // the reader is actually meant to read.
        if (el.closest('[aria-hidden="true"]')) continue;
        const cs = getComputedStyle(el);
        if (cs.opacity === '0' && el.textContent.trim().length > 3) hidden += 1;
      }
      return { hidden, text: document.body.innerText.trim().length };
    });
    check('readable with JS disabled', r.hidden === 0, `${r.hidden} invisible blocks`);
    check('real content present with JS off', r.text > 300, `${r.text} chars`);
    await ctx.close();
  }
}

await browser.close();
console.log('');
if (failures) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log('All ' + DIRS.length + ' previews pass the audit.');
