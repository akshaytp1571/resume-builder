/**
 * Regression tests for the P0 data-integrity bugs found by QA.
 *
 *   node test-integrity.mjs
 *
 * Each case here reproduces a defect that was reported in QA-REPORT.md and
 * confirms the fix holds. These are behavioural, not source greps: they import
 * the real modules and assert real outcomes.
 */

import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
};

const store = await import('./src/utils/resumeStore.js');
const { calculateAtsScore } = await import('./src/utils/atsScorer.js');

let bad = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const fail = (m) => {
  console.log(`  FAIL ${m}`);
  bad++;
};

/** Run fn, passing if it does not throw; report the throw otherwise. */
function noThrow(label, fn) {
  try {
    fn();
    ok(label);
  } catch (e) {
    fail(`${label} — threw: ${e.message}`);
  }
}

console.log('\n== P1: hostile item shapes must not crash the ATS scorer ==');
{
  const hostile = [
    ['skills: [null]', { skills: [null] }],
    ['experience: [{highlights:"one string"}]', { experience: [{ highlights: 'one string' }] }],
    ['education: [null]', { education: [null] }],
    ['customSections: [{items:"x"}]', { customSections: [{ items: 'x' }] }],
    ['personalInfo.email = 5', { personalInfo: { email: 5 } }],
    ['personalInfo.fullName = {}', { personalInfo: { fullName: {} } }],
    ['skills: [{items: 5}]', { skills: [{ items: 5 }] }],
    ['summary = 5', { summary: 5 }],
    ['skills: "a string"', { skills: 'a string' }],
    ['experience: [null, undefined, 42]', { experience: [null, undefined, 42] }],
    ['languages: [{name: null}]', { languages: [{ name: null }] }],
    ['certifications: [{}]', { certifications: [{}] }],
    ['projects: [{highlights: {}}]', { projects: [{ highlights: {} }] }],
  ];

  for (const [label, data] of hostile) {
    noThrow(`normalized resume survives ${label}`, () => {
      const normalized = store.normalizeResume(data);
      const result = calculateAtsScore(normalized);
      if (!Number.isInteger(result.score)) {
        throw new Error(`score is not an integer: ${result.score}`);
      }
      if (result.score < 0 || result.score > 100) {
        throw new Error(`score out of range: ${result.score}`);
      }
    });
  }
}

console.log('\n== P1: normalizeResume strips hostile items ==');
{
  const out = store.normalizeResume({
    skills: [null, { items: 'Java' }, 'nope', 42],
    experience: [{ role: 'Dev', highlights: [null, 'Did a thing', 42, {}] }],
    customSections: [{ title: 'Pubs', items: 'a single string' }],
  });

  if (out.skills.length !== 1) fail(`skills kept ${out.skills.length} items, expected 1`);
  else ok('non-object skill entries dropped');

  if (out.skills[0]?.items !== 'Java') fail('valid skill entry lost');
  else ok('valid skill entry preserved');

  if (out.experience[0]?.highlights?.length !== 1) {
    fail(`highlights kept ${out.experience[0]?.highlights?.length}, expected 1`);
  } else {
    ok('non-string highlights dropped');
  }

  if (out.customSections[0]?.items?.[0] !== 'a single string') {
    fail('a string items field was not coerced to a one-element array');
  } else {
    ok('string items coerced to array');
  }

  const ids = out.skills.map((s) => s.id);
  if (!ids.every((id) => typeof id === 'string' && id.length > 0)) fail('missing ids after normalise');
  else ok('every item has a string id');
}

console.log('\n== P0: a corrupt store is quarantined, not silently overwritten ==');
{
  mem.clear();
  const corrupt = '{"activeId":"x","variants":[{"id":"a","data":{"skills":[null]}}]';
  mem.set('precision_resume_store_v2', corrupt);

  const s = store.loadStore();
  if (!s || !Array.isArray(s.variants) || s.variants.length === 0) {
    fail('loadStore returned an unusable store');
  } else {
    ok('loadStore still returns a usable store');
  }

  const recoveryKeys = [...mem.keys()].filter((k) => k.includes('__recovery_'));
  if (recoveryKeys.length === 0) {
    fail('the corrupt value was not preserved under a recovery key');
  } else {
    ok(`corrupt value quarantined at ${recoveryKeys[0]}`);
    if (mem.get(recoveryKeys[0]) !== corrupt) fail('recovery copy does not match the original');
    else ok('recovery copy is byte-identical to the original');
  }

  if (!store.hasRecoveryCopy()) fail('hasRecoveryCopy() returned false');
  else ok('hasRecoveryCopy() detects it');
}

console.log('\n== P0: duplicate variant ids survive delete ==');
{
  mem.clear();
  const dup = {
    activeId: 'same',
    variants: [
      { id: 'same', name: 'One', data: {}, theme: {} },
      { id: 'same', name: 'Two', data: {}, theme: {} },
      { id: 'other', name: 'Three', data: {}, theme: {} },
    ],
  };
  mem.set('precision_resume_store_v2', JSON.stringify(dup));

  const loaded = store.loadStore();
  ok(`loaded ${loaded.variants.length} variants (duplicate ids allowed)`);

  noThrow('deleting one duplicate id does not throw', () => {
    const after = store.removeVariant(loaded, 'same');
    if (after.variants.length !== 2) {
      throw new Error(`expected 2 variants after delete, got ${after.variants.length}`);
    }
    if (!store.getActiveVariant(after)) throw new Error('active variant no longer resolves');
  });
}

console.log('\n== P0: removing the last variant is always refused ==');
{
  mem.clear();
  const s = store.loadStore();
  const after = store.removeVariant(s, s.activeId);
  if (after.variants.length !== 1) fail('the only variant was deleted');
  else ok('last variant protected');

  // Hostile: a store that already has an empty variants array.
  const empty = store.removeVariant({ activeId: 'x', variants: [] }, 'x');
  if (!Array.isArray(empty.variants)) fail('empty store produced a non-array');
  else ok('empty variants array handled without throwing');
}

console.log('\n== P1: a store missing variant ids gets them repaired ==');
{
  mem.clear();
  mem.set(
    'precision_resume_store_v2',
    JSON.stringify({
      activeId: 'gone',
      variants: [{ name: 'No id here', data: {}, theme: {} }],
    })
  );
  const s = store.loadStore();
  const v = store.getActiveVariant(s);
  if (!v?.id) fail('variant has no id after load');
  else ok(`missing id repaired -> ${v.id}`);
  if (s.activeId !== v.id) fail('activeId does not point at the repaired variant');
  else ok('activeId repaired');
}

console.log('\n== P2: saveStore reports failure instead of swallowing it ==');
{
  mem.clear();
  const s = store.loadStore();

  // saveStore returns { ok, merged } — `merged` is non-null when another tab
  // had a variant this one did not know about.
  const saved = store.saveStore(s);
  if (!saved || saved.ok !== true) fail('a normal save did not report success');
  else ok('normal save reports { ok: true }');
  if (saved.merged !== null) fail('a lone-tab save reported a spurious merge');
  else ok('a lone-tab save does not report a merge');

  // Simulate a full quota.
  const realSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => {
    const err = new Error('QuotaExceededError');
    err.name = 'QuotaExceededError';
    throw err;
  };
  try {
    const failed = store.saveStore(s);
    if (!failed || failed.ok !== false) fail('a failed save did not report ok: false');
    else ok('failed save reports { ok: false } so the caller can warn the user');
  } finally {
    globalThis.localStorage.setItem = realSetItem;
  }
}

console.log('\n== P0: two-tab race merges instead of overwriting ==');
{
  // Tab A holds one variant. Tab B has since added a second. Tab A saves.
  mem.clear();
  const base = store.loadStore();
  const tabA = base;

  const tabB = store.addVariant(base, store.createVariant({ name: 'From tab B' }));
  // Tab B's write lands first.
  const first = store.saveStore(tabB);
  if (!first.ok) fail('setup save failed');

  // Now tab A writes its stale copy over the top.
  const second = store.saveStore(tabA);
  if (!second.ok) fail('tab A save failed');

  const onDisk = JSON.parse(mem.get('precision_resume_store_v2'));
  if (onDisk.variants.length !== 2) {
    fail(`tab A overwrote tab B: ${onDisk.variants.length} variant(s) on disk, expected 2`);
  } else {
    ok('tab B\'s variant survived tab A\'s stale write');
  }

  if (!onDisk.variants.some((v) => v.name === 'From tab B')) {
    fail('the merged store lost tab B\'s variant name');
  } else {
    ok('merged store contains tab B\'s variant');
  }

  if (!second.merged) fail('the caller was not told a merge happened');
  else ok('saveStore reports the merge so the UI can notify the user');
}

console.log('\n== P0: a merge never drops the writing tab\'s own edits ==');
{
  mem.clear();
  const base = store.loadStore();
  const tabA = store.addVariant(base, store.createVariant({ name: 'Tab A only' }));
  store.saveStore(tabA);

  // Tab B knows about a different variant and saves its own stale copy.
  const tabB = store.addVariant(base, store.createVariant({ name: 'Tab B only' }));
  store.saveStore(tabB);

  const onDisk = JSON.parse(mem.get('precision_resume_store_v2'));
  const names = onDisk.variants.map((v) => v.name);
  if (!names.includes('Tab A only') || !names.includes('Tab B only')) {
    fail(`merge lost a variant: ${names.join(', ')}`);
  } else {
    ok('both tabs\' variants survive a mutual overwrite');
  }
}

console.log('\n== P2: import rejects junk without throwing unhandled ==');
{
  for (const [label, text] of [
    ['not JSON', '{oops'],
    ['JSON but not a resume', '{"hello":"world"}'],
    ['null', 'null'],
    ['array', '[1,2,3]'],
  ]) {
    try {
      store.importStoreJson(text);
      fail(`${label}: did not throw`);
    } catch (e) {
      if (!e.message || e.message.length < 10) fail(`${label}: unhelpful message "${e.message}"`);
      else ok(`${label}: rejected with "${e.message}"`);
    }
  }
}

console.log('\n== P1: migration from v1 keys still works ==');
{
  mem.clear();
  mem.set(
    'precision_resume_data_v1',
    JSON.stringify({ personalInfo: { fullName: 'Legacy User' }, summary: 'old' })
  );
  mem.set('precision_theme_data_v1', JSON.stringify({ templateId: 'modern' }));

  const s = store.loadStore();
  const v = store.getActiveVariant(s);
  if (v.data.personalInfo.fullName !== 'Legacy User') fail('legacy name lost');
  else ok('legacy name migrated');
  if (v.theme.templateId !== 'modern') fail('legacy theme lost');
  else ok('legacy theme migrated');
}

console.log('\n== P1: hostile migration data does not crash ==');
{
  mem.clear();
  mem.set('precision_resume_data_v1', '{"personalInfo":{"fullName":42},"skills":[null]}');
  noThrow('migration survives hostile legacy data', () => {
    const s = store.loadStore();
    const v = store.getActiveVariant(s);
    if (!v) throw new Error('no active variant after migration');
    calculateAtsScore(v.data);
  });
}

console.log('\n== P2: action verbs match whole words, not substrings ==');
{
  // None of these contains a real action verb. A bare `includes` matched "led"
  // inside "enabled", "saddled" and "cancelled", so all three together scored
  // 18/25 for zero verbs. Word-boundary matching drops them to presence-only 10.
  const verbless = [
    'Responsible for the enabled feature set and scheduled jobs',
    'Controlled the balanced ledger and handled cancelled tickets',
    'Managed upkeep of the saddled equipment and bundled cables',
  ];
  const expScore = (r) => r.breakdown.find((b) => /Experience/.test(b.category)).score;

  const asBullets = calculateAtsScore({ experience: [{ highlights: verbless }] });
  if (expScore(asBullets) !== 10) {
    fail(`verb-less bullets scored ${expScore(asBullets)}/25, expected 10 (presence only)`);
  } else {
    ok('verb-less bullets earn no action-verb points');
  }

  const single = calculateAtsScore({ experience: [{ highlights: [verbless[0]] }] });
  if (expScore(single) !== 10) {
    fail(`"enabled" still satisfies "led": ${expScore(single)}/25`);
  } else {
    ok('"enabled" no longer satisfies "led"');
  }

  // The fix must not be a blanket rejection: real verbs still score.
  const realVerbs = calculateAtsScore({
    experience: [{ highlights: ['Led 5 testers', 'Built 3 suites', 'Designed 2 APIs'] }],
  });
  if (expScore(realVerbs) !== 25) {
    fail(`real verbs with metrics scored ${expScore(realVerbs)}/25, expected 25`);
  } else {
    ok('real action verbs with metrics still score 25/25');
  }

  const punctuation = calculateAtsScore({
    experience: [{ highlights: ['I led. Then built, then designed!'] }],
  });
  if (expScore(punctuation) !== 10) {
    fail(`a verb followed by punctuation was not detected (${expScore(punctuation)}/25)`);
  } else {
    ok('verbs followed by punctuation still count');
  }

  const projScore = (r) => r.breakdown.find((b) => /Project/.test(b.category)).score;
  const projFake = calculateAtsScore({ projects: [{ highlights: ['enabled feature', 'saddled gear'] }] });
  if (projScore(projFake) !== 5) fail(`projects: substring verbs scored ${projScore(projFake)}/10, expected 5`);
  else ok('projects do not credit substring verbs either');
}

console.log('\n== P2: no dead zone between 10 and 11 summary words ==');
{
  const summaryScore = (words) =>
    calculateAtsScore({ summary: Array.from({ length: words }, (_, i) => `w${i}`).join(' ') })
      .breakdown.find((b) => /Summary/.test(b.category)).score;

  const ten = summaryScore(10);
  const eleven = summaryScore(11);
  if (ten !== eleven) fail(`10 words scored ${ten}, 11 words scored ${eleven} — dead zone remains`);
  else ok(`10 and 11 words both score ${ten}`);

  // The surrounding curve must keep its shape.
  const expected = [[0, 0], [1, 0], [10, 9], [29, 9], [30, 15], [120, 15], [121, 10], [200, 10]];
  const wrong = expected.filter(([words, want]) => summaryScore(words) !== want);
  if (wrong.length) {
    fail(`summary curve drifted: ${wrong.map(([w, want]) => `${w}w expected ${want} got ${summaryScore(w)}`).join(', ')}`);
  } else {
    ok('summary word curve unchanged elsewhere (0,1,29,30,120,121,200)');
  }
}

console.log('\n== P1: calculateAtsScore is defensive without normalizeResume ==');
{
  // Deliberately NOT normalized — this is the "future caller forgot" case.
  const hostileRaw = [
    ['null', null],
    ['undefined', undefined],
    ['skills: "x"', { skills: 'x' }],
    ['skills: {}', { skills: {} }],
    ['skills: [null]', { skills: [null] }],
    ['skills: [{items:5}]', { skills: [{ items: 5 }] }],
    ['experience: [null]', { experience: [null] }],
    ['highlights: "str"', { experience: [{ highlights: 'str' }] }],
    ['highlights: [null]', { experience: [{ highlights: [null] }] }],
    ['education: [null]', { education: [null] }],
    ['customSections: [{items:"x"}]', { customSections: [{ items: 'x' }] }],
    ['email: 5', { personalInfo: { email: 5 } }],
    ['fullName: {}', { personalInfo: { fullName: {} } }],
    ['summary: 5', { summary: 5 }],
  ];

  for (const [label, data] of hostileRaw) {
    noThrow(`un-normalized ${label} survives`, () => {
      const result = calculateAtsScore(data);
      if (!Number.isInteger(result.score)) throw new Error(`score not an integer: ${result.score}`);
      if (result.score < 0 || result.score > 100) throw new Error(`score out of range: ${result.score}`);
      if (!Array.isArray(result.breakdown) || !Array.isArray(result.suggestions)) {
        throw new Error('return shape changed');
      }
      const maxes = result.breakdown.reduce((sum, b) => sum + b.maxScore, 0);
      if (maxes !== 100) throw new Error(`breakdown maxes sum to ${maxes}`);
    });
  }

  noThrow('calling with no argument at all survives', () => {
    const result = calculateAtsScore();
    if (!Number.isInteger(result.score)) throw new Error('score not an integer');
  });
}

console.log('\n== v1.2: matcher stemming ==');
{
  const { extractKeywords, matchKeywords } = await import('./src/utils/keywordMatcher.js');

  // Display terms must keep their surface form — stemming is for comparison only.
  const surface = extractKeywords(
    'We need test automation and automated regression testing with analysis of business strategy'
  ).map((k) => k.term);

  const overStemmed = surface.filter((t) =>
    /^(automat|testin|analysi|busines|strategi|te)$/.test(t)
  );
  if (overStemmed.length) fail(`stemmed display terms leaked: ${overStemmed.join(', ')}`);
  else ok('display terms keep their surface form');

  // Symmetry: inflection on either side must match.
  const jdTesting = matchKeywords({ summary: 'automation test and unit test' }, 'test automation and unit testing');
  if (jdTesting.matched.length === 0) fail('JD "testing" did not match resume "test"');
  else ok('JD "testing" matches resume "test"');

  const resumeTesting = matchKeywords({ summary: 'test automation and unit testing' }, 'automation test and unit test');
  if (resumeTesting.matched.length === 0) fail('JD "test" did not match resume "testing"');
  else ok('JD "test" matches resume "testing"');

  // Over-stem guards: a wrong stem in the resume must not match the real word.
  for (const [real, wrong] of [
    ['analysis', 'analysi'],
    ['business', 'busines'],
    ['javascript', 'javascrip'],
    ['aws', 'aw'],
    ['sql', 'sq'],
  ]) {
    const r = matchKeywords({ summary: `I know ${wrong}` }, `We need ${real}`);
    if (r.matched.length > 0) fail(`"${wrong}" wrongly matched "${real}"`);
  }
  ok('over-stem guards hold (analysis, business, javascript, aws, sql)');

  // Acronyms must survive stemming intact.
  for (const acronym of ['aws', 'sql', 'api', 'ci', 'cd', 'gcp', 'js', 'ts', 'go']) {
    const r = matchKeywords({ summary: `experience with ${acronym}` }, `must know ${acronym}`);
    if (r.matched.length === 0) fail(`acronym "${acronym}" failed to match itself`);
  }
  ok('acronyms survive stemming');
}

console.log('\n== v1.2: recovery copy is discoverable ==');
{
  mem.clear();
  // Seed a corrupt store, then confirm the recovery helpers can find it.
  mem.set('precision_resume_store_v2', '{"variants":[ BROKEN');
  store.loadStore();

  if (!store.hasRecoveryCopy()) fail('hasRecoveryCopy() false after a corrupt load');
  else ok('hasRecoveryCopy() detects the quarantined value');

  const keys = store.listRecoveryKeys();
  if (!Array.isArray(keys) || keys.length === 0) {
    fail('listRecoveryKeys() returned no keys');
  } else {
    ok(`listRecoveryKeys() returns ${keys.length} key(s)`);
    const raw = mem.get(keys[0]);
    if (raw !== '{"variants":[ BROKEN') fail('recovery key does not hold the original raw bytes');
    else ok('recovery key holds the original raw bytes verbatim');
  }

  // Newest-first ordering matters: the UI downloads keys[0].
  mem.clear();
  mem.set('precision_resume_store_v2__recovery_1000', 'old');
  mem.set('precision_resume_store_v2__recovery_2000', 'new');
  const ordered = store.listRecoveryKeys();
  if (ordered[0] !== 'precision_resume_store_v2__recovery_2000') {
    fail(`listRecoveryKeys() is not newest-first: ${ordered[0]}`);
  } else {
    ok('listRecoveryKeys() returns newest first');
  }
}

console.log('\n== v1.2: no sub-AA muted text tokens remain ==');
{
  // Guards the contrast sweep: these exact low-opacity tokens measured under
  // 4.5:1 (body) or 3:1 (UI) and must not come back.
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const bad = [
    'placeholder:text-pink-300/30',
    'placeholder:text-pink-300/25',
    'text-pink-400/60',
    'text-pink-400/50',
  ];

  const walk = (dir) => {
    const out = [];
    for (const entry of fsMod.readdirSync(dir, { withFileTypes: true })) {
      const full = pathMod.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
    }
    return out;
  };

  const offenders = [];
  // `__dirname` is unavailable in an ESM module with top-level await, so derive
  // the source directory from import.meta.url.
  const srcDir = fileURLToPath(new URL('./src', import.meta.url));
  for (const file of walk(srcDir)) {
    const text = fsMod.readFileSync(file, 'utf8');
    for (const token of bad) {
      if (text.includes(token)) offenders.push(`${pathMod.basename(file)}: ${token}`);
    }
  }

  if (offenders.length) fail(`sub-AA tokens reintroduced: ${offenders.slice(0, 5).join(', ')}`);
  else ok('no sub-AA muted text tokens remain');
}

console.log('\n== v2.1: the ATS score can see the rendered page ==');
{
  const PAGE = 1123; // A4 at 96dpi, same constant ResumePreview reports with
  const at = (ratio) => ({ pageHeightPx: Math.round(PAGE * ratio), pageBudgetPx: PAGE });
  const sample = (await import('./src/data/initialData.js')).INITIAL_RESUME_DATA;
  const layoutOf = (r) => r.breakdown.find((b) => /layout/i.test(b.category));
  const maxes = (r) => r.breakdown.reduce((s, b) => s + b.maxScore, 0);

  // The hard contract: one argument must still produce exactly the old score.
  const legacy = calculateAtsScore(sample);
  if (legacy.score !== 90) fail(`one-argument score drifted: expected 90, got ${legacy.score}`);
  else ok('one-argument score is unchanged (90)');

  if (legacy.breakdown.length !== 6) fail(`legacy breakdown has ${legacy.breakdown.length} categories, expected 6`);
  else ok('one-argument breakdown keeps its 6 legacy categories');

  const withLayout = calculateAtsScore(sample, at(1));
  if (!layoutOf(withLayout)) fail('a measured layout did not add a Layout category');
  else ok(`measured layout adds Layout & Fit (${layoutOf(withLayout).score}/${layoutOf(withLayout).maxScore})`);

  for (const [label, r] of [
    ['no layout', legacy],
    ['one page', withLayout],
    ['200% spill', calculateAtsScore(sample, at(2))],
  ]) {
    if (maxes(r) !== 100) fail(`${label}: breakdown maxes sum to ${maxes(r)}, expected 100`);
  }
  ok('breakdown maximums still sum to 100 with and without a layout');

  const onePage = calculateAtsScore(sample, at(1)).score;
  const spill = calculateAtsScore(sample, at(2)).score;
  if (!(onePage > spill)) fail(`a one-pager (${onePage}) did not beat a 200% spill (${spill})`);
  else ok(`one page ${onePage} > 200% spill ${spill}`);

  const thin = calculateAtsScore(sample, at(0.3)).score;
  if (!(thin < onePage)) fail(`a 30%-full page (${thin}) was rewarded over a full one (${onePage})`);
  else ok(`thin 30% page ${thin} is not rewarded over a filled page ${onePage}`);

  // Content is worth 87 of the new 100 (Layout takes 13), so raw content points
  // legitimately shrink. What must NOT shrink is the PROPORTION of the content
  // budget earned: measuring a page must not make the same resume look worse at
  // the things it already did well. A rounding-down rescale would do exactly
  // that, so compare ratios rather than raw points.
  const legacyRatio =
    legacy.breakdown.reduce((s, b) => s + b.score, 0) /
    legacy.breakdown.reduce((s, b) => s + b.maxScore, 0);
  for (const ratio of [0.2, 0.3, 0.5, 1, 1.5, 3]) {
    const scored = calculateAtsScore(sample, at(ratio));
    const content = scored.breakdown.filter((b) => !/layout/i.test(b.category));
    const earned = content.reduce((s, b) => s + b.score, 0);
    const available = content.reduce((s, b) => s + b.maxScore, 0);
    const scoredRatio = earned / available;
    if (scoredRatio < legacyRatio - 0.01) {
      fail(
        `ratio ${ratio}: content proportion fell from ${(legacyRatio * 100).toFixed(1)}% to ${(scoredRatio * 100).toFixed(1)}% just because a page was measured`
      );
    }
  }
  ok('measuring a layout never reduces the proportion of content points earned');

  const hostile = [
    null, undefined, {}, { pageHeightPx: null, pageBudgetPx: null },
    { pageHeightPx: -1, pageBudgetPx: PAGE }, { pageHeightPx: Infinity, pageBudgetPx: PAGE },
    { pageHeightPx: NaN, pageBudgetPx: PAGE }, { pageHeightPx: '1123', pageBudgetPx: '1123' },
    'a string', 42, [],
  ];
  let hostileBad = 0;
  for (const layout of hostile) {
    const r = calculateAtsScore(sample, layout);
    if (!Number.isInteger(r.score) || r.score < 0 || r.score > 100) hostileBad++;
    if (r.score !== legacy.score) hostileBad++; // unusable measurement == not measured
  }
  if (hostileBad) fail(`${hostileBad} hostile layout values misbehaved`);
  else ok(`all ${hostile.length} hostile layout values fall back to the legacy score`);

  const emptyResume = {
    personalInfo: { fullName: '', title: '', email: '', phone: '', location: '' },
    summary: '', skills: [], experience: [], education: [],
    languages: [], certifications: [], projects: [], customSections: [],
  };
  const emptyFit = layoutOf(calculateAtsScore(emptyResume, at(1)));
  if (!emptyFit || emptyFit.score !== 0) {
    fail(`an empty resume earned ${emptyFit?.score} fit points for fitting an empty page`);
  } else {
    ok('an empty resume earns no Layout points for fitting an empty page');
  }
}

console.log(bad === 0 ? '\nINTEGRITY OK\n' : `\nINTEGRITY FAILED (${bad})\n`);
process.exit(bad === 0 ? 0 : 1);
