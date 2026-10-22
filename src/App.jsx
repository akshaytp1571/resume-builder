import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import Navbar from './components/ui/Navbar';
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
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [resumeData, setResumeData] = useState(() => {
    try {
      const saved = localStorage.getItem('precision_resume_data_v1');
      return saved ? JSON.parse(saved) : INITIAL_RESUME_DATA;
    } catch (e) {
      return INITIAL_RESUME_DATA;
    }
  });

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('precision_theme_data_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_THEME,
          ...parsed,
          // Guarantee singlePage is active by default to prevent spillover
          singlePage: parsed.singlePage !== undefined ? parsed.singlePage : true,
        };
      }
      return DEFAULT_THEME;
    } catch (e) {
      return DEFAULT_THEME;
    }
  });

  // AI State & Modals
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

  // Sync with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('precision_resume_data_v1', JSON.stringify(resumeData));
    } catch (e) {
      console.error(e);
    }
  }, [resumeData]);

  useEffect(() => {
    try {
      localStorage.setItem('precision_theme_data_v1', JSON.stringify(theme));
    } catch (e) {
      console.error(e);
    }
  }, [theme]);

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

  // Reset to default
  const handleResetDefault = () => {
    if (window.confirm('Reset resume data to original document content and default executive theme?')) {
      setResumeData(INITIAL_RESUME_DATA);
      setTheme(DEFAULT_THEME);
      sound.playAction();
      setToast({ type: 'success', message: 'REVERTED TO ORIGINAL SPECIMEN DATA' });
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
          setResumeData(newResume);
          fireCelebration();
          setToast({ type: 'success', message: 'RESUME INGESTED & SYNCHRONIZED SUCCESSFULLY!' });
        }}
        onOpenAiConfig={() => setIsAiConfigOpen(true)}
      />

      {/* Atelier Studio Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#200824]/95 border border-pink-500/40 shadow-[0_10px_35px_rgba(0,0,0,0.6)] text-xs font-sans text-pink-100 animate-fade-in no-print backdrop-blur-xl">
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
