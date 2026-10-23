import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';
import useKeyboardShortcuts, {
  SHORTCUTS,
  OWNED_SHORTCUT_IDS,
  ariaKeyshortcuts,
} from '../hooks/useKeyboardShortcuts.js';
import ShortcutHelp from '../components/ui/ShortcutHelp.jsx';
import Navbar from '../components/ui/Navbar.jsx';

/**
 * Keyboard shortcut coverage.
 *
 * The important tests here are the anti-rot ones:
 *   - every shortcut the help panel lists must actually fire a handler
 *   - nothing fires while the user is typing
 *   - two listeners must not both act on one press
 */

/** Mount the hook with spy handlers and return them. */
function mountShortcuts(overrides = {}) {
  const spies = {
    onExportDocx: vi.fn(),
    onExportPdf: vi.fn(),
    onOpenHelp: vi.fn(),
    ...overrides,
  };

  function Harness({ helpOpen = false }) {
    useKeyboardShortcuts({ ...spies, helpOpen });
    return <div data-testid="harness" />;
  }

  const utils = render(<Harness />);
  return {
    ...spies,
    rerenderHelpOpen: (open) => utils.rerender(<Harness helpOpen={open} />),
    unmount: utils.unmount,
  };
}

/** Press a key on document with the given modifier state. */
function press(key, { ctrl = false, meta = false, shift = false, target } = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    ctrlKey: ctrl,
    metaKey: meta,
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    (target || document).dispatchEvent(event);
  });
  return event;
}

describe('shortcut registry', () => {
  it('every entry has the fields the help panel and Navbar rely on', () => {
    for (const s of SHORTCUTS) {
      expect(s.id, 'id').toBeTruthy();
      expect(s.keys, `${s.id}.keys`).toBeTruthy();
      expect(s.description, `${s.id}.description`).toBeTruthy();
      expect(s.aria, `${s.id}.aria`).toBeTruthy();
      expect(s.handledBy, `${s.id}.handledBy`).toBeTruthy();
    }
  });

  it('aria-keyshortcuts uses the WAI-ARIA syntax, not a display string', () => {
    // "Control+Z" is valid; "Ctrl + Z" is not. The spec allows any
    // KeyboardEvent.key value as a token, so "Shift+/" is legal too.
    for (const s of SHORTCUTS) {
      for (const token of s.aria.split(' ')) {
        expect(token, `${s.id} aria token "${token}"`).toMatch(/^[A-Za-z0-9+/]+$/);
        expect(token).not.toMatch(/\s/);
      }
      expect(s.aria).not.toMatch(/Ctrl|⌘/);
    }
  });

  it('ariaKeyshortcuts() returns undefined for an unknown id', () => {
    expect(ariaKeyshortcuts('nope')).toBeUndefined();
  });

  it('does NOT claim Ctrl+P', () => {
    // The browser owns Ctrl+P for print; intercepting it is user-hostile.
    for (const s of SHORTCUTS) {
      expect(s.aria).not.toMatch(/Control\+P(\s|$)/);
    }
  });
});

describe('useKeyboardShortcuts — dispatch', () => {
  let s;
  afterEach(() => {
    s?.unmount?.();
    s = undefined;
  });

  it('Ctrl+S exports DOCX', () => {
    s = mountShortcuts();
    const e = press('s', { ctrl: true });
    expect(s.onExportDocx).toHaveBeenCalledTimes(1);
    expect(s.onExportPdf).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it('Meta+S (macOS) exports DOCX', () => {
    s = mountShortcuts();
    press('s', { meta: true });
    expect(s.onExportDocx).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+S exports PDF, not DOCX', () => {
    s = mountShortcuts();
    press('s', { ctrl: true, shift: true });
    expect(s.onExportPdf).toHaveBeenCalledTimes(1);
    expect(s.onExportDocx).not.toHaveBeenCalled();
  });

  it('Ctrl+P does nothing — the browser keeps print', () => {
    s = mountShortcuts();
    const e = press('p', { ctrl: true });
    expect(s.onExportPdf).not.toHaveBeenCalled();
    expect(s.onExportDocx).not.toHaveBeenCalled();
    // Not swallowed, so the browser's print dialog still opens.
    expect(e.defaultPrevented).toBe(false);
  });

  it('? opens the help panel', () => {
    s = mountShortcuts();
    const e = press('?');
    expect(s.onOpenHelp).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('? does not re-open the panel while it is already open', () => {
    s = mountShortcuts();
    s.rerenderHelpOpen(true);
    press('?');
    expect(s.onOpenHelp).not.toHaveBeenCalled();
  });

  it('a bare "s" does nothing', () => {
    s = mountShortcuts();
    press('s');
    expect(s.onExportDocx).not.toHaveBeenCalled();
  });
});

describe('useKeyboardShortcuts — never intercepts typing', () => {
  let s;
  afterEach(() => {
    s?.unmount?.();
    s = undefined;
    document.body.innerHTML = '';
  });

  const editableCases = [
    ['input', () => document.createElement('input')],
    ['textarea', () => document.createElement('textarea')],
    ['select', () => document.createElement('select')],
    [
      'contenteditable div',
      () => {
        const d = document.createElement('div');
        d.setAttribute('contenteditable', 'true');
        // jsdom does not implement isContentEditable (verified: the property is
        // undefined), but every real browser does, and that is what
        // isEditableTarget checks. Define it so this test exercises the same
        // code path a browser would.
        Object.defineProperty(d, 'isContentEditable', { value: true });
        return d;
      },
    ],
    [
      'role=textbox',
      () => {
        const d = document.createElement('div');
        d.setAttribute('role', 'textbox');
        return d;
      },
    ],
  ];

  for (const [label, make] of editableCases) {
    it(`ignores Ctrl+S while focus is in a ${label}`, () => {
      s = mountShortcuts();
      const el = make();
      document.body.appendChild(el);
      el.focus();

      const e = press('s', { ctrl: true, target: el });

      expect(s.onExportDocx).not.toHaveBeenCalled();
      // Not prevented either, so the browser's own handling is untouched.
      expect(e.defaultPrevented).toBe(false);
    });
  }

  it('ignores ? while typing in a textarea', () => {
    s = mountShortcuts();
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    ta.focus();

    press('?', { target: ta });
    expect(s.onOpenHelp).not.toHaveBeenCalled();
  });

  it('ignores Ctrl+Shift+S while typing', () => {
    s = mountShortcuts();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    press('s', { ctrl: true, shift: true, target: input });
    expect(s.onExportPdf).not.toHaveBeenCalled();
  });
});

describe('no duplicate keydown registration', () => {
  /**
   * useUndoRedo owns Ctrl+Z/Y; useKeyboardShortcuts owns the rest. If both
   * acted on the same press the action would fire twice. These assert the
   * domain boundary directly.
   */
  it('the shortcut hook ignores z and y entirely', () => {
    const s = mountShortcuts();
    // z/y belong to useUndoRedo — this hook must not swallow them.
    const z = press('z', { ctrl: true });
    const y = press('y', { ctrl: true });
    expect(z.defaultPrevented).toBe(false);
    expect(y.defaultPrevented).toBe(false);
    s.unmount();
  });

  it('one Ctrl+S press fires exactly one export', () => {
    const s = mountShortcuts();
    press('s', { ctrl: true });
    // The strongest available assertion for "no double registration": the
    // action ran once, not twice.
    expect(s.onExportDocx).toHaveBeenCalledTimes(1);
    s.unmount();
  });

  it('registers exactly one document listener per mount', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const s = mountShortcuts();
    const keydownAdds = add.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownAdds).toHaveLength(1);
    s.unmount();
    add.mockRestore();
  });

  it('removes its listener on unmount', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const s = mountShortcuts();
    s.unmount();
    const keydownRemoves = remove.mock.calls.filter(([type]) => type === 'keydown');
    expect(keydownRemoves.length).toBeGreaterThanOrEqual(1);
    remove.mockRestore();
  });
});

describe('ShortcutHelp panel', () => {
  it('lists every registered shortcut and nothing else', () => {
    const { container } = render(<ShortcutHelp isOpen onClose={() => {}} />);
    // No aspirational entries: the panel renders the registry itself.
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();

    // Scope to the definition list: the footer repeats the "?" key inline, so
    // an unscoped getByText would match twice.
    const list = container.querySelector('dl');
    expect(list).toBeTruthy();

    for (const s of SHORTCUTS) {
      expect(
        Array.from(list.querySelectorAll('dt')).some((dt) => dt.textContent === s.description),
        `missing description "${s.description}"`
      ).toBe(true);
      expect(
        Array.from(list.querySelectorAll('kbd')).some((k) => k.textContent === s.keys),
        `missing keys "${s.keys}"`
      ).toBe(true);
    }

    // And no extra rows beyond the registry.
    expect(list.querySelectorAll('dt')).toHaveLength(SHORTCUTS.length);
  });

  it('every advertised shortcut maps to a real handler', () => {
    /**
     * THE ANTI-ASPIRATIONAL TEST.
     *
     * A help panel documenting a key that does nothing is worse than no panel.
     * For each entry, the named handler must be one the app actually provides:
     * either owned by this hook's dispatcher, or owned by useUndoRedo.
     */
    const hookOwned = new Set(OWNED_SHORTCUT_IDS);
    const undoRedoOwned = new Set(['undo', 'redo']);

    for (const s of SHORTCUTS) {
      const known = hookOwned.has(s.id) || undoRedoOwned.has(s.handledBy);
      expect(known, `"${s.id}" claims handler "${s.handledBy}" which nothing provides`).toBe(true);
    }
  });

  it('each advertised shortcut is actually dispatched by the hook', () => {
    // Belt-and-braces on the above: press the key and confirm the handler runs.
    const s = mountShortcuts();

    press('s', { ctrl: true });
    expect(s.onExportDocx).toHaveBeenCalled();

    press('s', { ctrl: true, shift: true });
    expect(s.onExportPdf).toHaveBeenCalled();

    press('?');
    expect(s.onOpenHelp).toHaveBeenCalled();

    s.unmount();
  });

  it('is labelled as a dialog and closes with Escape', () => {
    const onClose = vi.fn();
    render(<ShortcutHelp isOpen onClose={onClose} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ShortcutHelp isOpen={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('has a labelled close button reachable by keyboard', () => {
    render(<ShortcutHelp isOpen onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: /close keyboard shortcuts/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toHaveAttribute('tabindex', '-1');
  });

  it('renders keys as <kbd> with aria-keyshortcuts so AT reads them as keys', () => {
    const { container } = render(<ShortcutHelp isOpen onClose={() => {}} />);
    const kbds = container.querySelectorAll('kbd[aria-keyshortcuts]');
    expect(kbds.length).toBe(SHORTCUTS.length);
  });
});

describe('Navbar advertises the shortcuts', () => {
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

  it('undo and redo carry aria-keyshortcuts', () => {
    render(<Navbar {...baseProps} canUndo canRedo onUndo={() => {}} onRedo={() => {}} />);

    expect(screen.getByRole('button', { name: /undo last edit/i })).toHaveAttribute(
      'aria-keyshortcuts',
      ariaKeyshortcuts('undo')
    );
    expect(screen.getByRole('button', { name: /redo last undone edit/i })).toHaveAttribute(
      'aria-keyshortcuts',
      ariaKeyshortcuts('redo')
    );
  });

  it('the DOCX and PDF buttons carry aria-keyshortcuts', () => {
    render(<Navbar {...baseProps} />);

    expect(screen.getByRole('button', { name: /download resume as docx/i })).toHaveAttribute(
      'aria-keyshortcuts',
      ariaKeyshortcuts('export-docx')
    );
    expect(screen.getByRole('button', { name: /^export resume as pdf$/i })).toHaveAttribute(
      'aria-keyshortcuts',
      ariaKeyshortcuts('export-pdf')
    );
  });

  it('has a keyboard-shortcuts button that opens the panel', () => {
    const onOpenShortcuts = vi.fn();
    render(<Navbar {...baseProps} onOpenShortcuts={onOpenShortcuts} />);

    const btn = screen.getByRole('button', { name: /show keyboard shortcuts/i });
    fireEvent.click(btn);
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onOpenShortcuts is not supplied', () => {
    render(<Navbar {...baseProps} />);
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: /show keyboard shortcuts/i }))
    ).not.toThrow();
  });
});
