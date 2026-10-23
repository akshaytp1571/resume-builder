import React from 'react';
import { Keyboard, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts.js';

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

/**
 * Keyboard shortcut reference.
 *
 * Renders SHORTCUTS from useKeyboardShortcuts.js — the same array that drives
 * the keydown handler. There is deliberately no local copy of the list: a help
 * panel that documents a key which does nothing is worse than no panel, and a
 * second copy is how that happens. Adding a shortcut to the registry adds it
 * here automatically, and a test asserts every row maps to a real handler.
 */
export default function ShortcutHelp({ isOpen, onClose }) {
  // ModalShell has no isOpen prop — it assumes it is only mounted when open.
  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} labelledBy="shortcut-help-title" className="max-w-lg">
      {/* Header */}
      <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
            <Keyboard size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 id="shortcut-help-title" className="text-sm font-bold text-pink-50 tracking-wide">
              Keyboard Shortcuts
            </h2>
            <p className="text-[11px] text-pink-300/70">
              Every shortcut below is active right now
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          aria-label="Close keyboard shortcuts"
          className={`p-1.5 rounded-xl text-pink-400/85 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer ${RING}`}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 overflow-y-auto">
        <dl className="space-y-1.5">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[#1b071e] border border-pink-500/20"
            >
              <dt className="text-xs text-pink-100">{shortcut.description}</dt>
              <dd className="shrink-0">
                {/* The keys are rendered as <kbd> so they read as literal key
                    names to a screen reader rather than prose. */}
                <kbd
                  aria-keyshortcuts={shortcut.aria}
                  className="px-2 py-1 rounded-lg bg-[#120414] border border-pink-500/30 text-[10.5px] font-mono text-rose-200 whitespace-nowrap"
                >
                  {shortcut.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-[10.5px] text-pink-300/70 leading-relaxed">
          On macOS, use ⌘ instead of Ctrl. Shortcuts are ignored while you are
          typing in a text field, so they never interrupt an edit.
        </p>
      </div>

      {/* Footer */}
      <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
        <span className="text-[10.5px] text-pink-300/70">
          Press <kbd className="font-mono text-pink-200">?</kbd> any time to reopen
        </span>
        <button
          type="button"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className={`px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/20 transition-colors cursor-pointer ${RING}`}
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}
