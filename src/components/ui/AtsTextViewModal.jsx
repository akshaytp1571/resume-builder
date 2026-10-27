import React, { useMemo, useState } from 'react';
import { X, Copy, Download, Check } from 'lucide-react';
import ModalShell from './ModalShell';
import { sound } from '../../utils/soundEffects';
import { toAtsText, atsTextFilename } from '../../utils/atsTextView.js';

/**
 * What the parser reads.
 *
 * An ATS does not see the design. This shows the résumé as a single column of
 * text — headings, bullets, no styling — which is roughly what an extraction
 * pipeline produces. If something is missing here, it is missing from the
 * export, however good the preview looks.
 *
 * It sits next to the score on purpose: the score is a verdict, this is the
 * evidence. A number without a visible cause is just anxiety.
 */

export default function AtsTextViewModal({ resumeData, onClose }) {
  const [copied, setCopied] = useState(false);
  const projection = useMemo(() => toAtsText(resumeData), [resumeData]);

  const handleCopy = async () => {
    sound.playAction();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(projection.text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the textarea is selectable, so the user can copy by
      // hand. No error state for that.
      setCopied(false);
    }
  };

  const handleDownload = () => {
    sound.playSuccess();
    const blob = new Blob([projection.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = atsTextFilename(resumeData);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <ModalShell onClose={onClose} labelledBy="ats-text-title" className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="flex items-baseline gap-2.5">
          <span className="dt-serif text-[13px] text-signal">TXT</span>
          <h2 id="ats-text-title" className="dt-label text-bone">
            What the parser reads
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close plain text view"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-3 overflow-y-auto p-4 sm:p-5">
        <p className="border-l-2 border-rule-2 py-1 pl-2 font-sans text-[12px] leading-relaxed text-bone-52">
          An applicant tracking system does not see the layout — it extracts a
          single column of text and guesses where each section starts. This is
          that column. Anything missing below will be missing from the employer's
          view, whatever the page looks like.
        </p>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-rule pt-2">
          <span className="dt-data text-bone-32">
            {projection.sections.length} sections
          </span>
          <span className="dt-data text-bone-32">{projection.words} words</span>
          <span className="dt-data text-bone-32">{projection.chars} chars</span>
        </div>

        {/* The projection itself. Monospace, selectable, no wrapping tricks. */}
        <pre
          aria-label="Plain text the parser reads"
          className="max-h-[46vh] overflow-auto whitespace-pre-wrap break-words border border-rule bg-void p-3 font-mono text-[11.5px] leading-relaxed text-bone-70"
        >
          {projection.text || 'Nothing to show yet.'}
        </pre>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-rule-2 px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <Download size={12} aria-hidden="true" />
          <span>.txt</span>
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-signal bg-signal px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-void transition-colors duration-[90ms] hover:bg-[#c8ef2e]"
        >
          {copied ? (
            <Check size={12} aria-hidden="true" />
          ) : (
            <Copy size={12} aria-hidden="true" />
          )}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </ModalShell>
  );
}
