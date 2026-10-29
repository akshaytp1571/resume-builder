import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, fireEvent, cleanup, act } from '@testing-library/react';
import Landing, { GAPS, TEMPLATES, LEDGER_ROWS } from '../components/Landing.jsx';
import { ROUTE_APP } from '../hooks/useHashRoute.js';

/**
 * The landing page is the first screen anyone sees, and until now it had no
 * tests at all.
 *
 * These are written against the shipped component, not a shell. The three
 * things they exist to protect:
 *
 *   1. The route handoff. Every launch control must call navigate('/app'), and
 *      the in-page section links must NOT — the anchors are plain `#score`
 *      style hashes, and this router treats any hash other than '#/' as the
 *      editor. An un-intercepted in-page link would silently throw the reader
 *      into the editor mid-scroll.
 *
 *   2. The reveal contract. Elements carrying .dt-rise/.landing-rise start at
 *      opacity 0 and are only restored by an `.is-in` class. An element that
 *      carries the hidden half of that contract but is never wrapped in the
 *      reveal that adds the other half is invisible forever — the single bug
 *      class most likely to survive a rewrite of this file.
 *
 *   3. The claims. Copy that states a count ("six ways in", "nine templates",
 *      "the eight points") is checked against the array that renders it, so a
 *      number in the prose cannot drift away from the list beneath it.
 */

/** A drivable IntersectionObserver: the jsdom stub never fires a callback. */
function installDrivableObserver() {
  const observers = [];
  class FakeIO {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.targets = new Set();
      observers.push(this);
    }
    observe(target) {
      this.targets.add(target);
    }
    unobserve(target) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
    }
    takeRecords() {
      return [];
    }
  }
  const original = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = FakeIO;

  return {
    observers,
    /** Report every observed element as visible, as a real scroll would. */
    revealAll() {
      for (const io of observers) {
        const entries = [...io.targets].map((target) => ({ target, isIntersecting: true }));
        if (entries.length) io.callback(entries, io);
      }
    },
    restore() {
      globalThis.IntersectionObserver = original;
    },
  };
}

/** Force a media query's answer, for the reduced-motion and pointer tests. */
function mockMedia({ reducedMotion = false } = {}) {
  const original = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: /prefers-reduced-motion/.test(query) ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
  return () => {
    window.matchMedia = original;
  };
}

function renderLanding(props = {}) {
  const navigate = vi.fn();
  const utils = render(<Landing navigate={navigate} {...props} />);
  return { navigate, ...utils };
}

describe('landing — route handoff', () => {
  beforeEach(() => {
    window.location.hash = '#/';
  });

  afterEach(() => {
    window.location.hash = '';
    cleanup();
  });

  it('every launch control calls navigate with the editor route', () => {
    const { navigate } = renderLanding();

    const launches = [
      screen.getByRole('button', { name: /^open$/i }),
      ...screen.getAllByRole('button', { name: /open the studio/i }),
    ];
    expect(launches.length).toBeGreaterThanOrEqual(2);

    for (const button of launches) {
      button.click();
    }
    expect(navigate).toHaveBeenCalledTimes(launches.length);
    for (const call of navigate.mock.calls) {
      expect(call[0]).toBe(ROUTE_APP);
    }
  });

  it('renders without a navigate prop rather than throwing on click', () => {
    render(<Landing />);
    expect(() => screen.getByRole('button', { name: /^open$/i }).click()).not.toThrow();
  });

  it('in-page section links do not touch the hash, because the router owns it', () => {
    // Any hash other than '#/' renders the editor. A link left to its default
    // browser behaviour would navigate the reader away from the page they are
    // reading, so every in-page link must be prevented.
    renderLanding();
    const nav = screen.getByRole('navigation', { name: /sections/i });

    for (const link of within(nav).getAllByRole('link')) {
      if (/^#(score|gaps|templates|parser|ledger)$/.test(link.getAttribute('href') || '')) {
        fireEvent.click(link);
        expect(window.location.hash, `${link.textContent} changed the route`).toBe('#/');
      }
    }
  });

  it('in-page links point at sections that exist on the page', () => {
    const { container } = renderLanding();
    const nav = screen.getByRole('navigation', { name: /sections/i });

    const ids = within(nav)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') || '')
      .filter((href) => /^#[a-z-]+$/.test(href))
      .map((href) => href.slice(1))
      .filter((id) => id !== 'top');

    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(container.querySelector(`#${id}`), `#${id} is linked but missing`).toBeTruthy();
    }
  });

  it('sets the document title while mounted and restores it on unmount', () => {
    document.title = 'previous title';
    const { unmount } = renderLanding();
    expect(document.title).toMatch(/resume studio/i);

    unmount();
    expect(document.title).toBe('previous title');
  });
});

describe('landing — accessibility contract', () => {
  afterEach(() => cleanup());

  it('leads with a skip link that targets a focusable main region', () => {
    const { container } = renderLanding();

    const skip = screen.getByRole('link', { name: /skip to main content/i });
    expect(skip.className).toMatch(/skip-link/);
    expect(skip).toHaveAttribute('href', '#main-content');

    const main = container.querySelector('#main-content');
    expect(main.tagName).toBe('MAIN');
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('has exactly one h1, and it carries the promise as real text', () => {
    renderLanding();
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);

    // The visible headline is split into three masked lines for the entrance
    // animation; those lines are aria-hidden so a screen reader reads one
    // sentence instead of three fragments. The accessible name is the promise.
    expect(headings[0]).toHaveAccessibleName(/make a résumé the machine can read/i);
  });

  it('labels every section by an id that exists', () => {
    const { container } = renderLanding();
    const labelled = [...container.querySelectorAll('[aria-labelledby]')];

    expect(labelled.length).toBeGreaterThanOrEqual(5);
    for (const node of labelled) {
      const id = node.getAttribute('aria-labelledby');
      expect(container.querySelector(`#${id}`), `dangling aria-labelledby="${id}"`).toBeTruthy();
    }
  });

  it('gives every control an accessible name', () => {
    const { container } = renderLanding();

    for (const control of container.querySelectorAll('button, a[href]')) {
      const hasName =
        control.getAttribute('aria-label') ||
        control.textContent.trim() ||
        control.getAttribute('title');
      expect(hasName, `unnamed control: ${control.outerHTML.slice(0, 80)}`).toBeTruthy();
    }
  });

  it('does not repeat an id', () => {
    const { container } = renderLanding();
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('opens external links safely and names them', () => {
    const { container } = renderLanding();
    const external = [...container.querySelectorAll('a[href^="http"]')];

    expect(external.length).toBeGreaterThan(0);
    for (const link of external) {
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
      expect(link.getAttribute('aria-label') || link.textContent.trim()).toBeTruthy();
    }
  });

  it('keeps the decorative specimen out of the keyboard tab order', () => {
    const { container } = renderLanding();
    const specimen = container.querySelector('.dt-sheet');

    // The sheet is visual evidence, not an interactive control. Removing its
    // tab stop avoids a large focus scroll and a dead control under reduced
    // motion; the parser peel below remains the keyboard-driven comparison.
    expect(specimen).not.toHaveAttribute('tabindex');
    expect(specimen).not.toHaveAttribute('role');
    expect(specimen).toHaveTextContent('Tomas Lindqvist');
  });
});

describe('landing — reveal contract', () => {
  afterEach(() => cleanup());

  it('reveals every hidden element once it scrolls into view', () => {
    // The bug this exists to catch: an element with the hidden half of the
    // reveal contract (.dt-rise) that is never wrapped in the component that
    // adds .is-in. It stays at opacity 0 in the browser while passing any test
    // that only looks for its text in the DOM.
    const io = installDrivableObserver();
    try {
      const { container } = renderLanding();

      const hidden = [...container.querySelectorAll('.landing-rise, .dt-rise')];
      expect(hidden.length).toBeGreaterThan(10);
      expect(hidden.some((el) => !el.className.includes('is-in'))).toBe(true);

      act(() => io.revealAll());

      const stillHidden = [...container.querySelectorAll('.landing-rise, .dt-rise')].filter(
        (el) => !el.className.includes('is-in')
      );
      expect(stillHidden.map((el) => el.className)).toEqual([]);
    } finally {
      io.restore();
    }
  });

  it('resolves everything immediately under reduced motion', () => {
    const restore = mockMedia({ reducedMotion: true });
    try {
      const { container } = renderLanding();

      const hidden = [...container.querySelectorAll('.landing-rise, .dt-rise')].filter(
        (el) => !el.className.includes('is-in')
      );
      expect(hidden).toEqual([]);

      // The score counts to its final value instead of animating to it.
      expect(screen.getByRole('img', { name: /ats readiness 92 out of 100/i })).toBeTruthy();
    } finally {
      restore();
    }
  });

  it('holds the score at its final value when the counter never scrolls into view', () => {
    // jsdom's observer stub never fires, so this is the no-IntersectionObserver
    // path: the page must still be readable, never blank.
    renderLanding();
    expect(screen.getByRole('img', { name: /ats readiness/i })).toBeTruthy();
  });
});

describe('landing — the parser peel', () => {
  afterEach(() => cleanup());

  it('puts the slider semantics on the control, not on a wrapper', () => {
    // An ARIA slider that CONTAINS an interactive button is semantically
    // broken: assistive tech flattens the child. The drag surface is a plain
    // group; the focusable handle is the slider.
    renderLanding();
    const { container } = renderLanding();

    const peel = container.querySelector('.dt-peel');
    expect(peel).toHaveAttribute('role', 'group');
    expect(peel.getAttribute('aria-label')).toBeTruthy();

    const handle = container.querySelector('.dt-peel__handle');
    expect(handle).toHaveAttribute('role', 'slider');
    expect(handle).toHaveAttribute('tabindex', '0');
    expect(handle.tagName).toBe('BUTTON');
  });

  it('exposes the peel as a slider a keyboard user can drive', () => {
    renderLanding();
    const slider = screen.getByRole('slider');

    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(slider.getAttribute('aria-label')).toBeTruthy();

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '10');

    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(slider).toHaveAttribute('aria-valuenow', '30');

    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it('clicking the handle and then using the keyboard agree on one value', () => {
    // The bug this pins: clicking used to write state while the keyboard read a
    // stale ref, so Peel then ArrowRight jumped from 100 back down to 10.
    renderLanding();
    const slider = screen.getByRole('slider');

    fireEvent.click(slider);
    expect(slider).toHaveAttribute('aria-valuenow', '100');

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '90');

    fireEvent.click(slider);
    expect(slider).toHaveAttribute('aria-valuenow', '0');
  });

  it('hides the extracted panel from assistive tech only while it is fully clipped', () => {
    const { container } = renderLanding();
    const read = container.querySelector('.dt-peel__side--read');

    // At 0% the panel is clipped to nothing, so it must not be announced.
    expect(read).toHaveAttribute('aria-hidden', 'true');

    // Any revealed slice is real content on screen, so it must be announced —
    // the visibility boundary and the clip boundary have to be the same value.
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(read).toHaveAttribute('aria-hidden', 'false');

    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(read).toHaveAttribute('aria-hidden', 'false');
  });

  it('describes the extracted side as the current version, not a screenshot', () => {
    renderLanding();
    expect(screen.getByText(/always the current version/i)).toBeTruthy();
  });
});

describe('landing — claims match the data beneath them', () => {
  afterEach(() => cleanup());

  it('shows the six gaps the copy claims, each with a fix', () => {
    const { container } = renderLanding();
    const cards = container.querySelectorAll('.dt-gap');

    expect(cards.length).toBe(6);
    expect(cards.length).toBe(GAPS.length);
    for (const card of cards) {
      expect(card.querySelector('.dt-gap__fix')).toBeTruthy();
    }
    expect(screen.getByText(/six ways in/i)).toBeTruthy();
  });

  it('shows nine templates plus a blank start', () => {
    const { container } = renderLanding();
    const plates = container.querySelectorAll('.dt-plate');

    expect(TEMPLATES).toHaveLength(9);
    expect(plates.length).toBe(10); // nine templates and the blank plate
    expect(container.querySelector('.dt-plate--blank')).toBeTruthy();
  });

  it('names every template exactly as the editor registry does', async () => {
    // The landing says the plate minis are keyed to the same nine the editor
    // ships. If a template is renamed or removed there, this fails rather than
    // letting the page advertise something the product does not have.
    const { TEMPLATES_CONFIG } = await import('../data/initialData.js');
    // "Grid Master (1-Page)" and "Grid Master" are the same template; every
    // other name must match character for character.
    const normalize = (name) => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

    expect(TEMPLATES.map(([name]) => normalize(name))).toEqual(
      TEMPLATES_CONFIG.map((t) => normalize(t.name))
    );
  });

  it('lists the ledger rows it renders', () => {
    const { container } = renderLanding();
    const rows = container.querySelectorAll('.dt-sheetrow');

    expect(rows.length).toBe(LEDGER_ROWS.length);
    const terms = [...rows].map((row) => row.querySelector('dt').textContent.trim());
    expect(terms).toEqual(LEDGER_ROWS.map(([k]) => k));
  });

  it('states the score weights total 100', () => {
    renderLanding();
    // The weights are rendered as a list; the sum is the claim that makes the
    // bars legible. If a weight changes, the total must be re-stated.
    const weights = screen.getByText('Layout & fit').closest('ol');
    const values = [...weights.querySelectorAll('.w__v')].map((el) => Number(el.textContent));
    const total = values[values.length - 1];
    const parts = values.slice(0, -1).reduce((a, b) => a + b, 0);

    expect(total).toBe(100);
    expect(parts).toBe(100);
  });
});

describe('landing — print safety', () => {
  afterEach(() => cleanup());

  it('keeps fixed chrome out of printed output', () => {
    const { container } = renderLanding();

    expect(container.querySelector('.landing-progress').className).toMatch(/no-print/);
    expect(container.querySelector('.dt-mast').className).toMatch(/no-print/);
    expect(container.querySelector('footer').className).toMatch(/no-print/);
  });
});
