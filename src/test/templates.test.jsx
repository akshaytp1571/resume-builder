import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import DefaultTemplate from '../components/templates/DefaultTemplate.jsx';
import ModernTemplate from '../components/templates/ModernTemplate.jsx';
import MinimalTemplate from '../components/templates/MinimalTemplate.jsx';
import CreativeTemplate from '../components/templates/CreativeTemplate.jsx';
import NordicTemplate from '../components/templates/NordicTemplate.jsx';
import CompactTemplate from '../components/templates/CompactTemplate.jsx';
import TechTemplate from '../components/templates/TechTemplate.jsx';
import AcademicTemplate from '../components/templates/AcademicTemplate.jsx';
import StartupTemplate from '../components/templates/StartupTemplate.jsx';

import {
  fullResume,
  emptyResume,
  hostileResumes,
  hostileThemes,
  DEFAULT_THEME,
} from './fixtures.js';

/**
 * Component tests for every resume template.
 *
 * This is the first suite in the project that mounts a real component. The
 * other two (test-fixes.cjs greps source text, test-integrity.mjs imports plain
 * modules) cannot catch a render crash, and every P0 in the QA audit was one.
 *
 * Everything is table-driven: 9 templates x 14 hostile inputs is 126 cases, and
 * hand-writing them would rot the moment a template is added. Adding a template
 * to TEMPLATES below (or a case to fixtures.js) automatically covers it.
 */

/** [id, Component] — order matches TEMPLATES_CONFIG. */
const TEMPLATES = [
  ['classic', DefaultTemplate],
  ['modern', ModernTemplate],
  ['minimal', MinimalTemplate],
  ['creative', CreativeTemplate],
  ['executive', NordicTemplate],
  ['compact', CompactTemplate],
  ['tech', TechTemplate],
  ['academic', AcademicTemplate],
  ['startup', StartupTemplate],
];

const TEMPLATE_IDS = TEMPLATES.map(([id]) => id);

/**
 * KNOWN_CRASHES — a debt ledger, not an excuse.
 *
 * These combinations crash TODAY. They are asserted with `it.fails`, which
 * passes only while the render genuinely throws. That means:
 *
 *   - the suite stays green, so CI is useful immediately;
 *   - the moment somebody fixes a template, `it.fails` turns RED and forces the
 *     entry to be deleted, so the ledger cannot rot into a permanent excuse.
 *
 * Reported to the Lead with repro steps; templates are not mine to fix.
 */
const KNOWN_CRASHES = {
  // Empty: all 9 templates now destructure through `safeResume()` in
  // src/components/templates/templateData.js, which tolerates null data, null
  // holes in arrays, and wrong-typed fields. The ledger is kept (rather than
  // deleted) so the mechanism stays available if a future template regresses.
};

/**
 * Templates that deliberately render no photo.
 *
 * Empty: `minimal` used to be listed here, but a resume template that silently
 * drops the user's photo is a bug, not a design choice — it now renders one
 * when `showPhoto` is set, the same as the other eight.
 */
const NO_PHOTO_BY_DESIGN = new Set();

/**
 * Templates that ignore theme.primaryColor/secondaryColor.
 *
 * Empty: `minimal` and `executive` both painted from a hardcoded palette, so
 * colour customisation silently did nothing for them. Both now honour the
 * theme. Kept as a Set so a future template can be recorded here honestly
 * rather than silently blessed.
 */
const IGNORES_THEME_COLOURS = new Set();

/** Text a component emitted, whitespace-collapsed for stable matching. */
const textOf = (container) => container.textContent.replace(/\s+/g, ' ');

/** Strings React should never leak into the DOM. */
const LEAK_MARKERS = ['undefined', 'NaN', '[object Object]'];

const expectNoLeaks = (container, label) => {
  const text = textOf(container);
  for (const marker of LEAK_MARKERS) {
    expect(text, `${label} leaked "${marker}"`).not.toContain(marker);
  }
};

/** jsdom serialises inline colours to rgb(), so accept either form. */
const colourForms = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [hex];
  const n = parseInt(m[1], 16);
  return [hex, `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`];
};

describe('template registry', () => {
  it('covers all nine shipped templates', () => {
    expect(TEMPLATE_IDS).toEqual([
      'classic',
      'modern',
      'minimal',
      'creative',
      'executive',
      'compact',
      'tech',
      'academic',
      'startup',
    ]);
  });

  it('exports a component for every template', () => {
    for (const [id, Component] of TEMPLATES) {
      expect(typeof Component, `${id} is not a component`).toBe('function');
    }
  });

  it('has no stale ledger entries for templates that no longer exist', () => {
    for (const id of Object.keys(KNOWN_CRASHES)) {
      expect(TEMPLATE_IDS, `ledger references unknown template "${id}"`).toContain(id);
    }
  });

  it('every ledger entry names a label that exists in the hostile matrix', () => {
    const labels = new Set(hostileResumes().map(([label]) => label));
    for (const [id, entries] of Object.entries(KNOWN_CRASHES)) {
      expect(Array.isArray(entries), `${id} ledger entry is not an array`).toBe(true);
      for (const label of entries) {
        expect(labels, `${id} references unknown case "${label}"`).toContain(label);
      }
    }
  });
});

describe.each(TEMPLATES)('%s template', (templateId, Template) => {
  describe('happy path', () => {
    it('renders with full resume data and the default theme without throwing', () => {
      const { container } = render(<Template data={fullResume()} theme={DEFAULT_THEME} />);
      expect(container).toBeTruthy();
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders the person name, title and an experience entry', () => {
      const data = fullResume();
      const { container } = render(<Template data={data} theme={DEFAULT_THEME} />);
      const text = textOf(container);

      expect(text).toContain(data.personalInfo.fullName);
      expect(text).toContain(data.personalInfo.title);
      // The first experience entry: role is the stable, template-independent bit.
      expect(text).toContain(data.experience[0].role);
    });

    it('renders certifications when present', () => {
      const data = fullResume();
      const { container } = render(<Template data={data} theme={DEFAULT_THEME} />);
      const text = textOf(container);

      expect(data.certifications.length).toBeGreaterThan(0);
      for (const cert of data.certifications) {
        expect(text, `${templateId} dropped certification "${cert.name}"`).toContain(cert.name);
      }
    });

    it('renders projects when present', () => {
      const data = fullResume();
      const { container } = render(<Template data={data} theme={DEFAULT_THEME} />);
      const text = textOf(container);

      expect(data.projects.length).toBeGreaterThan(0);
      for (const project of data.projects) {
        expect(text, `${templateId} dropped project "${project.name}"`).toContain(project.name);
      }
    });

    it('renders custom sections when present', () => {
      const data = fullResume();
      const { container } = render(<Template data={data} theme={DEFAULT_THEME} />);
      // Section headings are uppercased by several templates, so compare
      // case-insensitively rather than pinning each template's casing.
      const text = textOf(container).toLowerCase();

      expect(data.customSections.length).toBeGreaterThan(0);
      for (const section of data.customSections) {
        expect(text, `${templateId} dropped section "${section.title}"`).toContain(
          section.title.toLowerCase()
        );
        for (const item of section.items) {
          expect(text, `${templateId} dropped custom item`).toContain(item.toLowerCase());
        }
      }
    });

    it('renders languages, education and skills', () => {
      const data = fullResume();
      const { container } = render(<Template data={data} theme={DEFAULT_THEME} />);
      const text = textOf(container);

      expect(text).toContain(data.languages[0].name);
      expect(text).toContain(data.education[0].school);
      expect(text).toContain(data.skills[0].category);
    });

    it('renders the photo when personalInfo.showPhoto is set', () => {
      const data = fullResume();
      data.personalInfo.showPhoto = true;
      const { container } = render(<Template data={data} theme={DEFAULT_THEME} />);

      if (NO_PHOTO_BY_DESIGN.has(templateId)) {
        // Documented exception, see NO_PHOTO_BY_DESIGN.
        expect(container.querySelector('img')).toBeNull();
        return;
      }

      const img = container.querySelector('img');
      expect(img, `${templateId} rendered no photo`).not.toBeNull();
      expect(img.getAttribute('src')).toBe(data.personalInfo.photo);
    });

    it('omits the photo when personalInfo.showPhoto is false', () => {
      const data = fullResume();
      data.personalInfo.showPhoto = false;
      const { container } = render(<Template data={data} theme={DEFAULT_THEME} />);
      expect(container.querySelector('img')).toBeNull();
    });

    it('renders an empty resume without throwing or leaking placeholder junk', () => {
      const { container } = render(<Template data={emptyResume()} theme={DEFAULT_THEME} />);
      expect(container.innerHTML.length).toBeGreaterThan(0);
      expectNoLeaks(container, `${templateId} / empty resume`);
    });

    it('does not leak undefined, NaN or [object Object] with full data', () => {
      const { container } = render(<Template data={fullResume()} theme={DEFAULT_THEME} />);
      expectNoLeaks(container, `${templateId} / full resume`);
    });
  });

  describe('hostile data', () => {
    for (const [label, data] of hostileResumes()) {
      // An absent entry means "this template handles it". The ledger only ever
      // lists known-broken combinations, so the lookup must tolerate a missing
      // template id rather than assume one.
      const knownBroken = (KNOWN_CRASHES[templateId] || []).includes(label);
      // it.fails passes while the render throws and fails once it stops
      // throwing, so a fix cannot leave a stale ledger entry behind.
      const runner = knownBroken ? it.fails : it;
      const prefix = knownBroken ? '[known crash] ' : '';

      runner(`${prefix}survives ${label}`, () => {
        const { container } = render(<Template data={data} theme={DEFAULT_THEME} />);
        expect(container).toBeTruthy();
        expectNoLeaks(container, `${templateId} / ${label}`);
      });
    }
  });

  describe('hostile theme', () => {
    it.each(hostileThemes())('survives %s', (label, theme) => {
      const { container } = render(<Template data={fullResume()} theme={theme} />);
      expect(container).toBeTruthy();
      expect(container.innerHTML.length).toBeGreaterThan(0);
    });

    it.each(hostileThemes())('survives %s with empty data', (label, theme) => {
      const { container } = render(<Template data={emptyResume()} theme={theme} />);
      expect(container).toBeTruthy();
    });
  });

  describe('density switches', () => {
    it.each([
      ['single page', { ...DEFAULT_THEME, singlePage: true }],
      ['multi page', { ...DEFAULT_THEME, singlePage: false }],
      ['compact font', { ...DEFAULT_THEME, fontSize: 'compact' }],
      ['relaxed font', { ...DEFAULT_THEME, fontSize: 'relaxed' }],
    ])('renders in %s mode', (label, theme) => {
      const { container } = render(<Template data={fullResume()} theme={theme} />);
      expect(container.innerHTML.length).toBeGreaterThan(0);
      expectNoLeaks(container, `${templateId} / ${label}`);
    });

    const colourTest = IGNORES_THEME_COLOURS.has(templateId) ? it.fails : it;
    colourTest(
      `${IGNORES_THEME_COLOURS.has(templateId) ? '[known bug] ' : ''}honours theme.primaryColor on a rendered element`,
      () => {
        const theme = { ...DEFAULT_THEME, primaryColor: '#ff00aa', secondaryColor: '#00ffaa' };
        const { container } = render(<Template data={fullResume()} theme={theme} />);
        const html = container.innerHTML;
        const [hex, rgb] = colourForms('#ff00aa');
        expect(html.includes(hex) || html.includes(rgb), `${templateId} ignored primaryColor`).toBe(
          true
        );
      }
    );
  });
});
