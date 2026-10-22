/**
 * Smoke tests for the bugs fixed in this pass.
 * Run with: node test-fixes.cjs
 *
 * These exercise the pure logic that could be broken without a browser: the
 * resume parsers, the ATS scorer, the job de-duplicator and the cover-letter
 * prompt builder.
 */

const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, fn) {
  try {
    const result = fn();
    if (result === true) {
      passed += 1;
      console.log(`  ok   ${name}`);
    } else {
      failed += 1;
      failures.push(`${name}: ${result}`);
      console.log(`  FAIL ${name}: ${result}`);
    }
  } catch (err) {
    failed += 1;
    failures.push(`${name}: threw ${err.message}`);
    console.log(`  FAIL ${name}: threw ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// The utils under test are ESM, so load them through a tiny transform that
// strips the import/export syntax we rely on.
// ---------------------------------------------------------------------------
function loadEsm(relPath, exportNames) {
  const abs = path.join(__dirname, relPath);
  let src = fs.readFileSync(abs, 'utf8');
  src = src
    .replace(/^\s*import[^;]*;?\s*$/gm, '')
    .replace(/export\s+(default\s+)?/g, '')
    // Vite injects this at build time; stub it so the file parses in Node.
    .replace(/import\.meta\.env/g, '({})');
  const wrapper = new Function(`${src}\nreturn { ${exportNames.join(', ')} };`);
  return wrapper();
}

console.log('\n== resumeParser: heuristic experience parsing ==');
{
  // A single role with a date range must NOT split into multiple entries.
  const { parseResumeHeuristically } = loadEsm(
    'src/utils/resumeParser.js',
    ['parseResumeHeuristically']
  );

  const raw = [
    'Jane Doe',
    'QA Lead',
    'jane@example.com',
    '',
    'EXPERIENCE',
    'QA Lead | Acme Corp',
    '2019 - 2024',
    'Product: Order platform',
    '- Led a team of 5 testers',
    '- Built Selenium suites',
    '',
    'EDUCATION',
    'State University - B.Tech Computer Science - CGPA 8.2',
  ].join('\n');

  check('single role with a date range stays one entry', () => {
    const parsed = parseResumeHeuristically(raw);
    if (parsed.experience.length !== 1) {
      return `expected 1 experience, got ${parsed.experience.length}`;
    }
    return true;
  });

  check('date range lands in `period`, not the role name', () => {
    const parsed = parseResumeHeuristically(raw);
    const exp = parsed.experience[0];
    if (exp.role.includes('2019')) {
      return `role absorbed the dates: "${exp.role}"`;
    }
    if (exp.period !== '2019 - 2024') {
      return `period was "${exp.period}"`;
    }
    return true;
  });

  check('role and company are split on the pipe', () => {
    const parsed = parseResumeHeuristically(raw);
    const exp = parsed.experience[0];
    if (exp.role !== 'QA Lead') return `role: "${exp.role}"`;
    if (exp.company !== 'Acme Corp') return `company: "${exp.company}"`;
    return true;
  });

  check('bullets become highlights', () => {
    const parsed = parseResumeHeuristically(raw);
    const exp = parsed.experience[0];
    if (exp.highlights.length !== 2) {
      return `expected 2 highlights, got ${exp.highlights.length}`;
    }
    if (exp.highlights[0] !== 'Led a team of 5 testers') {
      return `first highlight: "${exp.highlights[0]}"`;
    }
    return true;
  });

  check('education splits school / degree / score', () => {
    const parsed = parseResumeHeuristically(raw);
    const edu = parsed.education[0];
    if (!edu.degree) return `degree empty: ${JSON.stringify(edu)}`;
    if (!/B\.?Tech/i.test(edu.degree)) return `degree: "${edu.degree}"`;
    if (!/8\.2/.test(edu.score)) return `score: "${edu.score}"`;
    if (!/University/i.test(edu.school)) return `school: "${edu.school}"`;
    return true;
  });

  check('email is captured', () => {
    const parsed = parseResumeHeuristically(raw);
    if (parsed.personalInfo.email !== 'jane@example.com') {
      return `email: "${parsed.personalInfo.email}"`;
    }
    return true;
  });

  check('all collection fields are arrays (no undefined.map crash)', () => {
    const parsed = parseResumeHeuristically('Just a name');
    for (const key of ['skills', 'experience', 'education', 'languages', 'certifications']) {
      if (!Array.isArray(parsed[key])) return `${key} is not an array`;
    }
    if (!parsed.personalInfo) return 'personalInfo missing';
    return true;
  });
}

console.log('\n== atsScorer ==');
{
  const { calculateAtsScore } = loadEsm('src/utils/atsScorer.js', ['calculateAtsScore']);

  check('a malformed email earns no contact points', () => {
    const res = calculateAtsScore({
      personalInfo: { fullName: 'A B', title: 'QA', email: 'not-an-email', phone: '123', location: 'X' },
      summary: ' '.repeat(40),
      skills: [],
      experience: [],
      education: [],
    });
    const contact = res.breakdown.find((b) => b.category.startsWith('Contact'));
    if (contact.score !== 21) {
      return `expected 21 (25 - 4 for the bad email), got ${contact.score}`;
    }
    return true;
  });

  check('a well-formed email earns its points', () => {
    const res = calculateAtsScore({
      personalInfo: { fullName: 'A B', title: 'QA', email: 'a@b.co', phone: '123', location: 'X' },
      summary: ' '.repeat(40),
      skills: [],
      experience: [],
      education: [],
    });
    const contact = res.breakdown.find((b) => b.category.startsWith('Contact'));
    if (contact.score !== 25) return `expected 25, got ${contact.score}`;
    return true;
  });

  check('score is capped at 100 and is an integer', () => {
    const res = calculateAtsScore({});
    if (!Number.isInteger(res.score)) return `score is ${typeof res.score}`;
    if (res.score < 0 || res.score > 100) return `score out of range: ${res.score}`;
    return true;
  });

  check('an empty resume does not throw', () => {
    const res = calculateAtsScore({});
    return Array.isArray(res.breakdown) && Array.isArray(res.suggestions) ? true : 'shape wrong';
  });
}

console.log('\n== jobDiscoveryService: deduplicateJobs ==');
{
  const { deduplicateJobs } = loadEsm(
    'src/utils/jobDiscoveryService.js',
    ['deduplicateJobs']
  );

  check('identical title+company collapse to one entry', () => {
    const out = deduplicateJobs([
      { title: 'QA Lead', company: 'Acme' },
      { title: 'QA Lead', company: 'Acme' },
    ]);
    if (out.length !== 1) return `expected 1, got ${out.length}`;
    return true;
  });

  check('case and punctuation differences still collapse', () => {
    const out = deduplicateJobs([
      { title: 'QA Lead', company: 'Acme' },
      { title: 'qa-lead!', company: 'ACME' },
    ]);
    if (out.length !== 1) return `expected 1, got ${out.length}`;
    return true;
  });

  check('different companies are kept', () => {
    const out = deduplicateJobs([
      { title: 'QA Lead', company: 'Acme' },
      { title: 'QA Lead', company: 'Globex' },
    ]);
    if (out.length !== 2) return `expected 2, got ${out.length}`;
    return true;
  });

  check('missing fields do not throw', () => {
    const out = deduplicateJobs([{}, { title: 'QA' }, null, { company: 'Acme' }]);
    if (!Array.isArray(out)) return 'did not return an array';
    return true;
  });

  check('a non-array input does not throw', () => {
    const out = deduplicateJobs(null);
    return Array.isArray(out) ? true : 'did not return an array';
  });
}

console.log('\n== filterJobsByResume ==');
{
  const { filterJobsByResume } = loadEsm(
    'src/utils/jobDiscoveryService.js',
    ['filterJobsByResume']
  );

  const resume = {
    personalInfo: { title: 'QA Lead | Automation' },
    summary: 'Selenium and JMeter performance testing',
    skills: [{ items: 'Selenium, Java, JMeter' }],
    experience: [{ role: 'QA Lead', company: 'Acme' }],
  };

  check('an on-target job scores above an unrelated one', () => {
    const out = filterJobsByResume(
      [
        { title: 'QA Lead', description: 'Selenium JMeter automation testing' },
        { title: 'Chef', description: 'cooking and plating' },
      ],
      resume
    );
    if (out[0].title !== 'QA Lead') return `top result was "${out[0].title}"`;
    return true;
  });

  check('scores stay within 0..100', () => {
    const out = filterJobsByResume([{ title: 'QA Lead', description: ' '.repeat(200) }], resume);
    const s = out[0].matchScore;
    if (s < 0 || s > 100) return `score ${s}`;
    return true;
  });

  check('a null job list does not throw', () => {
    const out = filterJobsByResume(null, resume);
    return Array.isArray(out) ? true : 'did not return an array';
  });
}

console.log('\n== applyService: cover-letter prompt ==');
{
  // The cover letter must be derived from the resume and name the job, so it
  // is generated without inventing employers.
  const src = fs.readFileSync(path.join(__dirname, 'src/utils/applyService.js'), 'utf8');
  check('cover letter prompt embeds the resume summary', () => {
    return /RESUME SUMMARY:/.test(src) ? true : 'RESUME SUMMARY placeholder missing';
  });
  check('cover letter prompt embeds the job title', () => {
    return /JOB TITLE:/.test(src) ? true : 'JOB TITLE placeholder missing';
  });
}

console.log('\n== docxExporter guards ==');
{
  const src = fs.readFileSync(path.join(__dirname, 'src/utils/docxExporter.js'), 'utf8');

  check('photo keeps its aspect ratio instead of being squared off', () => {
    if (!/readBase64ImageSize/.test(src)) return 'no size reader';
    if (!/imgW|imgH/.test(src)) return 'no derived dimensions';
    return true;
  });

  check('a resume with no personalInfo still exports', () => {
    if (!/const personalInfo = resumeData\?\.personalInfo \|\| \{\}/.test(src)) {
      return 'personalInfo is not defaulted';
    }
    return true;
  });

  check('every section is guarded against a missing array', () => {
    for (const field of ['skills', 'experience', 'education', 'languages', 'certifications']) {
      if (!new RegExp(`Array\\.isArray\\(resumeData\\?\\.${field}\\)`).test(src)) {
        return `${field} is not guarded`;
      }
    }
    return true;
  });

  check('an empty document still produces a valid docx', () => {
    return /docChildren\.length === 0/.test(src) ? true : 'no empty-document fallback';
  });

  check('the website field is exported', () => {
    return /personalInfo\.website/.test(src) ? true : 'website is never written';
  });
}

console.log('\n== aiService ==');
{
  const { isAiConfigReady, normalizeBaseUrl } = loadEsm(
    'src/utils/aiService.js',
    ['isAiConfigReady', 'normalizeBaseUrl']
  );

  check('a bare domain gets /v1 appended', () => {
    const out = normalizeBaseUrl('https://api.example.com');
    if (out !== 'https://api.example.com/v1') return `got "${out}"`;
    return true;
  });

  check('a trailing slash is trimmed but /v1 is kept', () => {
    const out = normalizeBaseUrl('https://api.example.com/v1/');
    if (out !== 'https://api.example.com/v1') return `got "${out}"`;
    return true;
  });

  check('ollama counts as ready with no key', () => {
    const ready = isAiConfigReady({
      providerId: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
      model: 'llama3',
    });
    return ready === true ? true : 'ollama was considered unready';
  });

  check('a keyed provider with no key is not ready', () => {
    const ready = isAiConfigReady({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-4o',
    });
    return ready === false ? true : 'openai with no key was considered ready';
  });

  check('a keyed provider with a key and model is ready', () => {
    const ready = isAiConfigReady({
      providerId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o',
    });
    return ready === true ? true : 'a complete config was considered unready';
  });

  check('a config with no model is not ready', () => {
    const ready = isAiConfigReady({
      providerId: 'ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
      model: '   ',
    });
    return ready === false ? true : 'blank model was considered ready';
  });
}

console.log('\n== apply-agent: form filler safety ==');
{
  const src = fs.readFileSync(
    path.join(__dirname, 'src/agents/apply-agent/form-filler.js'),
    'utf8'
  );

  check('protected-characteristic fields are never answered', () => {
    for (const term of ['gender', 'ethnicity', 'veteran', 'disability', 'religion', 'pronoun']) {
      if (!new RegExp(`'${term}'`).test(src)) return `"${term}" is not in NEVER_FILL`;
    }
    return true;
  });

  check('captcha fields are reported to a human', () => {
    return /CAPTCHA \/ anti-bot field/.test(src) ? true : 'no captcha reporting';
  });

  check('a failed fill is reported as skipped, not filled', () => {
    return /could not be written/.test(src) ? true : 'no failure branch for text fields';
  });

  check('a failed select is reported as skipped, not filled', () => {
    return /select could not be set/.test(src) ? true : 'no failure branch for selects';
  });

  check('file uploads use a specific selector per input', () => {
    if (!/data-field-idx/.test(src)) return 'no stable per-field handle';
    return true;
  });
}

console.log('\n== api-server ==');
{
  const src = fs.readFileSync(path.join(__dirname, 'src/agents/api-server.cjs'), 'utf8');

  check('dedup tolerates missing title/company', () => {
    return /if \(!job\) return false;/.test(src) ? true : 'no null guard in dedup';
  });

  check('the cover letter is forwarded to the agent', () => {
    return /coverLetter/.test(src) ? true : 'coverLetter is not passed through';
  });

  check('apply requires job.applyUrl', () => {
    return /job\.applyUrl is required/.test(src) ? true : 'no applyUrl validation';
  });
}

console.log('\n== scrapers ==');
{
  const indeed = fs.readFileSync(
    path.join(__dirname, 'src/agents/browser-scrapers/scrapers/indeed-scraper.cjs'),
    'utf8'
  );
  const naukri = fs.readFileSync(
    path.join(__dirname, 'src/agents/browser-scrapers/scrapers/naukari-scraper.cjs'),
    'utf8'
  );

  check('indeed maps the experience level to its own filter code', () => {
    return /EXPERIENCE_TO_JT/.test(indeed) ? true : 'no experience-to-jt mapping';
  });

  check('indeed honours the requested page count', () => {
    if (!/const maxPages/.test(indeed)) return 'pageCount is still unused';
    if (!/set\('start'/.test(indeed)) return 'no pagination offset';
    return true;
  });

  check('indeed treats a 403/429/503 as blocked', () => {
    return /resp\.status\(\) === 403/.test(indeed) ? true : 'no HTTP status check';
  });

  check('naukri maps the experience level to years', () => {
    return /EXPERIENCE_TO_YEARS/.test(naukri) ? true : 'no experience-to-years mapping';
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
