import React, { useState } from 'react';
import {
  X,
  Search,
  KeyRound,
  Send,
  LoaderCircle,
} from 'lucide-react';
import { tailorResumeToJobWithAi } from '../../utils/aiService';
import { discoverJobs } from '../../utils/jobDiscoveryService';
import { getConfiguredSites } from '../../utils/jobCredentials';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';
import AtsGauge from './AtsGauge';
import { Button, Chip, Field } from './primitives';

const EXPERIENCE_LEVELS = [
  ['Entry', 'Entry Level'],
  ['Mid', 'Mid Level'],
  ['Mid-Senior', 'Mid-Senior Level'],
  ['Senior', 'Senior Level'],
  ['Lead', 'Lead / Manager'],
  ['Director', 'Director+'],
];

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
      {/* Header */}
      <div className="flex items-start justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="dt-serif text-[13px] text-signal">JOB</span>
            <h2 id="job-match-title" className="dt-label text-bone">
              Target Job Matcher &amp; ATS Tailoring
            </h2>
          </div>
          <p className="dt-data mt-1 text-bone-32">
            Paste any vacancy to audit keyword overlap and auto-tailor your profile
          </p>
        </div>
        <button
          type="button"
          aria-label="Close job matcher dialog"
          onClick={() => {
            sound.playAction();
            onClose();
          }}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[2px] border border-transparent text-bone-52 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-5 overflow-y-auto p-4 text-[13px] sm:p-5">
        {discoveryMode ? (
          /* Discovery mode: search form and results */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="dt-label text-bone-52">Job Board Discovery</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    sound.playAction();
                    onOpenJobCredentials?.();
                  }}
                  title="Sign in to LinkedIn / Naukri for filtered listings"
                >
                  <KeyRound size={11} aria-hidden="true" />
                  <span>Logins</span>
                  {configuredSites.length > 0 && (
                    <span aria-hidden="true" className="h-[5px] w-[5px] bg-signal" />
                  )}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDiscoveryMode(false)}>
                  Back to Manual Paste
                </Button>
              </div>
            </div>

            {configuredSites.length > 0 && (
              <p className="border-l-2 border-signal py-1 pl-2 font-sans text-[12px] text-bone-70">
                Signed in to:{' '}
                <span className="font-semibold text-signal">
                  {configuredSites
                    .map((s) => (s === 'naukari' ? 'Naukri' : s.charAt(0).toUpperCase() + s.slice(1)))
                    .join(', ')}
                </span>
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 border-t border-rule pt-3 md:grid-cols-3">
              <Field
                label="Job Title"
                type="text"
                value={searchParams.jobTitle}
                onChange={(e) => setSearchParams({ ...searchParams, jobTitle: e.target.value })}
                placeholder="e.g. QA Lead"
              />
              <Field
                label="Location"
                type="text"
                value={searchParams.location}
                onChange={(e) => setSearchParams({ ...searchParams, location: e.target.value })}
                placeholder="e.g. Dubai, Abu Dhabi, Remote"
              />
              <div>
                <label
                  htmlFor="jm-experience-level"
                  className="dt-label mb-1 block text-bone-52"
                >
                  Experience Level
                </label>
                <select
                  id="jm-experience-level"
                  value={searchParams.experienceLevel}
                  onChange={(e) =>
                    setSearchParams({ ...searchParams, experienceLevel: e.target.value })
                  }
                  className="w-full resize-none border-0 border-b bg-transparent px-0 py-2 text-[16px] leading-[1.45] text-bone focus:outline-none focus-visible:outline-none"
                  style={{ borderBottomColor: 'var(--rule-2)' }}
                >
                  {EXPERIENCE_LEVELS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Secondary: the dialog's single signal fill lives in the footer. */}
            <Button onClick={handleDiscoverJobs} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <LoaderCircle size={13} aria-hidden="true" className="animate-spin" />
                  <span>Searching Job Boards...</span>
                </>
              ) : (
                <>
                  <Search size={13} aria-hidden="true" />
                  <span>Search Job Postings</span>
                </>
              )}
            </Button>

            {discoveredJobs.length > 0 && (
              <div className="border-t border-rule pt-3">
                <span className="dt-label mb-2 block text-bone-52">
                  Found {discoveredJobs.length} Vacancies (Click to load)
                </span>
                <div className="max-h-56 divide-y divide-[var(--rule)] overflow-y-auto border-t border-rule">
                  {discoveredJobs.map((job, jobIdx) => (
                    <div
                      key={job.id || `${job.title}-${job.company}-${jobIdx}`}
                      className="py-2"
                    >
                      <div
                        className="cursor-pointer"
                        onClick={() => handleSelectDiscoveredJob(job)}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate font-sans text-[13px] text-bone">
                            {job.title}
                          </span>
                          <Chip tone="neutral">{job.source || 'Board'}</Chip>
                        </div>
                        <p className="dt-data text-bone-52">{job.company}</p>
                        {job.description && (
                          <p className="mt-1 line-clamp-2 font-sans text-[12px] leading-relaxed text-bone-52">
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
                          title="Open the apply agent for this job"
                          className="mt-1.5 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-[2px] border border-rule-2 px-[10px] font-mono text-[10px] uppercase tracking-[0.08em] text-bone-70 transition-colors duration-[90ms] hover:bg-[rgba(237,232,220,0.05)] hover:text-bone"
                        >
                          <Send size={10} aria-hidden="true" />
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
          /* Manual paste mode */
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="jm-job-description" className="dt-label text-bone-52">
                Paste Job Description / Vacancy Requirements
              </label>
              <Button size="sm" onClick={() => setDiscoveryMode(true)}>
                <Search size={11} aria-hidden="true" />
                <span>Auto-Discover</span>
              </Button>
            </div>

            <textarea
              id="jm-job-description"
              rows={9}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the requirements, responsibilities, and role qualifications from LinkedIn, Indeed, or company careers page..."
              className="w-full resize-y border-0 border-b bg-transparent px-0 py-2 font-sans text-[16px] leading-relaxed text-bone placeholder:text-bone-32 focus:outline-none focus-visible:outline-none"
              style={{ borderBottomColor: 'var(--rule-2)' }}
            />

            {error && (
              <p className="flex flex-wrap items-baseline gap-2 border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
                <span>{error}</span>
                {(error.includes('configure') || error.includes('Key')) && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAiConfig();
                    }}
                    className="cursor-pointer font-sans text-[12px] font-semibold underline underline-offset-4 transition-colors duration-[90ms] hover:text-bone"
                  >
                    Open AI Settings
                  </button>
                )}
              </p>
            )}
          </div>
        ) : (
          /* Analysis results */
          <div className="space-y-5">
            {/* One bounded 0–100 quantity, so it gets the calibrated strip. */}
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="dt-label text-bone-52">Job Alignment Score</span>
                <Button size="sm" onClick={() => setAnalysis(null)}>
                  Analyze Different Job
                </Button>
              </div>
              <AtsGauge score={analysis.matchScore} className="mt-2" />
              <div className="mt-2 flex items-baseline justify-between border-t border-rule pt-2">
                <span className="dt-label text-bone-32">Match Overlap</span>
                <span className="dt-data text-bone-70">{analysis.matchScore}%</span>
              </div>
            </div>

            {analysis.missingKeywords?.length > 0 && (
              <div className="border-t border-rule pt-3">
                <span className="dt-label mb-2 block text-bone-52">
                  Key Target Terms Missing in Current Resume
                </span>
                <div className="flex flex-wrap gap-1">
                  {analysis.missingKeywords.map((kw, i) => (
                    <Chip key={i} tone="missing">
                      {kw}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {analysis.matchingStrengths?.length > 0 && (
              <div className="border-t border-rule pt-3">
                <span className="dt-label mb-2 block text-bone-52">
                  Strong Alignment Areas
                </span>
                <ul className="divide-y divide-[var(--rule)] border-t border-rule">
                  {analysis.matchingStrengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-2 py-2">
                      <span className="dt-serif mt-px w-[14px] shrink-0 text-[12px] text-signal">
                        {i + 1}
                      </span>
                      <span className="font-sans text-[12.5px] leading-relaxed text-bone-70">
                        {str}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.summaryTailored && (
              <div className="border-t border-rule pt-3">
                <span className="dt-label mb-2 block text-bone-52">
                  AI Tailored Summary for this Role
                </span>
                <p className="whitespace-pre-wrap border-t border-rule bg-void p-2 font-sans text-[12.5px] leading-relaxed text-bone">
                  {analysis.summaryTailored}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <Button onClick={onClose}>Close</Button>

        {!analysis ? (
          <Button
            variant="signal"
            onClick={handleAnalyze}
            disabled={loading || !jobDescription.trim()}
          >
            {loading && <LoaderCircle size={12} aria-hidden="true" className="animate-spin" />}
            <span>{loading ? 'Analyzing Match...' : 'Run AI Job Audit'}</span>
          </Button>
        ) : (
          <Button variant="signal" onClick={handleApply}>
            <span>Apply Tailored Summary</span>
          </Button>
        )}
      </div>
    </ModalShell>
  );
}
