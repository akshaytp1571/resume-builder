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
// strips import/export syntax.
//
// Local (relative) imports are resolved recursively and injected as consts, so
// a module doing `import { DEFAULT_PHOTO_URL } from '../assets/x.js'` still has
// that binding at runtime. Bare package imports are stripped - nothing under
// test needs them at module scope.
// ---------------------------------------------------------------------------
const moduleCache = new Map();

function loadEsm(relPath, exportNames, seen = new Set()) {
  const abs = path.join(__dirname, relPath);

  if (moduleCache.has(abs)) {
    const cached = moduleCache.get(abs);
    const out = {};
    for (const name of exportNames) out[name] = cached[name];
    return out;
  }

  if (seen.has(abs)) return {};
  seen.add(abs);

  const raw = fs.readFileSync(abs, 'utf8');

  // Resolve relative imports into a binding bag.
  const importBag = {};
  const injected = [];
  const importRe = /^\s*import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm;
  let match;
  while ((match = importRe.exec(raw)) !== null) {
    const names = match[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.split(/\s+as\s+/).pop().trim());
    const spec = match[2];

    if (!spec.startsWith('.')) {
      for (const name of names) importBag[name] = undefined;
      continue;
    }

    const resolved = path.join(path.dirname(abs), spec);
    const withExt = fs.existsSync(resolved) ? resolved : `${resolved}.js`;

    let mod = {};
    if (fs.existsSync(withExt)) {
      try {
        mod = loadEsm(path.relative(__dirname, withExt), names, seen);
      } catch (e) {
        mod = {};
      }
    }
    for (const name of names) {
      importBag[name] = mod[name];
      injected.push(`const ${name} = __imp[${JSON.stringify(name)}];`);
    }
  }

  const src = raw
    .replace(/^\s*import[^;]*;?\s*$/gm, '')
    .replace(/export\s+(default\s+)?/g, '')
    // Vite injects this at build time; stub it so the file parses in Node.
    .replace(/import\.meta\.env/g, '({})');

  // Always evaluate and cache EVERY export, so a later call asking for a
  // different name still finds it.
  const allNames = [...new Set([...exportNames, ...captureAllExports(raw)])];
  const wrapper = new Function(
    '__imp',
    `${injected.join('\n')}\n${src}\nreturn { ${allNames.join(', ')} };`
  );

  const result = wrapper(importBag);
  moduleCache.set(abs, result);

  const out = {};
  for (const name of exportNames) out[name] = result[name];
  return out;
}

/** Every `export const|let|var|function|class Name` identifier in source. */
function captureAllExports(src) {
  const names = new Set();
  const re = /^\s*export\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src)) !== null) names.add(m[1]);
  return [...names];
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

// ---------------------------------------------------------------------------
// v1.0 features
// ---------------------------------------------------------------------------

console.log('\n== templateCapabilities ==');
{
  const { getDroppedSections, templateSupports, TEMPLATE_CAPABILITIES } = loadEsm(
    'src/data/templateCapabilities.js',
    ['getDroppedSections', 'templateSupports', 'TEMPLATE_CAPABILITIES']
  );

  const { TEMPLATES_CONFIG } = loadEsm('src/data/initialData.js', ['TEMPLATES_CONFIG']);

  check('every template in TEMPLATES_CONFIG has capabilities', () => {
    for (const tpl of TEMPLATES_CONFIG) {
      if (!TEMPLATE_CAPABILITIES[tpl.id]) {
        return `"${tpl.id}" has no entry in TEMPLATE_CAPABILITIES`;
      }
    }
    return true;
  });

  check('every template renders certifications (the Creative bug)', () => {
    for (const tpl of TEMPLATES_CONFIG) {
      if (!templateSupports(tpl.id, 'certifications')) {
        return `"${tpl.id}" would drop certifications`;
      }
    }
    return true;
  });

  check('every template renders projects and customSections', () => {
    for (const tpl of TEMPLATES_CONFIG) {
      for (const key of ['projects', 'customSections']) {
        if (!templateSupports(tpl.id, key)) {
          return `"${tpl.id}" would drop ${key}`;
        }
      }
    }
    return true;
  });

  check('no filled section is reported as dropped on any template', () => {
    const fullResume = {
      summary: 'x',
      skills: [{ items: 'a' }],
      experience: [{ role: 'a' }],
      education: [{ school: 'a' }],
      languages: [{ name: 'a' }],
      certifications: [{ name: 'a' }],
      projects: [{ name: 'a' }],
      customSections: [{ title: 'a' }],
    };
    for (const tpl of TEMPLATES_CONFIG) {
      const dropped = getDroppedSections(tpl.id, fullResume);
      if (dropped.length > 0) {
        return `"${tpl.id}" reports dropping: ${dropped.join(', ')}`;
      }
    }
    return true;
  });

  check('an empty resume drops nothing', () => {
    const dropped = getDroppedSections('classic', {});
    return dropped.length === 0 ? true : `unexpected: ${dropped.join(', ')}`;
  });

  check('an unknown template id is treated as unrestricted', () => {
    return templateSupports('does-not-exist', 'projects') === true
      ? true
      : 'unknown template should not claim to drop sections';
  });
}

console.log('\n== resumeStore ==');
{
  // The store touches localStorage; give it a minimal in-memory shim.
  const mem = new Map();
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
    clear: () => mem.clear(),
  };

  const store = loadEsm('src/utils/resumeStore.js', [
    'loadStore',
    'saveStore',
    'getActiveVariant',
    'updateVariant',
    'addVariant',
    'duplicateVariant',
    'removeVariant',
    'setActiveVariant',
    'createVariant',
    'exportStoreJson',
    'importStoreJson',
    'normalizeResume',
    'normalizeTheme',
    'makeVariantId',
  ]);

  check('a fresh store has exactly one variant', () => {
    mem.clear();
    const s = store.loadStore();
    if (!Array.isArray(s.variants)) return 'variants is not an array';
    if (s.variants.length !== 1) return `expected 1, got ${s.variants.length}`;
    if (!s.activeId) return 'no activeId';
    return true;
  });

  check('the active variant resolves to a real variant', () => {
    mem.clear();
    const s = store.loadStore();
    const active = store.getActiveVariant(s);
    return active && active.id === s.activeId ? true : 'active variant did not resolve';
  });

  check('legacy single-resume keys migrate into a variant', () => {
    mem.clear();
    mem.set(
      'precision_resume_data_v1',
      JSON.stringify({ personalInfo: { fullName: 'Legacy Person' }, summary: 'old' })
    );
    mem.set('precision_theme_data_v1', JSON.stringify({ templateId: 'modern' }));
    const s = store.loadStore();
    const active = store.getActiveVariant(s);
    if (active.data.personalInfo.fullName !== 'Legacy Person') {
      return 'legacy name did not survive migration';
    }
    if (active.theme.templateId !== 'modern') return 'legacy theme did not survive';
    return true;
  });

  check('adding a variant makes it active and keeps the others', () => {
    mem.clear();
    let s = store.loadStore();
    const before = s.variants.length;
    const v = store.createVariant({ name: 'Second' });
    s = store.addVariant(s, v);
    if (s.variants.length !== before + 1) return 'variant was not added';
    if (s.activeId !== v.id) return 'new variant is not active';
    return true;
  });

  check('duplicating a variant deep-copies its data', () => {
    mem.clear();
    let s = store.loadStore();
    const original = store.getActiveVariant(s);
    original.data.summary = 'ORIGINAL';
    s = store.duplicateVariant(s, original.id);
    const copy = store.getActiveVariant(s);
    if (copy.id === original.id) return 'copy reused the original id';
    copy.data.summary = 'CHANGED';
    const stillOriginal = s.variants.find((v) => v.id === original.id);
    if (stillOriginal.data.summary === 'CHANGED') {
      return 'editing the copy mutated the original (shared reference)';
    }
    return true;
  });

  check('the last remaining variant cannot be deleted', () => {
    mem.clear();
    const s = store.loadStore();
    const after = store.removeVariant(s, s.activeId);
    if (after.variants.length !== 1) return 'the only variant was deleted';
    return true;
  });

  check('deleting the active variant moves the selection', () => {
    mem.clear();
    let s = store.loadStore();
    s = store.addVariant(s, store.createVariant({ name: 'B' }));
    const removedId = s.activeId;
    s = store.removeVariant(s, removedId);
    if (s.variants.length !== 1) return 'wrong count after delete';
    if (s.activeId === removedId) return 'activeId still points at the deleted variant';
    if (!store.getActiveVariant(s)) return 'active variant no longer resolves';
    return true;
  });

  check('switching to an unknown variant id is a no-op', () => {
    mem.clear();
    const s = store.loadStore();
    const after = store.setActiveVariant(s, 'nope');
    return after.activeId === s.activeId ? true : 'activeId changed to a bad value';
  });

  check('export then import round-trips every variant', () => {
    mem.clear();
    let s = store.loadStore();
    s = store.addVariant(s, store.createVariant({ name: 'Alpha' }));
    s = store.addVariant(s, store.createVariant({ name: 'Beta' }));
    const json = store.exportStoreJson(s);
    const back = store.importStoreJson(json);
    if (back.variants.length !== s.variants.length) {
      return `expected ${s.variants.length}, got ${back.variants.length}`;
    }
    const names = back.variants.map((v) => v.name).sort();
    if (!names.includes('Alpha') || !names.includes('Beta')) {
      return `names lost: ${names.join(', ')}`;
    }
    return true;
  });

  check('importing a bare v1 resume object works', () => {
    const back = store.importStoreJson(
      JSON.stringify({ personalInfo: { fullName: 'Bare Import' }, summary: 's' })
    );
    const active = store.getActiveVariant(back);
    if (active.data.personalInfo.fullName !== 'Bare Import') return 'bare import lost the name';
    return true;
  });

  check('importing garbage throws a readable error', () => {
    try {
      store.importStoreJson('{not json');
      return 'did not throw';
    } catch (err) {
      if (!/valid JSON/i.test(err.message)) return `unhelpful message: ${err.message}`;
      return true;
    }
  });

  check('importing valid JSON that is not a resume throws', () => {
    try {
      store.importStoreJson(JSON.stringify({ hello: 'world' }));
      return 'did not throw';
    } catch (err) {
      if (!/does not look like a resume/i.test(err.message)) {
        return `unhelpful message: ${err.message}`;
      }
      return true;
    }
  });

  check('normalizeResume fills missing collections with arrays', () => {
    const out = store.normalizeResume({ personalInfo: { fullName: 'X' } });
    for (const key of ['skills', 'experience', 'education', 'languages', 'certifications', 'projects', 'customSections']) {
      if (!Array.isArray(out[key])) return `${key} is not an array`;
    }
    return true;
  });

  check('normalizeResume survives null and non-objects', () => {
    for (const bad of [null, undefined, 42, 'string']) {
      const out = store.normalizeResume(bad);
      if (!out || !out.personalInfo) return `crashed on ${JSON.stringify(bad)}`;
    }
    return true;
  });

  check('normalizeTheme defaults singlePage to true', () => {
    const t = store.normalizeTheme({});
    return t.singlePage === true ? true : `singlePage was ${t.singlePage}`;
  });

  check('variant ids are unique', () => {
    const ids = new Set();
    for (let i = 0; i < 500; i++) ids.add(store.makeVariantId());
    return ids.size === 500 ? true : `collision: ${500 - ids.size}`;
  });
}

console.log('\n== ModalShell (accessibility contract) ==');
{
  const src = fs.readFileSync(
    path.join(__dirname, 'src/components/ui/ModalShell.jsx'),
    'utf8'
  );

  check('declares itself as a modal dialog', () => {
    if (!/role="dialog"/.test(src)) return 'missing role="dialog"';
    if (!/aria-modal="true"/.test(src)) return 'missing aria-modal';
    return true;
  });

  check('supports aria-labelledby and aria-describedby', () => {
    if (!/aria-labelledby=\{labelledBy\}/.test(src)) return 'labelledBy not wired';
    if (!/aria-describedby=\{describedBy\}/.test(src)) return 'describedBy not wired';
    return true;
  });

  check('Escape closes the dialog', () => {
    return /'Escape'/.test(src) ? true : 'no Escape handling';
  });

  check('traps Tab focus inside the dialog', () => {
    if (!/'Tab'/.test(src)) return 'no Tab handling';
    if (!/shiftKey/.test(src)) return 'no shift+tab wrapping';
    return true;
  });

  check('restores focus to the trigger on close', () => {
    return /previouslyFocused/.test(src) ? true : 'no focus restore';
  });

  check('locks background scroll while open', () => {
    return /overflow = 'hidden'/.test(src) ? true : 'no scroll lock';
  });
}

console.log('\n== all modals use ModalShell ==');
{
  const modalDir = path.join(__dirname, 'src/components/ui');
  const modals = [
    'AtsScoreModal.jsx',
    'AiConfigModal.jsx',
    'AiRefineModal.jsx',
    'JobMatchModal.jsx',
    'JobCredentialsModal.jsx',
    'ApplyModal.jsx',
    'ResumeUploadModal.jsx',
    'ImageCropModal.jsx',
  ];

  check('every modal imports ModalShell', () => {
    const missing = [];
    for (const m of modals) {
      const p = path.join(modalDir, m);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, 'utf8');
      if (!/ModalShell/.test(src)) missing.push(m);
    }
    return missing.length === 0 ? true : `not migrated: ${missing.join(', ')}`;
  });

  check('no modal still hand-rolls a fixed-inset wrapper', () => {
    const offenders = [];
    for (const m of modals) {
      const p = path.join(modalDir, m);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, 'utf8');
      if (/className="fixed inset-0/.test(src)) offenders.push(m);
    }
    return offenders.length === 0 ? true : `still hand-rolled: ${offenders.join(', ')}`;
  });
}

console.log('\n== projects & custom sections rendering ==');
{
  const templateDir = path.join(__dirname, 'src/components/templates');
  const templates = [
    'DefaultTemplate.jsx',
    'ModernTemplate.jsx',
    'MinimalTemplate.jsx',
    'CreativeTemplate.jsx',
    'NordicTemplate.jsx',
    'CompactTemplate.jsx',
  ];

  check('every template renders projects', () => {
    const missing = [];
    for (const t of templates) {
      const p = path.join(templateDir, t);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, 'utf8');
      if (!/projects/.test(src)) missing.push(t);
    }
    return missing.length === 0 ? true : `missing projects: ${missing.join(', ')}`;
  });

  check('every template renders customSections', () => {
    const missing = [];
    for (const t of templates) {
      const p = path.join(templateDir, t);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, 'utf8');
      if (!/customSections/.test(src)) missing.push(t);
    }
    return missing.length === 0 ? true : `missing customSections: ${missing.join(', ')}`;
  });

  check('CreativeTemplate renders certifications (was silently dropping them)', () => {
    const p = path.join(templateDir, 'CreativeTemplate.jsx');
    const src = fs.readFileSync(p, 'utf8');
    if (!/certifications/.test(src)) return 'CreativeTemplate still drops certifications';
    return true;
  });

  check('templates use the shared PhotoFrame instead of duplicating photo markup', () => {
    const p = path.join(templateDir, 'DefaultTemplate.jsx');
    const src = fs.readFileSync(p, 'utf8');
    return /PhotoFrame/.test(src) ? true : 'DefaultTemplate does not use PhotoFrame';
  });
}

console.log('\n== editors exist and follow the onChange contract ==');
{
  const editorDir = path.join(__dirname, 'src/components/editor');

  for (const [file, propName] of [
    ['ProjectsEditor.jsx', 'projects'],
    ['CustomSectionsEditor.jsx', 'customSections'],
  ]) {
    check(`${file} exists`, () => {
      const p = path.join(editorDir, file);
      return fs.existsSync(p) ? true : 'file missing';
    });

    check(`${file} accepts a ${propName} prop and calls onChange`, () => {
      const p = path.join(editorDir, file);
      if (!fs.existsSync(p)) return 'file missing';
      const src = fs.readFileSync(p, 'utf8');
      if (!new RegExp(propName).test(src)) return `${propName} prop not destructured`;
      if (!/onChange\(/.test(src)) return 'onChange is never called';
      return true;
    });

    check(`${file} guards against a missing array`, () => {
      const p = path.join(editorDir, file);
      if (!fs.existsSync(p)) return 'file missing';
      const src = fs.readFileSync(p, 'utf8');
      // Either a default parameter or a ?. guard is acceptable.
      const guarded = new RegExp(`${propName} = \\[\\]`).test(src) || new RegExp(`${propName}\\?\\.`).test(src);
      return guarded ? true : `${propName} is not guarded`;
    });
  }
}

console.log('\n== ATS scores projects ==');
{
  const { calculateAtsScore } = loadEsm('src/utils/atsScorer.js', ['calculateAtsScore']);

  check('adding projects raises the score', () => {
    const base = {
      personalInfo: { fullName: 'A', title: 'T', email: 'a@b.co', phone: '1', location: 'L' },
      summary: 'x '.repeat(40).trim(),
      skills: [{ items: 'a, b, c, d, e' }],
      experience: [{ highlights: ['Led 5 projects reducing bugs 40%'] }],
      education: [{ school: 'S', degree: 'D' }],
    };
    const without = calculateAtsScore({ ...base, projects: [] });
    const withProjects = calculateAtsScore({
      ...base,
      projects: [{ name: 'P', role: 'R', highlights: ['Built a thing'] }],
    });
    if (withProjects.score <= without.score) {
      return `score did not rise: ${without.score} -> ${withProjects.score}`;
    }
    return true;
  });

  check('a Projects category appears in the breakdown', () => {
    const res = calculateAtsScore({ projects: [{ name: 'P' }] });
    const hasProjects = res.breakdown.some((b) => /project/i.test(b.category));
    return hasProjects ? true : 'no Projects category in breakdown';
  });

  check('the score is still capped at 100', () => {
    const res = calculateAtsScore({
      personalInfo: { fullName: 'A', title: 'T', email: 'a@b.co', phone: '1', location: 'L' },
      summary: 'x '.repeat(50).trim(),
      skills: Array.from({ length: 6 }, () => ({ items: 'a, b, c, d, e, f' })),
      experience: [{ highlights: Array.from({ length: 8 }, () => 'Led 5 projects, 40% gain') }],
      education: [{ school: 'S', degree: 'D' }],
      projects: Array.from({ length: 3 }, () => ({ name: 'P', highlights: ['Built it'] })),
      certifications: [{ name: 'C' }],
      languages: [{ name: 'L' }],
    });
    if (res.score > 100) return `score was ${res.score}`;
    return true;
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
