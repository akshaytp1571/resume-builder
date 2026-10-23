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
import confetti from 'canvas-confetti';
import { sound } from '../../utils/soundEffects';
import { matchKeywords } from '../../utils/keywordMatcher';
import { loadStore, getActiveVariant } from '../../utils/resumeStore';
import ModalShell from './ModalShell';

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

export default function AtsScoreModal({ atsResult, onClose, resumeData }) {
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

  const triggerCelebration = () => {
    sound.playSuccess();
    confetti({
      particleCount: 100,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  return (
    <ModalShell onClose={onClose} labelledBy="ats-score-title" className="max-w-xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
              <Award size={18} />
            </div>
            <div>
              <h2
                id="ats-score-title"
                className="text-sm font-bold text-pink-50 tracking-wide flex items-center gap-2"
              >
                ATS Readiness & Score Breakdown
              </h2>
              <p className="text-[11px] text-pink-300/70">
                Enterprise ATS Compatibility Algorithm
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close ATS score dialog"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="p-1.5 rounded-xl text-pink-400/60 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Top Score Banner / Radar HUD */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2e0e33] via-[#220a26] to-[#18071c] border border-pink-500/40 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[10.5px] font-semibold tracking-wide text-rose-300">
                ✦ ATS Compliance Score
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-pink-200 to-amber-200">
                  {score}%
                </span>
                <span className="text-pink-300/60 font-sans text-sm">/ 100</span>
              </div>
              <p className="text-xs font-semibold mt-1 text-emerald-300">
                Status: {rating}
              </p>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={triggerCelebration}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white flex items-center gap-1.5 shadow-[0_2px_15px_rgba(244,63,94,0.35)] cursor-pointer transition-all active:scale-95"
              >
                <Sparkles size={13} />
                <span>Celebrate</span>
              </button>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-rose-300 tracking-wide">
              Category Breakdown
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {breakdown.map((item, idx) => {
                const percentage = Math.round((item.score / item.maxScore) * 100);
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-[#1b071e] border border-pink-500/20 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-4">
                      {item.status === 'good' ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-amber-400 shrink-0" />
                      )}
                      <div className="flex-1 truncate">
                        <div className="flex justify-between text-xs mb-1 font-semibold">
                          <span className="text-pink-100">{item.category}</span>
                          <span className="text-rose-300 font-mono">
                            {item.score}/{item.maxScore}
                          </span>
                        </div>
                        <div className="w-full bg-[#120414] rounded-full h-2 overflow-hidden border border-pink-500/20">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.status === 'good' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Job Description Keyword Match — local, offline, no AI */}
          <div className="rounded-2xl bg-[#1b071e] border border-pink-500/20 overflow-hidden">
            <h3 className="text-xs font-semibold text-rose-300 tracking-wide">
              <button
                type="button"
                onClick={() => {
                  sound.playTab();
                  setJdOpen((open) => !open);
                }}
                aria-expanded={jdOpen}
                aria-controls="jd-match-panel"
                className="w-full flex items-center justify-between gap-2 px-3 py-3 text-left cursor-pointer hover:bg-pink-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
              >
                <span className="flex items-center gap-1.5">
                  <Target size={13} className="text-rose-400" />
                  <span>Match Against a Job Description</span>
                  <span className="text-[10px] font-normal text-pink-300/50">offline</span>
                </span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-pink-300/70 transition-transform ${jdOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </h3>

            {jdOpen && (
              <div id="jd-match-panel" className="px-3 pb-3 space-y-2.5">
                <label
                  htmlFor="jd-match-input"
                  className="block text-[11px] font-semibold text-pink-200 tracking-wide"
                >
                  Paste the job description:
                </label>
                <textarea
                  id="jd-match-input"
                  rows={6}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  aria-label="Job description to match against this resume"
                  placeholder="Paste the requirements and responsibilities from LinkedIn, Indeed, or a company careers page..."
                  className="w-full bg-[#120414] border border-pink-500/25 rounded-xl p-3 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400 focus-visible:ring-2 focus-visible:ring-rose-400 font-sans leading-relaxed transition-colors resize-y select-text"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={!jobDescription.trim()}
                    aria-label="Analyze job description match"
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white flex items-center gap-1.5 shadow-[0_2px_15px_rgba(244,63,94,0.35)] cursor-pointer transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
                  >
                    <Target size={13} />
                    <span>Analyze Match</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={!jobDescription && !analyzedJd}
                    aria-label="Clear job description and match results"
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 transition-colors cursor-pointer border border-pink-500/20 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
                  >
                    Clear
                  </button>
                </div>

                {match?.error && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/35 text-xs text-amber-100/90 flex items-start gap-2 font-sans">
                    <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>{match.error}</span>
                  </div>
                )}

                {match && !match.error && (
                  <>
                    <div
                      aria-live="polite"
                      className="p-3 rounded-xl bg-gradient-to-r from-[#2e0e33] via-[#220a26] to-[#18071c] border border-pink-500/40"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10.5px] font-semibold tracking-wide text-rose-300">
                          ✦ Keyword Match
                        </span>
                        <span className="text-[10.5px] text-pink-300/60 font-mono">
                          {match.matchedWeight}/{match.totalWeight} weighted
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-pink-200 to-amber-200">
                          {match.matchScore}%
                        </span>
                        <span className="text-pink-300/60 font-sans text-xs">
                          {match.matched.length} of{' '}
                          {match.matched.length + match.missing.length} keywords
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={match.matchScore}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Job description keyword match score"
                        className="w-full bg-[#120414] rounded-full h-2 overflow-hidden border border-pink-500/20 mt-2"
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            match.matchScore >= 70
                              ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                              : match.matchScore >= 40
                                ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                                : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                          }`}
                          style={{ width: `${match.matchScore}%` }}
                        />
                      </div>
                      <p className="text-[10.5px] text-pink-300/60 mt-2 font-sans">
                        {Object.keys(match.sections)
                          .filter((key) => match.sections[key] > 0)
                          .map((key) => `${SECTION_LABELS[key] || key} ${match.sections[key]}`)
                          .join(' · ') || 'No resume sections matched yet.'}
                      </p>
                    </div>

                    {match.matched.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-1.5">
                        <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                          <CheckCircle2 size={13} className="text-emerald-400" />
                          <span>Matched keywords ({match.matched.length})</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {match.matched.map((kw) => (
                            <span
                              key={kw.term}
                              title={`Found in ${SECTION_LABELS[kw.where] || kw.where}`}
                              className="px-2 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-100 text-[11px]"
                            >
                              {kw.term}
                              <span className="text-emerald-300/60"> · {kw.category}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {match.missing.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                            <AlertCircle size={13} className="text-amber-400" />
                            <span>Missing keywords ({match.missing.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyMissing}
                            aria-label="Copy missing keywords to clipboard"
                            className="px-2.5 py-1 rounded-lg bg-[#2a1a12] border border-amber-500/40 hover:border-amber-400 text-amber-200 text-[10.5px] font-semibold transition-colors cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
                          >
                            {copied ? <Check size={11} /> : <Copy size={11} />}
                            <span>{copied ? 'Copied' : 'Copy missing keywords'}</span>
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {match.missing.map((kw) => (
                            <span
                              key={kw.term}
                              title={`Weight ${kw.weight}`}
                              className="px-2 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-100 text-[11px]"
                            >
                              + {kw.term}
                              <span className="text-amber-300/60"> · {kw.category}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {match.matched.length === 0 && match.missing.length === 0 && (
                      <div className="p-3 rounded-xl bg-[#120414] border border-pink-500/20 text-xs text-pink-300/70 font-sans">
                        No keywords could be extracted from that text.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Actionable Recommendations */}
          <div>
            <h3 className="text-xs font-semibold text-rose-300 tracking-wide mb-2 flex items-center gap-1.5">
              <Sparkles size={13} className="text-rose-400" />
              <span>Recommendations & Optimization Tips</span>
            </h3>
            {suggestions.length > 0 ? (
              <div className="space-y-2">
                {suggestions.map((sug, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/35 text-xs text-amber-100/90 flex items-start gap-2.5 font-sans leading-relaxed"
                  >
                    <span className="text-amber-400 font-bold mt-0.5">•</span>
                    <span>{sug}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>
                  High probability of passing 100% of enterprise automated screening filters.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex justify-end">
          <button
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#250d2b] hover:bg-[#32113a] text-pink-200 transition-colors cursor-pointer border border-pink-500/20"
          >
            Close
          </button>
        </div>
      </ModalShell>
  );
}
