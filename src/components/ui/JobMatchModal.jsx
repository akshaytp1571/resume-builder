import React, { useState } from 'react';
import {
  X,
  Target,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Check,
  Search,
  KeyRound,
  Send,
} from 'lucide-react';
import { tailorResumeToJobWithAi } from '../../utils/aiService';
import { discoverJobs } from '../../utils/jobDiscoveryService';
import { getConfiguredSites } from '../../utils/jobCredentials';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';

export default function JobMatchModal({
  isOpen,
  onClose,
  resumeData,
  onApplyTailoredSummary,
  onOpenAiConfig,
  onOpenJobCredentials,
  onOpenApply,
  aiConfig,
}) {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [discoveryMode, setDiscoveryMode] = useState(false);
  const [discoveredJobs, setDiscoveredJobs] = useState([]);
  const [configuredSites, setConfiguredSites] = useState([]);
  const [searchParams, setSearchParams] = useState({
    jobTitle: 'QA Lead',
    location: 'Dubai',
    experienceLevel: 'Mid-Senior',
  });

  // Keep the "signed in to" indicator honest whenever the modal opens, so the
  // dot reflects what is actually stored rather than a stale value from the
  // last discovery run. Done during render to avoid a cascading render.
  const [loadedFor, setLoadedFor] = useState(null);
  if (isOpen && loadedFor !== isOpen) {
    setLoadedFor(isOpen);
    setConfiguredSites(getConfiguredSites());
  }

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      setError('Please paste a job description first.');
      return;
    }

    sound.playAction();
    setLoading(true);
    setError(null);

    try {
      const result = await tailorResumeToJobWithAi({
        resumeData,
        jobDescription,
      });
      sound.playSuccess();
      setAnalysis(result);
    } catch (err) {
      setError(err.message || 'AI analysis failed. Please check AI settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscoverJobs = async () => {
    sound.playAction();
    setLoading(true);
    setError(null);
    setConfiguredSites(getConfiguredSites());

    try {
      const result = await discoverJobs(
        {
          jobTitle: searchParams.jobTitle,
          location: searchParams.location,
          experienceLevel: searchParams.experienceLevel,
          useBrowserAutomation: true,
        },
        aiConfig
      );

      if (result?.success && result?.jobs?.length > 0) {
        setDiscoveredJobs(result.jobs);
        sound.playSuccess();
      } else {
        setError('No jobs found. Try adjusting your search criteria.');
      }
    } catch (err) {
      setError(err.message || 'Job discovery failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDiscoveredJob = (job) => {
    setJobDescription(
      `${job.title} at ${job.company}\n\nLocation: ${job.location}\n\n${job.description || ''}\n\nApply: ${job.applyUrl || ''}`
    );
    setDiscoveryMode(false);
    setDiscoveredJobs([]);
  };

  const handleApply = () => {
    if (analysis?.summaryTailored) {
      sound.playSuccess();
      onApplyTailoredSummary(analysis.summaryTailored);
      onClose();
    }
  };

  return (
    <ModalShell onClose={onClose} labelledBy="job-match-title" className="max-w-2xl">
        {/* Modal Header */}
        <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
              <Target size={18} />
            </div>
            <div>
              <h2
                id="job-match-title"
                className="text-sm font-bold text-pink-50 tracking-wide flex items-center gap-2"
              >
                Target Job Matcher & ATS Tailoring
              </h2>
              <p className="text-[11px] text-pink-300/70">
                Paste any vacancy to audit keyword overlap and auto-tailor your profile
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close job matcher dialog"
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
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {discoveryMode ? (
            /* Discovery Mode: Search Form & Results */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-pink-200">Job Board Discovery</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playAction();
                      onOpenJobCredentials?.();
                    }}
                    className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-[#1a2a25] border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 hover:text-emerald-200 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Sign in to LinkedIn / Naukri for filtered listings"
                  >
                    <KeyRound size={11} />
                    <span>Logins</span>
                    {configuredSites.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscoveryMode(false)}
                    className="text-pink-400/70 hover:text-pink-100 text-xs cursor-pointer"
                  >
                    Back to Manual Paste
                  </button>
                </div>
              </div>

              {configuredSites.length > 0 && (
                <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <span className="text-[10px] text-emerald-100/85">
                    Signed in to:{' '}
                    <span className="font-semibold">
                      {configuredSites
                        .map((s) =>
                          s === 'naukari'
                            ? 'Naukri'
                            : s.charAt(0).toUpperCase() + s.slice(1)
                        )
                        .join(', ')}
                    </span>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10.5px] font-semibold text-pink-300 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={searchParams.jobTitle}
                    onChange={(e) => setSearchParams({ ...searchParams, jobTitle: e.target.value })}
                    placeholder="e.g. QA Lead"
                    className="w-full bg-[#150518] border border-pink-500/25 rounded-xl p-2.5 text-xs text-pink-100 focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-pink-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={searchParams.location}
                    onChange={(e) => setSearchParams({ ...searchParams, location: e.target.value })}
                    placeholder="e.g. Dubai, Abu Dhabi, Remote"
                    className="w-full bg-[#150518] border border-pink-500/25 rounded-xl p-2.5 text-xs text-pink-100 focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-semibold text-pink-300 mb-1">
                    Experience Level
                  </label>
                  <select
                    value={searchParams.experienceLevel}
                    onChange={(e) => setSearchParams({ ...searchParams, experienceLevel: e.target.value })}
                    className="w-full bg-[#150518] border border-pink-500/25 rounded-xl p-2.5 text-xs text-pink-100 focus:outline-none focus:border-rose-400"
                  >
                    <option value="Entry">Entry Level</option>
                    <option value="Mid">Mid Level</option>
                    <option value="Mid-Senior">Mid-Senior Level</option>
                    <option value="Senior">Senior Level</option>
                    <option value="Lead">Lead / Manager</option>
                    <option value="Director">Director+</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDiscoverJobs}
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Searching Job Boards...</span>
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    <span>Search Job Postings</span>
                  </>
                )}
              </button>

              {discoveredJobs.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold text-pink-200">
                    Found {discoveredJobs.length} Vacancies (Click to load):
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {discoveredJobs.map((job, jobIdx) => (
                      <div
                        key={job.id || `${job.title}-${job.company}-${jobIdx}`}
                        className="p-3 rounded-xl bg-[#150518] border border-pink-500/20 hover:border-pink-500/50 transition-all"
                      >
                        <div
                          className="cursor-pointer"
                          onClick={() => handleSelectDiscoveredJob(job)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="text-xs font-semibold text-pink-100">
                                {job.title}
                              </h5>
                              <p className="text-[10px] text-pink-300/70">{job.company}</p>
                            </div>
                            <span className="text-[10px] bg-[#2a1a2a] px-2 py-0.5 rounded-full text-emerald-300 shrink-0">
                              {job.source || 'Board'}
                            </span>
                          </div>
                          {job.description && (
                            <p className="text-[10.5px] text-pink-300/60 mt-1 line-clamp-2">
                              {job.description}
                            </p>
                          )}
                        </div>
                        {job.applyUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenApply?.(job);
                            }}
                            className="mt-2 px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-sky-700 to-indigo-700 hover:from-sky-600 hover:to-indigo-600 text-white flex items-center gap-1 cursor-pointer transition-colors"
                            title="Open the apply agent for this job"
                          >
                            <Send size={10} />
                            <span>Apply</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !analysis ? (
            /* Manual Paste Mode */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-pink-200 tracking-wide">
                  Paste Job Description / Vacancy Requirements:
                </label>
                <button
                  type="button"
                  onClick={() => setDiscoveryMode(true)}
                  className="px-2.5 py-1 rounded-lg bg-[#1a2a25] border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 hover:text-emerald-200 text-[10.5px] transition-all cursor-pointer flex items-center gap-1"
                >
                  <Search size={11} />
                  <span>Auto-Discover</span>
                </button>
              </div>

              <textarea
                rows={9}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the requirements, responsibilities, and role qualifications from LinkedIn, Indeed, or company careers page..."
                className="w-full bg-[#150518] border border-pink-500/25 rounded-2xl p-3.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400 font-sans leading-relaxed transition-colors"
              />

              {error && (
                <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 flex items-center justify-between">
                  <span>{error}</span>
                  {(error.includes('configure') || error.includes('Key')) && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenAiConfig();
                      }}
                      className="underline font-semibold text-rose-300 ml-2 hover:text-white"
                    >
                      Open AI Settings →
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Analysis Results */
            <div className="space-y-4">
              {/* Match Score Banner */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2c0e32] via-[#220a26] to-[#18071c] border border-pink-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-semibold tracking-wide text-rose-300">
                    ✦ Job Alignment Score
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-pink-200 to-amber-200">
                      {analysis.matchScore}%
                    </span>
                    <span className="text-pink-300/70 text-xs font-semibold">Match Overlap</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAnalysis(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#1e0823] hover:bg-[#2c0c32] border border-pink-500/30 text-pink-200 cursor-pointer transition-colors"
                >
                  Analyze Different Job
                </button>
              </div>

              {/* Missing Keywords */}
              {analysis.missingKeywords?.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                  <span className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <span>Key Target Terms Missing in Current Resume:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {analysis.missingKeywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/40 text-amber-100 text-[11px]"
                      >
                        + {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Strengths */}
              {analysis.matchingStrengths?.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
                  <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>Strong Alignment Areas:</span>
                  </span>
                  <ul className="list-disc pl-4 space-y-1 text-emerald-100/90 text-xs font-sans">
                    {analysis.matchingStrengths.map((str, i) => (
                      <li key={i}>{str}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tailored Professional Summary */}
              {analysis.summaryTailored && (
                <div className="p-4 rounded-2xl bg-[#220a26] border border-pink-500/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={13} className="text-rose-400" />
                      <span>AI Tailored Summary for this Role:</span>
                    </span>
                  </div>
                  <p className="text-pink-50 leading-relaxed font-sans text-xs bg-[#160518] p-3 rounded-xl border border-pink-500/20">
                    {analysis.summaryTailored}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl text-pink-300/70 hover:text-pink-100 cursor-pointer"
          >
            Close
          </button>

          {!analysis ? (
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading || !jobDescription.trim()}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              <Sparkles size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Analyzing Match...' : 'Run AI Job Audit'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <Check size={14} className="stroke-[3]" />
              <span>Apply Tailored Summary</span>
            </button>
          )}
        </div>
      </ModalShell>
  );
}