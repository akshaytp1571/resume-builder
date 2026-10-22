/**
 * Browser Automation Job Scraper
 *
 * Engines both job-board scrapers in parallel and normalizes their output.
 *
 * IMPORTANT (discovered by probing the live sites, 2026-10):
 *  - Naukri (Akamai) and Indeed (Cloudflare) 403 the *bundled* Chromium
 *    build. Launching the real installed Chrome via `channel: 'chrome'`
 *    renders them normally, so the engine always prefers the system Chrome
 *    and falls back to the bundled browser only if Chrome is unavailable.
 *  - Each site needs its own browser context (separate cookie jars).
 */

const { chromium } = require('playwright');

const scrapers = {
  linkedin: require('./scrapers/linkedin-scraper.cjs'),
  naukari: require('./scrapers/naukari-scraper.cjs'),
  indeed: require('./scrapers/indeed-scraper.cjs'),
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

class BrowserJobScraper {
  constructor(options = {}) {
    this.browser = null;
    this.maxConcurrency = options.maxConcurrency || 3;
    this.headless = options.headless !== false;
    this.useSystemChrome = options.useSystemChrome !== false;
  }

  async launchBrowser() {
    if (this.browser) return this.browser;

    const launchArgs = {
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    };

    if (this.useSystemChrome) {
      try {
        this.browser = await chromium.launch({ ...launchArgs, channel: 'chrome' });
        console.log('[scraper] Launched system Chrome');
        return this.browser;
      } catch (err) {
        console.warn(
          `[scraper] System Chrome unavailable (${err.message.split('\n')[0]}), using bundled Chromium`
        );
      }
    }

    this.browser = await chromium.launch(launchArgs);
    console.log('[scraper] Launched bundled Chromium');
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  async createContext() {
    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      extraHTTPHeaders: { 'Accept-Language': 'en-IN,en;q=0.9,en-US;q=0.8' },
    });

    // Hide the headless fingerprint
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-IN', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = window.chrome || { runtime: {} };
    });

    return context;
  }

  async scrapeSite(siteId, searchParams, credentials = {}) {
    const scraper = scrapers[siteId];
    if (!scraper) throw new Error(`No scraper registered for site: ${siteId}`);

    const context = await this.createContext();
    try {
      if (credentials[siteId]) {
        await scraper.authenticate(context, credentials[siteId]);
      }
      return await scraper.scrape(context, searchParams);
    } finally {
      await context.close().catch(() => {});
    }
  }

  async scrapeAllSites(searchParams, credentials = {}, only = null) {
    const siteIds = only || Object.keys(scrapers);
    const results = {};

    // Run the sites sequentially. Each one drives a full browser, and
    // hammering three Chrome instances at once triggered navigation races
    // ("Execution context was destroyed") on LinkedIn.
    for (const siteId of siteIds) {
      const started = Date.now();
      let attempt = 0;
      let lastError = null;

      while (attempt < 2) {
        attempt += 1;
        try {
          const jobs = await this.scrapeSite(siteId, searchParams, credentials);
          if (jobs.length > 0) {
            console.log(
              `[scraper] ${siteId}: ${jobs.length} jobs in ${((Date.now() - started) / 1000).toFixed(1)}s`
            );
            results[siteId] = { jobs, success: true };
            break;
          }
          lastError = new Error('no jobs returned');
          console.warn(`[scraper] ${siteId}: no jobs, retrying...`);
          await this.closeBrowser();
          await new Promise((r) => setTimeout(r, 4000));
        } catch (error) {
          lastError = error;
          console.error(`[scraper] ${siteId} failed:`, error.message);
          await this.closeBrowser();
          await new Promise((r) => setTimeout(r, 4000));
        }
      }

      if (!results[siteId]) {
        results[siteId] = {
          jobs: [],
          success: false,
          error: lastError ? lastError.message : 'unknown error',
        };
        console.error(`[scraper] ${siteId}: gave up after ${attempt} attempts`);
      }
    }

    await this.closeBrowser();
    return results;
  }
}

module.exports = BrowserJobScraper;
module.exports.scrapers = scrapers;
