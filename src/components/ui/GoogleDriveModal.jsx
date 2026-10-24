import React, { useCallback, useEffect, useState } from 'react';
import {
  Cloud,
  Download,
  Upload,
  Trash2,
  ExternalLink,
  LogOut,
  RefreshCw,
  X,
} from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import { Button, IconButton } from './primitives';
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
      {/* Header: serif kicker + mono title + 32px close, on a hairline. */}
      <div className="flex items-center justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="dt-serif text-[13px] text-signal">Drive</span>
          <h2 id="drive-title" className="dt-label text-bone">
            Google Drive
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close Google Drive dialog"
          onClick={onClose}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-5 overflow-y-auto p-4 text-[13px] sm:p-5">
        <p
          id="drive-desc"
          className="font-sans text-[12.5px] leading-relaxed text-bone-70"
        >
          Back up your whole workspace, or export the current resume, to your own
          Drive. Nothing is sent anywhere else.
        </p>

        {/* Scope disclosure — the user should know exactly how much of their
            Drive this can see before they connect, not after. Load-bearing
            trust copy: word for word. */}
        <div className="border-l-2 border-rule-2 py-1 pl-3">
          <p className="dt-data leading-relaxed text-bone-70">
            This app requests the <strong className="font-medium text-bone">drive.file</strong> scope. It can only see
            files it created itself — it cannot read anything else in your Drive. The
            access token is kept in memory only and never written to disk.
          </p>
        </div>

        {/* Errors and confirmations are announced, not just drawn. */}
        <div aria-live="polite" role="status" className="min-h-[1.5rem]">
          {error && (
            <p className="border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
              {error}
            </p>
          )}
          {status && !error && (
            <p className="border-l-2 border-signal py-1 pl-2 font-sans text-[12px] text-signal">
              {status}
            </p>
          )}
        </div>

        {!configured && (
          <div className="border-l-2 border-rule-2 py-1 pl-3">
            <p className="font-sans text-[12px] font-medium text-bone">
              Google Drive is not configured for this build.
            </p>
            <p className="dt-data mt-1 leading-relaxed text-bone-70">
              Set <code className="text-bone">VITE_GOOGLE_CLIENT_ID</code> to
              a Google OAuth client ID and rebuild. The JSON Resume and file import/export
              options work without it.
            </p>
          </div>
        )}

        {configured && !connected && (
          <Button
            variant="signal"
            onClick={handleConnect}
            disabled={busy === 'connect'}
            className="gap-1.5"
          >
            <Cloud size={13} aria-hidden="true" />
            {busy === 'connect' ? 'Opening Google…' : 'Connect Google Drive'}
          </Button>
        )}

        {configured && connected && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="signal"
                onClick={handleBackup}
                disabled={Boolean(busy)}
                className="gap-1.5"
              >
                <Upload size={13} aria-hidden="true" />
                {busy === 'backup' ? 'Backing up…' : 'Back up everything'}
              </Button>
              <Button
                variant="quiet"
                onClick={handleExportOne}
                disabled={Boolean(busy)}
                className="gap-1.5"
              >
                <Download size={13} aria-hidden="true" />
                {busy === 'export' ? 'Exporting…' : 'Export current resume'}
              </Button>
              <Button
                variant="quiet"
                onClick={refresh}
                disabled={Boolean(busy)}
                className="gap-1.5"
              >
                <RefreshCw
                  size={13}
                  className={busy === 'list' ? 'animate-spin' : ''}
                  aria-hidden="true"
                />
                Refresh
              </Button>
              <Button
                variant="ghost"
                onClick={handleDisconnect}
                className="ml-auto gap-1.5"
              >
                <LogOut size={13} aria-hidden="true" />
                Disconnect
              </Button>
            </div>

            <div className="border-t border-rule pt-3">
              <span className="dt-label mb-2 block text-bone-52">
                Your files
              </span>
              {files.length === 0 && busy !== 'list' && (
                <p className="dt-data text-bone-32">
                  Nothing here yet. Use the backup button above to create your first one.
                </p>
              )}
              <ul className="divide-y divide-[var(--rule)]">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center gap-2 py-2"
                  >
                    <span className="dt-data min-w-0 flex-1 truncate text-bone">
                      {file.name}
                    </span>
                    <span className="dt-data shrink-0 text-bone-32">
                      {formatDate(file.modifiedTime)}
                    </span>
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => handleRestore(file)}
                      disabled={Boolean(busy)}
                    >
                      {busy === `restore:${file.id}` ? 'Restoring…' : 'Restore'}
                    </Button>
                    <IconButton
                      label={`Move ${file.name} to the Drive trash`}
                      tone="alarm"
                      size="sm"
                      onClick={() => handleTrash(file)}
                      disabled={Boolean(busy)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <a
          href="https://drive.google.com/drive/"
          target="_blank"
          rel="noreferrer noopener"
          className="dt-label inline-flex items-center gap-1.5 text-bone-52 underline underline-offset-4 transition-colors duration-[90ms] hover:text-bone"
        >
          Open Google Drive
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
      </div>
    </ModalShell>
  );
}
