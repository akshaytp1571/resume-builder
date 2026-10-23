import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Upload,
  Sparkles,
  ShieldCheck,
  Loader2,
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
import ModalShell from './ModalShell';

export default function ApplyModal({
  isOpen,
  onClose,
  job,
  resumeData,
  resumePath = '',
  aiConfig,
  onSubmitted,
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
    if (res.submitted) {
      sound.playSuccess();
      onSubmitted?.(res);
    }
  };

  const needsHumanCount = result?.needsHuman?.length || 0;
  const filledCount = result?.filled?.length || 0;

  return (
    <ModalShell onClose={onClose} labelledBy="apply-modal-title" zIndex="z-[70]" className="max-w-2xl">
        {/* Header */}
        <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
              <Send size={18} />
            </div>
            <div>
              <h2
                id="apply-modal-title"
                className="text-sm font-bold text-pink-50 tracking-wide"
              >
                Apply Agent
              </h2>
              <p className="text-[11px] text-pink-300/70">
                {job.title} {job.company ? `at ${job.company}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close apply agent dialog"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="p-1.5 rounded-xl text-pink-400/60 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Step: review */}
          {step === 'review' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#150518] border border-pink-500/20 space-y-2">
                <span className="text-[10px] font-bold text-pink-300">APPLICATION LINK</span>
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-rose-300 hover:text-rose-200 break-all cursor-pointer"
                >
                  {job.applyUrl.slice(0, 110)}
                  <ExternalLink size={11} className="shrink-0" />
                </a>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#150518] border border-pink-500/20 space-y-2">
                <span className="text-[10px] font-bold text-pink-300">RESUME TO ATTACH</span>
                {resumePath ? (
                  <div className="flex items-center gap-2 text-[11px] text-emerald-200">
                    <FileText size={13} />
                    <span className="truncate">{resumePath.split(/[\\/]/).pop()}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-amber-200">
                    <AlertTriangle size={13} />
                    <span>
                      No resume file selected. Export a DOCX from the app first, then
                      set its path in AI Settings.
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-[#150518] border border-pink-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-pink-300">COVER LETTER</span>
                  <button
                    type="button"
                    onClick={handleGenerateCover}
                    disabled={generatingCover}
                    className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-[#2a1130] border border-pink-500/40 hover:border-pink-400 text-pink-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {generatingCover ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Sparkles size={11} />
                    )}
                    {coverLetter ? 'Regenerate' : 'Generate with AI'}
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Optional. The agent will paste this into a cover-letter or 'why do you want to work here' field if it finds one."
                  className="w-full bg-[#100410] border border-pink-500/25 rounded-xl p-2.5 text-xs text-pink-100 placeholder:text-pink-300/25 focus:outline-none focus:border-rose-400 leading-relaxed"
                />
              </div>

              {agentOnline === false && (
                <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-100 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    The apply agent service is not running. Start it with{' '}
                    <span className="font-mono">npm run jobs:api</span>.
                  </span>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-sky-950/25 border border-sky-500/30 text-sky-100 flex items-start gap-2">
                <ShieldCheck size={14} className="text-sky-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  The agent fills the form and attaches your resume. It does{' '}
                  <span className="font-semibold">not</span> submit until you press
                  Submit twice. CAPTCHAs and employer-specific questions are left
                  for you.
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step: preparing */}
          {step === 'prepare' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <Loader2 size={28} className="text-rose-300 animate-spin" />
              <p className="text-pink-200 font-semibold">Opening the application...</p>
              <p className="text-pink-300/60 text-[11px]">
                Filling fields, attaching your resume, reading what is left
              </p>
            </div>
          )}

          {/* Step: result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#2c0e32] to-[#18071c] border border-pink-500/40 flex items-center justify-between">
                <div>
                  <span className="text-[10.5px] font-semibold tracking-wide text-rose-300">
                    ✦ APPLICATION PREVIEW
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-pink-200 to-amber-200">
                      {filledCount}
                    </span>
                    <span className="text-pink-300/70 text-xs font-semibold">
                      fields filled
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-pink-300/60">ATS</div>
                  <div className="text-xs font-bold text-pink-100 uppercase">
                    {result.ats || 'unknown'}
                  </div>
                </div>
              </div>

              {result.uploads?.length > 0 && (
                <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 flex items-center gap-2">
                  <Upload size={14} className="text-emerald-400" />
                  <span className="text-emerald-100 text-[11px]">
                    Resume attached ({result.uploads.filter((u) => u.ok).length} file
                    input)
                  </span>
                </div>
              )}

              {needsHumanCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                  <span className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-400" />
                    {needsHumanCount} field(s) need you
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 text-amber-100/85 text-[11px]">
                    {result.needsHuman.map((f, i) => (
                      <li key={i}>
                        {f.label || f.field || 'Field'} - {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.filled?.length > 0 && (
                <details className="p-3.5 rounded-2xl bg-[#150518] border border-pink-500/20">
                  <summary className="text-[11px] font-semibold text-pink-200 cursor-pointer">
                    Filled fields ({result.filled.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-[11px]">
                    {result.filled.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-pink-300/60 shrink-0 w-36 truncate">
                          {f.field}
                        </span>
                        <span className="text-emerald-200/90 truncate">{f.value}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {result.error && (
                <div className="p-3 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200">
                  {result.error}
                </div>
              )}

              {result.status === 'refused' && (
                <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-100 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    The agent refused this link for safety reasons. Open it
                    yourself and apply manually.
                  </span>
                </div>
              )}

              {result.screenshot && (
                <p className="text-[10.5px] text-pink-300/60">
                  Screenshot saved next to the agent service:{' '}
                  <span className="font-mono">{result.screenshot}</span>
                </p>
              )}

              {result.status === 'submitted' ? (
                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span className="text-emerald-100 text-xs font-semibold">
                    Application submitted.
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-sky-950/25 border border-sky-500/30 text-sky-100 text-[11px] leading-relaxed">
                  The browser window has been closed after filling. Open the link
                  above to review, finish the remaining questions, and submit
                  yourself - or press Submit below to let the agent click it.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl text-pink-300/70 hover:text-pink-100 cursor-pointer"
          >
            {step === 'result' ? 'Close' : 'Cancel'}
          </button>

          {step === 'review' && (
            <button
              type="button"
              onClick={handlePrepare}
              disabled={busy || agentOnline === false || !job.applyUrl}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-[0_2px_15px_rgba(56,189,248,0.3)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
              title={
                !resumePath
                  ? 'No resume file is set, so the agent cannot attach one. Set it in Job Board Logins.'
                  : 'Open the application and fill the form'
              }
            >
              <User size={13} />
              <span>Prepare Application</span>
            </button>
          )}

          {step === 'result' && result?.status !== 'submitted' && (
            <div className="flex items-center gap-2">
              {confirmSubmit && (
                <span className="text-[10px] text-rose-300 font-semibold">
                  Click again to confirm
                </span>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className={`px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-[0_2px_15px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 active:scale-95 ${
                  confirmSubmit
                    ? 'bg-gradient-to-r from-rose-600 to-red-700'
                    : 'bg-gradient-to-r from-pink-700 to-rose-700'
                }`}
              >
                {busy ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>Submit Application</span>
              </button>
            </div>
          )}
        </div>
      </ModalShell>
  );
}
