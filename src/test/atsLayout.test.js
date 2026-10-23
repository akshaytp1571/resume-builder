import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { render, act } from '@testing-library/react';

import { calculateAtsScore } from '../utils/atsScorer.js';
import ResumePreview from '../components/preview/ResumePreview.jsx';
import { fullResume, emptyResume, DEFAULT_THEME } from './fixtures.js';

/**
 * Layout-aware ATS scoring.
 *
 * The contract under test is asymmetric on purpose: with ONE argument the
 * scorer must be bit-identical to the pre-layout version, because every caller
 * and test that predates this feature passes one argument. The layout second
 * argument is strictly opt-in, and an unusable measurement must degrade to the
 * legacy score rather than produce NaN.
 *
 * Rendered with createElement rather than JSX because this file is .js and the
 * project's transform only enables JSX in .jsx.
 */

const PAGE = 1123; // A4 at 96dpi, matching ResumePreview's budget constant

/** Build a layout argument from a page ratio, e.g. 1.0 or 2.0. */
const at = (ratio) => ({ pageHeightPx: Math.round(PAGE * ratio), pageBudgetPx: PAGE });

const layoutCategory = (result) =>
  result.breakdown.find((b) => /layout/i.test(b.category));

const maxesSum = (result) =>
  result.breakdown.reduce((sum, item) => sum + item.maxScore, 0);

describe('backwards compatibility: one argument is unchanged', () => {
  it('scores the sample resume exactly as the legacy scorer did', () => {
    // 90 is what v1.1/v2.0 produced for the shipped sample data. If this number
    // moves, every stored score and every existing assertion moves with it.
    expect(calculateAtsScore(fullResume()).score).toBe(90);
  });

  it('keeps the legacy six-category breakdown and no Layout category', () => {
    const result = calculateAtsScore(fullResume());
    expect(result.breakdown).toHaveLength(6);
    expect(layoutCategory(result)).toBeUndefined();
    expect(maxesSum(result)).toBe(100);
  });

  it('keeps the legacy category maximums', () => {
    const byName = Object.fromEntries(
      calculateAtsScore(fullResume()).breakdown.map((b) => [b.category, b.maxScore])
    );
    expect(byName).toEqual({
      'Contact & Header Info': 25,
      'Professional Summary': 15,
      'Skills & Keywords': 15,
      'Experience & Action Impact': 25,
      'Education & Credentials': 10,
      'Projects & Portfolio': 10,
    });
  });

  it('an explicit null layout is the same as no layout', () => {
    expect(calculateAtsScore(fullResume(), null).score).toBe(
      calculateAtsScore(fullResume()).score
    );
  });

  it('an empty resume still scores 4 with and without layout', () => {
    // Fitting an empty page must never be worth points — same class of false
    // positive as the substring action verbs.
    expect(calculateAtsScore(emptyResume()).score).toBe(4);
    expect(calculateAtsScore(emptyResume(), at(1)).score).toBe(4);
    expect(layoutCategory(calculateAtsScore(emptyResume(), at(1))).score).toBe(0);
  });
});

describe('layout awareness', () => {
  it('a one-page resume outscores a 200%-spill resume', () => {
    const data = fullResume();
    const onePage = calculateAtsScore(data, at(1));
    const spill = calculateAtsScore(data, at(2));

    expect(onePage.score).toBeGreaterThan(spill.score);
    expect(layoutCategory(onePage).score).toBeGreaterThan(layoutCategory(spill).score);
  });

  it('rewards a clean one-pager with the full Layout & Fit allocation', () => {
    const result = calculateAtsScore(fullResume(), at(1));
    const layout = layoutCategory(result);

    expect(layout).toBeDefined();
    expect(layout.score).toBe(layout.maxScore);
    expect(layout.status).toBe('good');
  });

  it('loses a little for a small spill and most of it for a large one', () => {
    const data = fullResume();
    const full = layoutCategory(calculateAtsScore(data, at(1))).score;
    const small = layoutCategory(calculateAtsScore(data, at(1.1))).score;
    const large = layoutCategory(calculateAtsScore(data, at(1.8))).score;

    expect(small).toBeLessThan(full);
    expect(large).toBeLessThan(small);
  });

  it('does not reward a thin resume that only fills 30% of the page', () => {
    const data = fullResume();
    const thin = calculateAtsScore(data, at(0.3));
    const filled = calculateAtsScore(data, at(0.95));

    expect(thin.score).toBeLessThan(filled.score);
    expect(layoutCategory(thin).status).toBe('warning');
  });

  it('flags a spill and a thin page with a suggestion, and stays quiet on a fit', () => {
    const data = fullResume();
    const mentions = (result, re) => result.suggestions.some((s) => re.test(s));

    expect(mentions(calculateAtsScore(data, at(1.4)), /spill|second page/i)).toBe(true);
    expect(mentions(calculateAtsScore(data, at(0.2)), /fill|empty/i)).toBe(true);
    expect(mentions(calculateAtsScore(data, at(0.9)), /spill|second page|fill/i)).toBe(false);
  });

  it('recomputes the total from the breakdown it returns', () => {
    // The score the modal shows and the category rows it renders must agree.
    for (const ratio of [0.2, 0.3, 0.5, 0.95, 1, 1.1, 1.3, 1.9, 3]) {
      const result = calculateAtsScore(fullResume(), at(ratio));
      const fromBreakdown = result.breakdown.reduce((sum, item) => sum + item.score, 0);
      expect(result.score, `ratio ${ratio}`).toBe(fromBreakdown);
    }
  });
});

describe('breakdown invariants', () => {
  it('maximums sum to exactly 100 with and without a layout', () => {
    const cases = [
      ['no layout', fullResume(), undefined],
      ['one page', fullResume(), at(1)],
      ['spill', fullResume(), at(2)],
      ['thin', fullResume(), at(0.1)],
      ['empty resume + layout', emptyResume(), at(1)],
      ['hostile data + layout', { skills: 'x', experience: [null] }, at(1)],
    ];
    for (const [label, data, layout] of cases) {
      expect(maxesSum(calculateAtsScore(data, layout)), label).toBe(100);
    }
  });

  it('every entry keeps the documented shape', () => {
    const result = calculateAtsScore(fullResume(), at(1));
    for (const item of result.breakdown) {
      expect(typeof item.category).toBe('string');
      expect(Number.isInteger(item.score)).toBe(true);
      expect(Number.isInteger(item.maxScore)).toBe(true);
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(item.maxScore);
      expect(['good', 'warning']).toContain(item.status);
    }
  });

  it('keeps the top-level return shape', () => {
    const result = calculateAtsScore(fullResume(), at(1));
    expect(Object.keys(result).sort()).toEqual(
      ['breakdown', 'rating', 'ratingColor', 'score', 'suggestions'].sort()
    );
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(typeof result.rating).toBe('string');
    expect(result.ratingColor).toMatch(/^text-/);
  });
});

describe('hostile layout values never produce NaN', () => {
  const hostileLayouts = [
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['null fields', { pageHeightPx: null, pageBudgetPx: null }],
    ['negative', { pageHeightPx: -1123, pageBudgetPx: PAGE }],
    ['negative budget', { pageHeightPx: 500, pageBudgetPx: -1 }],
    ['zero', { pageHeightPx: 0, pageBudgetPx: 0 }],
    ['Infinity', { pageHeightPx: Infinity, pageBudgetPx: PAGE }],
    ['-Infinity', { pageHeightPx: -Infinity, pageBudgetPx: PAGE }],
    ['NaN', { pageHeightPx: NaN, pageBudgetPx: PAGE }],
    ['strings', { pageHeightPx: '1123', pageBudgetPx: '1123' }],
    ['string layout', 'not a layout'],
    ['number layout', 42],
    ['array layout', []],
    ['missing budget', { pageHeightPx: 500 }],
    ['missing height', { pageBudgetPx: PAGE }],
  ];

  it.each(hostileLayouts)('survives %s', (label, layout) => {
    const result = calculateAtsScore(fullResume(), layout);

    expect(Number.isFinite(result.score), `${label}: score is ${result.score}`).toBe(true);
    expect(Number.isInteger(result.score), `${label}: score is not an integer`).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(maxesSum(result)).toBe(100);
    expect(result.breakdown.every((b) => Number.isInteger(b.score))).toBe(true);
  });

  it.each(hostileLayouts)('falls back to the legacy score for %s', (label, layout) => {
    // An unusable measurement is "not measured", not "score zero".
    expect(calculateAtsScore(fullResume(), layout).score, label).toBe(
      calculateAtsScore(fullResume()).score
    );
  });
});

/**
 * ResumePreview reports its measurement upward: once on mount, then debounced,
 * and only when the height actually changed. That last property is what stops
 * the score -> render -> measure -> score loop.
 */
describe('ResumePreview reports layout', () => {
  /** Give #resume-preview a controllable offsetHeight in jsdom. */
  function stubHeight(initial) {
    let height = initial;
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return this.id === 'resume-preview' ? height : 0;
      },
    });
    return {
      set(next) {
        height = next;
      },
      restore() {
        delete HTMLElement.prototype.offsetHeight;
      },
    };
  }

  const props = (onLayoutMeasured) => ({
    resumeData: fullResume(),
    theme: DEFAULT_THEME,
    onDownloadPdf: () => {},
    onDownloadDocx: () => {},
    ...(onLayoutMeasured ? { onLayoutMeasured } : {}),
  });

  /** Swap in a ResizeObserver we can fire by hand. */
  function captureObserver() {
    const real = globalThis.ResizeObserver;
    const box = {};
    globalThis.ResizeObserver = class {
      constructor(cb) {
        box.fire = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    return {
      fire: () => box.fire(),
      restore: () => {
        globalThis.ResizeObserver = real;
      },
    };
  }

  it('reports once on mount with the measured height and the A4 budget', () => {
    const heights = stubHeight(900);
    const onLayoutMeasured = vi.fn();
    try {
      render(h(ResumePreview, props(onLayoutMeasured)));
    } finally {
      heights.restore();
    }

    expect(onLayoutMeasured).toHaveBeenCalledTimes(1);
    expect(onLayoutMeasured).toHaveBeenCalledWith({
      pageHeightPx: 900,
      pageBudgetPx: 1123,
    });
  });

  it('renders without an onLayoutMeasured prop', () => {
    const heights = stubHeight(900);
    try {
      expect(() => render(h(ResumePreview, props()))).not.toThrow();
    } finally {
      heights.restore();
    }
  });

  it('debounces repeated ResizeObserver callbacks into one report', () => {
    vi.useFakeTimers();
    const heights = stubHeight(900);
    const observer = captureObserver();
    const onLayoutMeasured = vi.fn();

    try {
      render(h(ResumePreview, props(onLayoutMeasured)));
      // The mount report already happened; clear it to isolate the observer.
      onLayoutMeasured.mockClear();

      heights.set(1400);
      act(() => {
        observer.fire();
        observer.fire();
        observer.fire();
      });

      // Still inside the debounce window: nothing reported yet.
      expect(onLayoutMeasured).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onLayoutMeasured).toHaveBeenCalledTimes(1);
      expect(onLayoutMeasured).toHaveBeenCalledWith({
        pageHeightPx: 1400,
        pageBudgetPx: 1123,
      });
    } finally {
      observer.restore();
      heights.restore();
      vi.useRealTimers();
    }
  });

  it('does not re-report an unchanged height (loop guard)', () => {
    vi.useFakeTimers();
    const heights = stubHeight(900);
    const observer = captureObserver();
    const onLayoutMeasured = vi.fn();

    try {
      render(h(ResumePreview, props(onLayoutMeasured)));
      onLayoutMeasured.mockClear();

      // Same height as the mount measurement: a re-render must not re-report.
      act(() => {
        observer.fire();
        vi.advanceTimersByTime(300);
      });

      expect(onLayoutMeasured).not.toHaveBeenCalled();
    } finally {
      observer.restore();
      heights.restore();
      vi.useRealTimers();
    }
  });
});
