import React, { useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Award,
  Sparkles,
  Target,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { matchKeywords } from '../../utils/keywordMatcher';
import { loadStore, getActiveVariant } from '../../utils/resumeStore';
import ModalShell from './ModalShell';
import AtsGauge from './AtsGauge';

/** The active variant's data, read fresh when the parent did not pass it. */
function activeResumeData() {
  try {
    return getActiveVariant(loadStore())?.data || null;
  } catch (err) {
    return null;
  }
}

const SECTION_LABELS = {
  summary: 'Summary',
  skills: 'Skills',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  customSections: 'Custom',
};

export default function AtsScoreModal({ atsResult, onClose, resumeData, onShowText }) {
  const { score, rating, breakdown, suggestions } = atsResult;

  // --- local job-description matcher (no AI, no network) --------------------
  const [jdOpen, setJdOpen] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [analyzedJd, setAnalyzedJd] = useState('');
  const [copied, setCopied] = useState(false);

  // Keyed on analyzedJd, not jobDescription, so typing never re-runs the match.
  const match = useMemo(() => {
    if (!analyzedJd) return null;
    return matchKeywords(resumeData || activeResumeData(), analyzedJd);
  }, [analyzedJd, resumeData]);

  const handleAnalyze = () => {
    if (!jobDescription.trim()) return;
    sound.playAction();
    setCopied(false);
    setAnalyzedJd(jobDescription);
  };

  const handleClear = () => {
    sound.playAction();
    setJobDescription('');
    setAnalyzedJd('');
    setCopied(false);
  };

  const handleCopyMissing = async () => {
    if (!match?.missing?.length) return;
    const text = match.missing.map((m) => m.term).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      sound.playSuccess();
    } catch (err) {
      setCopied(false);
    }
  };

  // The "Celebrate" confetti button was removed in the v3.0.0 re-skin; this
  // handler and its canvas-confetti import were left behind. Deleted rather
  // than kept "in case" — dead code that imports a 30 KB animation library is
  // not a placeholder, it is weight.

  return (
    <ModalShell onClose={onClose} labelledBy="ats-score-title" className="max-w-2xl">
        {/* Header: mono index + title + 40px close, on a hairline. */}
        <div className="flex items-center justify-between border-b border-rule bg-housing px-4 py-3">
          <div className="flex items-baseline gap-2.5">
            <span className="dt-serif text-[13px] text-signal">ATS</span>
            {/* modals.test.jsx asserts this accessible name matches
                /ATS Readiness/i. The string is fixed — style it, never rename
                it. */}
            <h2 id="ats-score-title" className="dt-label text-bone">
              ATS Readiness &amp; Score Breakdown
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {/* The score is a verdict; the plain-text projection is the evidence
                behind it. So the entry point belongs here, next to the number,
                not buried in a settings menu. */}
            {onShowText && (
              <button
                type="button"
                onClick={() => {
                  sound.playAction();
                  onShowText();
                }}
                title="Show the single column of text an ATS actually extracts"
                className="inline-flex h-8 cursor-pointer items-center rounded-[2px] border border-rule-2 px-[10px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
              >
                Parser view
              </button>
            )}
            <button
              type="button"
              aria-label="Close ATS score dialog"
              onClick={() => {
                sound.playAction();
                onClose();
              }}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-5 overflow-y-auto p-4 text-[13px] sm:p-5">
          {/* THE GAUGE — the app's most instrument-like surface. */}
          <div>
            <AtsGauge score={score} />
            <div className="mt-3 flex items-baseline justify-between border-t border-rule pt-2">
              <span className="dt-label text-bone-32">Rating</span>
              <span className="dt-data text-bone-70">{rating}</span>
            </div>
          </div>

          {/* Breakdown: hairline rows, mono numerals. No bars, no rings. */}
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="dt-label text-bone-52">Category</span>
              <span className="dt-label text-bone-32">Score</span>
            </div>
            <div className="divide-y divide-[var(--rule)] border-t border-rule">
              {breakdown.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 py-[7px]">
                  {item.status === 'good' ? (
                    <CheckCircle2 size={13} className="shrink-0 text-signal" aria-hidden="true" />
                  ) : (
                    <AlertCircle size={13} className="shrink-0 text-alarm" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate font-sans text-[13px] text-bone">
                    {item.category}
                  </span>
                  <span className="dt-data shrink-0 tabular-nums text-bone-70">
                    {item.score}
                    <span className="text-bone-32">/{item.maxScore}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Job description keyword match — local, offline, no AI. */}
          <div className="border-t border-rule pt-3">
            <button
              type="button"
              onClick={() => {
                sound.playTab();
                setJdOpen((open) => !open);
              }}
              aria-expanded={jdOpen}
              aria-controls="jd-match-panel"
              className="flex w-full cursor-pointer items-baseline justify-between gap-2 text-left"
            >
              <span className="dt-label text-bone-52">Match against a job description</span>
              <span className="flex items-center gap-2">
                <span className="dt-data text-bone-32">offline</span>
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className={`shrink-0 text-bone-32 transition-transform duration-[90ms] ${jdOpen ? 'rotate-180' : ''}`}
                />
              </span>
            </button>

            {jdOpen && (
              <div id="jd-match-panel" className="mt-3 space-y-3">
                <label htmlFor="jd-match-input" className="dt-label mb-1 block text-bone-52">
                  Paste the job description
                </label>
                <textarea
                  id="jd-match-input"
                  rows={6}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  aria-label="Job description to match against this resume"
                  placeholder="Paste the requirements and responsibilities from the posting…"
                  className="w-full resize-y select-text border-0 border-b bg-transparent px-0 py-2 font-sans text-[16px] leading-relaxed text-bone placeholder:text-bone-32 focus:outline-none focus-visible:outline-none"
                  style={{ borderBottomColor: 'var(--rule-2)' }}
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={!jobDescription.trim()}
                    aria-label="Analyze job description match"
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[2px] border border-signal bg-signal px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-void transition-colors duration-[90ms] hover:bg-[#c8ef2e] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Target size={12} aria-hidden="true" />
                    <span>Analyze match</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={!jobDescription && !analyzedJd}
                    aria-label="Clear job description and match results"
                    className="inline-flex h-8 cursor-pointer items-center rounded-[2px] border border-rule-2 px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>

                {match?.error && (
                  <p className="flex items-start gap-2 border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{match.error}</span>
                  </p>
                )}

                {match && !match.error && (
                  <>
                    <div aria-live="polite" className="border-t border-rule pt-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="dt-label text-bone-52">Keyword match</span>
                        <span className="dt-data text-bone-32">
                          {match.matchedWeight}/{match.totalWeight} weighted
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="font-mono text-[28px] leading-none tabular-nums text-bone">
                          {match.matchScore}%
                        </span>
                        <span className="dt-data text-bone-52">
                          {match.matched.length} of{' '}
                          {match.matched.length + match.missing.length} keywords
                        </span>
                      </div>
                      {/* same calibrated strip language as the gauge */}
                      <div
                        role="progressbar"
                        aria-valuenow={match.matchScore}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Job description keyword match score"
                        className="mt-2 h-[3px] w-full bg-[rgba(237,232,220,0.12)]"
                      >
                        <div
                          className={`h-full ${
                            match.matchScore >= 70
                              ? 'bg-signal'
                              : match.matchScore >= 40
                                ? 'bg-[#f5b544]'
                                : 'bg-alarm'
                          }`}
                          style={{ width: `${match.matchScore}%` }}
                        />
                      </div>
                      <p className="dt-data mt-2 text-bone-32">
                        {Object.keys(match.sections)
                          .filter((key) => match.sections[key] > 0)
                          .map((key) => `${SECTION_LABELS[key] || key} ${match.sections[key]}`)
                          .join(' · ') || 'No resume sections matched yet.'}
                      </p>
                    </div>

                    {match.matched.length > 0 && (
                      <div>
                        <span className="dt-label flex items-center gap-1.5 text-bone-52">
                          <CheckCircle2 size={12} className="text-signal" aria-hidden="true" />
                          Matched ({match.matched.length})
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {match.matched.map((kw) => (
                            <span
                              key={kw.term}
                              title={`Found in ${SECTION_LABELS[kw.where] || kw.where}`}
                              className="rounded-[2px] border border-signal/40 px-1.5 py-0.5 font-mono text-[10px] text-signal"
                            >
                              {kw.term}
                              <span className="text-signal/50"> · {kw.category}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {match.missing.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="dt-label flex items-center gap-1.5 text-bone-52">
                            <AlertCircle size={12} className="text-alarm" aria-hidden="true" />
                            Missing ({match.missing.length})
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyMissing}
                            aria-label="Copy missing keywords to clipboard"
                            className="inline-flex cursor-pointer items-center gap-1 rounded-[2px] border border-rule-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
                          >
                            {copied ? <Check size={10} aria-hidden="true" /> : <Copy size={10} aria-hidden="true" />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {match.missing.map((kw) => (
                            <span
                              key={kw.term}
                              title={`Weight ${kw.weight}`}
                              className="rounded-[2px] border border-alarm/40 px-1.5 py-0.5 font-mono text-[10px] text-alarm"
                            >
                              + {kw.term}
                              <span className="text-alarm/50"> · {kw.category}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {match.matched.length === 0 && match.missing.length === 0 && (
                      <p className="dt-data border-l-2 border-rule-2 py-1 pl-2 text-bone-32">
                        No keywords could be extracted from that text.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Recommendations: numbered hairline rows, not amber cards. */}
          <div className="border-t border-rule pt-3">
            <span className="dt-label mb-2 block text-bone-52">
              Recommendations{suggestions.length > 0 ? ` · ${suggestions.length}` : ''}
            </span>
            {suggestions.length > 0 ? (
              <ol className="divide-y divide-[var(--rule)]">
                {suggestions.map((sug, i) => (
                  <li key={i} className="flex items-start gap-2 py-2">
                    <span className="dt-serif mt-px w-[14px] shrink-0 text-[12px] text-signal">
                      {i + 1}
                    </span>
                    <span className="font-sans text-[12.5px] leading-relaxed text-bone-70">
                      {sug}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="flex items-center gap-2 font-sans text-[12.5px] text-bone-70">
                <CheckCircle2 size={13} className="shrink-0 text-signal" aria-hidden="true" />
                <span>No outstanding issues. This resume should pass an automated screen.</span>
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-rule bg-housing px-4 py-2.5">
          <button
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="inline-flex h-8 cursor-pointer items-center rounded-[2px] border border-rule-2 px-[14px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
          >
            Close
          </button>
        </div>
      </ModalShell>
  );
}