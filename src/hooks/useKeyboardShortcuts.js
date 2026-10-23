import { useEffect, useRef } from 'react';
import { isEditableTarget } from '../utils/history.js';

/**
 * App-level keyboard shortcuts.
 *
 * SINGLE SOURCE OF TRUTH: SHORTCUTS below drives both the keydown handler and
 * the help panel (ShortcutHelp.jsx). The panel cannot drift from reality,
 * because it renders this array rather than its own copy. A test asserts every
 * entry actually fires its handler.
 *
 * TWO-LISTENER COORDINATION — read before adding a shortcut:
 * useUndoRedo already owns a keydown listener for Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y.
 * Rather than merge the two (which would mean rewriting a well-tested hook and
 * leaving its existing test vacuous), the domains are kept strictly DISJOINT:
 * this hook returns early on any z/y key and never touches undo/redo, so the two
 * listeners can never act on the same press. Only one of them calls
 * preventDefault for any given key. If you add a shortcut here, it must not be
 * a z/y variant.
 *
 * WHY NOT Ctrl+P FOR PDF:
 * The browser owns Ctrl+P for print, and this app's Print button already uses
 * the browser's own vector print path. Intercepting Ctrl+P would mean a user
 * asking to print gets a file export instead — the surprise is worse than the
 * missing shortcut. Ctrl+Shift+S is used instead: it sits in the same "save"
 * family as Ctrl+S, so it is memorable, and it is no more of a hijack than
 * Ctrl+S already is (browsers bind both to "save page"; web apps routinely take
 * Ctrl+S, so taking its shifted variant is the same class of decision rather
 * than a new surprise). Ctrl+E was rejected because Chrome and Firefox both
 * bind it to address-bar search, and F2 because it is undiscoverable.
 */

/**
 * The shortcut table.
 *
 * `aria` is the space-separated list for aria-keyshortcuts, which accepts
 * alternatives — so one attribute covers both platforms without sniffing the
 * user agent.
 *
 * `handledBy` names the handler this entry must fire. `useKeyboardShortcuts`
 * only dispatches the ids it owns; `undo`/`redo` are handled by useUndoRedo's
 * own listener (see the coordination note above). The help panel renders every
 * row, and the test asserts each `handledBy` is real.
 */
export const SHORTCUTS = [
  {
    id: 'undo',
    keys: 'Ctrl + Z',
    macKeys: '⌘ + Z',
    aria: 'Control+Z Meta+Z',
    description: 'Undo the last edit',
    handledBy: 'undo',
  },
  {
    id: 'redo',
    keys: 'Ctrl + Shift + Z',
    macKeys: '⌘ + Shift + Z',
    aria: 'Control+Shift+Z Meta+Shift+Z Control+Y',
    description: 'Redo the last undone edit',
    handledBy: 'redo',
  },
  {
    id: 'export-docx',
    keys: 'Ctrl + S',
    macKeys: '⌘ + S',
    aria: 'Control+S Meta+S',
    description: 'Export the resume as DOCX',
    handledBy: 'exportDocx',
  },
  {
    id: 'export-pdf',
    keys: 'Ctrl + Shift + S',
    macKeys: '⌘ + Shift + S',
    aria: 'Control+Shift+S Meta+Shift+S',
    description: 'Export the resume as PDF',
    handledBy: 'exportPdf',
  },
  {
    id: 'help',
    keys: '?',
    macKeys: '?',
    aria: 'Shift+/',
    description: 'Show this keyboard shortcut list',
    handledBy: 'help',
  },
];

/** Ids this hook dispatches. undo/redo belong to useUndoRedo. */
export const OWNED_SHORTCUT_IDS = ['export-docx', 'export-pdf', 'help'];

/** Look up an entry by id — used by the Navbar for aria-keyshortcuts. */
export function shortcutById(id) {
  return SHORTCUTS.find((s) => s.id === id) || null;
}

/** The aria-keyshortcuts string for an id, or undefined when there is none. */
export function ariaKeyshortcuts(id) {
  return shortcutById(id)?.aria;
}

/**
 * Bind the app-level shortcuts.
 *
 * @param {object} options
 * @param {() => void} options.onExportDocx
 * @param {() => void} options.onExportPdf
 * @param {() => void} options.onOpenHelp
 * @param {boolean}   [options.helpOpen]  suppresses the `?` toggle while open
 */
export default function useKeyboardShortcuts({
  onExportDocx,
  onExportPdf,
  onOpenHelp,
  helpOpen = false,
} = {}) {
  // Handlers change identity on every render; the listener must not, or it
  // would be torn down and rebuilt on each keystroke's re-render.
  const handlers = useRef({ onExportDocx, onExportPdf, onOpenHelp, helpOpen });
  handlers.current = { onExportDocx, onExportPdf, onOpenHelp, helpOpen };

  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';

      // --- Domain boundary -------------------------------------------------
      // undo/redo belong to useUndoRedo's listener. Returning here is what
      // keeps the two listeners from both acting on one press.
      if (key === 'z' || key === 'y') return;

      // Typing always wins. Ctrl+S in a textarea is the user's own business,
      // and `?` is a character before it is a shortcut.
      if (isEditableTarget(event.target)) return;

      // --- Ctrl/Cmd+S -> DOCX ---------------------------------------------
      if (mod && key === 's' && !event.shiftKey) {
        event.preventDefault();
        handlers.current.onExportDocx?.();
        return;
      }

      // --- Ctrl/Cmd+Shift+S -> PDF ----------------------------------------
      // Deliberately NOT Ctrl+P: see the header comment.
      if (mod && key === 's' && event.shiftKey) {
        event.preventDefault();
        handlers.current.onExportPdf?.();
        return;
      }

      // --- ? -> help --------------------------------------------------------
      // event.key is '?' when Shift+/ is pressed on a US layout, so no
      // shiftKey check is needed — and requiring one would break layouts where
      // '?' sits on its own key.
      if (!mod && event.key === '?') {
        event.preventDefault();
        // Already open: leave it alone rather than re-opening (which would
        // reset focus) — ModalShell handles Escape for closing.
        if (!handlers.current.helpOpen) {
          handlers.current.onOpenHelp?.();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
