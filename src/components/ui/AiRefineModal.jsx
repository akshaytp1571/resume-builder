import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Check,
  RotateCcw,
  Sliders,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';

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
        {/* Modal Header */}
        <div className="p-4 border-b border-pink-500/20 flex items-center justify-between bg-[#200824]/90 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#2e0d34] border border-pink-500/40 flex items-center justify-center text-rose-300">
              <Sparkles size={18} className="animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <h2
                id="ai-refine-title"
                className="text-sm font-bold text-pink-50 tracking-wide flex items-center gap-2"
              >
                {title}
              </h2>
              <p className="text-[11px] text-pink-300/70">
                AI Narrative Polish & Real-Time Comparison
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close AI refinement dialog"
            onClick={() => {
              sound.playAction();
              onClose();
            }}
            className="p-1.5 rounded-xl text-pink-400/85 hover:text-pink-100 hover:bg-pink-900/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Comparison */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original Box */}
            <div className="p-4 rounded-2xl bg-[#1a071c] border border-pink-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-pink-300/80">
                <span>Original Draft</span>
                <span className="text-pink-300/70">{originalWords} words</span>
              </div>
              <p className="text-pink-100 leading-relaxed font-sans text-xs whitespace-pre-wrap bg-[#140416] p-3 rounded-xl border border-pink-500/20">
                {originalText}
              </p>
            </div>

            {/* AI Refined Box */}
            <div className="p-4 rounded-2xl bg-[#230a28] border border-pink-500/40 space-y-2 shadow-lg">
              <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-rose-400" />
                  <span>AI Proposed Narrative</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-rose-300 font-mono">{refinedWords} words</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    aria-label={copied ? 'Copied to clipboard' : 'Copy refined text to clipboard'}
                    className="p-1 text-rose-300 hover:text-white cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#18071c]"
                    title={copied ? 'Copied!' : 'Copy to clipboard'}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {busy ? (
                <div className="h-40 flex flex-col items-center justify-center gap-2 text-rose-300 bg-[#160518] rounded-xl border border-pink-500/30">
                  <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold tracking-wide animate-pulse">
                    {isRegenerating ? 'Re-synthesizing with your directive...' : 'Synthesizing with AI engine...'}
                  </span>
                </div>
              ) : (
                <textarea
                  rows={7}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full bg-[#160518] border border-pink-500/35 rounded-xl p-3 text-xs text-pink-50 focus:outline-none focus:border-rose-400 font-sans leading-relaxed transition-colors"
                  placeholder="AI output appears here. You can directly edit this text before applying."
                />
              )}
            </div>
          </div>

          {regenError && (
            <div className="p-2.5 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-[11px] text-rose-200 flex items-start gap-2 animate-fade-in">
              <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <span>{regenError}</span>
            </div>
          )}

          {/* Quick Tuning Presets */}
          <div className="p-3.5 rounded-2xl bg-[#1b071e] border border-pink-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
              <span className="flex items-center gap-1.5">
                <Sliders size={13} />
                <span>Quick Re-Prompting Directives:</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                'Make it more concise (under 50 words)',
                'Incorporate stronger quantifiable metrics',
                'Emphasize QA leadership & team mentorship',
                'Focus on API & Performance Testing',
              ].map((directive, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleRegenerate(directive)}
                  disabled={busy}
                  className="px-3 py-1 text-xs rounded-xl bg-[#250d2b] hover:bg-[#32113a] border border-pink-500/25 text-pink-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  ✦ {directive}
                </button>
              ))}
            </div>

            {/* Free-form directive */}
            <div className="flex items-center gap-2 pt-1">
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
                className="flex-1 bg-[#150518] border border-pink-500/25 rounded-xl px-3 py-1.5 text-[11px] text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => {
                  if (!customPrompt.trim()) return;
                  handleRegenerate(customPrompt.trim());
                  setCustomPrompt('');
                }}
                disabled={busy || !customPrompt.trim()}
                className="px-3 py-1.5 text-[11px] font-semibold rounded-xl bg-[#2a0c30] hover:bg-[#381040] border border-pink-400/70 text-rose-200 cursor-pointer flex items-center gap-1 disabled:opacity-50 shrink-0"
                title="Re-run the AI with this instruction"
              >
                <RotateCcw size={11} className={isRegenerating ? 'animate-spin' : ''} />
                <span>Re-run</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-pink-500/20 bg-[#200824]/90 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl text-pink-300/70 hover:text-pink-100 cursor-pointer"
          >
            Discard
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={busy || !editedText}
            className="px-5 py-2 text-xs font-bold tracking-wide rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:opacity-95 text-white shadow-[0_2px_15px_rgba(16,185,129,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <Check size={14} className="stroke-[3]" />
            <span>Apply to Resume</span>
          </button>
        </div>
      </ModalShell>
  );
}
