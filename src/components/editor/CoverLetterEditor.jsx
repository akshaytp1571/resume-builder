import React, { useId, useMemo, useState } from 'react';
import { Copy, Download, Trash2, Wand2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import {
  createCoverLetter,
  normalizeCoverLetter,
  renderCoverLetter,
  suggestCoverLetter,
  countWords,
} from '../../utils/coverLetter.js';

// A ledger field: no box, one hairline under it. 16px so iOS does not zoom the
// viewport on focus, which would look like a layout bug.
const FIELD_CLASS =
  'w-full resize-y border-0 border-b bg-transparent px-0 py-2 text-[16px] leading-[1.45] text-bone placeholder:text-bone-32 focus:outline-none focus-visible:outline-none';

const LABEL_CLASS = 'dt-label mb-1 block text-bone-52';

/**
 * Cover letter editor.
 *
 * The letter lives on the active variant (`variant.letter`), so it travels with
 * the resume it belongs to. This component is fully controlled: `letter` in,
 * `onChange(nextLetter)` out — no storage, no AI, no network.
 */
export default function CoverLetterEditor({
  letter,
  resumeData,
  onChange,
  onExportDocx,
}) {
  const safe = useMemo(() => normalizeCoverLetter(letter), [letter]);
  const [isGenerating, setIsGenerating] = useState(false);
  const uid = useId();

  const words = countWords(safe.body);
  const chars = safe.body.length;

  const update = (patch) => {
    onChange?.({ ...safe, ...patch });
  };

  const handleGenerate = () => {
    sound.playSuccess();
    setIsGenerating(true);
    // Synchronous, but the button still gets a beat so the click feels answered.
    const draft = suggestCoverLetter(resumeData, '');
    update({ body: draft, date: safe.date || createCoverLetter().date });
    setIsGenerating(false);
  };

  const handleClear = () => {
    sound.playAction();
    onChange?.(createCoverLetter());
  };

  const handleCopyPreview = () => {
    const text = renderCoverLetter(safe, resumeData);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => sound.playSuccess(),
        () => {}
      );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + word count. The count is a readout, so it is mono and tabular
          and lives on the baseline grid rather than in a pill. */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="dt-serif text-[13px] text-signal">01</span>
          <label htmlFor={`${uid}-body`} className="dt-label text-bone-70">
            Cover letter
          </label>
        </div>
        <span className="dt-data whitespace-nowrap text-bone-32" aria-live="polite">
          {words} {words === 1 ? 'word' : 'words'} · {chars} chars
        </span>
      </div>

      {/* Job title + company */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${uid}-job`} className={LABEL_CLASS}>
            Job title
          </label>
          <input
            id={`${uid}-job`}
            type="text"
            value={safe.jobTitle}
            onChange={(e) => update({ jobTitle: e.target.value })}
            placeholder="Senior QA Engineer"
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-company`} className={LABEL_CLASS}>
            Company
          </label>
          <input
            id={`${uid}-company`}
            type="text"
            value={safe.company}
            onChange={(e) => update({ company: e.target.value })}
            placeholder="Northwind Technologies"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {/* Hiring manager + date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${uid}-manager`} className={LABEL_CLASS}>
            Hiring manager <span className="normal-case tracking-normal text-bone-32">optional</span>
          </label>
          <input
            id={`${uid}-manager`}
            type="text"
            value={safe.hiringManager}
            onChange={(e) => update({ hiringManager: e.target.value })}
            placeholder="Priya Raman"
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-date`} className={LABEL_CLASS}>
            Date
          </label>
          <input
            id={`${uid}-date`}
            type="date"
            value={safe.date}
            onChange={(e) => update({ date: e.target.value })}
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {/* Body */}
      <div>
        <label htmlFor={`${uid}-body`} className={LABEL_CLASS}>
          Letter body
        </label>
        <textarea
          id={`${uid}-body`}
          rows={12}
          value={safe.body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="Write your letter, or press Generate draft to start from your resume."
          className={`${FIELD_CLASS} leading-relaxed`}
        />
      </div>

      {/* Actions. One quiet row — the generate button is the only signal-coloured
          control, because it is the one action that creates content. */}
      <div className="space-y-2.5 border-t border-rule pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-signal bg-signal px-[14px] font-mono text-[11px] uppercase tracking-[0.08em] text-void transition-colors duration-[90ms] hover:bg-[#c8ef2e] disabled:cursor-not-allowed disabled:opacity-40"
            title="Build a draft from your resume's own summary, skills and latest role"
          >
            <Wand2 size={12} aria-hidden="true" />
            <span>{isGenerating ? 'Drafting…' : 'Generate draft'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPreview}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-rule-2 px-[10px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
          >
            <Copy size={12} aria-hidden="true" />
            <span>Copy letter</span>
          </button>

          {onExportDocx && (
            <button
              type="button"
              onClick={() => {
                sound.playAction();
                onExportDocx();
              }}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-rule-2 px-[10px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
            >
              <Download size={12} aria-hidden="true" />
              <span>.DOCX</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClear}
            className="ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-transparent px-[10px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-32 transition-colors duration-[90ms] hover:border-alarm/60 hover:text-alarm"
            aria-label="Clear the cover letter"
          >
            <Trash2 size={12} aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>

        <p className="font-sans text-[11px] leading-relaxed text-bone-32">
          The draft is assembled from your own summary, skills and most recent role
          — no placeholders. Edit it before sending.
        </p>
      </div>
    </div>
  );
}
