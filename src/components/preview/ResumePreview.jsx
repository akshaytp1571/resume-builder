import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import DefaultTemplate from '../templates/DefaultTemplate';
import ModernTemplate from '../templates/ModernTemplate';
import MinimalTemplate from '../templates/MinimalTemplate';
import CreativeTemplate from '../templates/CreativeTemplate';
import NordicTemplate from '../templates/NordicTemplate';
import CompactTemplate from '../templates/CompactTemplate';
import TechTemplate from '../templates/TechTemplate';
import AcademicTemplate from '../templates/AcademicTemplate';
import StartupTemplate from '../templates/StartupTemplate';

/** A4 at 96dpi — the budget the page-budget badge has always used. */
const PAGE_BUDGET_PX = 1123;

/**
 * How long to wait for the layout to settle before reporting it upward.
 * The observer fires on every keystroke that reflows the page; 250ms collapses
 * a typing burst into one report while still feeling live.
 */
const LAYOUT_REPORT_DEBOUNCE_MS = 250;

export default function ResumePreview({
  resumeData,
  theme,
  onDownloadPdf,
  onDownloadDocx,
  onLayoutMeasured,
}) {
  const [zoom, setZoom] = useState(85);
  const [pageHeight, setPageHeight] = useState(0);
  const lastReportedHeight = useRef(0);

  useEffect(() => {
    const el = document.getElementById('resume-preview');
    if (!el) return;

    // Report upward only when the height actually changed. This is the loop
    // guard: the ATS score is derived from the reported height, so a re-render
    // caused by that score must not report the same height again.
    const report = () => {
      const height = el.offsetHeight;
      if (!height || height === lastReportedHeight.current) return;
      lastReportedHeight.current = height;
      onLayoutMeasured?.({ pageHeightPx: height, pageBudgetPx: PAGE_BUDGET_PX });
    };

    let timer = null;
    const scheduleReport = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(report, LAYOUT_REPORT_DEBOUNCE_MS);
    };

    setPageHeight(el.offsetHeight);
    // Measure once on mount without waiting, so the score is layout-aware as
    // soon as the preview exists.
    report();

    const observer = new ResizeObserver(() => {
      setPageHeight(el.offsetHeight);
      scheduleReport();
    });
    observer.observe(el);

    return () => {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    };
    // Deliberately not keyed on onLayoutMeasured: a fresh callback identity per
    // render would tear down and rebuild the observer on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeData, theme]);

  const handleZoomIn = () => {
    sound.playBlip(700, 950, 0.03);
    setZoom((prev) => Math.min(130, prev + 10));
  };

  const handleZoomOut = () => {
    sound.playBlip(950, 700, 0.03);
    setZoom((prev) => Math.max(50, prev - 10));
  };

  const handleResetZoom = () => {
    sound.playBlip(800, 1100, 0.03);
    setZoom(85);
  };

  const renderActiveTemplate = () => {
    switch (theme.templateId) {
      case 'modern':
        return <ModernTemplate data={resumeData} theme={theme} />;
      case 'minimal':
        return <MinimalTemplate data={resumeData} theme={theme} />;
      case 'creative':
        return <CreativeTemplate data={resumeData} theme={theme} />;
      case 'executive':
        return <NordicTemplate data={resumeData} theme={theme} />;
      case 'compact':
        return <CompactTemplate data={resumeData} theme={theme} />;
      case 'tech':
        return <TechTemplate data={resumeData} theme={theme} />;
      case 'academic':
        return <AcademicTemplate data={resumeData} theme={theme} />;
      case 'startup':
        return <StartupTemplate data={resumeData} theme={theme} />;
      case 'classic':
      default:
        return <DefaultTemplate data={resumeData} theme={theme} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent relative overflow-hidden select-none">
      {/* Top Botanical Studio Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-pink-500/20 bg-[#170619]/90 backdrop-blur-xl no-print z-10 text-xs text-pink-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
            <Sparkles size={14} className="text-rose-400" />
            <span className="tracking-wide">ARTISAN CANVAS // DIN-A4</span>
          </div>
          <span className="text-pink-500/40 hidden sm:inline">•</span>
          <span className="text-[11px] text-pink-300/70 hidden md:inline">
            794 × 1123px (Standard A4)
          </span>
          {pageHeight > 0 && (
            <span
              className={`text-[10px] font-sans font-bold px-2.5 py-0.5 rounded-full border transition-colors ${
                pageHeight <= PAGE_BUDGET_PX + 2
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse'
              }`}
              title={`Rendered height: ${pageHeight}px / ${PAGE_BUDGET_PX}px max A4 budget`}
            >
              {pageHeight <= PAGE_BUDGET_PX + 2
                ? `PAGE_BUDGET: ${Math.round((pageHeight / PAGE_BUDGET_PX) * 100)}% (1-PAGE FIT)`
                : `PAGE_BUDGET: ${Math.round((pageHeight / PAGE_BUDGET_PX) * 100)}% (PAGE 2 SPILL)`}
            </span>
          )}
        </div>

        {/* Viewport Zoom Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#1f0923] border border-pink-500/30 p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded-lg text-pink-300/70 hover:text-pink-100 hover:bg-pink-900/40 transition-colors cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-xs font-semibold text-rose-300 px-2 min-w-[42px] text-center font-mono">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded-lg text-pink-300/70 hover:text-pink-100 hover:bg-pink-900/40 transition-colors cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1 rounded-lg text-pink-300/70 hover:text-pink-100 hover:bg-pink-900/40 transition-colors cursor-pointer"
              title="Reset Zoom (85%)"
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Scroll Area (Artisan Canvas Drafting Easel with Uploaded Painting Texture) */}
      <div 
        className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start relative"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 35%, rgba(20, 6, 23, 0.40) 0%, rgba(15, 4, 18, 0.85) 100%),
            url('/canvas-thread-texture.png'),
            url('/canvas-painting.jpg')
          `,
          backgroundSize: 'cover, 130px 130px, cover',
          backgroundPosition: 'center, 0 0, center',
          backgroundAttachment: 'local, local, local',
        }}
      >
        {/* Resume Canvas Container */}
        <div
          id="resume-print-wrapper"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative transition-all print:transform-none print:p-0 print:m-0"
        >
          {/* Actual Printable Resume Canvas - 100% Clean without any watermarks */}
          <div
            id="resume-preview"
            className="resume-paper rounded-xs shadow-2xl print:shadow-none print:m-0 print:p-0 print:border-none print:w-full"
          >
            {renderActiveTemplate()}
          </div>
        </div>
      </div>

      {/* Floating Botanical Dock at the Bottom */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-[#220a26]/90 border border-pink-500/35 backdrop-blur-xl px-4 py-2.5 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center gap-3 no-print z-20 text-xs text-pink-200">
        <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
          <Sparkles size={14} className="text-rose-400 animate-pulse" />
          <span>Atelier Dock</span>
        </div>
        <div className="h-4 w-[1px] bg-pink-500/30" />
        <span className="text-pink-300/80 font-medium">
          Ready for Export:
        </span>
        <button
          type="button"
          onClick={() => {
            sound.playSuccess();
            onDownloadPdf();
          }}
          className="px-3 py-1.5 font-bold text-white bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 rounded-xl shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <Download size={13} />
          <span>PDF</span>
        </button>
        <button
          type="button"
          onClick={() => {
            sound.playSuccess();
            onDownloadDocx();
          }}
          className="px-3 py-1.5 font-bold text-white bg-gradient-to-r from-purple-800 to-pink-700 hover:from-purple-700 hover:to-pink-600 rounded-xl shadow-[0_2px_15px_rgba(168,85,247,0.3)] transition-all cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <FileSpreadsheet size={13} />
          <span>DOCX</span>
        </button>
      </div>
    </div>
  );
}
