import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  Download,
  Upload,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import {
  connect,
  disconnect,
  isConnected,
  isDriveConfigured,
  listFiles,
  uploadJson,
  downloadText,
  trashFile,
  driveFilename,
} from '../../utils/googleDrive';

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * Google Drive backup, restore and export.
 *
 * Scope is `drive.file`: the app can only see files it created itself. That is
 * stated in the UI rather than buried in code, because a resume is personal and
 * the user deserves to know exactly how much of their Drive is visible.
 */
export default function GoogleDriveModal({
  isOpen,
  onClose,
  store,
  resumeData,
  onImportStore,
}) {
  const [connected, setConnected] = useState(isConnected());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [files, setFiles] = useState([]);

  const configured = isDriveConfigured();

  const refresh = useCallback(async () => {
    if (!isConnected()) return;
    setBusy('list');
    setError('');
    try {
      setFiles(await listFiles());
    } catch (e) {
      setError(e?.message || 'Could not list your Drive files.');
      if (e?.code === 'NOT_CONNECTED' || e?.code === 'EXPIRED') setConnected(false);
    } finally {
      setBusy('');
    }
  }, []);

  useEffect(() => {
    if (isOpen && isConnected()) refresh();
  }, [isOpen, refresh]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setError('');
    setStatus('');
    setBusy('connect');
    const result = await connect();
    setBusy('');
    if (!result.ok) {
      setError(result.error);
      return;
    }
    sound.playSuccess?.();
    setConnected(true);
    setStatus('Connected. This session lasts about an hour.');
    refresh();
  };

  const handleDisconnect = () => {
    disconnect();
    setConnected(false);
    setFiles([]);
    setStatus('Disconnected. The token was discarded from memory.');
  };

  const handleBackup = async () => {
    setError('');
    setStatus('');
    setBusy('backup');
    try {
      const json = JSON.stringify(store, null, 2);
      const saved = await uploadJson(json, driveFilename());
      sound.playSuccess?.();
      setStatus(`Backed up as “${saved.name}”.`);
      refresh();
    } catch (e) {
      setError(e?.message || 'The backup did not upload.');
      if (e?.code === 'EXPIRED') setConnected(false);
    } finally {
      setBusy('');
    }
  };

  const handleExportOne = async () => {
    setError('');
    setStatus('');
    setBusy('export');
    try {
      const json = JSON.stringify({ resume: resumeData }, null, 2);
      const name = `resume-${(resumeData?.personalInfo?.fullName || 'untitled')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')}.json`;
      const saved = await uploadJson(json, name);
      sound.playSuccess?.();
      setStatus(`Exported the current resume as “${saved.name}”.`);
      refresh();
    } catch (e) {
      setError(e?.message || 'The export did not upload.');
      if (e?.code === 'EXPIRED') setConnected(false);
    } finally {
      setBusy('');
    }
  };

  const handleRestore = async (file) => {
    setError('');
    setStatus('');
    setBusy(`restore:${file.id}`);
    try {
      const text = await downloadText(file.id);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        setError(`“${file.name}” is not valid JSON.`);
        return;
      }
      onImportStore?.(parsed, file.name);
      sound.playSuccess?.();
      setStatus(`Restored from “${file.name}”. Your current tabs were replaced.`);
    } catch (e) {
      setError(e?.message || 'That file could not be downloaded.');
      if (e?.code === 'EXPIRED') setConnected(false);
    } finally {
      setBusy('');
    }
  };

  const handleTrash = async (file) => {
    setError('');
    setStatus('');
    setBusy(`trash:${file.id}`);
    try {
      await trashFile(file.id);
      setStatus(`Moved “${file.name}” to your Drive trash.`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e) {
      setError(e?.message || 'Could not move that file to the trash.');
    } finally {
      setBusy('');
    }
  };

  return (
    <ModalShell onClose={onClose} labelledBy="drive-title" describedBy="drive-desc">
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-6 w-6 shrink-0 text-rose-300" aria-hidden="true" />
          <div>
            <h2 id="drive-title" className="text-lg font-bold tracking-wide text-pink-50">
              Google Drive
            </h2>
            <p id="drive-desc" className="mt-1 text-sm text-pink-200/80">
              Back up your whole workspace, or export the current resume, to your own
              Drive. Nothing is sent anywhere else.
            </p>
          </div>
        </div>

        {/* Scope disclosure — the user should know exactly how much of their
            Drive this can see before they connect, not after. */}
        <p className="mt-3 rounded-lg border border-pink-500/25 bg-black/25 p-3 text-xs text-pink-200/70">
          This app requests the <strong>drive.file</strong> scope. It can only see
          files it created itself — it cannot read anything else in your Drive. The
          access token is kept in memory only and never written to disk.
        </p>

        <div aria-live="polite" role="status" className="min-h-[1.5rem]">
          {error && (
            <p className="mt-3 flex items-start gap-2 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {status && !error && (
            <p className="mt-3 flex items-start gap-2 text-sm text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {status}
            </p>
          )}
        </div>

        {!configured && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 text-sm text-amber-200">
            <p className="font-semibold">Google Drive is not configured for this build.</p>
            <p className="mt-1 text-amber-200/80">
              Set <code className="rounded bg-black/40 px-1">VITE_GOOGLE_CLIENT_ID</code> to
              a Google OAuth client ID and rebuild. The JSON Resume and file import/export
              options work without it.
            </p>
          </div>
        )}

        {configured && !connected && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={busy === 'connect'}
            className={`mt-4 inline-flex items-center gap-2 rounded-md border border-rose-400/50 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50 ${RING}`}
          >
            <Cloud className="h-4 w-4" aria-hidden="true" />
            {busy === 'connect' ? 'Opening Google…' : 'Connect Google Drive'}
          </button>
        )}

        {configured && connected && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBackup}
                disabled={Boolean(busy)}
                className={`inline-flex items-center gap-2 rounded-md border border-rose-400/50 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50 ${RING}`}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {busy === 'backup' ? 'Backing up…' : 'Back up everything'}
              </button>
              <button
                type="button"
                onClick={handleExportOne}
                disabled={Boolean(busy)}
                className={`inline-flex items-center gap-2 rounded-md border border-pink-400/40 bg-black/30 px-3 py-2 text-sm font-semibold text-pink-100 hover:bg-black/50 disabled:opacity-50 ${RING}`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {busy === 'export' ? 'Exporting…' : 'Export current resume'}
              </button>
              <button
                type="button"
                onClick={refresh}
                disabled={Boolean(busy)}
                className={`inline-flex items-center gap-2 rounded-md border border-pink-400/30 px-3 py-2 text-sm text-pink-200 hover:bg-black/40 disabled:opacity-50 ${RING}`}
              >
                <RefreshCw
                  className={`h-4 w-4 ${busy === 'list' ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className={`ml-auto inline-flex items-center gap-2 rounded-md border border-pink-400/30 px-3 py-2 text-sm text-pink-200 hover:bg-black/40 ${RING}`}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Disconnect
              </button>
            </div>

            <section className="mt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-pink-100">
                Your files
              </h3>
              {files.length === 0 && busy !== 'list' && (
                <p className="mt-2 text-sm text-pink-200/60">
                  Nothing here yet. Use the backup button above to create your first one.
                </p>
              )}
              <ul className="mt-2 divide-y divide-pink-500/15">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center gap-2 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-pink-100">
                      {file.name}
                    </span>
                    <span className="text-xs text-pink-200/60">
                      {formatDate(file.modifiedTime)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRestore(file)}
                      disabled={Boolean(busy)}
                      className={`rounded border border-pink-400/40 px-2 py-1 text-xs font-semibold text-pink-100 hover:bg-black/40 disabled:opacity-50 ${RING}`}
                    >
                      {busy === `restore:${file.id}` ? 'Restoring…' : 'Restore'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTrash(file)}
                      disabled={Boolean(busy)}
                      aria-label={`Move ${file.name} to the Drive trash`}
                      className={`rounded border border-pink-400/30 px-2 py-1 text-xs text-pink-200 hover:bg-black/40 disabled:opacity-50 ${RING}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <a
          href="https://drive.google.com/drive/"
          target="_blank"
          rel="noreferrer noopener"
          className={`mt-4 inline-flex items-center gap-1.5 text-xs text-rose-300 underline underline-offset-2 hover:text-rose-200 ${RING}`}
        >
          Open Google Drive
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-md border border-pink-400/40 px-4 py-2 text-sm font-semibold text-pink-100 hover:bg-black/40 ${RING}`}
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
