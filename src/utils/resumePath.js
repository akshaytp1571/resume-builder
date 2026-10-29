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

/**
 * A path is usable if it looks absolute, has a document extension, and does
 * not try to walk out of where it claims to be.
 *
 * The `..` check is not decoration. `isUsableResumePath('C:\\a\\..\\..\\b.docx')`
 * used to return true — the value is handed to the Node apply agent as the file
 * to upload, so a path that escapes its own root is a traversal primitive
 * wearing a resume extension. Today that only lets a user point at their own
 * files, which is why the audit scored it low; the day this string crosses a
 * trust boundary it stops being low. Refuse it here instead.
 *
 * Null bytes are refused for the same reason: they truncate a path in some
 * consumers and not others, which is exactly the kind of disagreement that
 * turns a validation check into a bypass.
 */
export function isUsableResumePath(path) {
  const p = String(path || '').trim();
  if (!p) return false;
  if (p.includes('\0')) return false;
  if (!/\.(docx|pdf)$/i.test(p)) return false;
  // A `..` segment on either separator. Splitting on both and testing each
  // segment is deliberate: a substring test for '..' would also reject the
  // perfectly legal "My..Resume.docx".
  const segments = p.split(/[\\/]/);
  if (segments.some((seg) => seg === '..')) return false;
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith('/');
}
