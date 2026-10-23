import React, { useState } from 'react';
import {
  Download,
  Printer,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  FileSpreadsheet,
  Activity,
  Bot,
  Target,
  Settings,
  Upload,
  Undo2,
  Redo2,
  Briefcase,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { isAiConfigReady } from '../../utils/aiService';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

export default function Navbar({
  onDownloadPdf,
  onDownloadDocx,
  onPrint,
  onResetDefault,
  onOpenUpload,
  onOpenAts,
  onOpenAiConfig,
  onOpenJobMatch,
  onOpenApplications,
  applicationCount = 0,
  aiConfig,
  atsScore,
  isExporting,
  templateName,
  singlePage = true,
  onToggleSinglePage,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) {
  const [soundEnabled, setSoundEnabled] = useState(sound.enabled);

  const toggleSound = () => {
    const updated = sound.toggleSound();
    setSoundEnabled(updated);
  };

  const hasAuth = aiConfig?.providerId === 'ollama' || Boolean(aiConfig?.apiKey?.trim());
  const hasModel = Boolean(aiConfig?.model?.trim());
  const isAiConfigured = isAiConfigReady(aiConfig) || (hasAuth && hasModel);

  return (
    <header className="sticky top-0 z-40 bg-[#160718]/90 backdrop-blur-xl border-b border-pink-500/20 px-3 sm:px-6 py-2.5 no-print select-none">
      {/* Top delicate studio ticker */}
      <div className="hidden md:flex items-center justify-between text-[11px] tracking-wider text-pink-300/70 pb-1.5 border-b border-pink-950/40 mb-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-pink-200">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            ✦ BOTANICAL CANVAS STUDIO // TEXTURED EDITION
          </span>
          <span aria-hidden="true" className="text-pink-300/70">•</span>
          <span className="text-emerald-300 flex items-center gap-1">
            <Sparkles size={11} className="text-emerald-400" />
            AI_STATUS: {isAiConfigured ? `ONLINE (${aiConfig?.providerId?.toUpperCase()} : ${aiConfig?.model})` : !hasAuth ? 'UNCONFIGURED' : 'NEEDS_MODEL'}
          </span>
          <span aria-hidden="true" className="text-pink-300/70">•</span>
          <span className="text-amber-200/80">TARGET: EXECUTIVE ATS</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleSound}
            className={`hover:text-pink-200 flex items-center gap-1 cursor-pointer transition-colors ${FOCUS_RING}`}
            title="Toggle UI Sound FX"
            aria-label={soundEnabled ? 'Mute interface sounds' : 'Unmute interface sounds'}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? (
              <>
                <Volume2 size={12} className="text-rose-400" />
                <span>AUDIO: ON</span>
              </>
            ) : (
              <>
                <VolumeX size={12} className="text-pink-400/70" />
                <span>AUDIO: MUTED</span>
              </>
            )}
          </button>
          <span>BUILD: 2026.10</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => sound.playAction()}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500 p-[1.5px] shadow-[0_0_20px_rgba(244,63,94,0.35)]">
              <div className="w-full h-full bg-[#1b081e] rounded-[10px] flex items-center justify-center">
                <Sparkles className="text-rose-300 group-hover:rotate-45 transition-transform duration-500" size={18} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-100 via-pink-200 to-amber-200 text-base sm:text-lg">
                ATELIER<span className="text-rose-400 font-serif italic font-normal ml-1">Resume</span>
              </span>
              <span className="text-[9px] font-bold tracking-widest px-2 py-0.5 rounded-full bg-pink-950/80 text-pink-300 border border-pink-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
                BOTANICAL STUDIO
              </span>
            </div>
            <div className="text-[11px] text-pink-300/80 flex items-center gap-1.5">
              <span className="text-pink-400/70">TEMPLATE:</span>
              <strong className="text-pink-100 font-semibold uppercase">{templateName}</strong>
            </div>
          </div>
        </div>

        {/* Center / AI Tools & ATS Radar Capsule */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center rounded-xl border border-pink-500/20 bg-[#200b24] overflow-hidden">
            <button
              type="button"
              onClick={() => {
                if (!canUndo) return;
                sound.playAction();
                onUndo?.();
              }}
              disabled={!canUndo}
              className={`px-2 py-2 text-pink-300/70 transition-all ${
                canUndo
                  ? 'hover:bg-[#2c1031] hover:text-pink-100 cursor-pointer'
                  : 'opacity-35 cursor-not-allowed'
              } ${FOCUS_RING}`}
              title="Undo (Ctrl+Z)"
              aria-label="Undo last edit"
            >
              <Undo2 size={13} />
            </button>
            <span className="w-px self-stretch bg-pink-500/20" aria-hidden="true" />
            <button
              type="button"
              onClick={() => {
                if (!canRedo) return;
                sound.playAction();
                onRedo?.();
              }}
              disabled={!canRedo}
              className={`px-2 py-2 text-pink-300/70 transition-all ${
                canRedo
                  ? 'hover:bg-[#2c1031] hover:text-pink-100 cursor-pointer'
                  : 'opacity-35 cursor-not-allowed'
              } ${FOCUS_RING}`}
              title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
              aria-label="Redo last undone edit"
            >
              <Redo2 size={13} />
            </button>
          </div>

          {/* AI Settings Config Button */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenAiConfig();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${FOCUS_RING} ${
              isAiConfigured
                ? 'bg-[#2b102e] border-pink-500/50 text-pink-200 shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:border-pink-400'
                : 'bg-amber-950/40 border-amber-500/60 text-amber-300 animate-pulse'
            }`}
            title="Configure AI Provider (Vyce AI, DeepSeek, OpenAI, Groq)"
            aria-label={
              isAiConfigured
                ? `AI settings, configured with ${aiConfig?.providerId?.toUpperCase()}`
                : 'Configure AI provider and API key'
            }
          >
            <Bot size={14} className={isAiConfigured ? 'text-rose-300' : 'text-amber-400'} />
            <span className="hidden sm:inline">
              {isAiConfigured
                ? `AI: ${aiConfig?.providerId?.toUpperCase()}`
                : hasAuth && !hasModel
                ? 'SET_MODEL'
                : 'CONFIGURE_AI'}
            </span>
            <Settings size={11} className="opacity-70" />
          </button>

          {/* Job Matcher Button */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenJobMatch();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#13251e] border border-emerald-500/40 hover:border-emerald-400 text-emerald-200 text-xs font-bold transition-all cursor-pointer shadow-xs ${FOCUS_RING}`}
            title="Paste Job Description to check keyword match and tailor resume"
            aria-label="Open job matcher"
          >
            <Target size={14} className="text-emerald-400" />
            <span className="hidden md:inline">JOB_MATCH</span>
          </button>

          {/* Applications Tracker Button */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenApplications?.();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e1430] border border-violet-500/40 hover:border-violet-400 text-violet-200 text-xs font-bold transition-all cursor-pointer shadow-xs relative ${FOCUS_RING}`}
            title="Applications you have sent, and which resume each one used"
            aria-label={
              applicationCount > 0
                ? `Open application tracker, ${applicationCount} application${applicationCount === 1 ? '' : 's'} recorded`
                : 'Open application tracker'
            }
          >
            <Briefcase size={14} className="text-violet-300" aria-hidden="true" />
            <span className="hidden lg:inline">APPLICATIONS</span>
            {applicationCount > 0 && (
              <span
                aria-hidden="true"
                className="min-w-[16px] h-4 px-1 rounded-full bg-violet-500/90 text-white text-[9.5px] font-black flex items-center justify-center leading-none"
              >
                {applicationCount > 99 ? '99+' : applicationCount}
              </span>
            )}
          </button>

          {/* ATS Radar Capsule */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenAts();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#280f2b] border border-pink-500/30 hover:border-pink-400 transition-all cursor-pointer group shadow-[0_0_12px_rgba(244,63,94,0.15)] relative overflow-hidden ${FOCUS_RING}`}
            aria-label={`Open ATS score breakdown, current score ${atsScore.score} percent`}
          >
            <div className="w-5 h-5 rounded-lg bg-pink-950/90 border border-pink-400/40 flex items-center justify-center text-pink-300 group-hover:scale-110 transition-transform">
              <Activity size={12} className="animate-pulse text-rose-400" />
            </div>
            <div className="text-left font-sans">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-pink-300/80">
                  ATS:
                </span>
                <span className="text-xs font-black text-rose-300">
                  {atsScore.score}%
                </span>
              </div>
            </div>
          </button>

          {/* 1-Page Auto-Fit Toggle Button */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              if (onToggleSinglePage) onToggleSinglePage();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${FOCUS_RING} ${
              singlePage
                ? 'bg-[#102b20] border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'bg-[#220e26] border-pink-500/20 text-pink-300/70 hover:border-pink-500/40 hover:text-pink-200'
            }`}
            title="Single-Page Fit: Auto-compresses margins & line height to lock entire resume on 1 page"
            aria-label="Single-page auto-fit"
            aria-pressed={singlePage}
          >
            <Sparkles size={13} className={singlePage ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
            <span>{singlePage ? '1_PAGE: ON' : '1_PAGE: OFF'}</span>
          </button>
        </div>

        {/* Studio Action Buttons */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenUpload();
            }}
            className={`px-3 py-2 rounded-xl bg-[#2a112e] hover:bg-[#38163d] text-pink-200 border border-pink-500/40 hover:border-pink-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.18)] active:scale-95 ${FOCUS_RING}`}
            title="Upload Word DOCX, JSON or Paste Resume to Auto-Fill"
            aria-label="Upload resume file"
          >
            <Upload size={13} className="text-rose-400" />
            <span className="hidden sm:inline font-bold">UPLOAD</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onResetDefault();
            }}
            className={`px-2.5 py-2 rounded-xl bg-[#200b24] hover:bg-[#2c1031] text-pink-300/70 hover:text-pink-100 border border-pink-500/20 hover:border-pink-500/40 transition-all cursor-pointer flex items-center gap-1.5 ${FOCUS_RING}`}
            title="Reset to original document data"
            aria-label="Reset resume to original document data"
          >
            <RotateCcw size={13} />
            <span className="hidden xl:inline">RESET</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onPrint();
            }}
            className={`px-3 py-2 rounded-xl bg-[#240e29] hover:bg-[#301336] text-pink-200 border border-pink-500/30 hover:border-pink-400 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${FOCUS_RING}`}
            title="Print or Vector PDF"
            aria-label="Print resume or save as vector PDF"
          >
            <Printer size={13} className="text-pink-300" />
            <span className="hidden sm:inline">PRINT</span>
          </button>

          {/* Download DOCX Button */}
          <button
            type="button"
            onClick={() => {
              sound.playSuccess();
              onDownloadDocx();
            }}
            disabled={isExporting}
            className={`px-3.5 py-2 font-bold tracking-wider rounded-xl bg-gradient-to-r from-purple-800 via-pink-700 to-rose-700 hover:from-purple-700 hover:to-rose-600 text-white shadow-[0_4px_16px_rgba(168,85,247,0.3)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 ${FOCUS_RING}`}
            title="Generate native Word DOCX"
            aria-label="Download resume as DOCX"
          >
            <FileSpreadsheet size={14} />
            <span>.DOCX</span>
          </button>

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={() => {
              sound.playSuccess();
              onDownloadPdf();
            }}
            disabled={isExporting}
            className={`px-4 py-2 font-bold tracking-wider text-white rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 shadow-[0_4px_25px_rgba(244,63,94,0.45)] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 ${FOCUS_RING}`}
            title="Export high-res PDF"
            aria-label="Export resume as PDF"
          >
            <Download size={14} className="stroke-[2.5]" />
            <span>EXPORT_PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
}
