import React from 'react';
import { X, CheckCircle2, AlertCircle, Award, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../../utils/soundEffects';
import ModalShell from './ModalShell';

export default function AtsScoreModal({ atsResult, onClose }) {
  const { score, rating, breakdown, suggestions } = atsResult;

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
