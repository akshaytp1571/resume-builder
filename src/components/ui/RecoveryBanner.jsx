import React from 'react';
import { ShieldAlert, Download, X } from 'lucide-react';
import { Button } from './primitives';

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
      className="no-print select-none border-b border-rule bg-housing"
    >
      {/* Stacks on narrow screens: a single flex row squeezes the message
          column to ~60px and turns the banner into a 700px-tall strip. */}
      <div className="mx-auto flex max-w-7xl flex-col gap-x-3 gap-y-2 border-l-2 border-alarm px-3 py-2.5 font-sans text-[12px] sm:flex-row sm:items-center sm:px-6">
        <div className="flex min-w-0 items-start gap-2.5 sm:flex-1">
          <ShieldAlert size={15} className="mt-px shrink-0 text-alarm" aria-hidden="true" />
          <p className="min-w-0 leading-relaxed text-bone-70">
            <span className="font-medium text-alarm">
              Your saved resume could not be read.
            </span>{' '}
            A copy was kept in this browser, so nothing is lost yet. Download it
            before clearing site data or switching browsers — you are seeing
            sample data in the meantime.
            {recoveryKeys.length > 1 && (
              <span className="text-bone-52">
                {' '}
                ({recoveryKeys.length} copies kept; the newest is downloaded.)
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="signal" size="sm" onClick={onDownload} className="gap-1.5">
            <Download size={13} aria-hidden="true" />
            <span>Download recovery copy</span>
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={onDismiss}
            aria-label="Dismiss the recovery notice"
            className="gap-1.5"
          >
            <X size={13} aria-hidden="true" />
            <span>Dismiss</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
