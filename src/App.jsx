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
import RecoveryBanner from './components/ui/RecoveryBanner';
import ShortcutHelp from './components/ui/ShortcutHelp';
import JsonResumeModal from './components/ui/JsonResumeModal';
import { TEMPLATES_CONFIG } from './data/initialData.js';
import { exportToDocx, exportCoverLetterToDocx } from './utils/docxExporter.js';
import { exportToPdf, exportToVectorPdf, triggerPrint } from './utils/pdfExporter.js';
import { calculateAtsScore } from './utils/atsScorer.js';
import { getSavedAiConfig } from './utils/aiService.js';
import { getResumePath } from './utils/resumePath.js';
import { sound } from './utils/soundEffects.js';
import {
  normalizeResume,
  hasRecoveryCopy,
  listRecoveryKeys,
  saveStore,
  importStoreJson,
} from './utils/resumeStore.js';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import useToasts from './hooks/useToasts.js';
import useResumeStore from './hooks/useResumeStore.js';
import useUndoRedo from './hooks/useUndoRedo.js';
import useApplications from './hooks/useApplications.js';
import useLayoutMeasurement from './hooks/useLayoutMeasurement.js';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts.js';
import useCommandBar, { buildCommands } from './hooks/useCommandBar.js';
import useSaveStatus from './hooks/useSaveStatus.js';
import CommandBar from './components/ui/CommandBar.jsx';
import SaveStatus from './components/ui/SaveStatus.jsx';
import GoogleDriveModal from './components/ui/GoogleDriveModal.jsx';

/** Set when the user dismisses the recovery banner so it stops nagging. */
const RECOVERY_BANNER_DISMISSED_KEY = 'precision_resume_banner_dismissed';

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

export default function App() {
  // --- toasts --------------------------------------------------------------
  // Declared first: the store, history and export handlers all report through
  // it, and a toast is the one piece of state nothing else depends on.
  const { toast, setToast, showToast } = useToasts();

  // --- undo / redo wiring --------------------------------------------------
  // useResumeStore and useUndoRedo need each other: the store's variant actions
  // call resetHistory, and history needs setStore. The ref breaks the cycle —
  // the store reads `.current` at call time, so declaring the ref first is all
  // the ordering this needs.
  const resetHistoryRef = useRef(null);

  // --- resume variants -----------------------------------------------------
  const {
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
    handleExportAllVariants,
    handleImportVariants,
    handleResetDefault,
  } = useResumeStore({ showToast, resetHistoryRef });

  const { handleUndo, handleRedo, canUndo, canRedo, resetHistory } = useUndoRedo({
    store,
    setStore,
    showToast,
  });

  // Publish resetHistory for the store's variant handlers, which were created
  // before it existed.
  resetHistoryRef.current = resetHistory;

  // --- save status + "set as default" --------------------------------------
  // Autosave already runs inside useResumeStore. This adds the observable half:
  // a status the user can see, an explicit Save, and a way to pin the current
  // version as the one to come back to.
  const saveStatus = useSaveStatus({
    save: () => saveStore(store),
    variantId: activeVariant?.id,
    signature: store,
  });

  // --- applications --------------------------------------------------------
  const {
    applications,
    isTrackerOpen,
    setIsTrackerOpen,
    applicationCount,
    refreshApplicationCount,
    updateApplications,
  } = useApplications();

  // --- layout --------------------------------------------------------------
  const { layout, handleLayoutMeasured } = useLayoutMeasurement();

  // --- local UI state ------------------------------------------------------
  const [aiConfig, setAiConfig] = useState(getSavedAiConfig);
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [isJobMatchOpen, setIsJobMatchOpen] = useState(false);
  const [isJobCredentialsOpen, setIsJobCredentialsOpen] = useState(false);
  const [applyJob, setApplyJob] = useState(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isJsonResumeOpen, setIsJsonResumeOpen] = useState(false);
  const [isDriveOpen, setIsDriveOpen] = useState(false);
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
  // Counts export sweeps rather than holding a boolean: a rapid second export
  // must restart the animation, and a boolean would need a reset in between.
  const [sweepCount, setSweepCount] = useState(0);
  const [isAtsOpen, setIsAtsOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Quarantined copies from a store that could not be parsed. Read once per
  // load; dismissing clears it for this session and persists the flag.
  const [recoveryKeys, setRecoveryKeys] = useState(readRecoveryKeys);

  // Live ATS score. `layout` is a second argument only; a null measurement
  // means the scorer behaves exactly as it did before layout existed.
  const atsResult = useMemo(
    () => calculateAtsScore(resumeData, layout),
    [resumeData, layout]
  );

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

  // --- export handlers -----------------------------------------------------
  // All three exports share the same shape: flip the busy flag, announce, run,
  // celebrate or report, clear the flag. One helper keeps the messages and the
  // ordering in one place instead of three copies that can drift apart.
  const runExport = async ({ start, run, success, failure }) => {
    setIsExporting(true);
    setSweepCount((n) => n + 1);
    setToast({ type: 'info', message: start });
    try {
      await run();
      fireCelebration();
      setToast({ type: 'success', message: success });
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: failure });
    } finally {
      setIsExporting(false);
    }
  };

  // A letter is not a resume, so it goes through its own exporter rather than
  // reusing exportToDocx.
  const handleDownloadCoverLetter = () => {
    const letter = activeVariant?.letter;
    if (!letter || !String(letter.body || '').trim()) {
      setToast({ type: 'error', message: 'WRITE A COVER LETTER FIRST' });
      return;
    }
    return runExport({
      start: 'GENERATING COVER LETTER DOCX...',
      run: () => exportCoverLetterToDocx(letter, resumeData, theme),
      success: 'COVER LETTER GENERATED!',
      failure: 'Failed to generate the cover letter.',
    });
  };

  const handleDownloadPdf = () =>
    runExport({
      start: 'SYNTHESIZING HIGH-RESOLUTION PDF...',
      run: () => exportToPdf('resume-preview', resumeData),
      success: 'PDF EXPORT COMPILED SUCCESSFULLY!',
      failure: 'PDF Export encountered error. Use Print fallback.',
    });

  // Vector PDF: the browser's own print-to-PDF, which emits real selectable
  // text instead of a JPEG. exportToVectorPdf opens the print dialog, so there
  // is no "file saved" moment to celebrate — the toast tells the user to pick
  // "Save as PDF" rather than claiming a download happened.
  const handleDownloadVectorPdf = () =>
    runExport({
      start: 'OPENING PRINT DIALOG — CHOOSE "SAVE AS PDF"...',
      run: () => exportToVectorPdf('resume-preview', resumeData),
      success: 'PRINT DIALOG OPENED — SAVE AS PDF FOR SELECTABLE TEXT',
      failure: 'Vector PDF export failed. Use Print instead.',
    });

  const handleDownloadDocx = () =>
    runExport({
      start: 'GENERATING NATIVE OPENXML DOCX...',
      run: () => exportToDocx(resumeData, theme),
      success: 'NATIVE DOCX DOCUMENT GENERATED!',
      failure: 'Failed to generate DOCX document.',
    });

  // Print
  const handlePrint = () => {
    sound.playAction();
    triggerPrint(resumeData);
  };

  // --- keyboard shortcuts ---------------------------------------------------
  // Ctrl/Cmd+S -> DOCX, Ctrl/Cmd+Shift+S -> PDF, ? -> this panel.
  // Undo/redo stay owned by useUndoRedo's own listener; the hook returns early
  // on z/y so the two can never act on the same press.
  useKeyboardShortcuts({
    onExportDocx: handleDownloadDocx,
    onExportPdf: handleDownloadPdf,
    onOpenHelp: () => setIsShortcutsOpen(true),
    helpOpen: isShortcutsOpen,
  });

  // ⌘K palette. The registry is derived from SHORTCUTS plus the extra
  // commands below, so the palette can never advertise a key the dispatcher
  // does not handle.
  const commandBar = useCommandBar();
  const commandHandlers = useMemo(
    () => ({
      undo: handleUndo,
      redo: handleRedo,
      exportDocx: handleDownloadDocx,
      exportPdf: handleDownloadPdf,
      help: () => setIsShortcutsOpen(true),
    }),
    [handleUndo, handleRedo, handleDownloadDocx, handleDownloadPdf]
  );
  const commands = useMemo(
    () =>
      buildCommands(commandHandlers, [
        {
          id: 'open-json-resume',
          title: 'Import or export JSON Resume',
          category: 'Document',
          run: () => setIsJsonResumeOpen(true),
        },
        {
          id: 'export-cover-letter',
          title: 'Export cover letter as DOCX',
          category: 'Export',
          run: handleDownloadCoverLetter,
        },
        {
          id: 'open-tracker',
          title: 'Open application tracker',
          category: 'Navigate',
          run: () => setIsTrackerOpen(true),
        },
        {
          id: 'open-ats',
          title: 'Open ATS score breakdown',
          category: 'Navigate',
          run: () => setIsAtsOpen(true),
        },
        {
          id: 'open-job-match',
          title: 'Match resume to a job description',
          category: 'Navigate',
          run: () => setIsJobMatchOpen(true),
        },
        {
          id: 'new-variant',
          title: 'New resume variant',
          category: 'Variant',
          run: handleCreateVariant,
        },
        {
          id: 'open-upload',
          title: 'Import a resume file',
          category: 'Document',
          run: () => setIsUploadOpen(true),
        },
      ]),
    [
      commandHandlers,
      handleDownloadCoverLetter,
      handleCreateVariant,
    ]
  );

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
    <div className="flex min-h-screen flex-col bg-void font-sans text-bone selection:bg-signal selection:text-void">
      {/* Skip link. Must be the FIRST focusable node in the DOM — it is placed
          before the navbar, and nothing above it (this div, the RecoveryBanner
          further down) is focusable, so a keyboard user reaches it on the very
          first Tab. Hidden by .skip-link until focused; excluded in @media
          print via the .skip-link rule in index.css. */}
      <a href="#main-content" className="skip-link">
        Skip to resume editor
      </a>

      {/* Top Atelier Studio Navbar */}
      <Navbar
        onDownloadPdf={handleDownloadPdf}
        onDownloadVectorPdf={handleDownloadVectorPdf}
        onDownloadDocx={handleDownloadDocx}
        onPrint={handlePrint}
        onResetDefault={handleResetDefault}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenAts={() => setIsAtsOpen(true)}
        onOpenAiConfig={() => setIsAiConfigOpen(true)}
        onOpenJobMatch={() => setIsJobMatchOpen(true)}
        onOpenApplications={() => setIsTrackerOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
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

      {/* Recovery banner — a quarantined copy of an unreadable store exists. */}
      <RecoveryBanner
        recoveryKeys={recoveryKeys}
        onDownload={downloadRecoveryCopy}
        onDismiss={dismissRecoveryBanner}
      />

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
        onOpenJsonResume={() => setIsJsonResumeOpen(true)}
      />

      {/* Main Workspace.
          tabIndex={-1} is what makes the skip link actually work: a plain
          <main> is not focusable, so following #main-content would scroll but
          leave focus on the link. -1 keeps it out of the tab order while
          allowing programmatic focus from the anchor. The focus ring is
          suppressed for this region in index.css. */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col lg:flex-row overflow-hidden relative"
      >
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
          saveStatus={saveStatus}
          onOpenDrive={() => setIsDriveOpen(true)}
        />

        {/* Right Live Holo-Dock Preview */}
        <ResumePreview
          resumeData={resumeData}
          theme={theme}
          onDownloadPdf={handleDownloadPdf}
          onDownloadDocx={handleDownloadDocx}
          onLayoutMeasured={handleLayoutMeasured}
        />

        {/* THE SWEEP. One 1px lime hairline crossing the bench on each export,
            so the wait has a shape. It is a sibling of the preview, never a
            child — the paper must never be inside an animated element, or a
            capture taken during the animation comes out off-register.
            key={sweepCount} remounts it so a second export restarts rather than
            continuing a finished animation. */}
        {sweepCount > 0 && isExporting && (
          <div
            key={sweepCount}
            aria-hidden="true"
            className="no-print dt-sweep pointer-events-none absolute inset-y-0 right-0 left-0 z-30 lg:left-[460px] xl:left-[500px]"
          >
            <div className="dt-sweep-line h-px w-full bg-signal" style={{ boxShadow: '0 0 8px rgba(216,255,62,0.5)' }} />
          </div>
        )}
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
        activeVariantId={activeVariant?.id || ''}
        activeVariantName={activeVariant?.name || ''}
        onApplicationRecorded={refreshApplicationCount}
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
        onListChange={updateApplications}
      />

      {/* JSON Resume import/export */}
      <JsonResumeModal
        isOpen={isJsonResumeOpen}
        onClose={() => setIsJsonResumeOpen(false)}
        resumeData={resumeData}
        onImport={setResumeData}
      />

      {/* Google Drive backup / restore */}
      <GoogleDriveModal
        isOpen={isDriveOpen}
        onClose={() => setIsDriveOpen(false)}
        store={store}
        resumeData={resumeData}
        onImportStore={(parsed, filename) => {
          try {
            const next = importStoreJson(JSON.stringify(parsed));
            setStore(next);
            resetHistory(next);
            showToast('success', `RESTORED FROM ${filename}`);
          } catch (err) {
            showToast('error', err?.message || 'That backup could not be read.');
          }
        }}
      />

      {/* Keyboard shortcuts reference (also opened with ?) */}
      <ShortcutHelp
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Command palette (⌘K / Ctrl+K) */}
      <CommandBar
        isOpen={commandBar.isOpen}
        onClose={commandBar.close}
        query={commandBar.query}
        setQuery={commandBar.setQuery}
        activeIndex={commandBar.activeIndex}
        setActiveIndex={commandBar.setActiveIndex}
        commands={commands}
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

      {/* Toast. 1px border, 2px left rule coloured by type, mono 11px, 0px
          radius, no blur. role="status" + aria-live are asserted by the suite. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="dt-saved-toast fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 border border-rule-2 bg-housing-2 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.06em] text-bone no-print"
          style={{
            borderLeftWidth: '2px',
            borderLeftColor:
              toast.type === 'success'
                ? 'var(--signal)'
                : toast.type === 'error'
                  ? 'var(--alarm)'
                  : 'var(--rule-2)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
          }}
        >
          {toast.type === 'success' && (
            <CheckCircle2 size={14} className="shrink-0 text-signal" aria-hidden="true" />
          )}
          {toast.type === 'error' && (
            <AlertCircle size={14} className="shrink-0 text-alarm" aria-hidden="true" />
          )}
          {toast.type === 'info' && (
            <span aria-hidden="true" className="inline-block h-[5px] w-[5px] shrink-0 bg-bone-52" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
