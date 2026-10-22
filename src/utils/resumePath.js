/**
 * Resume File Path Store
 *
 * The apply agent runs in Node and needs an absolute path to the resume file
 * to upload. The browser cannot hand a File object's real path to a server,
 * so the user points at the exported DOCX once and we keep the path here.
 */

const STORAGE_KEY = 'nexus_resume_path_v1';

export function getResumePath() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch (e) {
    console.error('Error reading resume path:', e);
    return '';
  }
}

export function setResumePath(path) {
  try {
    const clean = String(path || '').trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    return clean;
  } catch (e) {
    console.error('Error saving resume path:', e);
    return '';
  }
}

/** A path is usable if it looks absolute and has a document extension. */
export function isUsableResumePath(path) {
  const p = String(path || '').trim();
  if (!p) return false;
  if (!/\.(docx|pdf)$/i.test(p)) return false;
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/');
}
