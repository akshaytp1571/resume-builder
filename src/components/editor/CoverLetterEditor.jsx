import React, { useId, useMemo, useState } from 'react';
import { Download, FileText, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import {
  createCoverLetter,
  normalizeCoverLetter,
  renderCoverLetter,
  suggestCoverLetter,
  countWords,
} from '../../utils/coverLetter.js';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071a]';

const FIELD_CLASS = `w-full bg-[#18071a] border border-pink-500/25 rounded-xl px-3 py-2 text-xs text-pink-50 placeholder:text-pink-300/60 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors font-sans ${FOCUS_RING}`;

const LABEL_CLASS = 'block text-[11px] font-bold text-pink-200 uppercase tracking-wider mb-1.5';

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
    <div className="space-y-4 font-sans text-xs text-pink-100 animate-fade-in">
      {/* Header + word count */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`${uid}-body`}
          className="text-xs font-bold text-pink-200 uppercase tracking-wider flex items-center gap-1.5"
        >
          <FileText size={13} className="text-rose-400" aria-hidden="true" />
          ✦ Cover Letter
        </label>
        <span
          className="text-[10px] px-2.5 py-0.5 rounded-full font-sans font-semibold border bg-pink-950/70 text-pink-300 border-pink-500/40 whitespace-nowrap"
          aria-live="polite"
        >
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
            Hiring manager <span className="text-pink-400/85 normal-case font-normal">(optional)</span>
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
          className={`${FIELD_CLASS} rounded-2xl p-3.5 leading-relaxed resize-y`}
        />
      </div>

      {/* Actions */}
      <div className="p-3.5 rounded-2xl bg-[#1d0920] border border-pink-500/30 space-y-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white shadow-[0_2px_12px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ${FOCUS_RING}`}
            title="Build a draft from your resume's own summary, skills and latest role"
          >
            <Wand2 size={13} aria-hidden="true" />
            <span>{isGenerating ? 'Drafting…' : 'Generate draft'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPreview}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/25 transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS_RING}`}
          >
            <Sparkles size={13} className="text-rose-300" aria-hidden="true" />
            <span>Copy letter</span>
          </button>

          {onExportDocx && (
            <button
              type="button"
              onClick={() => {
                sound.playAction();
                onExportDocx();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 border border-pink-500/25 transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS_RING}`}
            >
              <Download size={13} className="text-pink-300" aria-hidden="true" />
              <span>.DOCX</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClear}
            className={`ml-auto px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-rose-950/60 text-pink-300/80 hover:text-rose-200 border border-pink-500/20 hover:border-rose-500/40 transition-colors cursor-pointer flex items-center gap-1.5 ${FOCUS_RING}`}
            aria-label="Clear the cover letter"
          >
            <Trash2 size={13} aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>

        <p className="text-[10.5px] text-pink-300/70 leading-relaxed">
          The draft is assembled from your own summary, skills and most recent role —
          no placeholders. Edit it before sending.
        </p>
      </div>
    </div>
  );
}
