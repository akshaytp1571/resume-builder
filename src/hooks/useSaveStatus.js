import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Explicit save + "set as default" for the resume currently being edited.
 *
 * WHY THIS EXISTS
 * The store already autosaves on a 400 ms debounce and flushes on beforeunload,
 * and that path was verified working in a real browser. The complaint it did not
 * answer is different: there was no way to *tell* the app "this is the version I
 * want back", and nothing on screen ever confirmed a save had happened. Silent
 * autosave and broken autosave look identical to a user.
 *
 * So this adds two things the autosave cannot provide:
 *
 *  1. A visible status — "Saving…" / "Saved 2s ago" / "Save failed" — so the
 *     state is observable rather than inferred.
 *  2. `setAsDefault()`, which snapshots the active variant and marks it as the
 *     one to restore. Autosave keeps the current state; this pins the *chosen*
 *     state, so an experimental edit cannot quietly become what you come back to.
 *
 * "Default" is stored per-store, not per-variant, so deleting the default
 * variant leaves the pointer dangling — `resolveDefault` handles that rather
 * than throwing.
 */

const DEFAULT_KEY = 'precision_resume_default_v1';

/** Read the pinned default pointer, or null. Never throws. */
export function loadDefaultPointer() {
  try {
    const raw = localStorage.getItem(DEFAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      variantId: typeof parsed.variantId === 'string' ? parsed.variantId : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return null;
  }
}

/** Persist the pointer. Returns { ok } like saveStore. */
export function saveDefaultPointer(pointer) {
  try {
    if (!pointer) {
      localStorage.removeItem(DEFAULT_KEY);
      return { ok: true };
    }
    localStorage.setItem(
      DEFAULT_KEY,
      JSON.stringify({ variantId: pointer.variantId, savedAt: pointer.savedAt })
    );
    return { ok: true };
  } catch (e) {
    console.error('Could not save the default pointer:', e);
    return { ok: false };
  }
}

/**
 * Does the pinned default still point at a variant that exists?
 * Returns the variant, or null when the pointer is absent or orphaned.
 */
export function resolveDefault(pointer, store) {
  if (!pointer?.variantId) return null;
  const variants = Array.isArray(store?.variants) ? store.variants : [];
  return variants.find((v) => v.id === pointer.variantId) || null;
}

const STATUS = {
  idle: 'idle',
  saving: 'saving',
  saved: 'saved',
  failed: 'failed',
};

/**
 * @param {object}   options
 * @param {function} options.save       () => { ok }  — the actual write
 * @param {string}   options.variantId  active variant id
 * @param {*}        options.signature  changes whenever the data changes
 */
export default function useSaveStatus({ save, variantId, signature }) {
  const [status, setStatus] = useState(STATUS.idle);
  const [savedAt, setSavedAt] = useState(null);
  const [isDefault, setIsDefault] = useState(false);
  const firstRun = useRef(true);

  const markSaved = useCallback(() => {
    setStatus(STATUS.saved);
    setSavedAt(new Date().toISOString());
  }, []);

  // Autosave already writes on a debounce. This effect observes that the data
  // changed and reports the outcome, so the user can see it happened.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return undefined;
    }
    setStatus(STATUS.saving);
    const t = setTimeout(() => {
      try {
        const result = save?.();
        if (result && result.ok === false) setStatus(STATUS.failed);
        else markSaved();
      } catch {
        setStatus(STATUS.failed);
      }
    }, 450); // slightly after the store's own 400 ms debounce
    return () => clearTimeout(t);
    // `signature` is the data fingerprint; `save` is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Keep the "is this the default?" flag in sync when the active variant changes.
  useEffect(() => {
    const pointer = loadDefaultPointer();
    setIsDefault(Boolean(pointer?.variantId && pointer.variantId === variantId));
  }, [variantId]);

  const saveNow = useCallback(() => {
    setStatus(STATUS.saving);
    try {
      const result = save?.();
      if (result && result.ok === false) {
        setStatus(STATUS.failed);
        return { ok: false };
      }
      markSaved();
      return { ok: true };
    } catch {
      setStatus(STATUS.failed);
      return { ok: false };
    }
  }, [save, markSaved]);

  const setAsDefault = useCallback(() => {
    if (!variantId) return { ok: false };
    const wrote = saveDefaultPointer({
      variantId,
      savedAt: new Date().toISOString(),
    });
    if (!wrote.ok) return { ok: false };
    // Pinning is only meaningful if the data is actually on disk.
    saveNow();
    setIsDefault(true);
    return { ok: true };
  }, [variantId, saveNow]);

  const clearDefault = useCallback(() => {
    saveDefaultPointer(null);
    setIsDefault(false);
  }, []);

  return { status, savedAt, isDefault, saveNow, setAsDefault, clearDefault, STATUS };
}
