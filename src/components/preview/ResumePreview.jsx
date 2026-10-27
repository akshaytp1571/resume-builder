import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
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
import { safeTheme } from '../templates/templateData';

/**
 * The bench: a white A4 sheet on a warm-black surface, with print-shop
 * furniture around it.
 *
 * GEOMETRY CONTRACT — pdfExporter measures #resume-preview, and the print block
 * resets #resume-print-wrapper. Both ids and the .resume-paper class are
 * load-bearing; the tests, the layout measurement and the export capture all
 * depend on them. The ids are on plain <div>s with no transform of their own.
 *
 * Nothing that CONTAINS the sheet may be no-print. Everything AROUND it — the
 * top strip, the crop marks, the plate readout, the zoom dock — is no-print and
 * aria-hidden where it carries no information a screen reader needs.
 *
 * The sheet itself is never transformed except by the user's zoom, which the
 * print block neutralises. The entrance animation is on a sibling, not on the
 * paper, so a capture taken mid-animation is still correct.
 */

/** A4 at 96dpi — the budget the page-budget badge has always used. */
const PAGE_BUDGET_A4_PX = 1123;

/** US Letter at 96dpi: 11in × 96. A4 is 297mm ≈ 1123px, Letter is 11 × 96 = 1056. */
const PAGE_BUDGET_LETTER_PX = 1056;

/** The budget for the active paper size. Mirrors index.css' --budget-px. */
function budgetFor(paperSize) {
  return paperSize === 'letter' ? PAGE_BUDGET_LETTER_PX : PAGE_BUDGET_A4_PX;
}

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
      onLayoutMeasured?.({ pageHeightPx: height, pageBudgetPx: budgetFor(theme?.paperSize) });    };

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
    // Guard the theme: a null theme used to throw here for all nine templates,
    // because `theme.templateId` was read without a check. safeTheme() also
    // supplies the default palette, so a partial theme still renders.
    switch (safeTheme(theme).templateId) {
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

  const paperBudgetPx = budgetFor(theme?.paperSize);
  const isLetter = theme?.paperSize === 'letter';
  const budgetPct = pageHeight > 0 ? Math.round((pageHeight / paperBudgetPx) * 100) : 0;
  const overBudget = pageHeight > paperBudgetPx + 2;

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden select-none">
      {/* ---- top strip: what is on the bench ---------------------------- */}
      <div className="z-10 flex items-center justify-between gap-3 border-b border-rule bg-housing px-4 py-1.5 no-print">
        <div className="flex items-center gap-2.5">
          <span className="dt-label text-bone-52">Proof</span>
          <span aria-hidden="true" className="h-3 w-px bg-[var(--rule)]" />
          <span className="dt-data text-bone-32">{isLetter ? 'Letter · 8.5×11' : 'A4 · 210×297'}</span>
          {pageHeight > 0 && (
            <>
              <span aria-hidden="true" className="h-3 w-px bg-[var(--rule)]" />
              <span
                className={`dt-data ${overBudget ? 'text-alarm' : 'text-bone-70'}`}
                title={`Rendered height ${pageHeight}px against a ${paperBudgetPx}px budget`}
              >
                {budgetPct}% {overBudget ? '· spills' : '· fits'}
              </span>
            </>
          )}
        </div>

        {/* zoom */}
        <div className="flex items-center gap-1 rounded-[2px] border border-rule-2">
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex h-7 w-7 cursor-pointer items-center justify-center text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut size={12} aria-hidden="true" />
          </button>
          <span className="dt-data w-[38px] text-center text-bone">{zoom}%</span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="flex h-7 w-7 cursor-pointer items-center justify-center text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn size={12} aria-hidden="true" />
          </button>
          <span aria-hidden="true" className="h-4 w-px bg-[var(--rule)]" />
          <button
            type="button"
            onClick={handleResetZoom}
            className="flex h-7 w-7 cursor-pointer items-center justify-center text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
            title="Reset zoom to 85%"
            aria-label="Reset zoom"
          >
            <Maximize2 size={11} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ---- bench ------------------------------------------------------
          The dot grid, the vignette and the furniture live here. All of it is
          no-print; only the sheet survives. */}
      <div className="dt-bench dt-print-reset relative flex flex-1 items-start justify-center overflow-auto p-6 sm:p-10 lg:p-14">
        {/* one radial vignette behind the sheet, ≤4% — the only gradient */}
        <div
          aria-hidden="true"
          className="no-print pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 34%, rgba(237,232,220,0.04) 0%, rgba(237,232,220,0) 62%)',
          }}
        />

        {/* the sheet mount */}
        <div className="dt-enter-sheet relative">
          <div
            id="resume-print-wrapper"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 120ms cubic-bezier(0.6,0,0.3,1)',
            }}
            className="relative print:transform-none print:m-0 print:p-0"
          >
            {/* crop marks — print-shop furniture, 12px out from the corners */}
            <span aria-hidden="true" className="dt-crop dt-crop-tl no-print" />
            <span aria-hidden="true" className="dt-crop dt-crop-tr no-print" />
            <span aria-hidden="true" className="dt-crop dt-crop-bl no-print" />
            <span aria-hidden="true" className="dt-crop dt-crop-br no-print" />

            {/* THE SHEET. Ids and class are contracts — see the header note. */}
            <div
              id="resume-preview"
              className="resume-paper print:m-0 print:w-full print:border-none print:p-0 print:shadow-none"
            >
              {renderActiveTemplate()}
            </div>
          </div>
        </div>

        {/* plate readout, bottom-left — mono 10px */}
        <div
          aria-hidden="true"
          className="dt-bench-furniture no-print pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-32"
        >
          Plate 01 · {isLetter ? 'Letter 8.5×11' : 'A4 210×297'}
        </div>

        {/* fit readout, bottom-right — reflects the real zoom */}
        <div
          aria-hidden="true"
          className="dt-bench-furniture no-print pointer-events-none absolute bottom-3 right-4 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-32"
        >
          Fit {zoom}%
        </div>
      </div>
    </div>
  );
}
