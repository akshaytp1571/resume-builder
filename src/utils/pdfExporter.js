import html2pdf from 'html2pdf.js';

/**
 * Export the live resume preview to PDF.
 *
 * The preview is rendered inside a wrapper that is CSS-scaled for zoom. If we
 * hand that scaled subtree straight to html2canvas, the capture inherits the
 * transform and produces a blurry, wrongly-sized page. So we temporarily
 * neutralise the zoom, capture at the element's real layout size, then put
 * the transform back.
 */
export async function exportToPdf(elementId, resumeData) {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Resume element not found');
  }

  const cleanName = (resumeData?.personalInfo?.fullName || 'Resume')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');

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
  const captureWidth = 794;

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
      format: 'a4',
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
  const originalTitle = document.title;
  const cleanName = (resumeData?.personalInfo?.fullName || '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');

  // Set clean title during print
  document.title = cleanName ? `${cleanName}_Resume` : ' ';
  window.print();
  // Restore after the print dialog closes. The 1500ms guess is short enough
  // to feel instant and long enough for the synchronous print() call to have
  // already read the title.
  setTimeout(() => {
    document.title = originalTitle;
  }, 1500);
}
