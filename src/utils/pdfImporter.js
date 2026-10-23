import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// First N pages only — a resume is never longer, and a 400-page PDF would
// freeze the modal. Bump if someone ever imports a portfolio PDF.
const MAX_PAGES = 30;
const MIN_TEXT_CHARS = 50;

/**
 * Extract raw text from a PDF File/Blob.
 * @returns {Promise<{type:'pdf', text:string, pageCount:number, truncated:boolean}>}
 */
export async function extractTextFromPdf(file) {
  const data = await file.arrayBuffer();

  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Remove the password or export an unprotected copy.');
    }
    throw new Error('Could not read this PDF. It may be corrupt or not a PDF file.');
  }

  try {
    const pageCount = pdf.numPages;
    const limit = Math.min(pageCount, MAX_PAGES);
    const pages = [];

    for (let i = 1; i <= limit; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(itemsToText(content.items));
      page.cleanup();
    }

    const text = pages.join('\n\n').trim();
    if (text.length < MIN_TEXT_CHARS) {
      throw new Error('This PDF appears to be a scanned image. Try a DOCX or paste the text instead.');
    }

    return { type: 'pdf', text, pageCount, truncated: pageCount > limit };
  } finally {
    pdf.destroy();
  }
}

// Group text items by their baseline (transform[5]) so lines survive.
function itemsToText(items) {
  let out = '';
  let lastY = null;

  for (const item of items) {
    if (!item.str) continue;
    const y = item.transform?.[5] ?? lastY;

    if (lastY !== null && Math.abs(y - lastY) > 2) {
      out += '\n';
    } else if (out && !out.endsWith(' ') && !out.endsWith('\n')) {
      out += ' ';
    }

    out += item.str;
    lastY = y;
  }

  return out.replace(/[ \t]+\n/g, '\n').trim();
}
