import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SHORTCUTS } from './useKeyboardShortcuts.js';

/**
 * Command registry + open/close state for the ⌘K palette.
 *
 * THE REGISTRY IS DERIVED, NOT HAND-MAINTAINED.
 * Shortcut-backed commands come from SHORTCUTS. If this file kept its own copy
 * of the key labels they would drift from the dispatcher, and the palette would
 * eventually advertise a key that does nothing — the same failure the shortcut
 * help panel was designed to avoid. Only the *extra* commands (things with no
 * shortcut) are declared here by hand.
 *
 * `run` is always a function the caller provides. A command whose handler is
 * missing is dropped rather than rendered as a dead row.
 */

/** Human-readable category for a shortcut id. */
const SHORTCUT_CATEGORY = {
  undo: 'Edit',
  redo: 'Edit',
  'export-docx': 'Export',
  'export-pdf': 'Export',
  help: 'Help',
};

/** Title for a shortcut-backed command; falls back to its description. */
const SHORTCUT_TITLE = {
  undo: 'Undo',
  redo: 'Redo',
  'export-docx': 'Export as DOCX',
  'export-pdf': 'Export as PDF',
  help: 'Show keyboard shortcuts',
};

const CATEGORY_ORDER = ['Edit', 'Export', 'Document', 'Variant', 'Navigate', 'Help'];

/**
 * @param {object} handlers  map of shortcut `handledBy` -> function
 * @param {Array}  extra     additional `{ id, title, category, run }` commands
 */
export function buildCommands(handlers = {}, extra = []) {
  const commands = [];

  for (const s of SHORTCUTS) {
    const run = handlers[s.handledBy];
    // No handler wired yet — do not advertise a command that cannot run.
    if (typeof run !== 'function') continue;
    commands.push({
      id: s.id,
      title: SHORTCUT_TITLE[s.id] || s.description,
      category: SHORTCUT_CATEGORY[s.id] || 'Help',
      shortcut: s.keys,
      macShortcut: s.macKeys,
      run,
    });
  }

  for (const c of extra) {
    if (!c || typeof c.run !== 'function') continue;
    commands.push({
      id: c.id,
      title: c.title,
      category: c.category || 'Navigate',
      shortcut: c.shortcut || '',
      macShortcut: c.macShortcut || '',
      run: c.run,
    });
  }

  // A command listed twice is a bug: the palette would run one and show both.
  const seen = new Set();
  const unique = commands.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  return unique.sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb);
    return a.title.localeCompare(b.title);
  });
}

/** Filter commands by a query, matching title and category. */
export function filterCommands(commands, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return commands;
  return commands.filter(
    (c) =>
      c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
  );
}

/** Group a flat command list into `[{ category, items }]`, order preserved. */
export function groupCommands(commands) {
  const groups = [];
  for (const c of commands) {
    let g = groups.find((x) => x.category === c.category);
    if (!g) {
      g = { category: c.category, items: [] };
      groups.push(g);
    }
    g.items.push(c);
  }
  return groups;
}

export function useCommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  // The element to restore focus to on close.
  const returnFocusRef = useRef(null);

  const open = useCallback(() => {
    returnFocusRef.current =
      typeof document !== 'undefined' ? document.activeElement : null;
    setQuery('');
    setActiveIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
    const target = returnFocusRef.current;
    if (target && typeof target.focus === 'function') {
      // Defer: the dialog is still mounted during this tick.
      setTimeout(() => target.focus(), 0);
    }
    returnFocusRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        const target = returnFocusRef.current;
        if (target && typeof target.focus === 'function') {
          setTimeout(() => target.focus(), 0);
        }
        returnFocusRef.current = null;
        return false;
      }
      returnFocusRef.current =
        typeof document !== 'undefined' ? document.activeElement : null;
      return true;
    });
    setQuery('');
    setActiveIndex(0);
  }, []);

  /**
   * Global Ctrl/Cmd+K listener.
   *
   * DELIBERATE EXCEPTION to the isEditableTarget guard used by every other
   * shortcut: ⌘K is a navigation command, not an edit, so it must fire even
   * while the caret is in a textarea. Do not "fix" this by adding the guard.
   */
  useEffect(() => {
    const onKeyDown = (event) => {
      const isK = event.key === 'k' || event.key === 'K';
      if (!isK) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  return { isOpen, open, close, toggle, query, setQuery, activeIndex, setActiveIndex };
}

export default useCommandBar;
