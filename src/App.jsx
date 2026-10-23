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
import ResumeUploadModal from './components/ui/ResumeUploadModal';
import { INITIAL_RESUME_DATA, DEFAULT_THEME, TEMPLATES_CONFIG } from './data/initialData.js';
import { exportToDocx } from './utils/docxExporter.js';
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
} from './utils/resumeStore.js';
import { CheckCircle2, AlertCircle } from 'lucide-react';

/** Apply either a value or an updater function. */
function resolveValue(updater, previous) {
  return typeof updater === 'function' ? updater(previous) : updater;
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
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveStore(store);
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

  // --- variant actions -----------------------------------------------------
  const handleSelectVariant = (id) => {
    sound.playTab();
    setStore((prev) => setActiveVariant(prev, id));
  };

  const handleCreateVariant = () => {
    sound.playSuccess();
    setStore((prev) =>
      addVariant(
        prev,
        createVariant({
          name: `Resume ${prev.variants.length + 1}`,
          data: INITIAL_RESUME_DATA,
          theme: DEFAULT_THEME,
        })
      )
    );
    setToast({ type: 'success', message: 'NEW RESUME VARIANT CREATED' });
  };

  const handleDuplicateVariant = (id) => {
    sound.playAction();
    setStore((prev) => duplicateVariant(prev, id));
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
    setStore((prev) => removeVariant(prev, id));
    setToast({ type: 'success', message: 'VARIANT DELETED' });
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
      setToast({
        type: 'success',
        message: `IMPORTED ${imported.variants.length} VARIANT(S)`,
      });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'IMPORT FAILED' });
    }
  };

  // --- AI state & modals ---------------------------------------------------
  const [aiConfig, setAiConfig] = useState(getSavedAiConfig);
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [isJobMatchOpen, setIsJobMatchOpen] = useState(false);
  const [isJobCredentialsOpen, setIsJobCredentialsOpen] = useState(false);
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

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Live ATS score
  const atsResult = useMemo(() => calculateAtsScore(resumeData), [resumeData]);

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
        aiConfig={aiConfig}
        atsScore={atsResult}
        isExporting={isExporting}
        templateName={activeTemplateObj.name}
        singlePage={theme.singlePage !== false}
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
        />

        {/* Right Live Holo-Dock Preview */}
        <ResumePreview
          resumeData={resumeData}
          theme={theme}
          onDownloadPdf={handleDownloadPdf}
          onDownloadDocx={handleDownloadDocx}
        />
      </main>

      {/* ATS Scanner Hologram Modal */}
      {isAtsOpen && (
        <AtsScoreModal
          atsResult={atsResult}
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
          setToast({ type: 'success', message: 'APPLICATION SUBMITTED!' });
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
