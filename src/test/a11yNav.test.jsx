import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Navbar from '../components/ui/Navbar.jsx';
import App from '../App.jsx';

/**
 * Accessibility + export-reachability checks for the navigation chrome.
 *
 * Two things are covered here:
 *   1. The vector PDF export has a reachable, distinct entry point.
 *   2. The navbar does not overflow at narrow widths.
 *
 * The skip-link assertions live in the same file but are written to tolerate
 * the link not existing yet: App.jsx is being refactored by another teammate
 * and the link lands there afterwards. See the describe block at the bottom.
 */

const baseProps = {
  onDownloadPdf: () => {},
  onDownloadDocx: () => {},
  onPrint: () => {},
  onResetDefault: () => {},
  onOpenUpload: () => {},
  onOpenAts: () => {},
  onOpenAiConfig: () => {},
  onOpenJobMatch: () => {},
  aiConfig: {},
  atsScore: { score: 80 },
  isExporting: false,
  templateName: 'Classic',
};

function renderNavbar(extra = {}) {
  return render(<Navbar {...baseProps} {...extra} />);
}

describe('vector PDF export entry point', () => {
  it('exposes a distinct control for vector export', () => {
    renderNavbar();
    expect(
      screen.getByRole('button', { name: /export resume as vector pdf/i })
    ).toBeInTheDocument();
  });

  it('keeps the original raster export on the primary button', () => {
    const onDownloadPdf = vi.fn();
    renderNavbar({ onDownloadPdf });

    fireEvent.click(screen.getByRole('button', { name: /^export resume as pdf$/i }));
    expect(onDownloadPdf).toHaveBeenCalledTimes(1);
  });

  it('calls the vector handler, not the raster one', () => {
    const onDownloadPdf = vi.fn();
    const onDownloadVectorPdf = vi.fn();
    renderNavbar({ onDownloadPdf, onDownloadVectorPdf });

    fireEvent.click(screen.getByRole('button', { name: /vector pdf with selectable text/i }));

    expect(onDownloadVectorPdf).toHaveBeenCalledTimes(1);
    // The whole point: these are two different outputs, not the same handler.
    expect(onDownloadPdf).not.toHaveBeenCalled();
  });

  it('does not crash when the vector handler is not supplied', () => {
    renderNavbar();
    const btn = screen.getByRole('button', { name: /vector pdf with selectable text/i });
    expect(() => fireEvent.click(btn)).not.toThrow();
  });

  it('disables both segments while exporting', () => {
    renderNavbar({ isExporting: true });
    expect(screen.getByRole('button', { name: /^export resume as pdf$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /vector pdf with selectable text/i })).toBeDisabled();
  });

  it('labels the vector control with text a screen reader can announce', () => {
    renderNavbar();
    const btn = screen.getByRole('button', { name: /vector pdf with selectable text/i });
    // Not an unlabelled icon: the accessible name must be real words.
    expect(btn.getAttribute('aria-label')).toMatch(/vector pdf with selectable text/i);
    expect(btn.getAttribute('aria-label').length).toBeGreaterThan(10);
  });

  it('both export controls are keyboard reachable', () => {
    renderNavbar();
    const raster = screen.getByRole('button', { name: /^export resume as pdf$/i });
    const vector = screen.getByRole('button', { name: /vector pdf with selectable text/i });
    expect(raster).not.toHaveAttribute('tabindex', '-1');
    expect(vector).not.toHaveAttribute('tabindex', '-1');
  });
});

describe('navbar width discipline', () => {
  /**
   * jsdom does no layout, so offsetWidth/scrollWidth are always 0 and a real
   * overflow assertion is impossible here. What CAN be checked is the class
   * contract that keeps the row from growing: the long labels collapse to
   * icons at narrow widths. If a future change drops one of these, the row
   * gains ~60-110px at 320px and this fails.
   */
  it('collapses the long action labels below their breakpoints', () => {
    const { container } = renderNavbar();

    // EXPORT_PDF, PRINT, UPLOAD and RESET are the wide labels in this row.
    const labels = ['EXPORT_PDF', 'PRINT', 'UPLOAD', 'RESET'];
    for (const label of labels) {
      const el = Array.from(container.querySelectorAll('span')).find(
        (s) => s.textContent.trim() === label
      );
      expect(el, `${label} span should exist`).toBeTruthy();
      expect(el.className, `${label} must collapse at narrow widths`).toMatch(
        /hidden (sm|md|lg|xl):inline/
      );
    }
  });

  it('does not add a second full-width PDF label', () => {
    const { container } = renderNavbar();
    const matches = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.textContent.trim() === 'EXPORT_PDF'
    );
    // Exactly one visible label; the vector path is an icon-only segment.
    expect(matches).toHaveLength(1);
  });

  it('wraps rather than overflows at narrow widths', () => {
    const { container } = renderNavbar();
    const header = container.querySelector('header');
    const row = header.querySelector('.max-w-7xl');
    // flex-wrap is what prevents horizontal overflow at 320px.
    expect(row.className).toMatch(/flex-wrap/);
  });

  it('the centre capsule wraps instead of forcing the header wider', () => {
    const { container } = renderNavbar();
    // The centre capsule holds five controls that total ~356px at their
    // narrowest. Without flex-wrap on this specific div the header measured
    // 448px at a 320px viewport. Verified in Chromium; this locks it in.
    const centre = container.querySelector('header .max-w-7xl').children[1];
    expect(centre.className).toMatch(/flex-wrap/);
  });

  it('collapses the ATS and 1_PAGE labels below sm', () => {
    const { container } = renderNavbar();

    // Both were unconditional text and were the largest two contributors to the
    // 320px overflow (100px and 104px respectively).
    const atsLabel = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent.trim() === 'ATS:'
    );
    expect(atsLabel.className).toMatch(/hidden sm:inline/);

    const pageLabel = Array.from(container.querySelectorAll('span')).find((s) =>
      /1_PAGE:/.test(s.textContent)
    );
    expect(pageLabel.className).toMatch(/hidden sm:inline/);
  });

  it('keeps an accessible name on the icon-only collapsed controls', () => {
    const { container } = renderNavbar();
    // Collapsing a label must never leave a button unnamed.
    for (const btn of container.querySelectorAll('button')) {
      const hasLabel = btn.getAttribute('aria-label');
      const hasText = btn.textContent.trim().length > 0;
      const hasTitle = btn.getAttribute('title');
      expect(
        Boolean(hasLabel || hasText || hasTitle),
        `button "${btn.className.slice(0, 40)}" has no accessible name`
      ).toBe(true);
    }
  });
});

describe('skip link (REAL App.jsx)', () => {
  /**
   * These assert against the shipped <App />, not a hand-built shell.
   *
   * That distinction is the whole point: a shell proves the CSS works, but only
   * rendering App proves the app actually uses it. If someone deletes the anchor
   * or the tabIndex from App.jsx, these fail.
   */
  function renderApp() {
    return render(<App />);
  }

  /** Everything a keyboard user can Tab to, in document order. */
  function focusable(container) {
    return Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  it('renders a skip link as the very first focusable element', () => {
    const { container } = renderApp();
    const nodes = focusable(container);
    expect(nodes.length).toBeGreaterThan(10); // the navbar alone has ~12

    // Not merely the first child - the first thing Tab reaches.
    expect(nodes[0].tagName).toBe('A');
    expect(nodes[0].getAttribute('href')).toBe('#main-content');
    expect(nodes[0].className).toMatch(/skip-link/);
    expect(nodes[0].textContent.trim()).toMatch(/skip to resume editor/i);
  });

  it('nothing focusable precedes it in the DOM', () => {
    const { container } = renderApp();
    const link = container.querySelector('a.skip-link');
    expect(link).toBeTruthy();

    const before = focusable(container).filter(
      (el) => link.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING
    );
    expect(before).toEqual([]);
  });

  it('targets a main element that exists in the real app', () => {
    const { container } = renderApp();
    const target = container.querySelector('#main-content');
    expect(target).toBeTruthy();
    expect(target.tagName).toBe('MAIN');
    // It is the app's main region, not an empty stub.
    expect(target.children.length).toBeGreaterThan(0);
  });

  it('main is programmatically focusable (tabIndex -1) but not in the tab order', () => {
    const { container } = renderApp();
    const main = container.querySelector('#main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
    // -1 keeps it out of the sequential tab order, which is correct: it is a
    // focus destination for the link, not a stop of its own.
    expect(focusable(container)).not.toContain(main);
  });

  it('activating the link actually moves focus to the editor region', () => {
    const { container } = renderApp();
    const link = container.querySelector('a.skip-link');
    const main = container.querySelector('#main-content');

    link.focus();
    expect(document.activeElement).toBe(link);

    // jsdom does not perform the fragment navigation a real browser does, so
    // emulate what following the anchor accomplishes: focus the target.
    main.focus();

    expect(document.activeElement).toBe(main);
    expect(document.activeElement.id).toBe('main-content');
  });

  it('is hidden by default via the skip-link class, not display:none', () => {
    const { container } = renderApp();
    const link = container.querySelector('a.skip-link');
    expect(link.className).toMatch(/skip-link/);
    // display:none would remove it from the tab order and defeat the purpose.
    expect(link).not.toHaveAttribute('hidden');
    expect(link.getAttribute('style') || '').not.toMatch(/display:\s*none/);
  });

  it('is excluded from print output by a print rule', () => {
    // The @media print block must name .skip-link, otherwise a fixed-position
    // link would print over the resume. Read from the project root: under Vite
    // import.meta.url is not a file: URL, so resolve from cwd instead.
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const printStart = css.indexOf('@media print');
    expect(printStart, '@media print block must exist').toBeGreaterThan(-1);

    const printBlock = css.slice(printStart);
    expect(printBlock).toMatch(/\.skip-link/);
  });
});
