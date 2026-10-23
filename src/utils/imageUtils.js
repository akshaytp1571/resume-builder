/**
 * Image upload guards.
 *
 * A phone photo can be 50 MB. Reading it straight into a data URL base64-
 * decodes the whole thing into memory before anything else happens, which
 * freezes the tab. These two functions are the trust boundary for the upload
 * path: check the file before touching it, then shrink it to something the
 * crop modal can handle.
 */

/**
 * 10 MB. A 10 MB JPEG is already roughly a 12-15 MP photo at high quality, so
 * anything larger is a RAW/HEIC/unprocessed camera dump that the browser
 * cannot display anyway. This limit is about the decode step, not the store -
 * the crop output is 480x480 (~50-100 KB), so nothing near this size is ever
 * persisted.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Longest edge handed to the crop modal. See downscaleImage for the reasoning. */
export const CROP_SOURCE_MAX_EDGE = 1024;

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Decide whether a file is safe to read.
 *
 * Returns a result object rather than throwing so the caller can render the
 * message inline; a rejected upload is an expected outcome, not an exception.
 *
 * @param {File|null|undefined} file
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateImageFile(file) {
  if (!file || typeof file !== 'object') {
    return { ok: false, error: 'Please choose an image file first.' };
  }

  const type = typeof file.type === 'string' ? file.type : '';
  const size = typeof file.size === 'number' ? file.size : 0;

  // Checked before size: a 0-byte PDF should say "wrong type", not "empty".
  if (!type.startsWith('image/')) {
    return {
      ok: false,
      error: "That file type isn't supported. Please choose a JPG, PNG, WebP, or GIF image.",
    };
  }

  if (size <= 0) {
    return { ok: false, error: 'That file is empty. Please choose a different image.' };
  }

  // Strictly greater: a file exactly at the limit is allowed.
  if (size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `That image is ${formatMb(size)}. Please use one under 10 MB.`,
    };
  }

  return { ok: true };
}

/**
 * Read a File into a data URL.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('That file could not be read. Please try again.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Shrink a data URL so its longest edge is at most `maxEdge`.
 *
 * 1024 default: the crop viewport is 256-288 px CSS and can zoom to 3.5x, which
 * needs ~1000 px of source to avoid visible upscaling. 1024 covers max zoom
 * with no headroom wasted.
 *
 * Already-small images are returned untouched. Re-encoding a 400 px photo
 * through a canvas at 0.85 quality only throws away detail - there is nothing
 * to gain, so we skip it.
 *
 * @param {string} dataUrl
 * @param {number} [maxEdge]
 * @param {number} [quality]
 * @returns {Promise<string>}
 */
export function downscaleImage(dataUrl, maxEdge = CROP_SOURCE_MAX_EDGE, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (typeof dataUrl !== 'string' || dataUrl.length === 0) {
      reject(new Error('No image data to process.'));
      return;
    }

    const img = new Image();

    img.onerror = () => {
      reject(new Error('That image could not be read. It may be corrupt or in an unsupported format.'));
    };

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;

      // A decoded image with no dimensions cannot be drawn; the canvas would
      // throw or produce a 0x0 result.
      if (!width || !height) {
        reject(new Error('That image has no readable dimensions.'));
        return;
      }

      if (width <= maxEdge && height <= maxEdge) {
        resolve(dataUrl);
        return;
      }

      const scale = maxEdge / Math.max(width, height);
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('This browser could not prepare the image for resizing.'));
        return;
      }

      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(new Error('That image could not be resized.'));
      }
    };

    // Assigned last so a synchronous error from a malformed URL still has
    // onerror in place to catch it.
    img.src = dataUrl;
  });
}
