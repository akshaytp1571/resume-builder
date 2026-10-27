import html2pdf from 'html2pdf.js';

/**
 * PDF export.
 *
 * Two paths:
 *   'print'  — the browser's own print-to-PDF. Real vector text: selectable,
 *              small file, readable by ATS parsers.
 *   'raster' — html2pdf (html2canvas + jsPDF), a JPEG of the page.
 *
 * THE DEFAULT IS 'raster'. `exportToPdf(el, data)` is the existing public
 * signature and must keep producing exactly the file it always has, so vector
 * output is opt-in:
 *     exportToPdf('resume-preview', resumeData, { mode: 'print' })
 */

/** A4 at 96dpi. */
const A4_WIDTH_PX = 794;

/**
 * US Letter at 96dpi: 8.5in × 96. Both sizes are captured at their true CSS
 * pixel width so text stays vector-crisp instead of upsampling a scaled
 * snapshot, and so the jsPDF page dimensions match the sheet.
 */
const LETTER_WIDTH_PX = 816;

/**
 * `Jane Doe` -> `Jane_Doe`.
 *
 * A name written entirely in a non-Latin script sanitises to an empty string,
 * so fall back to `fallback` rather than emitting "_Resume.pdf".
 */
function resumeFileName(resumeData, fallback = '') {
  return (
    (resumeData?.personalInfo?.fullName || '')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '') || fallback
  );
}

/**
 * Neutralise the preview zoom, run `fn` against the live DOM, then put every
 * touched node back — in a finally, so a throwing print engine cannot leave
 * the preview stuck at 100% or the tab titled `_Resume`.
 *
 * The zoom is an inline transform on #resume-print-wrapper (ResumePreview.jsx).
 * html2pdf neutralises it on its *clone* via onclone; window.print() has no
 * clone, so the live node has to be neutralised instead. The @media print
 * block in index.css is the hard guarantee; this inline reset covers engines
 * that snapshot before the stylesheet cascade is applied.
 */
function withPrintLayout(resumeData, fn) {
  const wrapper = document.getElementById('resume-print-wrapper');
  const previousTransform = wrapper?.style.transform || '';
  const previousTransition = wrapper?.style.transition || '';
  const previousTitle = document.title;

  if (wrapper) {
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'none';
  }

  // The browser derives the PDF filename from document.title. Restored on a
  // timer because print() may return before the engine has read the title.
  const cleanName = resumeFileName(resumeData);
  document.title = cleanName ? `${cleanName}_Resume` : ' ';

  try {
    return fn();
  } finally {
    if (wrapper) {
      wrapper.style.transform = previousTransform;
      wrapper.style.transition = previousTransition;
    }
    setTimeout(() => {
      document.title = previousTitle;
    }, 1500);
  }
}

/**
 * Vector path: hand the page to the browser's print-to-PDF.
 * Returns true on success, false if the print engine threw.
 */
export function exportToVectorPdf(elementId, resumeData) {
  if (!document.getElementById(elementId)) {
    throw new Error('Resume element not found');
  }

  try {
    withPrintLayout(resumeData, () => window.print());
    return true;
  } catch (error) {
    console.error('Vector PDF export error:', error);
    return false;
  }
}

/**
 * Export the live resume preview to PDF.
 *
 * The preview is rendered inside a wrapper that is CSS-scaled for zoom. If we
 * hand that scaled subtree straight to html2canvas, the capture inherits the
 * transform and produces a blurry, wrongly-sized page. So we temporarily
 * neutralise the zoom, capture at the element's real layout size, then put
 * the transform back.
 */
export async function exportToPdf(elementId, resumeData, options) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Resume element not found');
  }

  const mode = options?.mode || 'raster';
  if (mode === 'print') {
    return exportToVectorPdf(elementId, resumeData);
  }

  const cleanName = resumeFileName(resumeData, 'Resume');

  const wrapper = document.getElementById('resume-print-wrapper');
  const previousTransform = wrapper?.style.transform || '';
  const previousTransition = wrapper?.style.transition || '';

  // Freeze the zoom so the capture is 1:1 with the printed page.
  if (wrapper) {
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'none';
  }

  // A4 at 96dpi is ~794x1123 CSS px. Capturing at that width keeps text
  // vector-crisp instead of upsampling a scaled-down snapshot.
  const isLetter = options?.paperSize === 'letter';
  const captureWidth = isLetter ? LETTER_WIDTH_PX : A4_WIDTH_PX;

  const opt = {
    margin: 0,
    filename: `${cleanName}_Resume.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      letterRendering: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: captureWidth,
      width: captureWidth,
      // Ignore the zoom transform on any ancestor.
      onclone: (doc) => {
        const cloneWrapper = doc.getElementById('resume-print-wrapper');
        if (cloneWrapper) {
          cloneWrapper.style.transform = 'none';
          cloneWrapper.style.transition = 'none';
        }
      },
    },
    jsPDF: {
      unit: 'mm',
      // jsPDF accepts a named format; both are real page sizes it knows.
      format: isLetter ? 'letter' : 'a4',
      orientation: 'portrait',
      compress: true,
    },
    pagebreak: {
      // 'css' plus 'legacy' is the reliable combination; 'avoid-all' makes
      // html2pdf split mid-paragraph on multi-page resumes.
      mode: ['css', 'legacy'],
    },
  };

  const restoreZoom = () => {
    if (wrapper) {
      wrapper.style.transform = previousTransform;
      wrapper.style.transition = previousTransition;
    }
  };

  try {
    await html2pdf().set(opt).from(element).save();
    restoreZoom();
    return true;
  } catch (error) {
    console.error('PDF export error:', error);
    restoreZoom();
    // Fallback to window print
    triggerPrint(resumeData);
    return false;
  }
}

export function triggerPrint(resumeData = null) {
  withPrintLayout(resumeData, () => window.print());
}
