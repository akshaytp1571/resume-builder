# Job Discovery Agent Harness

Browser-automation agents that search LinkedIn, Naukri and Indeed for openings,
feed them into the resume builder's existing ATS matcher, and (later) prepare
them for auto-application.

## Quick start

```bash
npm install                 # already run: express, cors, playwright added
npx playwright install chromium

# terminal 1 - the scraping backend
npm run jobs:api             # http://localhost:3457

# terminal 2 - the app
npm run dev                  # http://localhost:5173
```

Then in the app: **JOB_MATCH** -> **Auto-Discover** -> set filters ->
**Search Job Postings** -> click a result to load it into the ATS analyzer.

## Architecture

```
Browser (React)
  JobMatchModal  --POST /api/discover-jobs-->  Job Discovery API (Express, :3457)
                                                      |
                                              BrowserJobScraper
                                                      |
                    +----------------+----------------+----------------+
                    |                |                |                |
               linkedin.cjs    naukari.cjs     indeed.cjs       (sequential)
                    |                |                |
               Chrome instance   Chrome instance  Chrome instance
               (own context)     (own context)    (own context)
```

Each site runs in its **own browser context** so cookie jars never leak
between sites. The engine runs the sites **sequentially** with one retry each:
running three Chrome instances concurrently caused navigation races
("Execution context was destroyed") on LinkedIn.

## Files

| Path | Role |
|---|---|
| `src/agents/api-server.cjs` | Express API. `GET /health`, `POST /api/discover-jobs`. 180s hard cap. |
| `src/agents/browser-scrapers/scraper-engine.cjs` | Launches Chrome, creates per-site contexts, retries, aggregates. |
| `src/agents/browser-scrapers/scrapers/linkedin-scraper.cjs` | LinkedIn public job search. |
| `src/agents/browser-scrapers/scrapers/naukari-scraper.cjs` | Naukri job list. |
| `src/agents/browser-scrapers/scrapers/indeed-scraper.cjs` | Indeed, with regional host fallback. |
| `src/utils/jobDiscoveryService.js` | `discoverJobs()` - calls the API, falls back to AI search. |
| `src/components/ui/JobMatchModal.jsx` | Auto-Discover UI: filter form, result list, click-to-load, Apply button. |
| `src/agents/apply-agent/apply-agent.cjs` | Apply agent: opens the form, fills it, attaches the resume. |
| `src/agents/apply-agent/form-filler.js` | Generic field matcher for Greenhouse / Lever / Workday / Ashby / etc. |
| `src/agents/apply-agent/profile.js` | Builds the fillable profile from the resume builder's resumeData. |
| `src/utils/applyService.js` | Browser-side client for `POST /api/apply` + AI cover-letter generation. |
| `src/components/ui/ApplyModal.jsx` | Apply UI: review, generate cover letter, prepare, submit. |
| `src/utils/jobCredentials.js` | localStorage store for job board logins. |
| `src/components/ui/JobCredentialsModal.jsx` | Login form + resume file path. |
| `src/utils/resumePath.js` | Stores the absolute path to the DOCX the apply agent uploads. |
| `test-engine.cjs` | Standalone scraper test. `node test-engine.cjs linkedin,naukari,indeed` |

All backend files use the `.cjs` extension because `package.json` sets
`"type": "module"`.

## Site-specific notes (verified against the live sites, Oct 2026)

### LinkedIn - works
- Public job search, no login needed for a first pass.
- Cards: `.jobs-search__results-list li`; title `.base-search-card__title`;
  company `.base-search-card__subtitle`; location `.job-search-card__location`;
  link `a.base-card__full-link`; logo `img.artdeco-entity-image`.
- Descriptions come from the individual job page
  (`.description__text` / `#job-details` / `.show-more-less-html__markup`),
  hard-capped at 12s each for the first 8 jobs.

### Naukri - works
- **Akamai bot protection** 403s the bundled Chromium. The engine launches the
  real installed Chrome via `channel: 'chrome'`; bundled Chromium is only a fallback.
- Requires **homepage priming** first (direct deep links 403).
- The results feed renders lazily and lands on an empty shell about half the
  time, so the scraper **polls** for `.cust-job-tuple` and nudges the page to
  hydrate it.
- Card fields: title `a.title`, company `.comp-name`, experience `.exp`,
  salary / location also packed into `.job-details` (one per line),
  location `.loc`, teaser `.job-desc`, tags `.row5`, posted `.row6`.

### Indeed - works via regional fallback
- **Cloudflare** blocks `www.indeed.com` from datacenter IPs ("Request Blocked").
- The scraper walks a host list - `ae` -> `www` -> `uk` -> `in` - and uses
  whichever returns cards. On this machine `in.indeed.com` works.
- Cards: `.cardOutline`; title `.jobTitle` / `a.jcs-JobTitle`; company and
  location share `.company_location` (company on line 1, location on line 2);
  link `a.jcs-JobTitle` (an `/rc/clk` redirect to the `/viewjob` page).
- Results are lazy-loaded, so the page must be **scrolled** before the cards exist.

## Credentials

Public listings work without a login. To get personalised / filtered results,
pass credentials to the API:

```json
{
  "jobTitle": "QA Lead",
  "location": "Bengaluru",
  "experienceLevel": "Mid-Senior",
  "credentials": {
    "linkedin": { "username": "...", "password": "..." },
    "naukari":  { "username": "...", "password": "..." }
  }
}
```

LinkedIn and Naukri log in before scraping; Indeed scrapes publicly.

> Credentials travel from the browser to the local API in the request body and
> are used only for that run - nothing is persisted. Do not commit them.

## The Apply Agent

`POST /api/apply` prepares an application for one job.

```json
{
  "job": { "title": "...", "company": "...", "applyUrl": "https://..." },
  "resumeData": { "...": "the resume builder's resumeData" },
  "resumePath": "C:\\Users\\aksha\\Downloads\\Resume.docx",
  "dryRun": false,
  "submit": false,
  "confirmSubmit": false
}
```

The response reports `ats`, `filled[]`, `skipped[]`, `needsHuman[]`, `uploads[]`,
`submitted` and a screenshot path.

### What it does
1. Opens the application URL.
2. If the page has no form (LinkedIn / Indeed job boards), follows the
   offsite link to the employer's ATS.
3. Detects the ATS: Greenhouse, Lever, Workday, Ashby, SmartRecruiters, Taleo,
   iCIMS, SuccessFactors, BambooHR, JazzHR, Personio, or generic.
4. Walks every visible input / textarea / select, matches it against the
   candidate profile by label, name, id and placeholder, and fills it.
5. Uploads the resume to any file input it recognises.
6. Screenshots the result and reports what is left.

### Safety model
- **It never submits on its own.** `submit` and `confirmSubmit` must both be
  true, and the UI makes you press Submit twice. Verified: `submit: true,
  confirmSubmit: false` returns `submitted: false`.
- **Protected-characteristic fields are never answered** - gender, ethnicity,
  veteran status, disability, religion, pronouns and similar are skipped
  even when the label looks fillable.
- **CAPTCHAs and honeypots are reported, never solved.** They land in
  `needsHuman`.
- **Employer-specific custom questions** (Greenhouse's `question_*` ids) are
  only filled when the label genuinely matches a profile field; the rest go to
  `needsHuman`.
- **Payment and identity-verification URLs are refused** outright.

### Verified against a live form
Figma's public Greenhouse board (25 fields, 1 file input, 1 reCAPTCHA):

```
status: filled | ats: greenhouse | submitted: false
filled: 10   first_name, last_name, email, country, phone,
              candidate-location, linkedin, cover-letter, +2
uploads: 1   resume attached
needsHuman: 7  (employer custom questions + reCAPTCHA)
submitted: false
```

### Resume file
The browser cannot pass a `File` object's real path to a server, so the user
pastes the absolute path to the exported DOCX into **Job Board Logins ->
Resume file for applications**. It is stored in `localStorage` under
`nexus_resume_path_v1`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Request Blocked` from Indeed | Cloudflare, datacenter IP | The host fallback should route to `in.indeed.com`; if all fail, run from a residential IP. |
| `Access Denied` from Naukri | Akamai | Make sure the **real Chrome** is installed - the engine uses `channel: 'chrome'`. |
| API returns 500 "timed out" | A wedged browser | The 180s cap already returns; kill stray Chrome with `taskkill /IM chrome.exe /F`. |
| Port 3457 in use | A stale server | `taskkill /PID <pid> /F` (find it with `netstat -ano \| grep 3457`). |
| `stdin is not a tty` | Node from the Hermes tools dir in a background shell | Call the absolute `node.exe` path instead of `node`. |
