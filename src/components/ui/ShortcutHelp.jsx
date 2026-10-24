import React from 'react';
import { X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts.js';

/**
 * Keyboard shortcut reference.
 *
 * Renders SHORTCUTS from useKeyboardShortcuts.js — the same array that drives
 * the keydown handler. There is deliberately no local copy of the list: a help
 * panel that documents a key which does nothing is worse than no panel, and a
 * second copy is how that happens. Adding a shortcut to the registry adds it
 * here automatically, and a test asserts every row maps to a real handler.
 *
 * The contract is `dl > dt` plus a `kbd[aria-keyshortcuts]` per row, and that
 * `aria-keyshortcuts` equals what ariaKeyshortcuts(id) returns. A keycap grid
 * is the one place in this app where a bordered box is the honest rendering:
 * these are physical keys, not data.
 */
export default function ShortcutHelp({ isOpen, onClose }) {
  // ModalShell has no isOpen prop — it assumes it is only mounted when open.
  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} labelledBy="shortcut-help-title" className="max-w-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="dt-serif text-[13px] text-signal">?</span>
          <h2 id="shortcut-help-title" className="dt-label text-bone">
            Keyboard Shortcuts
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          aria-label="Close keyboard shortcuts"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto p-4">
        <p className="dt-label mb-2 text-bone-32">Every shortcut below is active right now</p>

        <dl className="divide-y divide-[var(--rule)] border-t border-rule">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.id} className="flex items-center justify-between gap-3 py-[7px]">
              <dt className="font-sans text-[13px] text-bone">{shortcut.description}</dt>
              <dd className="shrink-0">
                {/* The keys are rendered as <kbd> so they read as literal key
                    names to a screen reader rather than prose. */}
                <kbd
                  aria-keyshortcuts={shortcut.aria}
                  className="whitespace-nowrap rounded-[2px] border border-rule-2 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-bone-70"
                >
                  {shortcut.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 font-sans text-[11px] leading-relaxed text-bone-32">
          On macOS, use ⌘ instead of Ctrl. Shortcuts are ignored while you are
          typing in a text field, so they never interrupt an edit.
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-rule bg-housing px-4 py-2.5">
        <span className="dt-data text-bone-32">
          Press{' '}
          <kbd className="rounded-[2px] border border-rule-2 px-1 font-mono text-[10px] text-bone-70">
            ?
          </kbd>{' '}
          any time to reopen
        </span>
        <button
          type="button"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className="inline-flex h-8 cursor-pointer items-center rounded-[2px] border border-rule-2 px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}
