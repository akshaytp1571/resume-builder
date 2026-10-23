import React, { useRef, useState } from 'react';
import { FileJson2, Download, Upload, AlertCircle, ExternalLink } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import {
  toJsonResume,
  fromJsonResume,
  jsonResumeFilename,
} from '../../utils/jsonResume';

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]';

/**
 * Import/export in the public JSON Resume format.
 *
 * The app's own backup (`.json` from the variant switcher) is private to this
 * app. This dialog is the way in and out of the wider ecosystem: a resume made
 * in another tool can be brought here, and one made here can leave.
 */
export default function JsonResumeModal({ isOpen, onClose, resumeData, onImport }) {
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [includePhoto, setIncludePhoto] = useState(false);
  const fileRef = useRef(null);

  if (!isOpen) return null;

  const reset = () => {
    setError('');
    setStatus('');
  };

  const handleExport = () => {
    reset();
    try {
      const doc = toJsonResume(resumeData, { includePhoto });
      const blob = new Blob([JSON.stringify(doc, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = jsonResumeFilename(resumeData);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      sound.playSuccess?.();
      setStatus('Exported. The file is in your downloads.');
    } catch (err) {
      console.error(err);
      setError('Could not build the export. Your resume has not been changed.');
    }
  };

  const handleFile = async (file) => {
    reset();
    if (!file) return;
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        setError('That file is not valid JSON. Check that you picked the right file.');
        return;
      }
      const internal = fromJsonResume(parsed);
      onImport?.(internal);
      sound.playSuccess?.();
      setStatus('Imported. Check the editor — your previous resume is still saved.');
    } catch (err) {
      setError(err?.message || 'That file could not be read as a JSON Resume.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <ModalShell onClose={onClose} labelledBy="jsonresume-title" describedBy="jsonresume-desc">
      <div className="p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <FileJson2
            className="mt-0.5 h-6 w-6 shrink-0 text-rose-300"
            aria-hidden="true"
          />
          <div>
            <h2
              id="jsonresume-title"
              className="text-lg font-bold tracking-wide text-pink-50"
            >
              JSON Resume
            </h2>
            <p id="jsonresume-desc" className="mt-1 text-sm text-pink-200/80">
              An open format used by many resume tools. Use it to bring a resume in
              from somewhere else, or to take this one out.
            </p>
          </div>
        </div>

        <a
          href="https://jsonresume.org/schema"
          target="_blank"
          rel="noreferrer noopener"
          className={`mt-3 inline-flex items-center gap-1.5 text-sm text-rose-300 underline underline-offset-2 hover:text-rose-200 ${RING}`}
        >
          What is JSON Resume?
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>

        {/* Errors and confirmations are announced, not just drawn. */}
        <div aria-live="polite" role="status" className="min-h-[1.5rem]">
          {error && (
            <p className="mt-4 flex items-start gap-2 text-sm text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {status && !error && (
            <p className="mt-4 text-sm text-emerald-300">{status}</p>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <section className="rounded-lg border border-pink-500/25 bg-black/20 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-pink-100">
              Export
            </h3>
            <p className="mt-1 text-sm text-pink-200/70">
              Writes your resume as a JSON Resume document. Sections this format
              cannot express are preserved under <code>x-</code> keys rather than
              dropped.
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm text-pink-200/90">
              <input
                type="checkbox"
                checked={includePhoto}
                onChange={(e) => setIncludePhoto(e.target.checked)}
                className={`h-4 w-4 rounded border-pink-400/40 bg-black/40 accent-rose-400 ${RING}`}
              />
              Include my photo (adds a large base64 block to the file)
            </label>
            <button
              type="button"
              onClick={handleExport}
              className={`mt-3 inline-flex items-center gap-2 rounded-md border border-rose-400/50 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25 ${RING}`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export as JSON Resume
            </button>
          </section>

          <section className="rounded-lg border border-pink-500/25 bg-black/20 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-pink-100">
              Import
            </h3>
            <p className="mt-1 text-sm text-pink-200/70">
              Replaces the resume in the current tab. Your other tabs are untouched,
              and you can undo afterwards.
            </p>
            <input
              ref={fileRef}
              id="jsonresume-file"
              type="file"
              accept="application/json,.json"
              onChange={(e) => handleFile(e.target.files?.[0])}
              className="sr-only"
            />
            <label
              htmlFor="jsonresume-file"
              className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-pink-400/40 bg-black/30 px-3 py-2 text-sm font-semibold text-pink-100 hover:bg-black/50 ${RING}`}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Choose a JSON Resume file
            </label>
          </section>
        </div>

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
