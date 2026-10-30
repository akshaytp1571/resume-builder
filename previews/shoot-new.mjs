/**
 * Screenshot one or more preview dirs (passed as argv) at three states:
 * hero at 1440x900, full page at 1440, and hero at 390x844.
 *
 * Uses the system chromium at /usr/bin/chromium because the Playwright
 * bundled browser is not downloaded in this environment.
 *
 * Run: node previews/shoot-new.mjs G-paper-ink H-signal I-daylight
 */
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIRS = process.argv.slice(2);

if (DIRS.length === 0) {
  console.error('usage: node previews/shoot-new.mjs <dir> [dir...]');
  process.exit(1);
}

const EXE = '/usr/bin/chromium';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--font-render-hinting=none'] });

for (const dir of DIRS) {
  const url = `file://${join(HERE, dir, 'index.html')}`;

  // hero, desktop
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2400);
    await page.screenshot({ path: join(HERE, dir, 'shot-1440.png') });
    await ctx.close();
  }

  // full page, desktop — scroll through to trigger reveals, then settle
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.7);
      const max = document.body.scrollHeight;
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: join(HERE, dir, 'shot-full.png'), fullPage: true });
    await ctx.close();
  }

  // hero, mobile
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: join(HERE, dir, 'shot-390.png') });
    await ctx.close();
  }

  console.log(`${dir}: shot-1440, shot-full, shot-390`);
}

await browser.close();
