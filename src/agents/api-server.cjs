/**
 * Job Discovery API Server
 * 
 * Backend service that runs Playwright for browser automation job scraping.
 * This should be run separately: `node src/agents/api-server.js`
 * 
 * Frontend calls `/api/discover-jobs` which triggers browser automation
 * to scrape LinkedIn, Naukri, and Indeed.
 */

const express = require('express');
const cors = require('cors');
const BrowserJobScraper = require('./browser-scrapers/scraper-engine.cjs');
const ApplyAgent = require('./apply-agent/apply-agent.cjs');

const app = express();
const PORT = process.env.JOB_DISCOVERY_PORT || 3457;

// Restrict CORS to the app's own origins. A bare cors() reflects any Origin,
// so any page the user happens to have open could drive this API. The Vite dev
// server and the built app are the only legitimate callers.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
app.use(
  cors({
    origin(origin, cb) {
      // No Origin header: a same-origin fetch or a non-browser client (curl,
      // the scraper tests). Those are not the threat this guards against.
      if (!origin) return cb(null, true);
      cb(null, ALLOWED_ORIGINS.includes(origin));
    },
  })
);
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Job Discovery API' });
});

/**
 * Discover jobs from multiple job boards using browser automation
 * 
 * Expected request body:
 * {
 *   "jobTitle": "QA Lead",
 *   "location": "India",
 *   "experienceLevel": "Mid-Senior",
 *   "credentials": {
 *     "linkedin": { "username": "...", "password": "..." },
 *     "naukari": { "username": "...", "password": "..." }
 *   },
 *   "maxPages": 2
 * }
 */
app.post('/api/discover-jobs', async (req, res) => {
  const {
    jobTitle = 'QA Lead',
    location = 'India',
    experienceLevel = 'Mid-Senior',
    credentials = {},
    maxPages = 2
  } = req.body;

  const scraper = new BrowserJobScraper();

  try {
    const searchParams = {
      jobTitle,
      location,
      experienceLevel,
      pageCount: maxPages,
    };

    // Scrape all sites using the scraper engine.
    // Hard-capped so a wedged browser can never hang the HTTP request.
    const results = await Promise.race([
      scraper.scrapeAllSites(searchParams, credentials),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Scrape timed out after 180s')), 180000)
      ),
    ]);
    
    // Aggregate all jobs
    let allJobs = [];
    Object.values(results).forEach(result => {
      if (result.success) {
        allJobs = [...allJobs, ...result.jobs];
      }
    });
    
    // Deduplicate
    allJobs = deduplicateJobs(allJobs);
    
    res.json({
      success: true,
      jobs: allJobs,
      totalFound: allJobs.length,
      siteResults: results,
      searchParams: { jobTitle, location, experienceLevel }
    });

  } catch (error) {
    console.error('Job discovery server error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Job discovery failed',
      jobs: []
    });
  } finally {
    await scraper.closeBrowser();
  }
});

function deduplicateJobs(jobs) {
  const seen = new Set();
  const list = Array.isArray(jobs) ? jobs : [];
  return list.filter((job) => {
    if (!job) return false;
    const title = String(job.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const company = String(job.company || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const key = `${title}::${company}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Prepare an application for a job.
 *
 * The agent fills the form and attaches the resume but does NOT submit
 * unless both `submit` and `confirmSubmit` are true.
 */
app.post('/api/apply', async (req, res) => {
  const {
    job = {},
    resumeData = {},
    resumePath = '',
    coverLetter = '',
    dryRun = true,
    submit = false,
    confirmSubmit = false,
    profileOverrides = {},
  } = req.body;

  if (!job.applyUrl) {
    return res.status(400).json({
      status: 'failed',
      error: 'job.applyUrl is required',
    });
  }

  const agent = new ApplyAgent();
  try {
    const result = await agent.prepare(job, resumeData, {
      resumePath,
      coverLetter,
      dryRun,
      submit,
      confirmSubmit,
      profileOverrides,
    });
    res.json(result);
  } catch (error) {
    console.error('Apply agent error:', error);
    res.status(500).json({
      status: 'failed',
      error: error.message || 'Apply agent failed',
    });
  } finally {
    await agent.closeBrowser();
  }
});

// Start server.
//
// Bind to loopback ONLY. With no host argument Node listens on :: (all
// interfaces), which makes this unauthenticated API reachable from any device
// on the same network — including /api/apply, which drives the user's own
// browser automation and posts their resume to an arbitrary URL. There is no
// auth on any route, so the bind address is the only access control.
// Verified: app.listen(PORT) reports {"address":"::"}; with '127.0.0.1' it
// reports 127.0.0.1 and a LAN client is refused.
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`Job Discovery API running on http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Job Discovery API shutting down...');
  process.exit(0);
});

module.exports = { app, deduplicateJobs };
