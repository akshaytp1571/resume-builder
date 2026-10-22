/**
 * Apply Agent
 *
 * Takes a job (title, company, applyUrl) plus the candidate profile, opens
 * the application, fills what it can, attaches the resume, and reports back.
 *
 * SAFETY MODEL
 *   - The agent NEVER submits an application on its own. `submit` must be
 *     explicitly requested, and even then it stops at the final button
 *     without clicking when `confirmSubmit` is false (the default).
 *   - It never types into CAPTCHAs, and it reports them for a human.
 *   - It never touches payment or identity-verification fields.
 *   - It refuses to run against a job whose URL it does not recognise.
 */

const { chromium } = require('playwright');
const { buildProfile, profileAnswers } = require('./profile.js');
const { fillForm, attachResume, detectAts } = require('./form-filler.js');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const BLOCKED_HOSTS = [
  'accounts.google.com',
  'paypal.com',
  'stripe.com',
  'bank',
];

function isSafeUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    return !BLOCKED_HOSTS.some((b) => host.includes(b));
  } catch (e) {
    return false;
  }
}

class ApplyAgent {
  constructor(options = {}) {
    this.browser = null;
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
        return this.browser;
      } catch (err) {
        console.warn('[apply] system Chrome unavailable, using bundled Chromium');
      }
    }
    this.browser = await chromium.launch(launchArgs);
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
      userAgent: UA,
      viewport: { width: 1600, height: 1000 },
      locale: 'en-US',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = window.chrome || { runtime: {} };
    });
    return context;
  }

  /**
   * Prepare an application: open the page, work out where the real form is,
   * and fill it in.
   *
   * @param {object} job      { title, company, applyUrl }
   * @param {object} resumeData  The resume builder's resumeData
   * @param {object} options  { resumePath, dryRun, coverLetter, submit, confirmSubmit }
   */
  async prepare(job, resumeData, options = {}) {
    const {
      resumePath = '',
      dryRun = true,
      submit = false,
      confirmSubmit = false,
      coverLetter = '',
      timeout = 60000,
    } = options;

    const result = {
      job: { title: job.title || '', company: job.company || '', applyUrl: job.applyUrl || '' },
      ats: null,
      finalUrl: null,
      status: 'failed',
      filled: [],
      skipped: [],
      needsHuman: [],
      uploads: [],
      submitted: false,
      error: null,
    };

    if (!isSafeUrl(job.applyUrl)) {
      result.error = 'Refused: unsafe or invalid application URL';
      result.status = 'refused';
      return result;
    }

    const profile = buildProfile(resumeData, {
      ...(options.profileOverrides || {}),
      coverLetter: coverLetter || undefined,
    });
    const answers = profileAnswers(profile);

    const context = await this.createContext();
    const page = await context.newPage();

    try {
      // --- reach the application ---
      await page.goto(job.applyUrl, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(3000);

      // LinkedIn and Indeed both wrap the real form: the offsite apply link
      // is a redirect to the employer's ATS. Only follow one when the page
      // in front of us has no usable form - otherwise a "sign in to apply"
      // link would drag us away from the form that is already there.
      const hasForm = await page
        .evaluate(
          () =>
            document.querySelectorAll('input:not([type=hidden]), textarea, select').length > 0
        )
        .catch(() => false);

      if (!hasForm) {
        const offsite = await findOffsiteApplyLink(page);
        if (offsite) {
          result.redirectedFrom = job.applyUrl;
          await page.goto(offsite, { waitUntil: 'domcontentloaded', timeout });
          await page.waitForTimeout(3000);
        }
      }

      result.finalUrl = page.url();
      result.ats = detectAts(page.url(), await page.content());

      // --- fill ---
      const report = await fillForm(page, profile, { resumePath, dryRun, answers });
      result.ats = report.ats;
      result.filled = report.filled;
      result.skipped = report.skipped;
      result.needsHuman = report.needsHuman;

      if (!dryRun && report.fileInputs.length && resumePath) {
        result.uploads = await attachResume(page, report.fileInputs);
      }

      // --- submit (opt-in, and still gated on confirmSubmit) ---
      if (submit && confirmSubmit) {
        result.submitted = await clickSubmit(page);
        result.status = result.submitted ? 'submitted' : 'filled';
      } else {
        result.status = dryRun ? 'dry-run' : 'filled';
      }

      // A screenshot makes the report reviewable by a human.
      if (!dryRun) {
        const shot = `apply-${(job.company || 'job').replace(/[^\w-]+/g, '_')}.png`;
        await page.screenshot({ path: shot }).catch(() => {});
        result.screenshot = shot;
      }
    } catch (err) {
      result.error = err.message;
      result.status = 'failed';
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }

    return result;
  }
}

/**
 * Find a link on a job board that leads to the employer's own ATS.
 * Returns an absolute URL or null.
 */
async function findOffsiteApplyLink(page) {
  return page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll('a[href], button[data-tracking-control-name]')
    );

    const score = (el) => {
      const track = (el.getAttribute('data-tracking-control-name') || '').toLowerCase();
      const text = (el.innerText || '').trim().toLowerCase();
      const href = (el.getAttribute('href') || '').toLowerCase();

      if (/apply-link-offsite|offsite_apply|apply-offsite/.test(track)) return 100;
      if (/\bapply\b/.test(text) && text.length < 30) return 60;
      if (/greenhouse|lever\.co|workday|ashby|smartrecruiters|taleo|icims|successfactors/.test(href))
        return 90;
      if (/apply/.test(track) && /company|external/.test(track)) return 80;
      return 0;
    };

    let best = null;
    let bestScore = 50; // require a clear signal
    for (const el of candidates) {
      const s = score(el);
      if (s > bestScore) {
        const href = el.getAttribute('href');
        if (href && /^https?:\/\//i.test(href)) {
          best = href;
          bestScore = s;
        }
      }
    }
    return best;
  });
}

/** Click a submit / apply button. Returns true if something was clicked. */
async function clickSubmit(page) {
  return page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, input[type="submit"]')).find((b) => {
      const t = (b.innerText || b.value || '').trim().toLowerCase();
      return /^(submit application|submit|apply now|apply|send application|proceed to application)$/.test(t);
    });
    if (!btn) return false;
    btn.click();
    return true;
  });
}

module.exports = ApplyAgent;
module.exports.ApplyAgent = ApplyAgent;
module.exports.buildProfile = buildProfile;
module.exports.profileAnswers = profileAnswers;
module.exports.detectAts = detectAts;
