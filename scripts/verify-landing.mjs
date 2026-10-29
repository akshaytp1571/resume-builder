/**
 * Verify the landing page in a real browser.
 *
 * Run: node scripts/verify-landing.mjs      (expects a preview server on 4173)
 *
 * Static analysis cannot tell you whether a marketing page reads as premium:
 * type size, whitespace, overflow, and whether the launch button is actually
 * above the fold are all layout facts. This checks the ones that can be
 * measured, and writes screenshots to previews/landing/ for the rest.
 *
 * Four interaction contracts follow the layout sweep. Each is invisible in a
 * screenshot and each fails silently:
 *
 *   S1  in-page anchors and the skip link keep the route at `#/`
 *   S2  a one-finger drag scrolls the page, including over the specimen
 *   S4  the peel's ARIA state and its clip state describe one value
 *   S5  the page survives 200% zoom without horizontal scroll or clipped text
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'previews', 'landing');
const BASE = process.env.LANDING_URL || 'http://localhost:4173/';

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 800 },
  { name: '768', width: 768, height: 900 },
  { name: '390', width: 390, height: 844 },
  { name: '320', width: 320, height: 720 },
];

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
};

await mkdir(OUT, { recursive: true });

// Prefer Playwright's own download; fall back to a system Chromium so the
// check runs on a machine that has a browser but has not run
// `npx playwright install`.
const SYSTEM_CHROME = ['/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch(
  SYSTEM_CHROME ? { executablePath: SYSTEM_CHROME } : {}
);

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto(`${BASE}#/`, { waitUntil: 'load' });
  await page.waitForSelector('#hero-title');
  // Let the 900ms Templates count-up settle before capturing deterministic art.
  await page.waitForFunction(() => document.querySelector('[data-count="9"]')?.textContent === '9');

  // --- no horizontal overflow. This is the failure mode that hides on a
  // desktop screenshot and ruins the page on a phone.
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders = [];
    for (const el of document.querySelectorAll('.landing *')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > doc.clientWidth + 1 || r.left < -1)) {
        offenders.push(`${el.className || el.tagName} right=${Math.round(r.right)}`);
      }
    }
    return {
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      offenders: offenders.slice(0, 4),
    };
  });
  check(
    overflow.scrollW <= overflow.clientW + 1,
    `${vp.name}: no horizontal overflow (scrollW ${overflow.scrollW} vs clientW ${overflow.clientW})${overflow.offenders.length ? ` — ${overflow.offenders.join(' | ')}` : ''}`
  );

  // --- the promise and the launch button are both above the fold.
  const fold = await page.evaluate(() => {
    const h1 = document.querySelector('#hero-title');
    const cta = document.querySelector('.dt-acts .dt-btn--solid');
    return {
      h1Size: parseFloat(getComputedStyle(h1).fontSize),
      h1Rect: h1.getBoundingClientRect().toJSON(),
      ctaBottom: cta.getBoundingClientRect().bottom,
      innerH: window.innerHeight,
    };
  });
  check(fold.h1Size >= 40, `${vp.name}: hero type is display-scale (${fold.h1Size}px)`);
  check(
    fold.ctaBottom <= fold.innerH,
    `${vp.name}: primary CTA is above the fold (bottom ${Math.round(fold.ctaBottom)} vs ${fold.innerH})`
  );
  check(fold.h1Rect.bottom <= fold.innerH, `${vp.name}: headline is above the fold`);

  await page.screenshot({ path: join(OUT, `hero-${vp.name}.png`) });

  // --- the frosted mast materialises on scroll.
  await page.evaluate(() => window.scrollTo(0, 620));
  await page.waitForTimeout(400);
  const mast = await page.evaluate(() => {
    const m = document.querySelector('.dt-mast');
    const cs = getComputedStyle(m);
    return { stuck: m.classList.contains('is-stuck'), blur: cs.backdropFilter || cs.webkitBackdropFilter };
  });
  check(mast.stuck, `${vp.name}: mast pins once scrolled`);
  check(/blur/.test(mast.blur || ''), `${vp.name}: mast is frosted (${mast.blur || 'no backdrop-filter'})`);

  // --- everything hidden for the entrance has been revealed by the time the
  // reader has scrolled through the page.
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
  });
  await page.waitForTimeout(900);
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('.landing-rise, .dt-rise')]
      .filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99)
      .map((el) => el.className)
  );
  check(hidden.length === 0, `${vp.name}: all revealed content is visible (${hidden.length} hidden)`);

  await page.screenshot({ path: join(OUT, `full-${vp.name}.png`), fullPage: true });

  // --- the launch button actually launches.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.click('.dt-acts .dt-btn--solid');
  await page.waitForTimeout(900);
  const routed = await page.evaluate(() => ({
    hash: window.location.hash,
    editor: Boolean(document.querySelector('a.skip-link[href="#main-content"]')),
    landing: Boolean(document.querySelector('#hero-title')),
  }));
  check(routed.hash === '#/app', `${vp.name}: CTA routes to #/app (got ${routed.hash})`);
  check(!routed.landing, `${vp.name}: landing is gone after the CTA`);
  check(routed.editor, `${vp.name}: editor mounted after the CTA`);

  check(errors.length === 0, `${vp.name}: no console or page errors${errors.length ? ` — ${errors.slice(0, 2).join(' | ')}` : ''}`);

  await ctx.close();
}

// --- S1: local anchors and the skip link must never hand section fragments to
// the hash router. A click changes scroll position, not `location.hash`.
{
  console.log('\nS1 — in-page anchors and skip link');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}#/`, { waitUntil: 'load' });
  await page.waitForSelector('#hero-title');

  const sections = ['score', 'gaps', 'templates', 'parser', 'ledger'];
  for (const id of sections) {
    await page.click(`.dt-mast__nav a[href="#${id}"]`);
    await page.waitForTimeout(750);
    const anchor = await page.evaluate((targetId) => {
      const target = document.getElementById(targetId);
      const mast = document.querySelector('.dt-mast');
      return {
        hash: window.location.hash,
        top: target?.getBoundingClientRect().top ?? Infinity,
        mastBottom: mast?.getBoundingClientRect().bottom ?? 0,
      };
    }, id);
    check(anchor.hash === '#/', `S1: #${id} anchor preserves #/ route (got ${anchor.hash})`);
    check(
      Math.abs(anchor.top - anchor.mastBottom) <= 8,
      `S1: #${id} anchor lands below the sticky mast (top ${Math.round(anchor.top)}, mast ${Math.round(anchor.mastBottom)})`
    );
  }

  // The hero's secondary action is another route-sensitive in-page anchor.
  // It must use the same intercepted jump path as the mast links.
  await page.click('.dt-acts a[href="#score"]');
  await page.waitForTimeout(750);
  const heroAnchor = await page.evaluate(() => {
    const target = document.getElementById('score');
    const mast = document.querySelector('.dt-mast');
    return {
      hash: window.location.hash,
      top: target?.getBoundingClientRect().top ?? Infinity,
      mastBottom: mast?.getBoundingClientRect().bottom ?? 0,
    };
  });
  check(heroAnchor.hash === '#/', `S1: hero score anchor preserves #/ route (got ${heroAnchor.hash})`);
  check(
    Math.abs(heroAnchor.top - heroAnchor.mastBottom) <= 8,
    `S1: hero score anchor lands below the sticky mast (top ${Math.round(heroAnchor.top)}, mast ${Math.round(heroAnchor.mastBottom)})`
  );

  // The mast mark is the "back to top" control. The hero is not a
  // `.dt-section`, so it carries no `scroll-margin-top`: it lands at the very
  // top of the document, tucked under the sticky mast, rather than below it.
  // A full-page smooth scroll is the longest one on the page, hence the wait.
  await page.click('.dt-mark[href="#top"]');
  await page.waitForTimeout(1500);
  const toTop = await page.evaluate(() => ({
    hash: window.location.hash,
    y: Math.round(window.scrollY),
    top: Math.round(document.getElementById('top').getBoundingClientRect().top),
  }));
  check(toTop.hash === '#/', `S1: #top anchor preserves #/ route (got ${toTop.hash})`);
  check(
    toTop.y <= 80 && Math.abs(toTop.top) <= 2,
    `S1: #top anchor returns to the top (y ${toTop.y}, hero top ${toTop.top})`
  );

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.landing a.skip-link').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(750);
  const skip = await page.evaluate(() => ({
    hash: window.location.hash,
    href: document.querySelector('.landing a.skip-link')?.getAttribute('href'),
    active: document.activeElement?.id,
    target: document.querySelector('#main-content')?.getBoundingClientRect().height > 0,
  }));
  check(skip.href === '#main-content', 'S1: skip link targets the landing main region');
  check(skip.hash === '#/', `S1: skip link preserves #/ route (got ${skip.hash})`);
  check(skip.active === 'main-content', `S1: skip link focuses main content (got ${skip.active || 'none'})`);
  check(skip.target, 'S1: skip-link target is rendered and measurable');
  await ctx.close();
}

// --- S2: a one-finger vertical swipe keeps scrolling the document even when
// it starts on the draggable specimen. The specimen may tilt, but it must not
// trap the gesture or turn it into a hash navigation.
{
  console.log('\nS2 — touch scroll and specimen gesture');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}#/`, { waitUntil: 'load' });
  await page.waitForSelector('#hero-title');
  await page.locator('.dt-sheet').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  const touchCss = await page.evaluate(() => ({
    sheet: getComputedStyle(document.querySelector('.dt-sheet')).touchAction,
    peel: getComputedStyle(document.querySelector('.dt-peel')).touchAction,
  }));
  check(touchCss.sheet === 'pan-y', `S2: specimen allows vertical page pan (touch-action ${touchCss.sheet})`);
  check(touchCss.peel === 'pan-y', `S2: parser peel allows vertical page pan (touch-action ${touchCss.peel})`);

  const box = await page.locator('.dt-sheet').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const point = {
    x: Math.round((box?.x ?? 195) + (box?.width ?? 0) / 2),
    y: Math.round((box?.y ?? 420) + (box?.height ?? 0) / 2),
  };
  const before = await page.evaluate(() => ({ y: window.scrollY, transform: document.querySelector('.dt-sheet')?.style.transform || '' }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  for (let i = 1; i <= 10; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: point.x, y: point.y - Math.round((320 * i) / 10) }],
    });
    await page.waitForTimeout(10);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({
    y: window.scrollY,
    hash: window.location.hash,
    transform: document.querySelector('.dt-sheet')?.style.transform || '',
  }));
  check(after.y > before.y + 100, `S2: vertical swipe over specimen scrolls page (${Math.round(before.y)} → ${Math.round(after.y)})`);
  check(after.hash === '#/', `S2: specimen swipe preserves #/ route (got ${after.hash})`);
  check(after.transform !== before.transform, 'S2: specimen still responds to touch without trapping scroll');
  await ctx.close();
}

// --- S4: the peel button exposes one state to assistive technology and paints
// the same state through the CSS clip. Test both ends of the toggle.
{
  console.log('\nS4 — peel ARIA and clip agreement');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}#/`, { waitUntil: 'load' });
  await page.waitForSelector('#hero-title');
  const readPeelState = () => page.evaluate(() => {
    const box = document.querySelector('.dt-peel');
    const handle = document.querySelector('.dt-peel__handle');
    const read = document.querySelector('.dt-peel__side--read');
    const clip = getComputedStyle(read).clipPath;
    return {
      value: Number(handle?.getAttribute('aria-valuenow')),
      text: handle?.getAttribute('aria-valuetext'),
      hidden: read?.getAttribute('aria-hidden'),
      peel: Number(box?.style.getPropertyValue('--peel')),
      clip,
    };
  });
  const closed = await readPeelState();
  check(closed.value === 0 && closed.peel === 0, `S4: closed peel reports 0% in ARIA and CSS (ARIA ${closed.value}, CSS ${closed.peel})`);
  check(closed.text === '0% extracted', `S4: closed peel announces 0% extracted (got ${closed.text})`);
  check(closed.hidden === 'true' && /100%/.test(closed.clip), `S4: closed peel hides extracted text and clips it (${closed.clip})`);

  await page.click('.dt-peel__handle');
  const open = await readPeelState();
  check(open.value === 100 && open.peel === 100, `S4: open peel reports 100% in ARIA and CSS (ARIA ${open.value}, CSS ${open.peel})`);
  check(open.text === '100% extracted', `S4: open peel announces 100% extracted (got ${open.text})`);
  check(open.hidden === 'false' && !/100%/.test(open.clip), `S4: open peel reveals extracted text and removes full clip (${open.clip})`);
  await ctx.close();
}

// --- S5: a 640px CSS viewport is the browser-layout equivalent of 200% zoom
// on a 1280px display. Assert both the page width and the text-bearing boxes;
// intentional masked headline wrappers are excluded from the clipping probe.
{
  console.log('\nS5 — 200% zoom text and width');
  const ctx = await browser.newContext({ viewport: { width: 640, height: 450 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}#/`, { waitUntil: 'load' });
  await page.waitForSelector('#hero-title');
  await page.waitForTimeout(700);
  const zoom = await page.evaluate(() => {
    const doc = document.documentElement;
    const clipped = [];
    const textNodes = document.querySelectorAll(
      '.landing p, .landing h1, .landing h2, .landing h3, .landing dt, .landing dd, .landing li, .landing span'
    );
    for (const el of textNodes) {
      if (el.closest('.ln')) continue; // intentional headline mask, not text clipping
      if (!el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      const hides = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowY === 'hidden' || cs.overflowY === 'clip';
      if (hides && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) {
        clipped.push(`${el.className || el.tagName} ${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight}`);
      }
    }
    const visible = ['#hero-title', '.dt-deck', '.dt-acts .dt-btn--solid', '#score-title', '#templates-title', '#parser-title', '#ledger-title']
      .map((selector) => {
        const el = document.querySelector(selector);
        const r = el?.getBoundingClientRect();
        return { selector, visible: Boolean(r && r.width > 0 && r.height > 0 && r.right <= doc.clientWidth + 1 && r.left >= -1) };
      });
    return {
      width: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      clipped: clipped.slice(0, 4),
      visible,
    };
  });
  check(zoom.scrollWidth <= zoom.width + 1, `S5: 200% layout has no horizontal overflow (${zoom.scrollWidth} vs ${zoom.width})`);
  check(zoom.clipped.length === 0, `S5: 200% layout clips no text${zoom.clipped.length ? ` — ${zoom.clipped.join(' | ')}` : ''}`);
  check(zoom.visible.every((entry) => entry.visible), `S5: 200% hero, CTA and section headings remain visible${zoom.visible.some((entry) => !entry.visible) ? ` — ${zoom.visible.filter((entry) => !entry.visible).map((entry) => entry.selector).join(', ')}` : ''}`);
  await ctx.close();
}

// --- reduced motion: content is resolved, nothing is left hidden, no rAF loop.
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}#/`, { waitUntil: 'load' });
  await page.waitForSelector('#hero-title');
  await page.waitForTimeout(500);

  const reduced = await page.evaluate(() => {
    const hidden = [...document.querySelectorAll('.landing-rise, .dt-rise')].filter(
      (el) => parseFloat(getComputedStyle(el).opacity) < 0.99
    );
    const masked = [...document.querySelectorAll('.ln__i')].filter(
      (el) => getComputedStyle(el).transform !== 'none'
    );
    return { hidden: hidden.length, masked: masked.length, score: document.querySelector('.dt-gauge__num b').textContent };
  });
  check(reduced.hidden === 0, `reduced motion: nothing left hidden (${reduced.hidden})`);
  check(reduced.masked === 0, `reduced motion: masked headlines resolved (${reduced.masked})`);
  check(reduced.score === '92', `reduced motion: the score shows its final value (${reduced.score})`);
  await page.screenshot({ path: join(OUT, 'reduced-motion-1280.png') });
  await ctx.close();
}

await browser.close();

console.log('');
if (failures.length) {
  console.error(`${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('LANDING OK — screenshots in previews/landing/');
