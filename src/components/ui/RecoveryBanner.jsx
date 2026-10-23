import React from 'react';
import { ShieldAlert, Download, X } from 'lucide-react';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

/**
 * One-time notice that a saved store could not be read and a copy was kept.
 *
 * Presentation only: the parent owns the key list and the download handler, so
 * this stays a pure function of its props and renders nothing when there is no
 * recovery copy to report.
 *
 * Deliberately in normal flow (not fixed) so it never covers the editor/preview
 * split; it scrolls away with the page.
 */
export default function RecoveryBanner({ recoveryKeys = [], onDownload, onDismiss }) {
  if (!Array.isArray(recoveryKeys) || recoveryKeys.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print select-none border-b border-amber-500/30 bg-[#18071c]"
    >
      {/* Stacks on narrow screens: a single flex row squeezes the message
          column to ~60px and turns the banner into a 700px-tall strip. */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-2 text-xs font-sans">
        <div className="flex items-center gap-2.5 min-w-0 sm:flex-1">
          <div className="w-7 h-7 rounded-xl bg-[#2e0d34] border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
            <ShieldAlert size={15} aria-hidden="true" />
          </div>
          <p className="text-pink-200 leading-relaxed min-w-0">
            <span className="font-semibold text-amber-200">
              Your saved resume could not be read.
            </span>{' '}
            A copy was kept in this browser, so nothing is lost yet. Download it
            before clearing site data or switching browsers — you are seeing
            sample data in the meantime.
            {recoveryKeys.length > 1 && (
              <span className="text-pink-300/70">
                {' '}
                ({recoveryKeys.length} copies kept; the newest is downloaded.)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onDownload}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${FOCUS_RING}`}
          >
            <Download size={13} aria-hidden="true" />
            <span>Download recovery copy</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss the recovery notice"
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/30 transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS_RING}`}
          >
            <X size={13} aria-hidden="true" />
            <span>Dismiss</span>
          </button>
        </div>
      </div>
    </div>
  );
}
