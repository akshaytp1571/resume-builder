/**
 * Naukri.com Jobs Scraper
 *
 * Naukri sits behind Akamai bot protection that 403s the bundled Chromium.
 * Requirements discovered by probing the live site (2026-10):
 *  - Launch the real Chrome channel (not bundled Chromium) -> pages render
 *  - Load a normal job-list URL first to establish the Akamai session
 *  - Job cards live in `.cust-job-tuple` (title in `a.title`, company in
 *    `.comp-name`, summary in `.job-desc`, experience/salary in `.row3/.row4`)
 */

const CARD_SELECTOR = '.cust-job-tuple';

/**
 * Gulf job markets index far fewer openings under a literal "QA Lead" title
 * than under the broader discipline terms (probed: qa-lead -> 1 result in
 * Dubai, quality-assurance -> 20, software-testing -> 17). When a narrow title
 * returns too few openings, fan out to the related terms.
 */
const TITLE_EXPANSIONS = {
  'qa lead': ['quality assurance', 'software testing'],
  'qa': ['quality assurance', 'software testing'],
  'test lead': ['software testing', 'quality assurance'],
  'quality assurance': ['software testing'],
  'software testing': ['quality assurance'],
  'sdet': ['software testing', 'quality assurance'],
};

function expandTitles(jobTitle) {
  const key = (jobTitle || '').trim().toLowerCase();
  return TITLE_EXPANSIONS[key] || [];
}

const MIN_USEFUL_RESULTS = 5;

/**
 * Naukri's experience filter takes a number of years, not a level label.
 * These are the values Naukri itself emits for each of its own buckets.
 */
const EXPERIENCE_TO_YEARS = {
  entry: 0,
  intern: 0,
  mid: 2,
  'mid-senior': 5,
  senior: 7,
  lead: 10,
  director: 15,
};

const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-blink-features=AutomationControlled',
];

function slug(value) {
  return encodeURIComponent(value || '').replace(/%20/g, '-');
}

function experienceLevelMap(level) {
  const maps = {
    Internship: 0,
    'Entry Level': 1,
    Entry: 1,
    'Mid Level': 2,
    Mid: 2,
    'Mid-Senior Level': 3,
    'Mid-Senior': 3,
    Senior: 4,
    Lead: 4,
    'Lead/Manager': 4,
    Director: 5,
    'Director+': 5,
    Executive: 5,
  };
  return maps[level] || 3;
}

async function authenticate(context, credentials) {
  if (!credentials?.username || !credentials?.password) {
    console.warn('[naukri] No credentials supplied, scraping public listings only');
    return;
  }

  const page = await context.newPage();
  try {
    await page.goto('https://www.naukri.com/nlogin/login', {
      waitUntil: 'domcontentloaded',
      timeout: 40000,
    });
    await page.waitForTimeout(2500);
    await page.fill('#UserName', credentials.username);
    await page.fill('#Password', credentials.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {}),
    ]);
    await page.waitForTimeout(2500);
    console.log('[naukri] Authentication attempted');
  } catch (error) {
    console.error('[naukri] Authentication failed:', error.message);
  } finally {
    await page.close();
  }
}

async function scrape(context, searchParams) {
  const {
    jobTitle = 'QA Lead',
    location = 'Bengaluru',
    experienceLevel = 'Mid-Senior',
    pageCount = 1,
  } = searchParams;

  const all = await scrapeTitle(context, jobTitle, location, pageCount, experienceLevel);

  // A narrow title can match almost nothing in a Gulf market. Fan out to the
  // related discipline terms and merge the results.
  if (all.length < MIN_USEFUL_RESULTS) {
    const alternatives = expandTitles(jobTitle);
    if (alternatives.length) {
      console.log(
        `[naukri] "${jobTitle}" returned only ${all.length}; expanding to: ${alternatives.join(', ')}`
      );
      for (const alt of alternatives) {
        const extra = await scrapeTitle(context, alt, location, pageCount, experienceLevel);
        all.push(...extra);
      }
    }
  }

  // De-duplicate by title + company.
  const seen = new Set();
  return all.filter((job) => {
    const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scrapeTitle(context, jobTitle, location, pageCount, experienceLevel) {
  const page = await context.newPage();
  const jobs = [];

  const url = `https://www.naukri.com/${slug(jobTitle)}-jobs-in-${slug(location)}`;
  // Naukri's `cpexp` filter takes a minimum number of years. Without it the
  // experience-level control in the UI did nothing.
  const cpexp = EXPERIENCE_TO_YEARS[String(experienceLevel || '').toLowerCase()];

  try {
    // Prime the Akamai session on the homepage first - direct deep links 403.
    await page.goto('https://www.naukri.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(2000);

    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const status = resp ? resp.status() : 0;
    if (status === 403) {
      console.error('[naukri] Blocked (403) - Akamai rejected the session');
      return jobs;
    }

    // Apply the experience filter through the search box, which is how Naukri
    // expects it. The URL alone does not carry the filter on this route.
    if (cpexp) {
      try {
        await page.fill('input.suggestor-input', String(cpexp));
        await page.waitForTimeout(600);
        const dropdownItem = await page.$('.suggestor-dropdown li, .suggestor-dropdown ul li');
        if (dropdownItem) {
          await dropdownItem.click();
        } else {
          await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(1200);
      } catch (err) {
        console.warn(`[naukri] experience filter not applied: ${err.message.split('\n')[0]}`);
      }
    }

    // Naukri renders job cards lazily and intermittently lands on an empty
    // results shell. Poll until the card count stops growing so we capture
    // the whole first page rather than the first card that happens to appear.
    let cards = [];
    let lastCount = -1;
    let stable = 0;
    for (let attempt = 0; attempt < 10; attempt++) {
      await page.waitForTimeout(attempt === 0 ? 3000 : 2000);
      cards = await page.$$(CARD_SELECTOR);
      const count = cards.length;
      if (count === 0) {
        // Nudge the page into hydrating its result feed.
        await page.mouse.wheel(0, 900).catch(() => {});
        continue;
      }
      if (count === lastCount) {
        stable += 1;
        if (stable >= 2) break; // count held steady for two polls
      } else {
        stable = 0;
      }
      lastCount = count;
      await page.mouse.wheel(0, 700).catch(() => {});
    }

    if (cards.length === 0) {
      console.warn('[naukri] No job cards found after retries');
      return jobs;
    }

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      if (pageNum > 1) {
        const next = await page.$(
          'a.fright.fs14.btn-secondary, .pagination-next, button[aria-label="Next"]'
        );
        if (!next) break;
        await next.click().catch(() => {});
        await page.waitForTimeout(3500);
        cards = await page.$$(CARD_SELECTOR);
        if (cards.length === 0) break;
      }

      console.log(`[naukri] ${cards.length} cards on page ${pageNum}`);

      for (const card of cards) {
        try {
          const data = await card.evaluate((el) => {
            const text = (sel) => {
              const node = el.querySelector(sel);
              return node ? node.innerText.trim() : '';
            };
            const titleLink = el.querySelector('a.title');
            const companyLink = el.querySelector('a.comp-name');

            // .job-details packs experience / salary / location on separate lines.
            const detailLines = text('.job-details')
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean);
            const exp = text('.exp') || detailLines[0] || '';
            const salary = text('.salary') || detailLines[1] || '';
            const loc = text('.loc') || detailLines[2] || '';

            // .row5 is the tag/skill strip; .job-desc is the teaser text.
            const tags = text('.row5')
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean);

            return {
              title: text('a.title') || text('.row1') || text('h2'),
              company: text('.comp-name') || text('.row2').split('\n')[0],
              experience: exp,
              salary,
              location: loc,
              description: text('.job-desc'),
              postedAt: text('.row6').split('\n')[0] || '',
              applyUrl: titleLink ? titleLink.href : '',
              companyUrl: companyLink ? companyLink.href : '',
              tags,
            };
          });

          if (!data.title) continue;

          jobs.push({
            id: `naukri-${pageNum}-${jobs.length}`,
            title: data.title,
            company: data.company || 'Unknown Company',
            location: data.location || 'Location not specified',
            salary: data.salary || 'Not disclosed',
            experience: data.experience,
            description: data.description || '',
            applyUrl: data.applyUrl,
            companyUrl: data.companyUrl,
            tags: data.tags,
            source: 'Naukri',
            discoveredAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('[naukri] card parse error:', err.message);
        }
      }
    }
  } catch (error) {
    console.error('[naukri] scrape error:', error.message);
  } finally {
    await page.close();
  }

  return jobs;
}

module.exports = { authenticate, scrape, CHROME_ARGS, experienceLevelMap };
