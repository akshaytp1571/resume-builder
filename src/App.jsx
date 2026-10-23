import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import Navbar from './components/ui/Navbar';
import VariantSwitcher from './components/ui/VariantSwitcher';
import EditorSidebar from './components/editor/EditorSidebar';
import ResumePreview from './components/preview/ResumePreview';
import AtsScoreModal from './components/ui/AtsScoreModal';
import AiConfigModal from './components/ui/AiConfigModal';
import AiRefineModal from './components/ui/AiRefineModal';
import JobMatchModal from './components/ui/JobMatchModal';
import JobCredentialsModal from './components/ui/JobCredentialsModal';
import ApplyModal from './components/ui/ApplyModal';
import ApplicationTracker from './components/ui/ApplicationTracker';
import ResumeUploadModal from './components/ui/ResumeUploadModal';
import { INITIAL_RESUME_DATA, DEFAULT_THEME, TEMPLATES_CONFIG } from './data/initialData.js';
import { exportToDocx, exportCoverLetterToDocx } from './utils/docxExporter.js';
import { exportToPdf, triggerPrint } from './utils/pdfExporter.js';
import { calculateAtsScore } from './utils/atsScorer.js';
import { getSavedAiConfig } from './utils/aiService.js';
import { getResumePath } from './utils/resumePath.js';
import { sound } from './utils/soundEffects.js';
import {
  loadStore,
  saveStore,
  getActiveVariant,
  updateVariant,
  addVariant,
  duplicateVariant,
  removeVariant,
  setActiveVariant,
  createVariant,
  exportStoreJson,
  importStoreJson,
  normalizeResume,
  hasRecoveryCopy,
  listRecoveryKeys,
} from './utils/resumeStore.js';
import { countApplications, loadApplications } from './utils/applicationTracker.js';
import { CheckCircle2, AlertCircle, ShieldAlert, Download, X } from 'lucide-react';
import { createHistory, isEditableTarget } from './utils/history.js';

/** Undo history depth. Bounded so a long editing session cannot grow forever. */
const HISTORY_LIMIT = 50;
/**
 * Longer than the 400ms save debounce on purpose: the save timer marks "the
 * browser has the latest data", this one marks "the user paused". A pause is
 * the natural boundary between one undo step and the next, and reusing the
 * save timer's 400ms would split a burst of typing into several steps.
 */
const HISTORY_DEBOUNCE_MS = 600;

/** Set when the user dismisses the recovery banner so it stops nagging. */
const RECOVERY_BANNER_DISMISSED_KEY = 'precision_resume_banner_dismissed';
const BANNER_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

/**
 * Recovery keys to show a banner for, newest first — or [] when the user has
 * dismissed it or nothing was ever quarantined. Called as a lazy state
 * initialiser so it runs once per load, not on every render.
 */
function readRecoveryKeys() {
  try {
    if (localStorage.getItem(RECOVERY_BANNER_DISMISSED_KEY)) return [];
  } catch (e) {
    // Storage is blocked, so there is nothing quarantined to rescue either.
    return [];
  }
  return hasRecoveryCopy() ? listRecoveryKeys() : [];
}

/** Apply either a value or an updater function. */
function resolveValue(updater, previous) {
  return typeof updater === 'function' ? updater(previous) : updater;
}

/**
 * The part of a variant that undo restores: data and theme, nothing else.
 *
 * Identity fields (id, name, timestamps) are deliberately excluded — undoing an
 * edit must not rename the resume back.
 */
function snapshotOfStore(store) {
  const active = getActiveVariant(store);
  if (!active) return null;
  return { id: active.id, data: active.data, theme: active.theme };
}

export default function App() {
  // --- resume variants -----------------------------------------------------
  // The store is the single source of truth. `resumeData` and `theme` are
  // derived from whichever variant is active, so switching variants needs no
  // extra state juggling.
  const [store, setStore] = useState(() => loadStore());

  const activeVariant = getActiveVariant(store);
  const resumeData = activeVariant?.data || INITIAL_RESUME_DATA;
  const theme = activeVariant?.theme || DEFAULT_THEME;

  // Persist, debounced so typing does not hammer localStorage on every keypress.
  const saveTimer = useRef(null);
  // Warn once per failure, not once per keystroke.
  const saveFailedRef = useRef(false);
  // Debounce the "merged from another tab" notice too.
  const mergeNotifiedRef = useRef(false);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { ok, merged } = saveStore(store);
      if (!ok && !saveFailedRef.current) {
        saveFailedRef.current = true;
        setToast({
          type: 'error',
          message: 'COULD NOT SAVE — BROWSER STORAGE IS FULL. EXPORT A BACKUP NOW.',
        });
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
        setToast({
          type: 'info',
          message: 'MERGED CHANGES FROM ANOTHER TAB',
        });
        setTimeout(() => {
          mergeNotifiedRef.current = false;
        }, 5000);
      }
    }, 400);
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

  // --- undo / redo ---------------------------------------------------------
  // The history object lives in a ref: it is mutable state that must survive
  // re-renders without causing them. `historyVersion` is the only React state,
  // and it exists purely to re-render the toolbar when availability flips.
  const historyRef = useRef(null);
  if (historyRef.current === null) {
    historyRef.current = createHistory(HISTORY_LIMIT);
  }
  const [historyVersion, setHistoryVersion] = useState(0);
  const historyTimer = useRef(null);
  // Set while an undo/redo is being applied. The store change that results is
  // not a user edit, so it must not be recorded as a new history entry — doing
  // so would push the restored state on top of the redo branch and clear it,
  // making redo impossible after a single undo.
  const restoringRef = useRef(false);

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
  const applySnapshot = useCallback((snap) => {
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
  }, []);

  const handleUndo = useCallback(() => {
    const snap = historyRef.current.undo();
    if (!snap) return false;
    applySnapshot(snap);
    sound.playAction();
    setToast({ type: 'info', message: 'UNDO' });
    return true;
  }, [applySnapshot]);

  const handleRedo = useCallback(() => {
    const snap = historyRef.current.redo();
    if (!snap) return false;
    applySnapshot(snap);
    sound.playAction();
    setToast({ type: 'info', message: 'REDO' });
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

  // --- variant actions -----------------------------------------------------
  // Each of these swaps the document out from under the editor, so history is
  // reset to the new state. Without this, Ctrl+Z after switching variants would
  // paste the previous variant's resume into this one.
  const handleSelectVariant = (id) => {
    sound.playTab();
    const next = setActiveVariant(store, id);
    setStore(next);
    resetHistory(next);
  };

  const handleCreateVariant = () => {
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
    resetHistory(next);
    setToast({ type: 'success', message: 'NEW RESUME VARIANT CREATED' });
  };

  const handleDuplicateVariant = (id) => {
    sound.playAction();
    const next = duplicateVariant(store, id);
    setStore(next);
    resetHistory(next);
    setToast({ type: 'success', message: 'VARIANT DUPLICATED' });
  };

  const handleRenameVariant = (id, name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    setStore((prev) => updateVariant(prev, id, { name: clean }));
  };

  const handleDeleteVariant = (id) => {
    if (store.variants.length <= 1) {
      setToast({ type: 'error', message: 'CANNOT DELETE THE ONLY REMAINING RESUME' });
      return;
    }
    sound.playAction();
    const next = removeVariant(store, id);
    setStore(next);
    resetHistory(next);
    setToast({ type: 'success', message: 'VARIANT DELETED' });
  };

  // Download the cover letter as DOCX. A letter is not a resume, so it goes
  // through its own exporter rather than reusing exportToDocx.
  const handleDownloadCoverLetter = async () => {
    const letter = activeVariant?.letter;
    if (!letter || !String(letter.body || '').trim()) {
      setToast({ type: 'error', message: 'WRITE A COVER LETTER FIRST' });
      return;
    }

    setIsExporting(true);
    setToast({ type: 'info', message: 'GENERATING COVER LETTER DOCX...' });

    try {
      await exportCoverLetterToDocx(letter, resumeData, theme);
      fireCelebration();
      setToast({ type: 'success', message: 'COVER LETTER GENERATED!' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Failed to generate the cover letter.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAllVariants = () => {
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
      setToast({ type: 'success', message: `EXPORTED ${store.variants.length} VARIANT(S)` });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'EXPORT FAILED' });
    }
  };

  const handleImportVariants = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const imported = importStoreJson(text);
      sound.playSuccess();
      setStore(imported);
      resetHistory(imported);
      setToast({
        type: 'success',
        message: `IMPORTED ${imported.variants.length} VARIANT(S)`,
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'IMPORT FAILED' });
    }
  };

  // --- recovery banner -----------------------------------------------------
  const dismissRecoveryBanner = () => {
    try {
      localStorage.setItem(RECOVERY_BANNER_DISMISSED_KEY, '1');
    } catch (e) {
      // If storage is blocked the flag cannot persist, but hiding it for this
      // session still beats a banner the user cannot get rid of.
    }
    setRecoveryKeys([]);
    sound.playAction();
  };

  /**
   * Save the newest quarantined value to a file.
   *
   * The RAW string goes straight into the Blob — never JSON.parse'd and never
   * round-tripped — because this button exists precisely for data that does
   * not parse. Re-serialising would either throw or quietly drop the bytes the
   * user is trying to recover.
   */
  const downloadRecoveryCopy = () => {
    const key = recoveryKeys[0];
    if (!key) return;

    let raw = null;
    try {
      raw = localStorage.getItem(key);
    } catch (e) {
      console.error('Could not read the recovery copy:', e);
    }

    if (raw == null) {
      setToast({ type: 'error', message: 'RECOVERY COPY IS NO LONGER IN THIS BROWSER' });
      return;
    }

    try {
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // The timestamp in the key is what makes this file identifiable later.
      a.download = `resume-recovery-${key.split('__recovery_')[1] || Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      sound.playSuccess();
      setToast({ type: 'success', message: 'RECOVERY COPY DOWNLOADED — KEEP IT SAFE' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'COULD NOT DOWNLOAD THE RECOVERY COPY' });
    }
  };

  // --- AI state & modals ---------------------------------------------------
  const [aiConfig, setAiConfig] = useState(getSavedAiConfig);
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [isJobMatchOpen, setIsJobMatchOpen] = useState(false);
  const [isJobCredentialsOpen, setIsJobCredentialsOpen] = useState(false);
  // Application tracker. The count is read from storage rather than derived from
  // the variant store: applications outlive the resume that was sent, and
  // ApplyModal writes to that key directly when the agent confirms a submission.
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [applications, setApplications] = useState(() => loadApplications());
  const [applicationCount, setApplicationCount] = useState(() => countApplications());
  const refreshApplicationCount = useCallback(() => {
    setApplicationCount(countApplications());
  }, []);
  const [applyJob, setApplyJob] = useState(null);
  // Absolute path to the resume file the apply agent should attach.
  const [resumePath, setResumePathState] = useState(() => getResumePath());
  const [aiRefineState, setAiRefineState] = useState({
    isOpen: false,
    title: '',
    originalText: '',
    refinedText: '',
    onApply: null,
    onRegenerate: null,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [isAtsOpen, setIsAtsOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [toast, setToast] = useState(null);

  // Quarantined copies from a store that could not be parsed. Read once per
  // load; dismissing clears it for this session and persists the flag.
  const [recoveryKeys, setRecoveryKeys] = useState(readRecoveryKeys);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Measured page height, reported by ResumePreview. Null until the first
  // measurement, which keeps the ATS score on its legacy path until then.
  const [layout, setLayout] = useState(null);

  // Live ATS score. `layout` is a second argument only; a null measurement
  // means the scorer behaves exactly as it did before layout existed.
  const atsResult = useMemo(
    () => calculateAtsScore(resumeData, layout),
    [resumeData, layout]
  );

  // Stable identity so ResumePreview's observer effect is not rebuilt on every
  // render, and so an identical measurement cannot re-trigger a state update
  // (which would loop: score -> render -> measure -> score).
  const handleLayoutMeasured = useCallback((measurement) => {
    setLayout((previous) => {
      if (
        previous &&
        previous.pageHeightPx === measurement.pageHeightPx &&
        previous.pageBudgetPx === measurement.pageBudgetPx
      ) {
        return previous;
      }
      return measurement;
    });
  }, []);

  const activeTemplateObj = useMemo(() => {
    return (
      TEMPLATES_CONFIG.find((t) => t.id === theme.templateId) ||
      TEMPLATES_CONFIG[0]
    );
  }, [theme.templateId]);

  // Confetti trigger
  const fireCelebration = () => {
    sound.playSuccess();
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    setToast({ type: 'info', message: 'SYNTHESIZING HIGH-RESOLUTION PDF...' });

    try {
      await exportToPdf('resume-preview', resumeData);
      fireCelebration();
      setToast({ type: 'success', message: 'PDF EXPORT COMPILED SUCCESSFULLY!' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'PDF Export encountered error. Use Print fallback.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Download DOCX
  const handleDownloadDocx = async () => {
    setIsExporting(true);
    setToast({ type: 'info', message: 'GENERATING NATIVE OPENXML DOCX...' });

    try {
      await exportToDocx(resumeData, theme);
      fireCelebration();
      setToast({ type: 'success', message: 'NATIVE DOCX DOCUMENT GENERATED!' });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Failed to generate DOCX document.' });
    } finally {
      setIsExporting(false);
    }
  };

  // Print
  const handlePrint = () => {
    sound.playAction();
    triggerPrint(resumeData);
  };

  // Reset the ACTIVE variant to the shipped sample data.
  const handleResetDefault = () => {
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
      setToast({ type: 'success', message: 'REVERTED TO SAMPLE DATA' });
    }
  };

  // Trigger Refine Modal
  const handleTriggerAiRefine = ({ title, originalText, refinedText, onApply, onRegenerate }) => {
    setAiRefineState({
      isOpen: true,
      title,
      originalText,
      refinedText,
      onApply,
      onRegenerate,
    });
  };

  return (
    <div className="min-h-screen bg-[#140715] text-[#fce7f3] flex flex-col font-sans selection:bg-rose-500 selection:text-white">
      {/* Top Atelier Studio Navbar */}
      <Navbar
        onDownloadPdf={handleDownloadPdf}
        onDownloadDocx={handleDownloadDocx}
        onPrint={handlePrint}
        onResetDefault={handleResetDefault}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAts={() => setIsAtsOpen(true)}
        onOpenAiConfig={() => setIsAiConfigOpen(true)}
        onOpenJobMatch={() => setIsJobMatchOpen(true)}
        onOpenApplications={() => setIsTrackerOpen(true)}
        applicationCount={applicationCount}
        aiConfig={aiConfig}
        atsScore={atsResult}
        isExporting={isExporting}
        templateName={activeTemplateObj.name}
        singlePage={theme.singlePage !== false}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onToggleSinglePage={() => {
          setTheme((prev) => {
            const nextVal = prev.singlePage === false;
            setToast({
              type: 'info',
              message: nextVal ? '1-PAGE AUTO-FIT ENABLED: COMPACTING MARGINS' : 'MULTI-PAGE MODE ENABLED',
            });
            return {
              ...prev,
              singlePage: nextVal,
              fontSize: nextVal ? 'compact' : 'normal',
            };
          });
        }}
      />

      {/* Recovery banner — a quarantined copy of an unreadable store exists.
          Deliberately in normal flow (not fixed) so it never covers the
          editor/preview split; it scrolls away with the page. */}
      {recoveryKeys.length > 0 && (
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
                onClick={downloadRecoveryCopy}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${BANNER_FOCUS_RING}`}
              >
                <Download size={13} aria-hidden="true" />
                <span>Download recovery copy</span>
              </button>
              <button
                type="button"
                onClick={dismissRecoveryBanner}
                aria-label="Dismiss the recovery notice"
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/30 transition-colors cursor-pointer flex items-center gap-1.5 ${BANNER_FOCUS_RING}`}
              >
                <X size={13} aria-hidden="true" />
                <span>Dismiss</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume variant bar */}
      <VariantSwitcher
        variants={store.variants}
        activeId={store.activeId}
        onSelect={handleSelectVariant}
        onDuplicate={handleDuplicateVariant}
        onRename={handleRenameVariant}
        onDelete={handleDeleteVariant}
        onCreate={handleCreateVariant}
        onExportAll={handleExportAllVariants}
        onImportFile={handleImportVariants}
      />

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Form / Settings Cyber Panel */}
        <EditorSidebar
          resumeData={resumeData}
          theme={theme}
          onUpdateResume={setResumeData}
          onUpdateTheme={setTheme}
          onTriggerAiRefine={handleTriggerAiRefine}
          onOpenAiConfig={() => setIsAiConfigOpen(true)}
          letter={activeVariant?.letter}
          onUpdateLetter={setLetter}
          onExportCoverLetter={handleDownloadCoverLetter}
        />

        {/* Right Live Holo-Dock Preview */}
        <ResumePreview
          resumeData={resumeData}
          theme={theme}
          onDownloadPdf={handleDownloadPdf}
          onDownloadDocx={handleDownloadDocx}
          onLayoutMeasured={handleLayoutMeasured}
        />
      </main>

      {/* ATS Scanner Hologram Modal */}
      {isAtsOpen && (
        <AtsScoreModal
          atsResult={atsResult}
          resumeData={resumeData}
          onClose={() => setIsAtsOpen(false)}
        />
      )}

      {/* AI Configuration Modal */}
      <AiConfigModal
        isOpen={isAiConfigOpen}
        onClose={() => setIsAiConfigOpen(false)}
        onConfigSaved={(savedCfg) => {
          setAiConfig(savedCfg);
          setToast({ type: 'success', message: `AI CONFIG SAVED: ${savedCfg.providerId.toUpperCase()}` });
        }}
      />

      {/* AI Refine Diff Modal */}
      <AiRefineModal
        isOpen={aiRefineState.isOpen}
        title={aiRefineState.title}
        originalText={aiRefineState.originalText}
        refinedText={aiRefineState.refinedText}
        onApply={aiRefineState.onApply || (() => {})}
        onRegenerate={async (directive) => {
          if (aiRefineState.onRegenerate) {
            const newRes = await aiRefineState.onRegenerate(directive);
            // The modal owns its editable text; pushing the value into its
            // prop keeps both in sync after a regeneration.
            setAiRefineState((prev) => ({ ...prev, refinedText: newRes }));
            return newRes;
          }
          return null;
        }}
        onClose={() => setAiRefineState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Target Job Matcher Modal */}
      <JobMatchModal
        isOpen={isJobMatchOpen}
        onClose={() => setIsJobMatchOpen(false)}
        resumeData={resumeData}
        onApplyTailoredSummary={(newSummary) => {
          setResumeData((prev) => ({ ...prev, summary: newSummary }));
          setToast({ type: 'success', message: 'TAILORED PROFESSIONAL SUMMARY APPLIED!' });
        }}
        onOpenAiConfig={() => setIsAiConfigOpen(true)}
        onOpenJobCredentials={() => setIsJobCredentialsOpen(true)}
        onOpenApply={(job) => setApplyJob(job)}
        aiConfig={aiConfig}
      />

      {/* Apply Agent Modal */}
      <ApplyModal
        isOpen={Boolean(applyJob)}
        onClose={() => setApplyJob(null)}
        job={applyJob}
        resumeData={resumeData}
        resumePath={resumePath}
        aiConfig={aiConfig}
        onSubmitted={() => {
          // ApplyModal has already written the record; re-read the count so the
          // Navbar badge reflects it without a reload.
          refreshApplicationCount();
          setToast({ type: 'success', message: 'APPLICATION SUBMITTED!' });
        }}
      />

      {/* Application Tracker */}
      <ApplicationTracker
        isOpen={isTrackerOpen}
        onClose={() => setIsTrackerOpen(false)}
        applications={applications}
        onListChange={(next) => {
          setApplications(next);
          refreshApplicationCount();
        }}
      />

      {/* Job Board Credentials Modal */}
      <JobCredentialsModal
        isOpen={isJobCredentialsOpen}
        onClose={() => setIsJobCredentialsOpen(false)}
        onSaved={() => {
          // Pick up any change to the resume path.
          setResumePathState(getResumePath());
          setToast({ type: 'success', message: 'JOB BOARD LOGINS SAVED LOCALLY' });
        }}
      />

      {/* Resume Ingestion / Upload Modal */}
      <ResumeUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        currentResumeData={resumeData}
        onApplyParsedResume={(newResume) => {
          setResumeData(normalizeResume(newResume));
          fireCelebration();
          setToast({ type: 'success', message: 'RESUME INGESTED & SYNCHRONIZED SUCCESSFULLY!' });
        }}
        onOpenAiConfig={() => setIsAiConfigOpen(true)}
      />

      {/* Atelier Studio Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#200824]/95 border border-pink-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)] text-xs font-sans text-pink-100 animate-fade-in no-print backdrop-blur-xl"
        >
          {toast.type === 'success' && (
            <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
          )}
          {toast.type === 'error' && (
            <AlertCircle size={17} className="text-rose-400 shrink-0" />
          )}
          {toast.type === 'info' && (
            <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          <span className="font-semibold tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
