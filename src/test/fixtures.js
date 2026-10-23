import { render } from '@testing-library/react';
import { INITIAL_RESUME_DATA, DEFAULT_THEME } from '../data/initialData.js';

/**
 * Shared fixtures and render helpers for the component suite.
 *
 * The hostile-data matrix here is the important part: every P0 the QA audit
 * found was reachable by feeding a template or modal data that passed
 * `Array.isArray` but had the wrong shape inside. Components must survive all
 * of these, so tests assert against the matrix rather than one happy path.
 */

export { INITIAL_RESUME_DATA, DEFAULT_THEME };

/** A complete, realistic resume for the happy path. */
export const fullResume = () => JSON.parse(JSON.stringify(INITIAL_RESUME_DATA));

/** A resume with every optional section empty. */
export const emptyResume = () => ({
  personalInfo: { fullName: '', title: '', email: '', phone: '', location: '' },
  summary: '',
  skills: [],
  experience: [],
  education: [],
  languages: [],
  certifications: [],
  projects: [],
  customSections: [],
});

/**
 * Data shapes that previously crashed rendering or scoring.
 * Each entry is [label, data]. Components must render all of them.
 */
export const hostileResumes = () => [
  ['null data', null],
  ['undefined data', undefined],
  ['empty object', {}],
  ['array instead of object', []],
  ['string instead of object', 'a resume'],
  ['null sections', {
    personalInfo: null,
    summary: null,
    skills: null,
    experience: null,
    education: null,
    languages: null,
    certifications: null,
    projects: null,
    customSections: null,
  }],
  ['null holes in arrays', {
    personalInfo: { fullName: 'Test' },
    skills: [null, undefined, 42],
    experience: [null],
    education: [null],
    languages: [null],
    certifications: [null],
    projects: [null],
    customSections: [null],
  }],
  ['wrong types inside items', {
    personalInfo: { fullName: { first: 'Jane' }, email: 5 },
    summary: { text: 'hello' },
    skills: [{ items: 5, category: null }],
    experience: [{ role: 'Dev', highlights: 'one string' }],
    education: [{ degree: 5 }],
    languages: [{ name: null }],
    certifications: [{}],
    projects: [{ highlights: {} }],
    customSections: [{ items: 'x' }],
  }],
  ['enormous strings', {
    personalInfo: { fullName: 'A'.repeat(500), title: 'B'.repeat(500) },
    summary: 'word '.repeat(2000),
    skills: Array.from({ length: 100 }, (_, i) => ({ category: `C${i}`, items: 'a, b, c' })),
  }],
  ['unicode and emoji', {
    personalInfo: { fullName: '日本語テスト 🚀', title: 'مطور' },
    summary: 'Résumé naïve café — 中文 العربية 🎯',
    skills: [{ category: '言語', items: 'Java, Python' }],
  }],
  ['html injection', {
    personalInfo: { fullName: '<script>alert(1)</script>', title: '<img onerror=x>' },
    summary: '<svg onload=alert(1)>',
    experience: [{ role: '<b>bold</b>', highlights: ['<script>bad()</script>'] }],
  }],
];

/** Theme shapes that previously crashed. */
export const hostileThemes = () => [
  ['null theme', null],
  ['empty theme', {}],
  ['missing colours', { templateId: 'classic' }],
  ['invalid colours', { templateId: 'classic', primaryColor: 'not-a-colour' }],
  ['unknown template', { templateId: 'does-not-exist' }],
  ['null fontFamily', { templateId: 'modern', fontFamily: null }],
];

/** Render a component and fail loudly if React logs a render error. */
export function renderStrict(ui) {
  return render(ui);
}
