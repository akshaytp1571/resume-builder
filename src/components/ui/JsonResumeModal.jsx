import React, { useRef, useState } from 'react';
import { Download, Upload, ExternalLink, X } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import { Button } from './primitives';
import {
  toJsonResume,
  fromJsonResume,
  jsonResumeFilename,
} from '../../utils/jsonResume';

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
      {/* Header: serif kicker + mono title + 32px close, on a hairline. */}
      <div className="flex items-center justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="dt-serif text-[13px] text-signal">Interchange</span>
          <h2 id="jsonresume-title" className="dt-label text-bone">
            JSON Resume
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close JSON Resume dialog"
          onClick={onClose}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-5 overflow-y-auto p-4 text-[13px] sm:p-5">
        <p
          id="jsonresume-desc"
          className="font-sans text-[12.5px] leading-relaxed text-bone-70"
        >
          An open format used by many resume tools. Use it to bring a resume in
          from somewhere else, or to take this one out.
        </p>

        <a
          href="https://jsonresume.org/schema"
          target="_blank"
          rel="noreferrer noopener"
          className="dt-label inline-flex items-center gap-1.5 text-bone-52 underline underline-offset-4 transition-colors duration-[90ms] hover:text-bone"
        >
          What is JSON Resume?
          <ExternalLink size={11} aria-hidden="true" />
        </a>

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

        <div className="border-t border-rule pt-3">
          <span className="dt-label mb-2 block text-bone-52">Export</span>
          <p className="font-sans text-[12.5px] leading-relaxed text-bone-70">
            Writes your resume as a JSON Resume document. Sections this format
            cannot express are preserved under <code className="dt-data text-bone">x-</code> keys rather than
            dropped.
          </p>
          <label className="mt-3 flex items-center gap-2 font-sans text-[12.5px] text-bone-70">
            <input
              type="checkbox"
              checked={includePhoto}
              onChange={(e) => setIncludePhoto(e.target.checked)}
              className="h-3.5 w-3.5 accent-signal"
            />
            Include my photo (adds a large base64 block to the file)
          </label>
          <Button variant="quiet" size="sm" onClick={handleExport} className="mt-3 gap-1.5">
            <Download size={12} aria-hidden="true" />
            Export as JSON Resume
          </Button>
        </div>

        <div className="border-t border-rule pt-3">
          <span className="dt-label mb-2 block text-bone-52">Import</span>
          <p className="font-sans text-[12.5px] leading-relaxed text-bone-70">
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
            className="mt-3 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[2px] border border-rule-2 px-[10px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
          >
            <Upload size={12} aria-hidden="true" />
            Choose a JSON Resume file
          </label>
        </div>
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
