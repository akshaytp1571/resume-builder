import { useCallback, useEffect, useRef, useState } from 'react';
import { INITIAL_RESUME_DATA, DEFAULT_THEME } from '../data/initialData.js';
import {
  loadStore,
  saveStore,
  getActiveVariant,
  updateVariant,
  addVariant,
  duplicateVariant,
  removeVariant,
  restoreVariant,
  purgeVariant,
  emptyTrash,
  getTrash,
  setActiveVariant,
  createVariant,
  exportStoreJson,
  importStoreJson,
  normalizeResume,
} from '../utils/resumeStore.js';
import { sound } from '../utils/soundEffects.js';

/** Delay before a store change is written to localStorage. */
const SAVE_DEBOUNCE_MS = 400;
/** How long the "merged from another tab" notice is suppressed for. */
const MERGE_NOTICE_COOLDOWN_MS = 5000;

/** Apply either a value or an updater function. */
export function resolveValue(updater, previous) {
  return typeof updater === 'function' ? updater(previous) : updater;
}

/**
 * The variant store: state, persistence, cross-tab merge, and every variant
 * action.
 *
 * Undo history is injected through `resetHistoryRef`, a ref whose `.current` is
 * filled in by useUndoRedo on the same render. Two hooks that each need the
 * other cannot take each other as plain arguments without a cycle, and a ref
 * breaks it: this hook reads the latest value at call time (long after mount),
 * so only the ordering inside App matters.
 */
export default function useResumeStore({ showToast, resetHistoryRef } = {}) {
  const [store, setStore] = useState(() => loadStore());

  // Read the injected reset at call time, not at render time.
  const resetHistory = useCallback(
    (next) => {
      resetHistoryRef?.current?.(next);
    },
    [resetHistoryRef]
  );

  const activeVariant = getActiveVariant(store);
  const resumeData = activeVariant?.data || INITIAL_RESUME_DATA;
  const theme = activeVariant?.theme || DEFAULT_THEME;

  // Persist, debounced so typing does not hammer localStorage on every keypress.
  const saveTimer = useRef(null);
  // Warn once per failure, not once per keystroke.
  const saveFailedRef = useRef(false);
  // Debounce the "merged from another tab" notice too.
  const mergeNotifiedRef = useRef(false);
  // Separate cooldown for the conflict notice: a merge and a conflict are
  // different messages about different problems, and one ref would let the
  // first suppress the second for five seconds.
  const conflictNotifiedRef = useRef(false);
  // Latest toast handler, so the save effect does not need it as a dependency
  // (which would restart the debounce whenever the toast changes).
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { ok, merged, conflicts } = saveStore(store);
      if (!ok && !saveFailedRef.current) {
        saveFailedRef.current = true;
        showToastRef.current?.(
          'error',
          'COULD NOT SAVE — BROWSER STORAGE IS FULL. EXPORT A BACKUP NOW.'
        );
      } else if (ok) {
        saveFailedRef.current = false;
      }
      // Another tab created a variant while this one was open. Adopt it rather
      // than losing it, and say so once.
      //
      // Deliberately does NOT reset the undo history: a merge only appends
      // variants this tab does not have, so the active variant's data and theme
      // are untouched and the user's own edit history is still valid. Undo
      // applies through a functional update, so it lands on top of the merged
      // store rather than overwriting it.
      if (merged && !mergeNotifiedRef.current) {
        mergeNotifiedRef.current = true;
        setStore(merged);
        showToastRef.current?.('info', 'MERGED CHANGES FROM ANOTHER TAB');
        setTimeout(() => {
          mergeNotifiedRef.current = false;
        }, MERGE_NOTICE_COOLDOWN_MS);
      }
      // Another tab edited a variant this tab also holds, more recently than
      // this tab's copy. Ours is the one that gets written — the user is
      // looking at it — so the other tab's newer edit is about to be dropped
      // from disk. Say so, with the name, instead of losing it in silence.
      if (conflicts?.length && !conflictNotifiedRef.current) {
        conflictNotifiedRef.current = true;
        const names = conflicts.map((c) => c.name).join(', ');
        showToastRef.current?.(
          'error',
          `"${names}" WAS ALSO EDITED IN ANOTHER TAB — THAT TAB'S NEWER CHANGES WERE NOT SAVED`
        );
        setTimeout(() => {
          conflictNotifiedRef.current = false;
        }, MERGE_NOTICE_COOLDOWN_MS);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store]);

  // Flush pending writes if the tab is closed mid-edit.
  useEffect(() => {
    const flush = () => saveStore(store);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [store]);

  const setResumeData = useCallback((updater) => {
    setStore((prev) => {
      const active = getActiveVariant(prev);
      if (!active) return prev;
      return updateVariant(prev, active.id, {
        data: normalizeResume(resolveValue(updater, active.data)),
      });
    });
  }, []);

  const setTheme = useCallback((updater) => {
    setStore((prev) => {
      const active = getActiveVariant(prev);
      if (!active) return prev;
      return updateVariant(prev, active.id, {
        theme: resolveValue(updater, active.theme),
      });
    });
  }, []);

  // The cover letter lives on the variant next to `data` and `theme`. Undo/redo
  // deliberately does not snapshot it (it tracks { id, data, theme } only), so
  // undoing a resume edit cannot silently revert the letter.
  const setLetter = useCallback((updater) => {
    setStore((prev) => {
      const active = getActiveVariant(prev);
      if (!active) return prev;
      return updateVariant(prev, active.id, {
        letter: resolveValue(updater, active.letter),
      });
    });
  }, []);

  // --- variant actions -----------------------------------------------------
  // Each of these swaps the document out from under the editor, so history is
  // reset to the new state. Without this, Ctrl+Z after switching variants would
  // paste the previous variant's resume into this one.
  const handleSelectVariant = useCallback(
    (id) => {
      sound.playTab();
      const next = setActiveVariant(store, id);
      setStore(next);
      resetHistory?.(next);
    },
    [store, resetHistory]
  );

  const handleCreateVariant = useCallback(() => {
    sound.playSuccess();
    const next = addVariant(
      store,
      createVariant({
        name: `Resume ${store.variants.length + 1}`,
        data: INITIAL_RESUME_DATA,
        theme: DEFAULT_THEME,
      })
    );
    setStore(next);
    resetHistory?.(next);
    showToastRef.current?.('success', 'NEW RESUME VARIANT CREATED');
  }, [store, resetHistory]);

  const handleDuplicateVariant = useCallback(
    (id) => {
      sound.playAction();
      const next = duplicateVariant(store, id);
      setStore(next);
      resetHistory?.(next);
      showToastRef.current?.('success', 'VARIANT DUPLICATED');
    },
    [store, resetHistory]
  );

  const handleRenameVariant = useCallback((id, name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    setStore((prev) => updateVariant(prev, id, { name: clean }));
  }, []);

  const handleDeleteVariant = useCallback(
    (id) => {
      if (store.variants.length <= 1) {
        showToastRef.current?.('error', 'CANNOT DELETE THE ONLY REMAINING RESUME');
        return;
      }
      sound.playAction();
      const next = removeVariant(store, id);
      setStore(next);
      resetHistory?.(next);
      showToastRef.current?.('success', 'MOVED TO TRASH — RECOVERABLE FOR 30 DAYS');
    },
    [store, resetHistory]
  );

  /** Put a trashed resume back. Gets a fresh id, see restoreVariant. */
  const handleRestoreVariant = useCallback(
    (id) => {
      const next = restoreVariant(store, id);
      if (next === store) return;
      sound.playAction();
      setStore(next);
      resetHistory?.(next);
      showToastRef.current?.('success', 'RESUME RESTORED');
    },
    [store, resetHistory]
  );

  /** Destroy one trashed resume for good. */
  const handlePurgeVariant = useCallback(
    (id) => {
      const next = purgeVariant(store, id);
      if (next === store) return;
      sound.playAction();
      setStore(next);
      showToastRef.current?.('info', 'DELETED PERMANENTLY');
    },
    [store]
  );

  /** Destroy the whole trash. */
  const handleEmptyTrash = useCallback(() => {
    const count = getTrash(store).length;
    if (count === 0) return;
    sound.playAction();
    setStore(emptyTrash(store));
    showToastRef.current?.('info', `EMPTIED TRASH — ${count} DELETED`);
  }, [store]);

  const handleExportAllVariants = useCallback(() => {
    try {
      const json = exportStoreJson(store);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resume-variants-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToastRef.current?.('success', `EXPORTED ${store.variants.length} VARIANT(S)`);
    } catch (err) {
      console.error(err);
      showToastRef.current?.('error', 'EXPORT FAILED');
    }
  }, [store]);

  const handleImportVariants = useCallback(
    async (file) => {
      if (!file) return;
      try {
        const text = await file.text();
        const imported = importStoreJson(text);
        sound.playSuccess();
        setStore(imported);
        resetHistory?.(imported);
        showToastRef.current?.('success', `IMPORTED ${imported.variants.length} VARIANT(S)`);
      } catch (err) {
        showToastRef.current?.('error', err.message || 'IMPORT FAILED');
      }
    },
    [resetHistory]
  );

  /** Reset the ACTIVE variant to the shipped sample data. */
  const handleResetDefault = useCallback(() => {
    if (
      window.confirm(
        `Reset "${activeVariant?.name || 'this resume'}" to the sample data and default theme?\n\nOther resume variants are not affected.`
      )
    ) {
      setStore((prev) => {
        const active = getActiveVariant(prev);
        if (!active) return prev;
        return updateVariant(prev, active.id, {
          data: normalizeResume(INITIAL_RESUME_DATA),
          theme: DEFAULT_THEME,
        });
      });
      sound.playAction();
      showToastRef.current?.('success', 'REVERTED TO SAMPLE DATA');
    }
  }, [activeVariant]);

  return {
    store,
    setStore,
    activeVariant,
    resumeData,
    theme,
    setResumeData,
    setTheme,
    setLetter,
    handleSelectVariant,
    handleCreateVariant,
    handleDuplicateVariant,
    handleRenameVariant,
    handleDeleteVariant,
    handleRestoreVariant,
    handlePurgeVariant,
    handleEmptyTrash,
    trash: getTrash(store),
    handleExportAllVariants,
    handleImportVariants,
    handleResetDefault,
  };
}
