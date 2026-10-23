/**
 * Runtime smoke test for the v1.0 features.
 *
 *   node smoke-test.mjs
 *
 * Unlike test-fixes.cjs (which mostly greps source text), this actually imports
 * the modules and asserts they behave correctly with the shipped sample data.
 */

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const { INITIAL_RESUME_DATA } = await import('./src/data/initialData.js');
const { TEMPLATE_CAPABILITIES, OPTIONAL_SECTIONS, getDroppedSections } = await import(
  './src/data/templateCapabilities.js'
);
const { calculateAtsScore } = await import('./src/utils/atsScorer.js');
const store = await import('./src/utils/resumeStore.js');

let bad = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const fail = (m) => {
  console.log(`  FAIL ${m}`);
  bad++;
};

console.log('\n== sample data ==');
if (!Array.isArray(INITIAL_RESUME_DATA.projects) || INITIAL_RESUME_DATA.projects.length === 0) {
  fail('sample data has no projects');
} else {
  ok(`sample data has ${INITIAL_RESUME_DATA.projects.length} project(s)`);
}
if (
  !Array.isArray(INITIAL_RESUME_DATA.customSections) ||
  INITIAL_RESUME_DATA.customSections.length === 0
) {
  fail('sample data has no customSections');
} else {
  ok(`sample data has ${INITIAL_RESUME_DATA.customSections.length} custom section(s)`);
}

console.log('\n== every template renders every filled section ==');
for (const tplId of Object.keys(TEMPLATE_CAPABILITIES)) {
  const dropped = getDroppedSections(tplId, INITIAL_RESUME_DATA);
  if (dropped.length) fail(`${tplId} would drop: ${dropped.join(', ')}`);
}
if (bad === 0) ok('no template drops a filled section');

console.log('\n== ATS with sample data ==');
const ats = calculateAtsScore(INITIAL_RESUME_DATA);
if (!Number.isInteger(ats.score) || ats.score < 0 || ats.score > 100) {
  fail(`ats score is ${ats.score}`);
} else {
  ok(`ATS score ${ats.score} (${ats.rating})`);
}
const projectsCat = ats.breakdown.find((b) => /project/i.test(b.category));
if (!projectsCat) fail('no Projects category in breakdown');
else ok(`Projects category: ${projectsCat.score}/${projectsCat.maxScore}`);

const maxes = ats.breakdown.reduce((s, b) => s + b.maxScore, 0);
if (maxes !== 100) fail(`breakdown maxes sum to ${maxes}, expected 100`);
else ok('breakdown maxes sum to 100');

console.log('\n== resume store round-trip ==');
mem.clear();
let s = store.loadStore();
ok(`fresh store has ${s.variants.length} variant(s)`);

s = store.addVariant(s, store.createVariant({ name: 'Tailored' }));
s = store.duplicateVariant(s, s.activeId);
ok(`after add+duplicate: ${s.variants.length} variants`);

const json = store.exportStoreJson(s);
const back = store.importStoreJson(json);
if (back.variants.length !== s.variants.length) {
  fail(`round-trip lost variants: ${s.variants.length} -> ${back.variants.length}`);
} else {
  ok(`export/import round-trip preserved ${back.variants.length} variants`);
}

// Mutating an imported copy must not touch the original.
const a = store.getActiveVariant(back);
a.data.summary = 'MUTATED';
const b = store.getActiveVariant(s);
if (b.data.summary === 'MUTATED') fail('variants share object references after import');
else ok('variants are independent objects');

// Delete down to one, then confirm the last one is protected.
while (s.variants.length > 1) s = store.removeVariant(s, s.activeId);
const afterDelete = store.removeVariant(s, s.activeId);
if (afterDelete.variants.length !== 1) fail('last variant was deleted');
else ok('last variant is protected from deletion');

console.log('\n== migration from v1 keys ==');
mem.clear();
mem.set(
  'precision_resume_data_v1',
  JSON.stringify({ personalInfo: { fullName: 'Old User' }, summary: 'legacy' })
);
mem.set('precision_theme_data_v1', JSON.stringify({ templateId: 'modern' }));
const migrated = store.loadStore();
const active = store.getActiveVariant(migrated);
if (active.data.personalInfo.fullName !== 'Old User') fail('migration lost the resume data');
else ok('legacy resume migrated');
if (active.theme.templateId !== 'modern') fail('migration lost the theme');
else ok('legacy theme migrated');

console.log(bad === 0 ? '\nSMOKE OK\n' : `\nSMOKE FAILED (${bad})\n`);
process.exit(bad === 0 ? 0 : 1);
