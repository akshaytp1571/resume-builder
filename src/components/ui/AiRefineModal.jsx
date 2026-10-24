import React, { useState } from 'react';
import {
  X,
  Check,
  RotateCcw,
  Copy,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';
import { Button, Divider, IconButton } from './primitives';

const DIRECTIVES = [
  'Make it more concise (under 50 words)',
  'Incorporate stronger quantifiable metrics',
  'Emphasize QA leadership & team mentorship',
  'Focus on API & Performance Testing',
];

export default function AiRefineModal({
  isOpen,
  title = 'AI Resume Refinement',
  originalText = '',
  refinedText = '',
  onApply,
  onRegenerate,
  onClose,
  isGenerating = false,
}) {
  // The modal is mounted for one specific refinement, so track which
  // refinement it belongs to. When the parent hands us a different piece of
  // text we reset our local edits during render instead of in an effect -
  // that avoids a cascading render and the stale-edits bug where edits from
  // the previous bullet bled into the next one.
  const [editKey, setEditKey] = useState(refinedText);
  const [editedText, setEditedText] = useState(refinedText);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenError, setRegenError] = useState(null);

  if (editKey !== refinedText) {
    setEditKey(refinedText);
    setEditedText(refinedText);
    setRegenError(null);
  }

  if (!isOpen) return null;

  const originalWords = originalText.trim() ? originalText.trim().split(/\s+/).length : 0;
  const refinedWords = (editedText || '').trim() ? (editedText || '').trim().split(/\s+/).length : 0;
  const busy = isGenerating || isRegenerating;

  const handleCopy = async () => {
    sound.playAction();
    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  const handleRegenerate = async (directive) => {
    if (!onRegenerate) return;
    sound.playAction();
    setIsRegenerating(true);
    setRegenError(null);
    try {
      const next = await onRegenerate(directive);
      if (typeof next === 'string' && next.trim()) {
        setEditedText(next);
      }
    } catch (err) {
      setRegenError(err.message || 'Regeneration failed. Try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleApply = () => {
    sound.playSuccess();
    onApply(editedText);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} labelledBy="ai-refine-title" className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-rule bg-housing px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="dt-serif text-[13px] text-signal">REF</span>
            <h2 id="ai-refine-title" className="dt-label text-bone">
              {title}
            </h2>
          </div>
          <p className="dt-data mt-1 text-bone-32">
            AI Narrative Polish &amp; Real-Time Comparison
          </p>
        </div>
        <button
          type="button"
          aria-label="Close AI refinement dialog"
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
        {/* Before / after: two mono-labelled columns on a vertical hairline. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="dt-label text-bone-52">Original Draft</span>
              <span className="dt-data text-bone-32">{originalWords} words</span>
            </div>
            <p className="whitespace-pre-wrap border-t border-rule bg-void p-2 font-sans text-[12.5px] leading-relaxed text-bone-70">
              {originalText}
            </p>
          </div>

          <Divider vertical className="hidden sm:block" />

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="dt-label text-bone-52">AI Proposed Narrative</span>
              <span className="flex items-center gap-1.5">
                <span className="dt-data text-signal">{refinedWords} words</span>
                <IconButton
                  size="sm"
                  label={copied ? 'Copied to clipboard' : 'Copy refined text to clipboard'}
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check size={13} aria-hidden="true" className="text-signal" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                </IconButton>
              </span>
            </div>

            {busy ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 border-t border-rule bg-void p-2">
                <LoaderCircle
                  size={16}
                  aria-hidden="true"
                  className="animate-spin text-signal"
                />
                <span className="dt-data text-bone-52">
                  {isRegenerating
                    ? 'Re-synthesizing with your directive...'
                    : 'Synthesizing with AI engine...'}
                </span>
              </div>
            ) : (
              <textarea
                rows={7}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder="AI output appears here. You can directly edit this text before applying."
                aria-label="AI proposed narrative"
                className="w-full resize-y border-0 border-t bg-void px-0 py-2 font-sans text-[16px] leading-relaxed text-bone placeholder:text-bone-32 focus:outline-none"
                style={{ borderTopColor: 'var(--rule)' }}
              />
            )}
          </div>
        </div>

        {regenError && (
          <p className="flex items-start gap-2 border-l-2 border-alarm py-1 pl-2 font-sans text-[12px] text-alarm">
            <AlertCircle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{regenError}</span>
          </p>
        )}

        {/* Quick tuning presets */}
        <div className="border-t border-rule pt-3">
          <span className="dt-label mb-2 block text-bone-52">Quick Re-Prompting Directives</span>
          <div className="flex flex-wrap gap-1.5">
            {DIRECTIVES.map((directive, i) => (
              <Button
                key={i}
                size="sm"
                onClick={() => handleRegenerate(directive)}
                disabled={busy}
              >
                {directive}
              </Button>
            ))}
          </div>

          {/* Free-form directive */}
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customPrompt.trim() && !busy) {
                  handleRegenerate(customPrompt.trim());
                  setCustomPrompt('');
                }
              }}
              placeholder="Or type your own instruction and press Enter..."
              disabled={busy}
              aria-label="Custom regeneration instruction"
              className="min-w-0 flex-1 border-0 border-b bg-transparent px-0 py-2 font-sans text-[16px] text-bone placeholder:text-bone-32 focus:outline-none disabled:opacity-50"
              style={{ borderBottomColor: 'var(--rule-2)' }}
            />
            <Button
              onClick={() => {
                if (!customPrompt.trim()) return;
                handleRegenerate(customPrompt.trim());
                setCustomPrompt('');
              }}
              disabled={busy || !customPrompt.trim()}
              title="Re-run the AI with this instruction"
              className="shrink-0"
            >
              <RotateCcw size={11} aria-hidden="true" />
              <span>Re-run</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 border-t border-rule bg-housing px-4 py-2.5">
        <Button onClick={onClose}>Discard</Button>
        <Button variant="signal" onClick={handleApply} disabled={busy || !editedText}>
          <Check size={12} aria-hidden="true" />
          <span>Apply to Resume</span>
        </Button>
      </div>
    </ModalShell>
  );
}
