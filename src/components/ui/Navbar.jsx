import React, { useState } from 'react';
import {
  Download,
  Printer,
  RotateCcw,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  Activity,
  Bot,
  Target,
  Settings,
  Upload,
  Undo2,
  Redo2,
  Briefcase,
  FileText,
  Keyboard,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { isAiConfigReady } from '../../utils/aiService';
import { ariaKeyshortcuts } from '../../hooks/useKeyboardShortcuts.js';

/**
 * The instrument bar.
 *
 * STRUCTURAL CONTRACT — src/test/a11yNav.test.jsx asserts all of this and it is
 * invisible to the eye, so read before editing:
 *
 *   <header>  →  .max-w-7xl row  →  children[0] brand
 *                                   children[1] centre capsule (must match
 *                                               /flex-wrap/ — it is the row that
 *                                               would otherwise push the header
 *                                               past 320px)
 *                                   children[2] action cluster
 *
 *   Spans reading exactly EXPORT_PDF, PRINT, UPLOAD, RESET must each exist once
 *   and carry /hidden (sm|md|lg|xl):inline/. Exactly one may read EXPORT_PDF.
 *   The ATS: and 1_PAGE: spans carry /hidden sm:inline/.
 *   Every button needs an accessible name.
 *
 * No ticker, no build stamp, no marquee. Earlier versions carried a scrolling
 * "BOTANICAL CANVAS STUDIO // TEXTURED EDITION" strip; it was decoration that
 * told the user nothing, so the readouts below replaced it with state that is
 * actually measured.
 */

const BTN =
  'inline-flex items-center gap-1.5 rounded-[2px] border font-mono uppercase tracking-[0.08em] transition-colors duration-[90ms] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
const QUIET = 'border-rule-2 bg-transparent text-bone-70 hover:text-bone hover:bg-[rgba(237,232,220,0.05)]';
const BTN_MD = 'h-8 px-[10px] text-[10px]';

/** A 2px square LED. Not glowing, not pinging — a static block. */
function Led({ tone = 'idle' }) {
  const colour =
    tone === 'ok'
      ? 'bg-signal'
      : tone === 'warn'
        ? 'bg-[#f5b544]'
        : tone === 'bad'
          ? 'bg-alarm'
          : 'bg-bone-32';
  return <span aria-hidden="true" className={`inline-block h-[5px] w-[5px] shrink-0 ${colour}`} />;
}

export default function Navbar({
  onDownloadPdf,
  onDownloadVectorPdf,
  onDownloadDocx,
  onPrint,
  onResetDefault,
  onOpenUpload,
  onOpenAts,
  onOpenAiConfig,
  onOpenJobMatch,
  onOpenApplications,
  onOpenShortcuts,
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

  const score = atsScore?.score ?? 0;
  const scoreTone = score >= 80 ? 'ok' : score >= 55 ? 'warn' : 'bad';

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-housing px-3 py-2 no-print select-none sm:px-5">
      {/* Hairline that draws itself once on first paint. */}
      <div
        aria-hidden="true"
        className="dt-enter-bar pointer-events-none absolute inset-x-0 bottom-0 h-px bg-signal/60"
      />

      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {/* ---- brand ---------------------------------------------------- */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            onClick={() => sound.playAction()}
            className="flex h-7 w-7 shrink-0 items-center justify-center border border-rule-2 text-signal"
          >
            {/* A single mark: a sheet on a bench. Drawn, not a gradient chip. */}
            <svg width="13" height="15" viewBox="0 0 13 15" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="12" height="14" stroke="currentColor" />
              <path d="M3 4.5h7M3 7.5h7M3 10.5h4" stroke="currentColor" strokeLinecap="square" />
            </svg>
          </span>

          <div className="leading-none">
            <div className="flex items-baseline gap-1">
              <span className="font-sans text-[15px] font-semibold tracking-[-0.02em] text-bone">
                Resume
              </span>
              <span className="dt-serif text-[15px] text-signal">Studio</span>
            </div>
            <div className="dt-label mt-0.5 text-bone-32">{templateName}</div>
          </div>
        </div>

        {/* ---- centre capsule -------------------------------------------
            flex-wrap is load-bearing: at 320px these controls cannot shrink
            further without losing meaning, and without wrapping the header
            pushes ~48px past the viewport. a11yNav.test.jsx asserts
            children[1].className matches /flex-wrap/. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* undo / redo — one segmented pair */}
          <div className="flex items-stretch overflow-hidden rounded-[2px] border border-rule-2">
            <button
              type="button"
              onClick={() => {
                if (!canUndo) return;
                sound.playAction();
                onUndo?.();
              }}
              disabled={!canUndo}
              className={`flex h-8 items-center px-2 transition-colors duration-[90ms] ${
                canUndo
                  ? 'cursor-pointer text-bone-70 hover:bg-[rgba(237,232,220,0.05)] hover:text-bone'
                  : 'cursor-not-allowed text-bone-32'
              }`}
              title="Undo (Ctrl+Z)"
              aria-label="Undo last edit"
              aria-keyshortcuts={ariaKeyshortcuts('undo')}
            >
              <Undo2 size={13} aria-hidden="true" />
            </button>
            <span aria-hidden="true" className="w-px self-stretch bg-[var(--rule)]" />
            <button
              type="button"
              onClick={() => {
                if (!canRedo) return;
                sound.playAction();
                onRedo?.();
              }}
              disabled={!canRedo}
              className={`flex h-8 items-center px-2 transition-colors duration-[90ms] ${
                canRedo
                  ? 'cursor-pointer text-bone-70 hover:bg-[rgba(237,232,220,0.05)] hover:text-bone'
                  : 'cursor-not-allowed text-bone-32'
              }`}
              title="Redo (Ctrl+Shift+Z or Ctrl+Y)"
              aria-label="Redo last undone edit"
              aria-keyshortcuts={ariaKeyshortcuts('redo')}
            >
              <Redo2 size={13} aria-hidden="true" />
            </button>
          </div>

          {/* AI state. The LED carries the state; the label is mono data. */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenAiConfig();
            }}
            className={`${BTN} ${QUIET} ${BTN_MD} ${
              isAiConfigured ? '' : 'border-[#f5b544]/60 text-[#f5b544]'
            }`}
            title="Configure AI provider"
            aria-label={
              isAiConfigured
                ? `AI settings, configured with ${aiConfig?.providerId?.toUpperCase()}`
                : 'Configure AI provider and API key'
            }
          >
            <Led tone={isAiConfigured ? 'ok' : 'warn'} />
            <span className="hidden md:inline">
              {isAiConfigured
                ? `AI · ${aiConfig?.providerId?.toUpperCase()}`
                : hasAuth && !hasModel
                  ? 'AI · SET MODEL'
                  : 'AI · OFF'}
            </span>
            <Settings size={11} className="opacity-60" aria-hidden="true" />
          </button>

          {/* job matcher */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenJobMatch();
            }}
            className={`${BTN} ${QUIET} ${BTN_MD}`}
            title="Match the resume against a job description"
            aria-label="Open job matcher"
          >
            <Target size={13} aria-hidden="true" />
            <span className="hidden lg:inline">MATCH</span>
          </button>

          {/* applications */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenApplications?.();
            }}
            className={`${BTN} ${QUIET} ${BTN_MD}`}
            title="Applications you have sent, and which resume each one used"
            aria-label={
              applicationCount > 0
                ? `Open application tracker, ${applicationCount} application${applicationCount === 1 ? '' : 's'} recorded`
                : 'Open application tracker'
            }
          >
            <Briefcase size={13} aria-hidden="true" />
            <span className="hidden lg:inline">TRACKER</span>
            {applicationCount > 0 && (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-[2px] bg-signal px-1 font-mono text-[9px] font-medium leading-none text-void"
              >
                {applicationCount > 99 ? '99+' : applicationCount}
              </span>
            )}
          </button>

          {/* ATS readout. The score is the number; the LED is the verdict. */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenAts();
            }}
            className={`${BTN} border-rule-2 bg-transparent px-[10px] text-[10px] hover:bg-[rgba(237,232,220,0.05)]`}
            aria-label={`Open ATS score breakdown, current score ${atsScore.score} percent`}
            title="ATS score breakdown"
          >
            <Activity size={13} className="text-bone-52" aria-hidden="true" />
            {/* a11yNav.test.jsx asserts /hidden sm:inline/ on this span — the
                two utilities must stay adjacent and in this order. */}
            <span className="hidden sm:inline text-bone-52">ATS:</span>
            <span className="font-mono text-[11px] tabular-nums text-bone">
              {score}
            </span>
            <Led tone={scoreTone} />
          </button>

          {/* single-page fit */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              if (onToggleSinglePage) onToggleSinglePage();
            }}
            className={`${BTN} ${BTN_MD} ${
              singlePage
                ? 'border-signal/60 bg-signal/10 text-signal'
                : 'border-rule-2 bg-transparent text-bone-52 hover:bg-[rgba(237,232,220,0.05)]'
            }`}
            title="Single-page fit: compresses margins and line height so the resume stays on one page"
            aria-label="Single-page auto-fit"
            aria-pressed={singlePage}
          >
            <span className="hidden sm:inline">{singlePage ? '1_PAGE: ON' : '1_PAGE: OFF'}</span>
          </button>

          {/* shortcuts. A reference control, so it lives here rather than in
              the action cluster, which is the row that runs out of width. */}
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenShortcuts?.();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-[2px] border border-rule-2 text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone ${BTN_MD}`}
            title="Keyboard shortcuts (?)"
            aria-label="Show keyboard shortcuts"
            aria-keyshortcuts={ariaKeyshortcuts('help')}
          >
            <Keyboard size={13} aria-hidden="true" />
          </button>
        </div>

        {/* ---- action cluster ------------------------------------------ */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onOpenUpload();
            }}
            className={`${BTN} ${QUIET} ${BTN_MD}`}
            title="Upload DOCX or JSON, or paste a resume, to auto-fill"
            aria-label="Upload resume file"
          >
            <Upload size={13} aria-hidden="true" />
            <span className="hidden sm:inline">UPLOAD</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onResetDefault();
            }}
            className={`${BTN} ${QUIET} ${BTN_MD}`}
            title="Reset to the original document data"
            aria-label="Reset resume to original document data"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span className="hidden xl:inline">RESET</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onPrint();
            }}
            className={`${BTN} ${QUIET} ${BTN_MD}`}
            title="Open the print dialog (print to PDF for vector text)"
            aria-label="Open the print dialog"
          >
            <Printer size={13} aria-hidden="true" />
            <span className="hidden sm:inline">PRINT</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playSuccess();
              onDownloadDocx();
            }}
            disabled={isExporting}
            className={`${BTN} ${QUIET} ${BTN_MD}`}
            title="Generate native Word DOCX (Ctrl+S)"
            aria-label="Download resume as DOCX"
            aria-keyshortcuts={ariaKeyshortcuts('export-docx')}
          >
            <FileSpreadsheet size={13} aria-hidden="true" />
            <span>.DOCX</span>
          </button>

          {/* SPLIT BUTTON.
              Left: the existing raster export (html2pdf JPEG), unchanged.
              Right: vector export (window.print) — real selectable text that
              ATS parsers can read.

              Chosen over the alternatives: a second full button would add ~110px
              to a row that already wraps and would duplicate the PDF label; a
              keyboard modifier is undiscoverable without a tooltip the user has
              to hunt for. The caret is a small icon-only segment butted against
              the primary, and EXPORT_PDF collapses below md — matching PRINT/
              UPLOAD/RESET — so this is narrower than before at 320px. */}
          <div className="flex items-stretch">
            <button
              type="button"
              onClick={() => {
                sound.playSuccess();
                onDownloadPdf();
              }}
              disabled={isExporting}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-l-[2px] border border-signal bg-signal pl-2.5 pr-2 font-mono text-[10px] uppercase tracking-[0.08em] text-void transition-colors duration-[90ms] hover:bg-[#c8ef2e] disabled:cursor-not-allowed disabled:opacity-40"
              title="Export high-res PDF (image-based) (Ctrl+Shift+S)"
              aria-label="Export resume as PDF"
              aria-keyshortcuts={ariaKeyshortcuts('export-pdf')}
            >
              <Download size={13} className="stroke-[2.5]" aria-hidden="true" />
              <span className="hidden md:inline">EXPORT_PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playSuccess();
                onDownloadVectorPdf?.();
              }}
              disabled={isExporting}
              className="inline-flex h-8 cursor-pointer items-center rounded-r-[2px] border border-l-0 border-signal bg-signal/15 px-1.5 text-signal transition-colors duration-[90ms] hover:bg-signal/25 disabled:cursor-not-allowed disabled:opacity-40"
              title="Export vector PDF — selectable text, smaller file, ATS-readable"
              aria-label="Export resume as vector PDF with selectable text"
            >
              <FileText size={12} aria-hidden="true" />
            </button>
          </div>

          {/* Sound. A reference toggle, so it sits last and quiet. */}
          <button
            type="button"
            onClick={toggleSound}
            className="flex h-8 w-8 items-center justify-center rounded-[2px] text-bone-32 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone-70"
            title={soundEnabled ? 'Mute interface sounds' : 'Unmute interface sounds'}
            aria-label={soundEnabled ? 'Mute interface sounds' : 'Unmute interface sounds'}
            aria-pressed={soundEnabled}
          >
            {soundEnabled ? (
              <Volume2 size={13} aria-hidden="true" />
            ) : (
              <VolumeX size={13} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
