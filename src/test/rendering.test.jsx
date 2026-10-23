import { describe, it, expect, vi, afterEach } from 'vitest';
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

import { fullResume, emptyResume, DEFAULT_THEME } from './fixtures.js';

/**
 * Cross-cutting render safety that is not per-template behaviour:
 * XSS containment, React key warnings, act() warnings, and the "silently
 * returns null" failure mode.
 *
 * These are grouped here rather than duplicated nine times because they assert
 * a property of the framework boundary, not of any one layout.
 */

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

/** Collect console.error calls for the duration of a callback. */
function captureConsoleErrors(fn) {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    fn();
  } finally {
    // Read before restore so the spy is still populated.
    const calls = spy.mock.calls.map((args) => args.map(String).join(' '));
    spy.mockRestore();
    return calls;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('HTML injection containment', () => {
  const INJECTION_PAYLOADS = [
    '<script>alert(1)</script>',
    '<img src=x onerror="window.__pwned=1">',
    '<svg onload="window.__pwned=1">',
    '"><iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">click</a>',
  ];

  it.each(TEMPLATES)('%s escapes script payloads instead of executing them', (id, Template) => {
    for (const payload of INJECTION_PAYLOADS) {
      const data = fullResume();
      data.personalInfo.fullName = payload;
      data.personalInfo.title = payload;
      data.summary = payload;
      data.experience[0].role = payload;
      data.experience[0].highlights = [payload];
      data.customSections[0].items = [payload];

      const { container, unmount } = render(<Template data={data} theme={DEFAULT_THEME} />);

      // No injected element may exist in the DOM.
      expect(container.querySelectorAll('script'), `${id} injected <script>`).toHaveLength(0);
      expect(container.querySelectorAll('iframe'), `${id} injected <iframe>`).toHaveLength(0);
      expect(container.querySelectorAll('svg[onload]'), `${id} injected svg onload`).toHaveLength(0);
      expect(
        container.querySelectorAll('img[onerror]'),
        `${id} injected img onerror`
      ).toHaveLength(0);

      // No javascript: URL survived into an href.
      for (const anchor of container.querySelectorAll('a')) {
        expect(anchor.getAttribute('href') || '').not.toMatch(/^javascript:/i);
      }

      // The payload is present as inert text, which proves it was escaped.
      expect(container.textContent).toContain(payload);

      // Nothing executed.
      expect(globalThis.__pwned).toBeUndefined();

      unmount();
    }
  });

  it('renders the injection fixture from fixtures.js safely on every template', () => {
    // fixtures.js already ships an 'html injection' hostile case; assert the
    // framework boundary on it directly so the fixture cannot silently regress.
    const data = {
      personalInfo: { fullName: '<script>alert(1)</script>', title: '<img onerror=x>' },
      summary: '<svg onload=alert(1)>',
      experience: [{ role: '<b>bold</b>', highlights: ['<script>bad()</script>'] }],
    };

    for (const [id, Template] of TEMPLATES) {
      const { container, unmount } = render(<Template data={data} theme={DEFAULT_THEME} />);
      expect(container.querySelectorAll('script'), `${id}`).toHaveLength(0);
      expect(container.querySelectorAll('img'), `${id} injected an img`).toHaveLength(0);
      unmount();
    }
  });
});

describe('React key warnings', () => {
  it.each(TEMPLATES)('%s logs no duplicate-key warning', (id, Template) => {
    const errors = captureConsoleErrors(() => {
      render(<Template data={fullResume()} theme={DEFAULT_THEME} />);
    });

    const keyWarnings = errors.filter((msg) => /unique "?key"?|duplicate key/i.test(msg));
    expect(keyWarnings, `${id} logged key warnings:\n${keyWarnings.join('\n')}`).toEqual([]);
  });

  it.each(TEMPLATES)('%s logs no duplicate-key warning with hostile-shaped arrays', (id, Template) => {
    // Entries without an id force every template onto its index fallback, which
    // is exactly where a missing `key` or a duplicate key shows up.
    const data = {
      personalInfo: { fullName: 'No Ids' },
      skills: [{ category: 'A', items: 'x' }, { category: 'A', items: 'x' }],
      experience: [{ role: 'R', highlights: ['a'] }, { role: 'R', highlights: ['a'] }],
      education: [{ school: 'S' }, { school: 'S' }],
      languages: [{ name: 'L' }, { name: 'L' }],
      certifications: [{ name: 'C' }, { name: 'C' }],
      projects: [{ name: 'P' }, { name: 'P' }],
      customSections: [{ title: 'T', items: ['i'] }, { title: 'T', items: ['i'] }],
    };

    const errors = captureConsoleErrors(() => {
      render(<Template data={data} theme={DEFAULT_THEME} />);
    });

    const keyWarnings = errors.filter((msg) => /unique "?key"?|duplicate key/i.test(msg));
    expect(keyWarnings, `${id} logged key warnings:\n${keyWarnings.join('\n')}`).toEqual([]);
  });
});

describe('act() warnings', () => {
  it.each(TEMPLATES)('%s renders without an "not wrapped in act" warning', (id, Template) => {
    const errors = captureConsoleErrors(() => {
      render(<Template data={fullResume()} theme={DEFAULT_THEME} />);
    });

    const actWarnings = errors.filter((msg) => /not wrapped in act/i.test(msg));
    expect(actWarnings, `${id} logged act warnings:\n${actWarnings.join('\n')}`).toEqual([]);
  });

  it.each(TEMPLATES)('%s re-renders without an act warning when data changes', (id, Template) => {
    const errors = captureConsoleErrors(() => {
      const { rerender } = render(<Template data={fullResume()} theme={DEFAULT_THEME} />);
      rerender(<Template data={emptyResume()} theme={DEFAULT_THEME} />);
      rerender(<Template data={fullResume()} theme={{ ...DEFAULT_THEME, singlePage: false }} />);
    });

    const actWarnings = errors.filter((msg) => /not wrapped in act/i.test(msg));
    expect(actWarnings, `${id} logged act warnings:\n${actWarnings.join('\n')}`).toEqual([]);
  });
});

describe('non-empty output', () => {
  it.each(TEMPLATES)('%s produces a non-empty container', (id, Template) => {
    const { container } = render(<Template data={fullResume()} theme={DEFAULT_THEME} />);
    expect(container.firstElementChild, `${id} returned null`).not.toBeNull();
    expect(container.innerHTML.trim().length, `${id} rendered nothing`).toBeGreaterThan(0);
  });

  it.each(TEMPLATES)('%s produces a non-empty container with empty data', (id, Template) => {
    const { container } = render(<Template data={emptyResume()} theme={DEFAULT_THEME} />);
    expect(container.firstElementChild, `${id} returned null on empty data`).not.toBeNull();
    expect(container.innerHTML.trim().length, `${id} rendered nothing`).toBeGreaterThan(0);
  });

  it.each(TEMPLATES)('%s renders a single root element', (id, Template) => {
    // Two roots would break the print wrapper's sizing assumptions.
    const { container } = render(<Template data={fullResume()} theme={DEFAULT_THEME} />);
    expect(container.children.length, `${id} rendered multiple roots`).toBe(1);
  });
});

/**
 * Templates whose fontFamily handling is conditional or absent.
 *
 * Empty: executive/NordicTemplate.jsx used to accept only a family containing
 * "Merriweather" and hardcode 'Playfair Display' otherwise, so every other
 * choice in the theme customiser silently did nothing. It now honours whatever
 * family the theme sets. Kept as a Set so a future template can be recorded
 * here honestly rather than silently blessed.
 */
const IGNORES_THEME_FONT = new Set();

describe('theme is actually applied', () => {
  for (const [id, Template] of TEMPLATES) {
    const knownBroken = IGNORES_THEME_FONT.has(id);
    const runner = knownBroken ? it.fails : it;
    const prefix = knownBroken ? '[known bug] ' : '';

    runner(`${prefix}${id} applies theme.fontFamily somewhere`, () => {
      const theme = { ...DEFAULT_THEME, fontFamily: 'Comic Sans MS' };
      const { container } = render(<Template data={fullResume()} theme={theme} />);
      expect(container.innerHTML, `${id} ignored theme.fontFamily`).toContain('Comic Sans MS');
    });
  }
});
