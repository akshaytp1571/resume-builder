/**
 * Regression tests for the P0 data-integrity bugs found by QA.
 *
 *   node test-integrity.mjs
 *
 * Each case here reproduces a defect that was reported in QA-REPORT.md and
 * confirms the fix holds. These are behavioural, not source greps: they import
 * the real modules and assert real outcomes.
 */

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

console.log(bad === 0 ? '\nINTEGRITY OK\n' : `\nINTEGRITY FAILED (${bad})\n`);
process.exit(bad === 0 ? 0 : 1);
