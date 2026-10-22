/**
 * LinkedIn Jobs Scraper
 *
 * Selectors verified against the live public job search DOM (2026-10).
 */

const LIST_SELECTORS = [
  '.jobs-search__results-list li',
  'li.scaffold-layout__list-item',
  '[data-tracking-control-name="public_jobs_jserp-result_search-card"]',
];

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
    console.warn('[linkedin] No credentials supplied, scraping public listings only');
    return;
  }

  const page = await context.newPage();
  try {
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.fill('#username', credentials.username);
    await page.fill('#password', credentials.password);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {}),
    ]);
    await page.waitForTimeout(2000);
    console.log('[linkedin] Authentication attempted');
  } catch (error) {
    console.error('[linkedin] Authentication failed:', error.message);
  } finally {
    await page.close();
  }
}

async function scrape(context, searchParams) {
  const {
    jobTitle = 'QA Lead',
    location = 'India',
    experienceLevel = 'Mid-Senior',
    pageCount = 1,
    postedWithin = 0, // days; 0 = any
  } = searchParams;

  const page = await context.newPage();
  const jobs = [];

  const params = new URLSearchParams({
    keywords: jobTitle,
    location,
    f_E: String(experienceLevelMap(experienceLevel)),
  });
  if (postedWithin > 0) {
    params.set('f_TPR', `r${postedWithin * 86400}`);
  }

  const baseUrl = `https://www.linkedin.com/jobs/search/?${params.toString()}`;

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // LinkedIn occasionally triggers a client-side redirect right after load;
    // wait for it to settle before querying the DOM.
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      let cards = [];
      for (const sel of LIST_SELECTORS) {
        try {
          cards = await page.$$(sel);
        } catch (err) {
          // "Execution context was destroyed" = a navigation raced the query.
          await page.waitForTimeout(2500);
          cards = [];
        }
        if (cards.length > 0) break;
      }

      if (cards.length === 0) {
        console.warn('[linkedin] No result cards found');
        break;
      }

      console.log(`[linkedin] ${cards.length} cards on page ${pageNum}`);

      for (const card of cards) {
        try {
          const data = await card.evaluate((el) => {
            const text = (sel) => {
              const node = el.querySelector(sel);
              return node ? node.innerText.trim() : '';
            };
            const link = el.querySelector('a.base-card__full-link') || el.querySelector('a[href*="/jobs/view/"]');
            const logo = el.querySelector('img.artdeco-entity-image');

            return {
              title: text('.base-search-card__title') || text('h3'),
              company: text('.base-search-card__subtitle') || text('h4'),
              location: text('.job-search-card__location') || text('.base-search-card__location'),
              postedAt: text('.job-search-card__listdate') || text('time'),
              applyUrl: link ? link.href : '',
              logo: logo ? logo.src : '',
            };
          });

          if (!data.title) continue;

          jobs.push({
            id: `linkedin-${pageNum}-${jobs.length}`,
            title: data.title,
            company: data.company || 'Unknown Company',
            location: data.location || 'Location not specified',
            salary: 'Not listed',
            postedAt: data.postedAt,
            logo: data.logo,
            applyUrl: data.applyUrl,
            source: 'LinkedIn',
            description: '',
            discoveredAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('[linkedin] card parse error:', err.message);
        }
      }

      if (pageNum < pageCount) {
        const next = await page.$('.pagination-next-container button:not([disabled])');
        if (next) {
          await next.click();
          await page.waitForTimeout(3000);
        } else {
          break;
        }
      }
    }
  } catch (error) {
    console.error('[linkedin] scrape error:', error.message);
  } finally {
    await page.close();
  }

  // Fetch descriptions for the first N jobs. Each fetch is hard-capped so a
  // slow job page can never stall the whole scrape.
  const DESCRIPTION_LIMIT = 8;
  const descResults = await Promise.all(
    jobs.slice(0, DESCRIPTION_LIMIT).map(async (job) => {
      if (!job.applyUrl) return [job.id, ''];
      const desc = await Promise.race([
        fetchDescription(context, job.applyUrl),
        new Promise((r) => setTimeout(() => r(''), 12000)),
      ]);
      return [job.id, desc];
    })
  );
  const descMap = new Map(descResults);
  return jobs.map((j) => ({ ...j, description: descMap.get(j.id) || '' }));
}

async function fetchDescription(context, jobUrl) {
  const page = await context.newPage();
  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1200);
    const desc =
      (await page.$eval('.description__text', (el) => el.innerText.trim()).catch(() => null)) ||
      (await page.$eval('#job-details', (el) => el.innerText.trim()).catch(() => null)) ||
      (await page.$eval('.show-more-less-html__markup', (el) => el.innerText.trim()).catch(() => null));
    return desc ? desc.slice(0, 1200) : '';
  } catch (err) {
    return '';
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { authenticate, scrape };
