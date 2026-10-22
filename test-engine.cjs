const S = require('./src/agents/browser-scrapers/scraper-engine.cjs');

(async () => {
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  const s = new S();
  const res = await s.scrapeAllSites(
    {
      jobTitle: process.argv[3] || 'QA Lead',
      location: process.argv[4] || 'Bengaluru',
      experienceLevel: 'Mid-Senior',
      pageCount: 1,
    },
    {},
    only
  );
  console.log('--- SUMMARY ---');
  for (const [k, v] of Object.entries(res)) {
    console.log(k, v.success ? v.jobs.length + ' jobs' : 'FAIL ' + v.error);
  }
  const all = Object.values(res).flatMap((r) => r.jobs);
  console.log('TOTAL:', all.length);
  if (all[0]) console.log('SAMPLE:', JSON.stringify(all[0], null, 1).slice(0, 900));
  process.exit(0);
})();
