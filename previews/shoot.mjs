/**
 * Screenshot every preview at three useful states, so they can be compared
 * like-for-like: hero at 1440, a mid-page scroll at 1440, and the top at 390.
 *
 * Run: node previews/shoot.mjs
 */
import { chromium } from 'playwright';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIRS = ['A-letterpress', 'B-kinetic', 'C-instrument', 'D-reading', 'E-hold', 'F-studio'];

const browser = await chromium.launch();

for (const dir of DIRS) {
  const url = pathToFileURL(join(HERE, dir, 'index.html')).href;

  // hero, desktop
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    // let entrance motion finish so the shot is the settled state
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(HERE, dir, 'shot-1440.png') });
    await ctx.close();
  }

  // mid-page, desktop — scroll far enough to trigger reveals, then settle
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.75);
      const max = document.body.scrollHeight;
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 110));
      }
    });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: join(HERE, dir, 'shot-mid.png') });
    // and a full-page one, now that everything has been revealed
    await page.screenshot({ path: join(HERE, dir, 'shot-full.png'), fullPage: true });
    await ctx.close();
  }

  // mobile
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(HERE, dir, 'shot-390.png') });
    await ctx.close();
  }

  console.log(`${dir}: shot-1440, shot-mid, shot-full, shot-390`);
}

await browser.close();