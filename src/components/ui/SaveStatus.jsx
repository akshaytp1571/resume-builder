import React from 'react';
import { CheckCircle2, Loader2, AlertTriangle, Bookmark, BookmarkCheck } from 'lucide-react';

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#140616]';

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

/**
 * Save state, stated plainly.
 *
 * Autosave already worked before this existed, but nothing on screen said so —
 * and an autosave you cannot see is indistinguishable from one that failed. This
 * shows the state, offers an explicit save, and lets the user pin the current
 * version as the default.
 *
 * The live region is `polite` and the text is short: a save status that
 * interrupts a screen reader mid-sentence would be worse than silence.
 */
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

  return (
    <div className="flex items-center gap-1.5">
      <span
        role="status"
        aria-live="polite"
        className={`flex items-center gap-1 text-[10px] font-semibold ${
          isFailed ? 'text-rose-300' : 'text-pink-300/85'
        }`}
      >
        {isSaving && (
          <>
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
            Saving…
          </>
        )}
        {isFailed && (
          <>
            <AlertTriangle size={11} aria-hidden="true" />
            Save failed
          </>
        )}
        {isSaved && (
          <>
            <CheckCircle2 size={11} aria-hidden="true" />
            Saved {timeAgo(savedAt)}
          </>
        )}
        {!isSaving && !isFailed && !isSaved && (
          <>
            <CheckCircle2 size={11} aria-hidden="true" />
            Auto-sync on
          </>
        )}
      </span>

      <button
        type="button"
        onClick={onSave}
        title="Save now (autosave is already on)"
        className={`rounded-lg border border-pink-500/30 bg-[#250d2b] px-2 py-1 text-[10px] font-bold text-pink-100 transition-colors hover:bg-[#32113a] ${RING}`}
      >
        Save
      </button>

      {isDefault ? (
        <button
          type="button"
          onClick={onClearDefault}
          title="This resume is the saved default. Click to unpin."
          className={`flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-950/50 px-2 py-1 text-[10px] font-bold text-emerald-200 transition-colors hover:bg-emerald-900/60 ${RING}`}
        >
          <BookmarkCheck size={11} aria-hidden="true" />
          Default
        </button>
      ) : (
        <button
          type="button"
          onClick={onSetDefault}
          title="Pin this version as the one to restore"
          className={`flex items-center gap-1 rounded-lg border border-pink-500/30 bg-[#250d2b] px-2 py-1 text-[10px] font-bold text-pink-100 transition-colors hover:bg-[#32113a] ${RING}`}
        >
          <Bookmark size={11} aria-hidden="true" />
          Set default
        </button>
      )}
    </div>
  );
}
