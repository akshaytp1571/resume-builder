/**
 * Indeed Jobs Scraper
 *
 * Indeed sits behind Cloudflare, which 403s/redirects the US and IN domains
 * from datacenter IPs. Probing the live site (2026-10) showed:
 *  - `ae.indeed.com` serves results where `www.indeed.com` is blocked
 *  - The real Chrome channel is required (bundled Chromium gets "Request Blocked")
 *  - Job cards are `.cardOutline`; title `.jobTitle`, company `.company_location`,
 *    link `a.jcs-Jumbo` (an /rc/clk redirect that lands on the /viewjob page)
 *  - Results are lazy-loaded, so the page must be scrolled
 */

const CARD_SELECTOR = '.cardOutline';

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
];

/** Regional Indeed domains, ordered by likelihood of serving results. */
const REGION_HOSTS = ['ae.indeed.com', 'www.indeed.com', 'uk.indeed.com', 'in.indeed.com'];

/** Indeed locations that map onto a Gulf country for URL building. */
const UAE_LOCATIONS = ['dubai', 'abu dhabi', 'sharjah', 'uae', 'emirates', 'doha', 'riyadh'];

/**
 * Gulf job markets index fewer openings under a literal "QA Lead" title than
 * under the broader discipline terms. When a narrow title is searched, fan
 * out to the related terms so the scraper does not return a single result.
 */
const TITLE_EXPANSIONS = {
  'qa lead': ['quality assurance', 'software testing', 'test engineer'],
  'qa': ['quality assurance', 'software testing'],
  'test lead': ['software testing', 'quality assurance'],
  'quality assurance': ['software testing', 'test engineer'],
  'software testing': ['quality assurance', 'test engineer'],
  'sdet': ['software testing', 'quality assurance'],
  'automation lead': ['test automation', 'software testing'],
};

/**
 * Indeed's job-type filter codes, used in the `sc=0kf:jt(...)` URL parameter.
 * These are the values Indeed itself emits when you pick an experience level.
 */
const EXPERIENCE_TO_JT = {
  entry: 'internship,entry_level',
  intern: 'internship',
  mid: 'associate,mid_level',
  'mid-senior': 'mid_level,senior_level',
  senior: 'senior_level',
  lead: 'senior_level,management',
  director: 'director,executive',
};

function expandTitles(jobTitle) {
  const key = (jobTitle || '').trim().toLowerCase();
  return TITLE_EXPANSIONS[key] || [];
}

/**
 * Indeed's index is country-scoped, so a Gulf search must hit the regional
 * host and use a location string the local index recognises.
 */
function isUaeLocation(location) {
  return UAE_LOCATIONS.some((t) => (location || '').toLowerCase().includes(t));
}

function hostPriorityFor(location) {
  if (isUaeLocation(location)) {
    return ['ae.indeed.com', 'www.indeed.com', 'uk.indeed.com', 'in.indeed.com'];
  }
  return REGION_HOSTS;
}

function normalizeLocation(location) {
  const loc = (location || 'Dubai').trim();
  if (/^(dubai|uae|emirates)$/i.test(loc)) return 'Dubai';
  if (/abu dhabi/i.test(loc)) return 'Abu Dhabi';
  if (/sharjah/i.test(loc)) return 'Sharjah';
  return loc;
}

function experienceLevelMap(level) {
  const maps = {
    Internship: 1,
    'Entry Level': 2,
    Entry: 2,
    'Mid Level': 3,
    Mid: 3,
    'Mid-Senior Level': 3,
    'Mid-Senior': 3,
    Senior: 4,
    Lead: 4,
    'Lead/Manager': 4,
    Director: 5,
    'Director+': 5,
    Executive: 6,
  };
  return maps[level] || 3;
}

async function authenticate(context, credentials) {
  if (!credentials?.username || !credentials?.password) {
    console.warn('[indeed] No credentials supplied, scraping public listings only');
    return;
  }

  const page = await context.newPage();
  try {
    await page.goto('https://secure.indeed.com/account/login', {
      waitUntil: 'domcontentloaded',
      timeout: 40000,
    });
    await page.waitForTimeout(2000);
    await page.fill('#ifl', credentials.username);
    await page.fill('#idf', credentials.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {}),
    ]);
    await page.waitForTimeout(2000);
    console.log('[indeed] Authentication attempted');
  } catch (error) {
    console.error('[indeed] Authentication failed:', error.message);
  } finally {
    await page.close();
  }
}

async function dismissConsent(page) {
  const btn = await page.$('#onetrust-accept-btn-handler');
  if (btn) await btn.click().catch(() => {});
  await page.waitForTimeout(1200);
}

async function scrollForResults(page, scrolls = 5) {
  for (let i = 0; i < scrolls; i++) {
    await page.mouse.wheel(0, 1600);
    await page.waitForTimeout(900);
  }
}

async function scrape(context, searchParams) {
  const {
    jobTitle = 'QA Lead',
    location = 'Dubai',
    experienceLevel = 'Mid-Senior',
    pageCount = 1,
    postedWithin = 0,
  } = searchParams;

  const page = await context.newPage();
  const jobs = [];
  const searchLocation = normalizeLocation(location);
  const hosts = hostPriorityFor(searchLocation);
  // Indeed's `sc=0kf:jt(...)` filter codes for seniority. Without this the
  // experience-level control in the UI did nothing.
  const jtCode = EXPERIENCE_TO_JT[String(experienceLevel).toLowerCase()] || '';

  try {
    let hostUsed = null;

    const maxPages = Math.max(1, Number(pageCount) || 1);

    for (const host of hosts) {
      // Walk up to `maxPages` result pages on this host before falling back
      // to the next regional domain. Indeed pages by 10s via `start`.
      for (let pageIdx = 0; pageIdx < maxPages; pageIdx++) {
        const params = new URLSearchParams({ q: jobTitle, l: searchLocation });
        if (postedWithin > 0) params.set('fromage', String(postedWithin));
        if (jtCode) params.set('sc', `0kf:jt(${jtCode});`);
        if (pageIdx > 0) params.set('start', String(pageIdx * 10));

        const url = `https://${host}/jobs?${params.toString()}`;
        let resp;
        try {
          resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        } catch (err) {
          console.warn(`[indeed] ${host} navigation failed: ${err.message.split('\n')[0]}`);
          break;
        }

        // A 403/429/503 means the host is refusing us; there is no point
        // parsing a challenge page, so move on to the next regional host.
        if (resp && (resp.status() === 403 || resp.status() === 429 || resp.status() === 503)) {
          console.warn(`[indeed] ${host} returned HTTP ${resp.status()}`);
          break;
        }

        await page.waitForTimeout(2500);
        await dismissConsent(page);
        await scrollForResults(page);

        const cards = await page.$$(CARD_SELECTOR);
        const blocked = await page.evaluate(() =>
          document.body.innerText.includes('Request Blocked')
        );

        if (blocked) {
          console.warn(`[indeed] ${host} returned "Request Blocked"`);
          break;
        }
        if (cards.length === 0) {
          console.warn(`[indeed] ${host} returned no cards`);
          break;
        }

        hostUsed = host;
        console.log(`[indeed] ${cards.length} cards from ${host} (page ${pageIdx + 1})`);

        for (const card of cards) {
          try {
            const data = await card.evaluate((el) => {
              const text = (sel) => {
                const node = el.querySelector(sel);
                return node ? node.innerText.trim() : '';
              };
              const link =
                el.querySelector('a.jcs-JobTitle') ||
                el.querySelector('a.jcs-Jumbo') ||
                el.querySelector('a[href*="/viewjob"]');
              const companyEl = el.querySelector('.company_location');

              // company_location holds "Company" then "Location" on separate lines
              const cl = companyEl ? companyEl.innerText.split('\n').map((s) => s.trim()) : [];
              const company = cl[0] || text('[data-testid="company-name"]');
              const loc = cl[1] || text('[data-testid="text-location"]');

              // Indeed's teaser text lives in a hashed container, so fall back
              // to the card's own text with the header lines stripped off.
              const cardLines = el.innerText
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
              const headerCount = cardLines.findIndex((l) => l === company);
              const fallbackSnippet =
                headerCount >= 0 ? cardLines.slice(headerCount + 2).join(' ') : '';

              return {
                title: text('.jobTitle') || text('h2.jobTitle') || text('.jcs-JobTitle'),
                company,
                location: loc,
                salary:
                  text('.salary-snippet') ||
                  text('[data-testid="attribute-value"]') ||
                  text('.estimated-salary'),
                postedAt: text('.date') || text('.date-a11y'),
                applyUrl: link ? link.href : '',
                snippet:
                  text('.job-snippet') ||
                  text('.jobDescription') ||
                  text('.job-snippet-container') ||
                  fallbackSnippet,
              };
            });

            if (!data.title) continue;

            jobs.push({
              id: `indeed-${jobs.length}`,
              title: data.title,
              company: data.company || 'Unknown Company',
              location: data.location || 'Location not specified',
              salary: data.salary || 'Not disclosed',
              postedAt: data.postedAt,
              description: data.snippet || '',
              applyUrl: data.applyUrl,
              source: 'Indeed',
              region: hostUsed,
              discoveredAt: new Date().toISOString(),
            });
          } catch (err) {
            console.warn('[indeed] card parse error:', err.message);
          }
        }

        // A short page means there is nothing more to fetch.
        if (cards.length < 10) break;
      }

      if (hostUsed) break;
    }
  } catch (error) {
    console.error('[indeed] scrape error:', error.message);
  } finally {
    await page.close();
  }

  // A narrow title can match almost nothing in a Gulf market. Fan out to the
  // related discipline terms and merge the results. `_expanded` stops the
  // fan-out from recursing into itself.
  if (jobs.length < 5 && !searchParams._expanded) {
    const alternatives = expandTitles(jobTitle);
    if (alternatives.length) {
      console.log(
        `[indeed] "${jobTitle}" returned only ${jobs.length}; expanding to: ${alternatives.join(', ')}`
      );
      for (const alt of alternatives) {
        const extra = await scrape(context, {
          ...searchParams,
          jobTitle: alt,
          _expanded: true,
        });
        jobs.push(...extra);
      }
    }
  }

  const seen = new Set();
  return jobs.filter((job) => {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { authenticate, scrape, CHROME_ARGS, experienceLevelMap };
