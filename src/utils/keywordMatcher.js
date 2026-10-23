/**
 * Local ATS keyword matcher — compares a resume against a pasted job
 * description with no AI call, no network, no browser APIs.
 *
 * Pure module: it has no dependencies at all, so it runs unchanged in Node
 * (test-fixes.cjs / smoke-test.mjs) and in the Vite bundle.
 *
 * ponytail: English + ASCII only. A non-Latin JD tokenises to nothing and the
 * caller gets a zeroed result with `error` set. Upgrade: replace flatten()
 * with a Unicode tokenizer when non-English resumes matter.
 */

// --- vocabulary -------------------------------------------------------------

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'also', 'am', 'an',
  'and', 'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does',
  'doing', 'done', 'down', 'during', 'each', 'either', 'else', 'etc', 'even',
  'ever', 'every', 'few', 'for', 'from', 'further', 'get', 'gets', 'got',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his',
  'how', 'however', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'like', 'make', 'makes', 'many', 'may', 'me', 'might', 'more',
  'most', 'much', 'must', 'my', 'need', 'needs', 'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'one', 'only', 'onto', 'or', 'other', 'others',
  'our', 'ours', 'out', 'over', 'own', 'per', 'plus', 'same', 'shall', 'she',
  'should', 'since', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'then', 'there', 'these', 'they', 'this', 'those',
  'though', 'through', 'to', 'too', 'under', 'until', 'up', 'upon', 'us',
  'use', 'used', 'uses', 'using', 'very', 'via', 'was', 'we', 'were', 'what',
  'when', 'where', 'whether', 'which', 'while', 'who', 'whom', 'why', 'will',
  'with', 'within', 'without', 'would', 'you', 'your', 'yours',
  // Hiring-doc noise: true of every posting, so it never discriminates.
  'ability', 'able', 'across', 'applicant', 'applicants', 'application',
  'apply', 'applying', 'candidate', 'candidates', 'company', 'description',
  'excellent', 'experience', 'experienced', 'familiar', 'familiarity', 'good',
  'great', 'hand', 'hands', 'include', 'includes', 'including', 'job', 'join',
  'knowledge', 'looking', 'opportunity', 'position', 'preferred', 'proven',
  'qualification', 'qualifications', 'requirement', 'requirements', 'required',
  'responsibilities', 'responsibility', 'role', 'skill', 'skills', 'solid',
  'strong', 'team', 'teams', 'understanding', 'work', 'working', 'works',
  'year', 'years',
  // Contraction fragments: the tokenizer folds apostrophes to spaces, so
  // "you'll" arrives as "you" + "ll".
  'll', 're', 've', 'didn', 'doesn', 'don', 'isn', 'wasn', 'weren', 'won',
  'eg', 'ie', 'vs',
  // Generic job-ad verbs. True of every posting and of nearly every resume, so
  // they carry no signal; the action-verb check lives in atsScorer instead.
  'analyse', 'analysing', 'analyze', 'analyzing', 'build', 'builds', 'built',
  'create', 'creates', 'creating', 'deliver', 'delivers', 'delivering',
  'develop', 'develops', 'developing', 'drive', 'drives', 'driving',
  'engineer', 'engineers', 'ensure', 'ensures', 'ensuring', 'execute',
  'executing', 'help', 'helps', 'helping', 'identify', 'identifying',
  'implement', 'implements', 'implementing', 'keep', 'keeps', 'keeping',
  'maintain', 'maintains', 'maintaining', 'manage', 'manages', 'managing',
  'monitor', 'monitoring', 'partner', 'partners', 'perform', 'performing',
  'provide', 'provides', 'providing', 'review', 'reviewing', 'support',
  'supports', 'supporting',
]);

// Multi-word terms that must survive tokenisation as one unit. Matching runs
// on text whose punctuation has already become spaces, so "CI/CD",
// "ci-cd" and "ci cd" all collapse onto the same form.
const PHRASES = [
  'accessibility testing',
  'agile methodology',
  'agile scrum',
  'api automation',
  'api testing',
  'automation testing',
  'behavior driven development',
  'ci cd',
  'cloud computing',
  'code review',
  'computer vision',
  'continuous delivery',
  'continuous deployment',
  'continuous integration',
  'cross platform testing',
  'data analysis',
  'data pipeline',
  'data science',
  'defect tracking',
  'end to end testing',
  'exploratory testing',
  'functional testing',
  'integration testing',
  'load testing',
  'machine learning',
  'manual testing',
  'microservices architecture',
  'natural language processing',
  'order to cash',
  'page object model',
  'performance testing',
  'regression testing',
  'rest api',
  'rest assured',
  'root cause analysis',
  'security testing',
  'shift left',
  'source control',
  'spring boot',
  'stress testing',
  'supply chain',
  'test automation',
  'test case',
  'test design',
  'test driven development',
  'test plan',
  'test strategy',
  'unit testing',
  'version control',
];

const TOOL_TERMS = new Set([
  'android', 'angular', 'ansible', 'apache', 'appium', 'aws', 'azure', 'bash',
  'bitbucket', 'bugzilla', 'charles', 'chrome', 'confluence', 'cucumber',
  'cypress', 'datadog', 'django', 'docker', 'excel', 'express', 'figma',
  'firebase', 'fiddler', 'flask', 'gcp', 'git', 'github', 'gitlab', 'grafana',
  'graphql', 'heroku', 'ios', 'java', 'javascript', 'jenkins', 'jest', 'jira',
  'jmeter', 'jquery', 'junit', 'kafka', 'kotlin', 'kubernetes', 'lighthouse',
  'linux', 'macos', 'mantisbt', 'mongodb', 'mysql', 'next.js', 'nginx',
  'node.js', 'notion', 'npm', 'oracle', 'photoshop', 'php', 'playwright',
  'postgres', 'postgresql', 'postman', 'powershell', 'protractor', 'pytest',
  'qmetry', 'react', 'redis', 'rest assured', 'robot', 'ruby', 'safari',
  'salesforce', 'sap', 'selenium', 'sketch', 'slack', 'soapui', 'splunk',
  'spring', 'sql', 'swift', 'tableau', 'tailwind', 'terraform', 'testng',
  'testrail', 'tomcat', 'trello', 'typescript', 'ubuntu', 'vitest', 'vue',
  'webdriver', 'webpack', 'windows', 'wordpress', 'xcode', 'xray', 'zephyr',
]);

const SOFT_TERMS = new Set([
  'adaptability', 'adaptable', 'analytical', 'articulate', 'attention',
  'coaching', 'collaboration', 'collaborative', 'communication', 'creativity',
  'cross functional', 'dependable', 'detail', 'empathy', 'facilitation',
  'flexible', 'influencing', 'initiative', 'interpersonal', 'leadership',
  'mentoring', 'mentorship', 'motivated', 'multitasking', 'negotiation',
  'organization', 'organised', 'organized', 'ownership', 'partnership',
  'presentation', 'presentations', 'proactive', 'problem', 'problem solving',
  'punctuality', 'solving', 'stakeholder', 'stakeholders', 'teamwork',
  'verbal', 'written',
]);

const DOMAIN_TERMS = new Set([
  'audit', 'audits', 'automotive', 'aviation', 'b2b', 'b2c', 'bank', 'banking',
  'chain', 'clinical', 'compliance', 'e commerce', 'edtech', 'energy',
  'ecommerce', 'finance', 'financial', 'fintech', 'gdpr', 'governance',
  'health', 'healthcare', 'hipaa', 'insurance', 'logistics', 'manufacturing',
  'mortgage', 'order to cash', 'payments', 'pci', 'pharma', 'regulatory',
  'retail', 'risk', 'saas', 'sox', 'supply chain', 'telecom',
  'telecommunications', 'utilities',
]);

const MAX_TERMS = 60;
const MAX_REQ_CHARS = 20000;

const REQ_START =
  /^(?:requirements?|qualifications?|required(?:\s+skills?)?|must[-\s]?have|minimum\s+qualifications?|what\s+you(?:'|’)?ll\s+need|who\s+you\s+are|skills?\s*(?:and|&)\s*experience|your\s+(?:profile|background|experience))\b/i;

const REQ_END =
  /^(?:responsibilities|what\s+you(?:'|’)?ll\s+do|benefits?|perks|about\s+(?:us|the\s+(?:company|team|role))|compensation|salary|why\s+(?:join|work)|nice\s+to\s+have)\b/i;

const SECTION_KEYS = [
  'summary',
  'skills',
  'experience',
  'education',
  'projects',
  'customSections',
];

// --- small helpers ----------------------------------------------------------

/** Lowercase, fold punctuation to spaces, keep `+ # .` so c++, c#, node.js survive. */
function flatten(input) {
  if (typeof input !== 'string' || !input) return '';
  let text = input;
  try {
    text = input.normalize('NFKC');
  } catch (err) {
    text = input;
  }
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Longest term we will build a regex for.
 *
 * V8 refuses to compile a pattern beyond roughly 2^15 characters ("Regular
 * expression too large"), and a legitimate keyword is never longer than this.
 * A 50,000-character run with no spaces — pasted binary, a base64 blob, a
 * minified bundle — would otherwise throw from deep inside the matcher.
 */
const MAX_TERM_LENGTH = 60;

/**
 * A term is a run of words; separators inside the JD are already spaces.
 * `\b` is only emitted next to a word character, so "c++" and "c#" still match
 * instead of failing on an impossible word boundary.
 */
function termPattern(term) {
  const body = String(term)
    .slice(0, MAX_TERM_LENGTH)
    .split(' ')
    .map(escapeRe)
    .join('\\s+');
  const lead = /^\w/.test(term) ? '\\b' : '';
  const tail = /\w$/.test(term) ? '\\b' : '';
  return lead + body + tail;
}

const testReCache = new Map();
const countReCache = new Map();

function testRe(term) {
  let re = testReCache.get(term);
  if (!re) {
    re = new RegExp(termPattern(term));
    testReCache.set(term, re);
  }
  return re;
}

function countRe(term) {
  let re = countReCache.get(term);
  if (!re) {
    re = new RegExp(termPattern(term), 'g');
    countReCache.set(term, re);
  }
  re.lastIndex = 0;
  return re;
}

/** Whole-word for single tokens, plain substring for multi-word phrases. */
function containsTerm(flatText, term) {
  if (!flatText || !term) return false;
  if (term.indexOf(' ') !== -1) return flatText.indexOf(term) !== -1;
  return testRe(term).test(flatText);
}

// --- stemming ---------------------------------------------------------------
//
// Deliberately NOT a Porter stemmer. A handful of suffix rules fix the one
// false negative that matters: "testing" in a JD must find "test" in a resume
// and vice versa. Stems are used for COMPARISON only — every user-visible
// label keeps the original surface form.
//
// Single-word terms only. Multi-word phrases are compared component by
// component, so they are never stemmed as a unit.

/**
 * Strip a small set of English suffixes so inflections of one word collide.
 *
 * Plain string checks, no regex, memoised: this runs per token on every
 * analysis and tokens repeat heavily ("the", "and", "testing" ...).
 *
 *   testing -> test      strategies -> strategy    classes -> class
 *   automated -> automat analysis -> analysis      business -> business
 *   javascript -> javascript   aws/sql/api/ci/led -> unchanged
 *
 * ponytail: no derivational stemming ("automation" stays distinct from
 * "automated") and no irregular verbs. Add Porter only if users report the
 * gap; the suffix list below covers plurals and the -ing/-ed forms that
 * actually differ between a JD and a resume.
 */
const stemCache = new Map();

function computeStem(word) {
  const n = word.length;
  // Short tokens are almost always acronyms (ci, sql, aws, api, js, ts, go) or
  // words whose stem would be meaningless (led -> l). Leave them alone.
  if (n <= 3) return word;

  // Anything with a digit or symbol is an identifier, not an English word:
  // node.js, c++, c#, .net, next.js. Suffix rules would corrupt them.
  for (let i = 0; i < n; i += 1) {
    const code = word.charCodeAt(i);
    if (code < 97 || code > 122) return word;
  }

  let w = word;

  // strategies -> strategy
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';

  if (w.endsWith('ing')) {
    const cut = w.slice(0, -3);
    // "ring" -> "r" is not a stem; keep the word when the cut leaves < 3 chars.
    if (cut.length >= 3) w = cut;
  } else if (w.endsWith('ed')) {
    const cut = w.slice(0, -2);
    if (cut.length >= 3) w = cut;
  } else if (w.endsWith('sses')) {
    // classes -> class
    w = w.slice(0, -2);
  } else if (w.endsWith('es')) {
    // Only drop the "s" here: cases -> case, databases -> database,
    // releases -> release. Stripping the full "es" would give "cas" and miss
    // the singular, which is exactly the asymmetry stemming is meant to fix.
    w = w.slice(0, -1);
  } else if (
    // skills -> skill. Keep "analysis" (-is), "business" (-ss), "bonus" (-us).
    w.endsWith('s') &&
    !w.endsWith('ss') &&
    !w.endsWith('us') &&
    !w.endsWith('is')
  ) {
    w = w.slice(0, -1);
  }

  return w;
}

/** Memoised stem. The cache is bounded so a hostile JD cannot grow it forever. */
function stem(word) {
  if (!word) return '';
  const hit = stemCache.get(word);
  if (hit !== undefined) return hit;
  const result = computeStem(word);
  if (stemCache.size > 5000) stemCache.clear();
  stemCache.set(word, result);
  return result;
}

/**
 * Stemmed token set for a flattened section. Built once per section per
 * analysis, then every keyword lookup is an O(1) Set hit instead of a regex
 * scan over the whole corpus.
 *
 * Trailing dots are stripped before stemming: flatten() keeps "." so that
 * node.js survives, but that also leaves sentence-final "testing." behind, and
 * a bare Set lookup would then miss it. Interior dots (node.js, next.js) are
 * left alone.
 */
function tokenSet(flatText) {
  const set = new Set();
  if (!flatText) return set;
  const tokens = flatText.split(' ');
  for (let i = 0; i < tokens.length; i += 1) {
    let token = tokens[i];
    if (!token) continue;
    while (token.charCodeAt(token.length - 1) === 46) token = token.slice(0, -1);
    if (token) set.add(stem(token));
  }
  return set;
}

/**
 * Does a stemmed token set contain this keyword?
 *
 * Single tokens compare stem-to-stem, so "testing" and "test" are one word.
 * Multi-word phrases require every component stem to be present in the same
 * section — order-insensitive on purpose, so a JD's "test automation" finds a
 * resume's "automation testing". Phrases are never stemmed as a whole.
 */
function setHasTerm(set, term) {
  if (!set || !term) return false;
  const space = term.indexOf(' ');
  if (space === -1) return set.has(stem(term));

  const parts = term.split(' ');
  for (let i = 0; i < parts.length; i += 1) {
    if (!parts[i]) continue;
    if (!set.has(stem(parts[i]))) return false;
  }
  return true;
}

function countOccurrences(flatText, term) {
  if (!flatText || !term) return 0;
  const hits = flatText.match(countRe(term));
  return hits ? hits.length : 0;
}

function categorise(term) {
  if (TOOL_TERMS.has(term)) return 'tool';
  if (SOFT_TERMS.has(term)) return 'soft';
  if (DOMAIN_TERMS.has(term)) return 'domain';
  return 'skill';
}

/**
 * Longest token accepted as a keyword. No real skill, tool or phrase is
 * longer; anything beyond this is pasted binary, a base64 blob, or a
 * minified bundle, and keeping it would both pollute the results and force
 * an enormous regex.
 */
const MAX_TOKEN_LENGTH = 40;

function isTerm(token) {
  if (!token || token.length < 2) return false;
  if (token.length > MAX_TOKEN_LENGTH) return false;
  if (!/[a-z]/.test(token)) return false; // pure numbers, "5+", "2024"
  if (STOPWORDS.has(token)) return false;
  return true;
}

function safeStr(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

/** Text inside a REQUIREMENTS / QUALIFICATIONS block, or '' when there is none. */
function requirementBlocks(jobDescription) {
  if (typeof jobDescription !== 'string' || !jobDescription) return '';
  const lines = jobDescription.split(/\r?\n/);
  const kept = [];
  let inRequirements = false;
  let chars = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;

    if (REQ_START.test(line)) {
      inRequirements = true;
      continue;
    }
    if (inRequirements && REQ_END.test(line)) {
      inRequirements = false;
      continue;
    }
    if (inRequirements) {
      kept.push(line);
      chars += line.length;
      if (chars > MAX_REQ_CHARS) break;
    }
  }

  return kept.join('\n');
}

// --- public API -------------------------------------------------------------

/**
 * Pull weighted keywords out of a job description.
 * Returns at most 60 terms, weight 2 before weight 1, alphabetical inside each.
 */
export function extractKeywords(jobDescription) {
  const flat = flatten(jobDescription);
  if (!flat) return [];

  const reqFlat = flatten(requirementBlocks(jobDescription));
  const hits = new Map(); // term -> { term, count }
  const consumed = new Set();

  for (let i = 0; i < PHRASES.length; i += 1) {
    const phrase = PHRASES[i];
    const count = countOccurrences(flat, phrase);
    if (count === 0) continue;
    hits.set(phrase, { term: phrase, count });
    // "api testing" wins over a bare "api": drop the components. Loses the odd
    // standalone "api", but stops every phrase inflating the term list.
    const parts = phrase.split(' ');
    for (let p = 0; p < parts.length; p += 1) consumed.add(parts[p]);
  }

  const tokens = flat.split(' ');
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i].replace(/\.+$/, '');
    if (consumed.has(token) || !isTerm(token)) continue;
    const existing = hits.get(token);
    if (existing) existing.count += 1;
    else hits.set(token, { term: token, count: 1 });
  }

  const terms = [];
  hits.forEach((hit) => {
    const repeated = hit.count >= 2;
    const inRequirements = reqFlat ? containsTerm(reqFlat, hit.term) : false;
    terms.push({
      term: hit.term,
      weight: repeated || inRequirements ? 2 : 1,
      category: categorise(hit.term),
    });
  });

  terms.sort(
    (a, b) => b.weight - a.weight || (a.term < b.term ? -1 : a.term > b.term ? 1 : 0)
  );

  return terms.slice(0, MAX_TERMS);
}

/** Every resume field, flattened per section, for matching. */
function buildSections(resumeData) {
  const data = resumeData && typeof resumeData === 'object' ? resumeData : {};

  const parts = (values) => {
    const out = [];
    for (let i = 0; i < values.length; i += 1) {
      const text = safeStr(values[i]);
      if (text) out.push(text);
    }
    return out.join(' \n ');
  };

  const sections = {
    summary: flatten(safeStr(data.summary)),
    // Credentials are keyword-bearing, so they widen the skills corpus rather
    // than adding a section the ATS panel does not display.
    skills: flatten(
      parts([
        ...arr(data.skills).flatMap((s) => [s && s.category, s && s.items]),
        ...arr(data.certifications).flatMap((c) => [c && c.name, c && c.issuer]),
      ])
    ),
    experience: flatten(
      arr(data.experience)
        .flatMap((e) => [e && e.role, e && e.company, e && e.product, ...arr(e && e.highlights)])
        .join(' \n ')
    ),
    education: flatten(
      arr(data.education)
        .flatMap((e) => [e && e.degree, e && e.school])
        .join(' \n ')
    ),
    projects: flatten(
      arr(data.projects)
        .flatMap((p) => [p && p.name, p && p.role, ...arr(p && p.highlights)])
        .join(' \n ')
    ),
    customSections: flatten(
      arr(data.customSections)
        .flatMap((c) => [c && c.title, ...arr(c && c.items)])
        .join(' \n ')
    ),
  };

  return sections;
}

function zeroResult(error) {
  return {
    matchScore: 0,
    matched: [],
    missing: [],
    coverage: 0,
    totalWeight: 0,
    matchedWeight: 0,
    sections: {
      summary: 0,
      skills: 0,
      experience: 0,
      education: 0,
      projects: 0,
      customSections: 0,
    },
    error: error || null,
  };
}

/**
 * Weighted keyword coverage of the job description by the resume.
 * Never throws: empty JD, empty resume and junk input all return a result.
 */
export function matchKeywords(resumeData, jobDescription) {
  const terms = extractKeywords(jobDescription);

  if (terms.length === 0) {
    const hasText = flatten(jobDescription).length > 0;
    return zeroResult(
      hasText
        ? 'No analysable keywords found in this job description.'
        : 'Paste a job description to analyse.'
    );
  }

  const corpus = buildSections(resumeData);
  // Stemmed token sets, one per section, built once. Every keyword lookup below
  // is then a Set hit rather than a regex sweep of the whole corpus.
  const sets = {};
  for (let s = 0; s < SECTION_KEYS.length; s += 1) {
    const key = SECTION_KEYS[s];
    sets[key] = tokenSet(corpus[key]);
  }

  const matched = [];
  const missing = [];
  const sectionHits = {
    summary: 0,
    skills: 0,
    experience: 0,
    education: 0,
    projects: 0,
    customSections: 0,
  };

  let totalWeight = 0;
  let matchedWeight = 0;

  for (let i = 0; i < terms.length; i += 1) {
    const { term, weight, category } = terms[i];
    totalWeight += weight;

    let where = null;
    for (let s = 0; s < SECTION_KEYS.length; s += 1) {
      const key = SECTION_KEYS[s];
      if (setHasTerm(sets[key], term)) {
        where = key;
        break;
      }
    }

    if (where) {
      matchedWeight += weight;
      sectionHits[where] += 1;
      matched.push({ term, category, where });
    } else {
      missing.push({ term, category, weight });
    }
  }

  const coverage = totalWeight > 0 ? matchedWeight / totalWeight : 0;

  return {
    matchScore: Math.max(0, Math.min(100, Math.round(coverage * 100))),
    matched,
    missing,
    coverage,
    totalWeight,
    matchedWeight,
    sections: sectionHits,
    error: null,
  };
}
