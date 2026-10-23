import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveVariant, updateVariant, normalizeResume } from '../utils/resumeStore.js';
import { createHistory, isEditableTarget } from '../utils/history.js';
import { sound } from '../utils/soundEffects.js';

/** Undo history depth. Bounded so a long editing session cannot grow forever. */
export const HISTORY_LIMIT = 50;
/**
 * Longer than the 400ms save debounce on purpose: the save timer marks "the
 * browser has the latest data", this one marks "the user paused". A pause is
 * the natural boundary between one undo step and the next, and reusing the
 * save timer's 400ms would split a burst of typing into several steps.
 */
export const HISTORY_DEBOUNCE_MS = 600;

/**
 * The part of a variant that undo restores: data and theme, nothing else.
 *
 * Identity fields (id, name, timestamps) are deliberately excluded — undoing an
 * edit must not rename the resume back — and so is `letter`, so undoing a
 * resume edit cannot silently revert the cover letter.
 */
export function snapshotOfStore(store) {
  const active = getActiveVariant(store);
  if (!active) return null;
  return { id: active.id, data: active.data, theme: active.theme };
}

/**
 * Undo/redo over the active variant's data and theme.
 *
 * Takes the store and its setter from useResumeStore rather than importing it,
 * so the dependency runs one way: store -> history. `resetHistory` is returned
 * for the store's variant handlers to call.
 */
export default function useUndoRedo({ store, setStore, showToast } = {}) {
  // The history object lives in a ref: it is mutable state that must survive
  // re-renders without causing them. `historyVersion` is the only React state,
  // and it exists purely to re-render the toolbar when availability flips.
  const historyRef = useRef(null);
  if (historyRef.current === null) {
    historyRef.current = createHistory(HISTORY_LIMIT);
  }
  const [, setHistoryVersion] = useState(0);
  const historyTimer = useRef(null);
  // Set while an undo/redo is being applied. The store change that results is
  // not a user edit, so it must not be recorded as a new history entry — doing
  // so would push the restored state on top of the redo branch and clear it,
  // making redo impossible after a single undo.
  const restoringRef = useRef(false);

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  // Seed the baseline so the first edit has something to undo back to.
  useEffect(() => {
    if (historyRef.current.size() === 0) {
      const snap = snapshotOfStore(store);
      if (snap) historyRef.current.reset(snap);
    }
    // Intentionally mount-only: seeding again would wipe real history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record a snapshot 600ms after the store settles.
  useEffect(() => {
    if (historyTimer.current) clearTimeout(historyTimer.current);
    if (restoringRef.current) {
      // This render is the result of an undo/redo, not an edit. Release the
      // guard so the user's *next* edit is recorded normally.
      restoringRef.current = false;
      return undefined;
    }
    historyTimer.current = setTimeout(() => {
      const snap = snapshotOfStore(store);
      if (snap && historyRef.current.push(snap)) {
        setHistoryVersion((v) => v + 1);
      }
    }, HISTORY_DEBOUNCE_MS);
    return () => {
      if (historyTimer.current) clearTimeout(historyTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  /**
   * Restore a snapshot into the store.
   *
   * Written as a targeted patch of one variant rather than a whole-store
   * replacement, for two reasons: a whole-store write would clobber variants
   * another tab has added since (the merge logic in saveStore would then have to
   * clean up after us), and the recovery banner keys off storage that undo has
   * no business touching. Only `data` and `theme` move.
   */
  const applySnapshot = useCallback(
    (snap) => {
      if (!snap) return;
      // Any queued push would record the pre-undo state as a new edit, and the
      // store change below must not re-arm the timer at all.
      if (historyTimer.current) clearTimeout(historyTimer.current);
      restoringRef.current = true;
      setStore((prev) => {
        // The variant may have been deleted since the snapshot was taken. Fall
        // back to the active one rather than resurrecting a dead id.
        const target = prev.variants.some((v) => v.id === snap.id)
          ? snap.id
          : getActiveVariant(prev)?.id;
        if (!target) return prev;
        return updateVariant(prev, target, {
          data: normalizeResume(snap.data),
          theme: snap.theme,
        });
      });
      setHistoryVersion((v) => v + 1);
    },
    [setStore]
  );

  const handleUndo = useCallback(() => {
    const snap = historyRef.current.undo();
    if (!snap) return false;
    applySnapshot(snap);
    sound.playAction();
    showToastRef.current?.('info', 'UNDO');
    return true;
  }, [applySnapshot]);

  const handleRedo = useCallback(() => {
    const snap = historyRef.current.redo();
    if (!snap) return false;
    applySnapshot(snap);
    sound.playAction();
    showToastRef.current?.('info', 'REDO');
    return true;
  }, [applySnapshot]);

  // Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y.
  useEffect(() => {
    const onKeyDown = (event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;

      // Let the browser undo text while the user is typing. Hijacking this is
      // worse than having no undo at all.
      if (isEditableTarget(event.target)) return;

      const isRedo = key === 'y' || (key === 'z' && event.shiftKey);
      const handled = isRedo ? handleRedo() : handleUndo();
      // Only swallow the shortcut when we actually moved through history, so an
      // empty stack leaves the browser's own behaviour alone.
      if (handled) event.preventDefault();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  /**
   * History belongs to one document. Switching, creating, duplicating,
   * deleting or importing a variant changes what is on screen without the user
   * editing it — so the stack is reset to the new state rather than left
   * pointing at the old one.
   */
  const resetHistory = useCallback((nextStore) => {
    const snap = snapshotOfStore(nextStore);
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyRef.current.reset(snap || undefined);
    setHistoryVersion((v) => v + 1);
  }, []);

  // Read during render so the buttons reflect the stack; `historyVersion` is
  // what makes this re-run after every mutation of the ref.
  const canUndo = historyRef.current.canUndo();
  const canRedo = historyRef.current.canRedo();

  return {
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    resetHistory,
    applySnapshot,
    historyRef,
  };
}
