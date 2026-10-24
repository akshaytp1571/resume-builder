import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  AlertTriangle,
  FileText,
  Upload,
  LoaderCircle,
  ExternalLink,
  User,
} from 'lucide-react';
import {
  prepareApplication,
  submitApplication,
  generateCoverLetter,
  isApplyAgentOnline,
} from '../../utils/applyService';
import { sound } from '../../utils/soundEffects';
import { addApplication } from '../../utils/applicationTracker';
import ModalShell from './ModalShell';
import { Button } from './primitives';

export default function ApplyModal({
  isOpen,
  onClose,
  job,
  resumeData,
  resumePath = '',
  aiConfig,
  onSubmitted,
  activeVariantId = '',
  activeVariantName = '',
  onApplicationRecorded,
}) {
  const [step, setStep] = useState('review'); // review | cover | prepare | result
  const [agentOnline, setAgentOnline] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [generatingCover, setGeneratingCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Reset per-job state when the modal is opened for a different listing.
  // Resetting during render (rather than in an effect) means the user never
  // sees the previous job's result flash on screen.
  const [activeUrl, setActiveUrl] = useState(job?.applyUrl);
  if (isOpen && job && activeUrl !== job.applyUrl) {
    setActiveUrl(job.applyUrl);
    setStep('review');
    setResult(null);
    setError(null);
    setConfirmSubmit(false);
    setCoverLetter('');
  }

  useEffect(() => {
    if (!isOpen || !job) return;
    let cancelled = false;
    isApplyAgentOnline().then((online) => {
      if (!cancelled) setAgentOnline(online);
    });
    return () => {
      cancelled = true;
    };
    // `job` is replaced wholesale when the modal is pointed at a different
    // listing, so depending on the whole object (not just its url) is the
    // correct, if slightly wider, trigger.
  }, [isOpen, job]);

  if (!isOpen || !job) return null;

  const handleGenerateCover = async () => {
    setGeneratingCover(true);
    setError(null);
    const res = await generateCoverLetter({ job, resumeData, config: aiConfig });
    setGeneratingCover(false);
    if (res.ok) setCoverLetter(res.text);
    else setError(res.error);
  };

  const handlePrepare = async () => {
    sound.playAction();
    setBusy(true);
    setError(null);
    setStep('prepare');

    const res = await prepareApplication(job, resumeData, {
      resumePath,
      coverLetter,
      dryRun: false,
    });

    setBusy(false);
    setResult(res);
    setStep('result');
    if (res.status === 'filled' || res.status === 'submitted') sound.playSuccess();
  };

  const handleSubmit = async () => {
    if (!confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    sound.playAction();
    setBusy(true);
    setError(null);
    const res = await submitApplication(job, resumeData, { resumePath, coverLetter });
    setBusy(false);
    setResult(res);
    setConfirmSubmit(false);

    // Record ONLY on the agent's own confirmation. `status: 'filled'` means the
    // form was prepared but never sent, 'failed'/'refused' mean it did not go
    // out, and an offline agent returns 'failed'. Recording any of those would
    // fill the tracker with applications that never happened.
    if (res.submitted === true || res.status === 'submitted') {
      sound.playSuccess();

      const recorded = addApplication({
        company: job.company || '',
        title: job.title || '',
        url: job.applyUrl || '',
        status: 'applied',
        variantId: activeVariantId || '',
        variantName: activeVariantName || '',
      });

      onApplicationRecorded?.(recorded);
      onSubmitted?.(res);
    }
  };

  const needsHumanCount = result?.needsHuman?.length || 0;
  const filledCount = result?.filled?.length || 0;

  return (
    <ModalShell
      onClose={onClose}
      labelledBy="apply-modal-title"
      zIndex="z-[70]"
      className="max-w-2xl"
    >
      {/* Header: mono kicker + title + 40px close, on a hairline. The listing
          the run acts on stays pinned under the title. */}
      <div className="flex items-start justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="dt-serif text-[13px] text-signal">RUN</span>
            <h2 id="apply-modal-title" className="dt-label text-bone">
              Apply Agent
            </h2>
          </div>
          <p className="dt-data mt-1 truncate text-bone-32">
            {job.title} {job.company ? `at ${job.company}` : ''}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close apply agent dialog"
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
        {/* Step: review */}
        {step === 'review' && (
          <div className="space-y-5">
            <div className="border-t border-rule pt-3">
              <span className="dt-label mb-1 block text-bone-52">Application Link</span>
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-baseline gap-1.5 break-all font-mono text-[11px] text-signal underline-offset-4 transition-colors duration-[90ms] hover:text-bone hover:underline"
              >
                {job.applyUrl.slice(0, 110)}
                <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
              </a>
            </div>

            <div className="border-t border-rule pt-3">
              <span className="dt-label mb-1 block text-bone-52">Resume to Attach</span>
              {resumePath ? (
                <div className="flex items-center gap-2 font-mono text-[11px] text-bone-70">
                  <FileText size={13} className="shrink-0 text-signal" aria-hidden="true" />
                  <span className="truncate">{resumePath.split(/[\\/]/).pop()}</span>
                </div>
              ) : (
                <p className="flex items-start gap-2 border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    No resume file selected. Export a DOCX from the app first, then
                    set its path in AI Settings.
                  </span>
                </p>
              )}
            </div>

            <div className="border-t border-rule pt-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="dt-label text-bone-52">Cover Letter</span>
                <Button
                  size="sm"
                  onClick={handleGenerateCover}
                  disabled={generatingCover}
                >
                  {generatingCover && (
                    <LoaderCircle size={11} aria-hidden="true" className="animate-spin" />
                  )}
                  {coverLetter ? 'Regenerate' : 'Generate with AI'}
                </Button>
              </div>
              <textarea
                rows={6}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Optional. The agent will paste this into a cover-letter or 'why do you want to work here' field if it finds one."
                aria-label="Cover letter"
                className="w-full resize-y border-0 border-b bg-transparent px-0 py-2 font-sans text-[16px] leading-relaxed text-bone placeholder:text-bone-32 focus:outline-none"
                style={{ borderBottomColor: 'var(--rule-2)' }}
              />
            </div>

            {agentOnline === false && (
              <p className="flex items-start gap-2 border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  The apply agent service is not running. Start it with{' '}
                  <span className="font-mono">npm run jobs:api</span>.
                </span>
              </p>
            )}

            <p className="border-l-2 border-rule-2 py-1 pl-2 font-sans text-[12px] leading-relaxed text-bone-52">
              The agent fills the form and attaches your resume. It does{' '}
              <span className="font-semibold text-bone-70">not</span> submit until you press
              Submit twice. CAPTCHAs and employer-specific questions are left for you.
            </p>

            {error && (
              <p className="border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Step: preparing */}
        {step === 'prepare' && (
          <div className="flex flex-col items-center gap-3 py-10">
            <LoaderCircle size={22} aria-hidden="true" className="animate-spin text-signal" />
            <p className="font-sans text-[13px] text-bone">Opening the application...</p>
            <p className="dt-data text-bone-32">
              Filling fields, attaching your resume, reading what is left
            </p>
          </div>
        )}

        {/* Step: result */}
        {step === 'result' && result && (
          <div className="space-y-5">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="dt-label text-bone-52">Application Preview</span>
                <span className="dt-data text-bone-32">
                  ATS <span className="text-bone-70">{result.ats || 'unknown'}</span>
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2 border-t border-rule pt-2">
                <span className="font-mono text-[28px] leading-none tabular-nums text-bone">
                  {filledCount}
                </span>
                <span className="dt-data text-bone-52">fields filled</span>
              </div>
            </div>

            {result.uploads?.length > 0 && (
              <p className="flex items-center gap-2 border-l-2 border-signal py-1 pl-2 font-sans text-[12px] text-signal">
                <Upload size={13} className="shrink-0" aria-hidden="true" />
                <span>
                  Resume attached ({result.uploads.filter((u) => u.ok).length} file
                  input)
                </span>
              </p>
            )}

            {needsHumanCount > 0 && (
              <div className="border-t border-rule pt-3">
                <span className="dt-label mb-2 block text-bone-52">
                  {needsHumanCount} field(s) need you
                </span>
                <ul className="divide-y divide-[var(--rule)] border-t border-rule">
                  {result.needsHuman.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 py-2">
                      <AlertTriangle
                        size={12}
                        className="mt-0.5 shrink-0 text-alarm"
                        aria-hidden="true"
                      />
                      <span className="font-sans text-[12.5px] leading-relaxed text-bone-70">
                        {f.label || f.field || 'Field'} - {f.reason}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.filled?.length > 0 && (
              <details className="border-t border-rule pt-3">
                <summary className="dt-label cursor-pointer text-bone-52">
                  Filled fields ({result.filled.length})
                </summary>
                <ul className="mt-2 divide-y divide-[var(--rule)] border-t border-rule">
                  {result.filled.map((f, i) => (
                    <li key={i} className="flex gap-2 py-[6px] font-mono text-[11px]">
                      <span className="w-36 shrink-0 truncate text-bone-32">
                        {f.field}
                      </span>
                      <span className="truncate text-bone-70">{f.value}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {result.error && (
              <p className="border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
                {result.error}
              </p>
            )}

            {result.status === 'refused' && (
              <p className="flex items-start gap-2 border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] leading-relaxed text-alarm">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  The agent refused this link for safety reasons. Open it
                  yourself and apply manually.
                </span>
              </p>
            )}

            {result.screenshot && (
              <p className="dt-data text-bone-32">
                Screenshot saved next to the agent service:{' '}
                <span className="font-mono text-bone-70">{result.screenshot}</span>
              </p>
            )}

            {result.status === 'submitted' ? (
              <p className="border-l-2 border-signal py-1 pl-2 font-sans text-[12px] text-signal">
                Application submitted.
              </p>
            ) : (
              <p className="border-l-2 border-rule-2 py-1 pl-2 font-sans text-[12px] leading-relaxed text-bone-52">
                The browser window has been closed after filling. Open the link
                above to review, finish the remaining questions, and submit
                yourself - or press Submit below to let the agent click it.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <Button
          onClick={() => {
            sound.playAction();
            onClose();
          }}
        >
          {step === 'result' ? 'Close' : 'Cancel'}
        </Button>

        {step === 'review' && (
          <Button
            variant="signal"
            onClick={handlePrepare}
            disabled={busy || agentOnline === false || !job.applyUrl}
            title={
              !resumePath
                ? 'No resume file is set, so the agent cannot attach one. Set it in Job Board Logins.'
                : 'Open the application and fill the form'
            }
          >
            <User size={12} aria-hidden="true" />
            <span>Prepare Application</span>
          </Button>
        )}

        {step === 'result' && result?.status !== 'submitted' && (
          <span className="flex items-center gap-2">
            {confirmSubmit && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-alarm">
                Click again to confirm
              </span>
            )}
            <Button variant="danger" onClick={handleSubmit} disabled={busy}>
              {busy ? (
                <LoaderCircle size={12} aria-hidden="true" className="animate-spin" />
              ) : (
                <Send size={12} aria-hidden="true" />
              )}
              <span>Submit Application</span>
            </Button>
          </span>
        )}
      </div>
    </ModalShell>
  );
}
