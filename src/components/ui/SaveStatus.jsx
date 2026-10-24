import React from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';

/**
 * Save state, stated plainly.
 *
 * A quiet mono strip: a 2px LED, the state, and the pin. Autosave already worked
 * before this existed; the point was that nothing on screen ever said so, and a
 * working autosave and a broken one looked identical.
 *
 * The live region is `polite` and the text is short — a save status that
 * interrupts a screen reader mid-sentence would be worse than silence.
 *
 * Accessible names are asserted: the pin reads exactly "Set default" when
 * unpinned and "Default" when pinned.
 */

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export default function SaveStatus({
  status,
  savedAt,
  isDefault,
  onSave,
  onSetDefault,
  onClearDefault,
}) {
  const isSaving = status === 'saving';
  const isFailed = status === 'failed';
  const isSaved = status === 'saved';

  // The state word, then the time as separate mono data — a readout, not a
  // sentence. Tests match /saved/i and /saving/i and /save failed/i.
  const stateWord = isSaving ? 'Saving…' : isFailed ? 'Save failed' : isSaved ? 'Saved' : 'Auto-sync on';

  return (
    <div className="flex items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        className={`dt-label flex items-center gap-1.5 ${isFailed ? 'text-alarm' : 'text-bone-52'}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-[5px] w-[5px] shrink-0 ${
            isFailed ? 'bg-alarm' : isSaved ? 'bg-signal' : isSaving ? 'bg-bone' : 'bg-bone-32'
          }`}
        />
        <span>{stateWord}</span>
        {isSaved && savedAt && (
          <span className="text-bone-32">· {timeAgo(savedAt)}</span>
        )}
      </span>

      <button
        type="button"
        onClick={onSave}
        title="Save now (autosave is already on)"
        className="dt-label cursor-pointer rounded-[2px] border border-rule-2 px-1.5 py-0.5 text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
      >
        Save
      </button>

      {isDefault ? (
        <button
          type="button"
          onClick={onClearDefault}
          title="This resume is the saved default. Click to unpin."
          className="dt-label flex cursor-pointer items-center gap-1 rounded-[2px] border border-signal/50 px-1.5 py-0.5 text-signal transition-colors duration-[90ms] hover:bg-signal/10"
        >
          <BookmarkCheck size={11} aria-hidden="true" />
          Default
        </button>
      ) : (
        <button
          type="button"
          onClick={onSetDefault}
          title="Pin this version as the one to restore"
          className="dt-label flex cursor-pointer items-center gap-1 rounded-[2px] border border-rule-2 px-1.5 py-0.5 text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <Bookmark size={11} aria-hidden="true" />
          Set default
        </button>
      )}
    </div>
  );
}
