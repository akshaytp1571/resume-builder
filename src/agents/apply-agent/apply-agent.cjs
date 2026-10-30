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
 *   - It refuses to navigate to a URL that is not a public http(s) address,
 *     and it re-checks every URL it is about to visit — including the
 *     offsite redirect it discovers on the page.
 *
 * WHAT THE URL CHECK IS AND IS NOT
 *   It is a guard against the agent being pointed somewhere it should not go:
 *   payment and identity providers, the loopback and private ranges the user's
 *   own machine and LAN expose, and URLs that disguise their real host. It is
 *   NOT a reputation check and it does NOT vet the employer. A URL that passes
 *   `isSafeUrl` is merely a well-formed public address; the agent still drives
 *   a real browser to it, which is the user's own explicit action.
 */

const { chromium } = require('playwright');
const { buildProfile, profileAnswers } = require('./profile.js');
const { fillForm, attachResume, detectAts } = require('./form-filler.js');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/**
 * Hosts the agent must never be driven to. Matched as a domain suffix, so
 * `paypal.com` covers `www.paypal.com` and `paypal.com.evil.example` does NOT
 * sneak through the way a raw substring test would have to be written.
 */
const BLOCKED_HOSTS = [
  'accounts.google.com',
  'paypal.com',
  'stripe.com',
];

/**
 * Loopback, link-local (including the cloud metadata address), private ranges,
 * and other non-global IPv4 space. The old rule was `host.includes('bank')`,
 * which was both over-broad — any hostname containing "bank" — and useless
 * against the addresses that actually matter here.
 */
const BLOCKED_IPV4 = [
  ['0.0.0.0', '8'],
  ['10.0.0.0', '8'],
  ['100.64.0.0', '10'],
  ['127.0.0.0', '8'],
  ['169.254.0.0', '16'],
  ['172.16.0.0', '12'],
  ['192.0.0.0', '24'],
  ['192.0.2.0', '24'],
  ['192.168.0.0', '16'],
  ['198.18.0.0', '15'],
  ['224.0.0.0', '4'],
  ['240.0.0.0', '4'],
];

function ipv4ToInt(host) {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = n * 256 + octet;
  }
  return n;
}

function isBlockedIpv4(host) {
  const value = ipv4ToInt(host);
  if (value === null) return false;
  return BLOCKED_IPV4.some(([base, bits]) => {
    const shift = 32 - Number(bits);
    const mask = shift === 32 ? 0 : (0xffffffff << shift) >>> 0;
    const network = ipv4ToInt(base);
    return (value & mask) === (network & mask);
  });
}

/** `paypal.com` matches itself and `x.paypal.com`, never `notpaypal.com`. */
function hostMatchesBlocklist(host) {
  return BLOCKED_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  );
}

/**
 * Parse an IPv6 literal into its eight 16-bit groups, or null.
 *
 * Needed because Node's URL normalises `[::ffff:127.0.0.1]` to the hex form
 * `[::ffff:7f00:1]`, so a regex looking for a dotted quad inside the hostname
 * never fires — which is exactly the kind of parser disagreement that turns a
 * validation check into a bypass.
 */
function ipv6Groups(host) {
  const text = String(host || '').replace(/^\[|\]$/g, '');
  if (!text.includes(':')) return null;

  const halves = text.split('::');
  if (halves.length > 2) return null;

  const expand = (part) =>
    part === '' ? [] : part.split(':').filter(Boolean).map((g) => parseInt(g, 16));

  const head = expand(halves[0]);
  const tail = halves.length === 2 ? expand(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;

  const groups =
    halves.length === 2
      ? [...head, ...new Array(missing).fill(0), ...tail]
      : [...head, ...tail];

  if (groups.length !== 8) return null;
  if (groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

/** The dotted-quad IPv4 address an IPv6-mapped literal stands for, or null. */
function ipv6MappedIpv4(host) {
  const groups = ipv6Groups(host);
  if (!groups) return null;
  // ::ffff:a.b.c.d — five leading zero groups, then 0xffff.
  const isMapped =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff;
  if (!isMapped) return null;
  return `${groups[6] >> 8}.${groups[6] & 0xff}.${groups[7] >> 8}.${groups[7] & 0xff}`;
}

/** Loopback, link-local, unique-local and other non-global IPv6 space. */
function isBlockedIpv6(host) {
  const groups = ipv6Groups(host);
  if (!groups) return false;
  if (groups.every((g) => g === 0)) return true; // ::
  if (groups[0] === 0 && groups[1] === 0 && groups[2] === 0 &&
      groups[3] === 0 && groups[4] === 0 && groups[5] === 0 &&
      groups[6] === 0 && groups[7] === 1) return true; // ::1
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  return false;
}

/**
 * Decide whether the agent may navigate to `url`.
 *
 * Exported because the offsite-apply redirect is discovered from page content
 * the app does not control, and it used to skip this check entirely: the agent
 * validated `job.applyUrl` and then followed whatever link the page offered,
 * which made the guard decorative.
 */
function isSafeUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    return false;
  }

  // Only plain http(s). `file:`, `data:` and `blob:` are not navigable targets
  // for a form-filling agent.
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

  // Credentials in the authority. `https://accounts.google.com@evil.example/`
  // parses with hostname `evil.example`, so a denylist that only inspects the
  // hostname sees a host it does not recognise and waves it through. Reject
  // the whole form instead of trying to be clever about it.
  if (u.username || u.password) return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // IPv6 first: a mapped v4 address is judged on the v4 it stands for, and an
  // IPv6 literal is judged on its own non-global ranges.
  const mapped = ipv6MappedIpv4(host);
  if (mapped) {
    if (isBlockedIpv4(mapped)) return false;
  } else if (host.includes(':')) {
    if (isBlockedIpv6(host)) return false;
  } else if (isBlockedIpv4(host)) {
    return false;
  }

  // mDNS and other names that resolve inside the user's own network.
  if (host === 'localhost') return false;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) {
    return false;
  }

  return !hostMatchesBlocklist(host);
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
        // The redirect target comes from the page's own DOM, which the app does
        // not control. It used to be followed on a bare `^https?://` test, so
        // the only URL that was ever validated was the one we started from.
        if (offsite && isSafeUrl(offsite)) {
          result.redirectedFrom = job.applyUrl;
          await page.goto(offsite, { waitUntil: 'domcontentloaded', timeout });
          await page.waitForTimeout(3000);
        } else if (offsite) {
          result.needsHuman.push({
            field: 'offsite apply link',
            reason: 'the redirect target was refused by the URL guard',
          });
        }
      }

      // Re-check after any redirect: the page we actually landed on is the one
      // the form gets filled on, and it is not necessarily the URL we approved.
      if (!isSafeUrl(page.url())) {
        result.error = 'Refused: the page redirected to an unsafe URL';
        result.status = 'refused';
        return result;
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
// Exported so the URL guard can be tested without launching a browser.
module.exports.isSafeUrl = isSafeUrl;
