/**
 * Google Drive integration — no SDK, no dependency.
 *
 * WHY HAND-ROLLED
 * `googleapis` is a server library; `gapi` is a 200 KB script that wants a
 * different auth flow; `@react-oauth/google` wraps one specific button. What
 * this app actually needs is three REST calls and an OAuth token, which is a
 * few hundred lines of plain fetch. Adding a dependency here would cost more
 * bundle than the feature.
 *
 * SCOPE — `drive.file` ONLY.
 * This is the narrowest Drive scope Google offers: the app can see and touch
 * only files IT created, plus files the user explicitly opens with it via the
 * picker. It cannot read the rest of the user's Drive. A resume builder has no
 * business asking for more, and asking for `drive` (full access) would be a
 * privacy failure for an app whose whole pitch is that your data stays yours.
 *
 * TOKEN HANDLING
 * The access token is held in memory only, never in localStorage. It expires in
 * about an hour, and writing it to disk would leave a bearer credential lying in
 * a place any script on the origin can read. The user reconnects when it lapses.
 * That is a deliberate trade: reconnect friction against a stolen credential.
 *
 * GRACEFUL DEGRADATION
 * Without a configured client ID the feature is unavailable, and every entry
 * point reports that clearly rather than throwing. Nothing here runs unless the
 * user clicks "Connect".
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** The app's own JSON backup, so a Drive round-trip is lossless. */
export const DRIVE_MIME = 'application/json';

/** Folder name created on first save. */
const FOLDER_NAME = 'Precision Resume Studio';

/**
 * A client ID must be supplied at build time. Vite inlines `VITE_` vars, which
 * is fine here: a client ID is public by design, unlike a client secret.
 * When absent the whole feature reports itself as unconfigured.
 */
export function getClientId() {
  try {
    return import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';
  } catch {
    return '';
  }
}

export function isDriveConfigured() {
  return Boolean(getClientId());
}

// --- token state (memory only, by design) ----------------------------------

let accessToken = null;
let tokenExpiresAt = 0;
let tokenClient = null;
let gisLoading = null;

export function getAccessToken() {
  if (!accessToken) return null;
  // Treat a token inside its last 60 s as gone; a request would fail anyway.
  if (Date.now() > tokenExpiresAt - 60_000) {
    accessToken = null;
    return null;
  }
  return accessToken;
}

export function isConnected() {
  return Boolean(getAccessToken());
}

export function disconnect() {
  accessToken = null;
  tokenExpiresAt = 0;
}

/** Load the Google Identity Services script once. */
function loadGis() {
  if (typeof document === 'undefined') return Promise.reject(new Error('No DOM'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoading) return gisLoading;

  gisLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('GIS failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(script);
  });
  return gisLoading;
}

/**
 * Open Google's OAuth consent popup and keep the token in memory.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function connect() {
  const clientId = getClientId();
  if (!clientId) {
    return {
      ok: false,
      error:
        'Google Drive is not configured for this build. Set VITE_GOOGLE_CLIENT_ID and rebuild.',
    };
  }

  try {
    await loadGis();
  } catch (e) {
    return { ok: false, error: e.message };
  }

  return new Promise((resolve) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) => {
          if (response?.error) {
            resolve({ ok: false, error: String(response.error) });
            return;
          }
          accessToken = response.access_token;
          // expires_in is seconds; default to an hour when absent.
          const lifetime = Number(response.expires_in) || 3600;
          tokenExpiresAt = Date.now() + lifetime * 1000;
          resolve({ ok: true });
        },
      });
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (e) {
      resolve({ ok: false, error: e?.message || 'Could not start the Google sign-in.' });
    }
  });
}

// --- REST helpers -----------------------------------------------------------

async function authedFetch(url, options = {}) {
  const token = getAccessToken();
  if (!token) {
    const err = new Error('Not connected to Google Drive.');
    err.code = 'NOT_CONNECTED';
    throw err;
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    disconnect();
    const err = new Error('Your Google session expired. Reconnect and try again.');
    err.code = 'EXPIRED';
    throw err;
  }
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error?.message || '';
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(detail || `Google Drive returned ${res.status}.`);
    err.code = 'HTTP';
    throw err;
  }
  return res;
}

/** Find (or create) the app's folder. Returns its id. */
async function ensureFolder() {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await authedFetch(
    `${DRIVE_API}/files?q=${q}&fields=files(id,name)&spaces=drive`
  );
  const body = await res.json();
  if (Array.isArray(body.files) && body.files.length > 0) return body.files[0].id;

  const created = await authedFetch(`${DRIVE_API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const createdBody = await created.json();
  return createdBody.id;
}

/**
 * List the resume files this app created.
 * @returns {Promise<Array<{id, name, modifiedTime, size}>>}
 */
export async function listFiles() {
  const q = encodeURIComponent(
    `mimeType='${DRIVE_MIME}' and trashed=false`
  );
  const res = await authedFetch(
    `${DRIVE_API}/files?q=${q}&orderBy=modifiedTime desc&pageSize=50` +
      `&fields=files(id,name,modifiedTime,size)&spaces=drive`
  );
  const body = await res.json();
  return Array.isArray(body.files) ? body.files : [];
}

/**
 * Upload a JSON string. Uses a multipart body so metadata and content go in one
 * request — the simple upload endpoint cannot set a name in the same call.
 *
 * @param {string} json
 * @param {string} filename
 * @param {string} [existingId]  pass to update in place instead of creating
 */
export async function uploadJson(json, filename, existingId) {
  const folderId = existingId ? null : await ensureFolder();

  const boundary = `resume${Math.random().toString(36).slice(2)}`;
  const metadata = existingId
    ? { name: filename, mimeType: DRIVE_MIME }
    : { name: filename, mimeType: DRIVE_MIME, parents: folderId ? [folderId] : [] };

  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${DRIVE_MIME}\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}--`;

  const url = existingId
    ? `${UPLOAD_API}/files/${encodeURIComponent(existingId)}?uploadType=multipart&fields=id,name,modifiedTime`
    : `${UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime`;

  const res = await authedFetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

/** Download a file's text content. */
export async function downloadText(fileId) {
  const res = await authedFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`
  );
  return res.text();
}

/** Move a file to the Drive trash. Not a permanent delete. */
export async function trashFile(fileId) {
  await authedFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  return { ok: true };
}

/** Filename for a Drive backup of the whole store. */
export function driveFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `resume-backup-${stamp}.json`;
}

/** Only used by tests. */
export function __setTokenForTests(token, expiresInSeconds = 3600) {
  accessToken = token;
  tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
}
