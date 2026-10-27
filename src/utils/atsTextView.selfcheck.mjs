/**
 * Self-check for the ATS plain-text projection.
 *
 * Run: node src/utils/atsTextView.selfcheck.mjs
 *
 * Assert-based, no framework. Lives beside the module it checks because the
 * vitest suite cannot import it (utils/ is out of scope for test edits) and
 * this needs to be runnable on its own.
 */

import assert from 'node:assert/strict';
import { toAtsText, atsTextFilename } from './atsTextView.js';

const resume = {
  personalInfo: {
    fullName: 'Alex Morgan',
    title: 'QA Lead',
    email: 'alex@example.com',
    phone: '+1 555 0100',
    location: 'Springfield, USA',
    linkedin: 'linkedin.com/in/x',
    github: '',
    website: '',
    summary: 'QA Lead with 5 years of experience.',
  },
  skills: [
    { category: 'Testing', items: 'Manual, API' },
    { category: '', items: 'Orphan items' },
    { category: 'Empty', items: '' },
  ],
  experience: [
    {
      role: 'QA Lead',
      company: 'Northwind',
      period: '2021 - Present',
      product: 'Product: FleetWorks',
      highlights: ['Led a team.', '  ', 'Cut runtime by 40%.'],
    },
  ],
  education: [{ school: 'State University', degree: 'B.Tech', score: '8.0', year: '2019' }],
  languages: [{ name: 'English', proficiency: 'Native' }],
  certifications: [{ name: 'ISTQB', issuer: 'ISTQB', year: '2021' }],
  projects: [{ name: 'Framework', role: 'Creator', period: '2022', link: 'gh/x', highlights: ['Built it.'] }],
  customSections: [{ id: 'c1', title: 'Publications', items: ['A blog post'] }],
};

// --- 1. every populated section appears, in a predictable order
const out = toAtsText(resume);
for (const heading of [
  'CONTACT',
  'SUMMARY',
  'SKILLS',
  'EXPERIENCE',
  'PROJECTS',
  'EDUCATION',
  'CERTIFICATIONS',
  'LANGUAGES',
  'PUBLICATIONS',
]) {
  assert.ok(out.text.includes(heading), `missing section heading: ${heading}`);
}
assert.ok(
  out.text.indexOf('EXPERIENCE') < out.text.indexOf('EDUCATION'),
  'experience must precede education'
);
assert.ok(
  out.text.indexOf('EDUCATION') < out.text.indexOf('PUBLICATIONS'),
  'custom sections must come after the known ones'
);

// --- 2. contact details are plain text, and empties do not leave stray separators
assert.ok(out.text.includes('Alex Morgan'), 'name missing');
assert.ok(out.text.includes('alex@example.com'), 'email missing');
assert.ok(!out.text.includes('| |'), 'empty contact field produced a double separator');
assert.ok(!out.text.includes('Springfield, USA |'), 'trailing separator after last contact field');

// --- 3. bullets are real dashes, and whitespace-only bullets are dropped
assert.ok(out.text.includes('- Led a team.'), 'bullet not rendered with a dash');
assert.ok(!out.text.includes('- \n'), 'whitespace-only bullet leaked through');
// Count line-leading dashes only: "2021 - Present" also contains "- " and is
// not a bullet. 2 experience + 1 project + 1 custom-section item = 4.
assert.equal(
  (out.text.match(/^- /gm) || []).length,
  4,
  'expected 4 bullets (2 experience + 1 project + 1 custom item)'
);

// --- 4. skills: category prefix kept, bare items kept, empty category+items dropped
assert.ok(out.text.includes('Testing: Manual, API'), 'categorised skill lost its prefix');
assert.ok(out.text.includes('Orphan items'), 'uncategorised skill dropped');
assert.ok(!out.text.includes('Empty:'), 'empty skill category emitted a bare prefix');

// --- 5. no double blank lines anywhere (that is what breaks parsers)
assert.ok(!/\n{3,}/.test(out.text), 'output contains a triple newline');

// --- 6. counts are real
assert.equal(out.words, out.text.split(/\s+/).filter(Boolean).length, 'word count mismatch');
assert.equal(out.chars, out.text.length, 'char count mismatch');

// --- 7. `only` restricts sections but always keeps the header
const only = toAtsText(resume, { only: ['experience'] });
assert.ok(only.text.includes('CONTACT'), 'header must survive filtering');
assert.ok(only.text.includes('EXPERIENCE'), 'requested section missing');
assert.ok(!only.text.includes('EDUCATION'), 'unrequested section leaked in');

// --- 8. empty and malformed input must not throw
for (const bad of [null, undefined, {}, { personalInfo: null }, { skills: 'nope' }]) {
  const r = toAtsText(bad);
  assert.equal(typeof r.text, 'string', 'non-string text for malformed input');
  assert.ok(!r.text.includes('undefined'), 'literal "undefined" leaked into output');
  assert.ok(!r.text.includes('null'), 'literal "null" leaked into output');
}

// --- 9. filename
assert.equal(atsTextFilename(resume), 'alex-morgan-ats-plain-text.txt');
assert.equal(atsTextFilename({}), 'resume-ats-plain-text.txt');
assert.equal(
  atsTextFilename({ personalInfo: { fullName: '  Ñoño  Jr. ' } }),
  'o-o-jr-ats-plain-text.txt',
  'filename slug should strip non-ascii and collapse separators'
);

console.log('atsTextView: all checks passed');
console.log(`  ${out.sections.length} sections, ${out.words} words, ${out.chars} chars`);
