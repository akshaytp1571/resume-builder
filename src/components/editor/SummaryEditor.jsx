import React, { useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { refineSummaryWithAi, getSavedAiConfig, isAiConfigReady } from '../../utils/aiService';

const SUMMARY_PRESETS = [
  {
    title: 'QA Lead (Original Protocol)',
    text: 'QA Lead with 5 years of experience in software testing for enterprise web and mobile products. Led a QA team for an end-to-end Order-to-Cash automation platform for a leading ready-mix concrete and cement manufacturer, covering three mobile apps and a central web interface. Hands-on in manual functional testing, API testing (Postman, Rest Assured), performance testing (JMeter), and Selenium automation. Experienced in production L2 support, team leadership, and Agile delivery using JIRA.',
  },
  {
    title: 'Automation & API High-Impact',
    text: 'Results-driven QA Lead and Test Automation Engineer with 5+ years of specialized experience in architecting robust Selenium, Rest Assured, and JMeter test suites. Proven track record in orchestrating multi-platform testing across iOS, Android, and distributed cloud applications with high test coverage and rapid defect turnaround.',
  },
  {
    title: 'Enterprise Scalability & L2 DevOps',
    text: 'Seasoned Software Quality Assurance Lead specializing in end-to-end enterprise platform verification and post-deployment L2 production engineering. Adept in guiding Agile cross-functional teams, formulating scalable test strategies, and implementing automated continuous testing pipelines.',
  },
];

export default function SummaryEditor({
  summary,
  onChange,
  onTriggerAiRefine,
  onOpenAiConfig,
}) {
  const [selectedTone, setSelectedTone] = useState('Executive & Metric-Driven');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const words = summary?.trim() ? summary.trim().split(/\s+/).length : 0;

  const handleAiRefine = async () => {
    sound.playAction();
    setIsAiLoading(true);
    setErrorMsg(null);

    try {
      const config = getSavedAiConfig();
      if (!isAiConfigReady(config)) {
        onOpenAiConfig();
        setIsAiLoading(false);
        return;
      }

      const refined = await refineSummaryWithAi({
        summary,
        tone: selectedTone,
      });

      // Pass to refinement diff modal
      onTriggerAiRefine({
        title: 'AI Summary Refinement',
        originalText: summary,
        refinedText: refined,
        onApply: (appliedText) => onChange(appliedText),
        onRegenerate: async (instructions) => {
          const re = await refineSummaryWithAi({
            summary,
            tone: selectedTone,
            extraInstructions: instructions,
          });
          return re;
        },
      });
    } catch (err) {
      setErrorMsg(err.message || 'AI refinement failed. Check AI config.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-4 font-sans text-xs text-pink-100 animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-pink-200 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={13} className="text-rose-400" />
          ✦ Executive Summary & Career Narrative
        </label>
        <span
          className={`text-[10px] px-2.5 py-0.5 rounded-full font-sans font-semibold border ${
            words >= 35 && words <= 100
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
              : 'bg-amber-950/80 text-amber-300 border-amber-600/40'
          }`}
        >
          {words} words ({words >= 35 && words <= 100 ? 'Optimal' : 'Recommended: 40-80'})
        </span>
      </div>

      <div className="relative">
        <textarea
          rows={6}
          value={summary || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter career synopsis, leadership directives, and architectural accomplishments..."
          className="w-full bg-[#18071a] border border-pink-500/25 rounded-2xl p-3.5 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-pink-400 focus:ring-1 focus:ring-pink-400/40 transition-colors leading-relaxed font-sans"
        />
      </div>

      {/* AI Refinement Bar */}
      <div className="p-3.5 rounded-2xl bg-[#1d0920] border border-pink-500/30 space-y-2.5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-pink-200">
            <Sparkles size={13} className="text-rose-400 animate-pulse" />
            <span>AI Narrative Refinement (DeepSeek V4.1)</span>
          </div>

          <button
            type="button"
            onClick={onOpenAiConfig}
            className="text-[11px] text-pink-400/80 hover:text-pink-200 underline cursor-pointer"
          >
            Configure AI Provider
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTone}
            onChange={(e) => setSelectedTone(e.target.value)}
            className="bg-[#150617] border border-pink-500/30 rounded-xl px-3 py-1.5 text-xs text-pink-200 focus:outline-none focus:border-pink-400 flex-1 min-w-[150px]"
          >
            <option value="Executive & Metric-Driven">Tone: Executive & Metrics</option>
            <option value="High-Impact & Direct">Tone: High-Impact & Direct</option>
            <option value="Lead QA Architect Focus">Tone: Lead Architect Focus</option>
            <option value="Agile & Product Delivery">Tone: Agile & Product Delivery</option>
          </select>

          <button
            type="button"
            onClick={handleAiRefine}
            disabled={isAiLoading || !summary}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white shadow-[0_2px_12px_rgba(244,63,94,0.35)] transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
          >
            <Wand2 size={13} className={isAiLoading ? 'animate-spin' : ''} />
            <span>{isAiLoading ? 'Polishing...' : 'Polish with AI'}</span>
          </button>
        </div>

        {errorMsg && (
          <p className="text-[10.5px] text-rose-300">
            ⚠ {errorMsg}
          </p>
        )}
      </div>

      {/* Preset suggestions */}
      <div className="p-3.5 rounded-2xl bg-[#19081c] border border-pink-500/20">
        <div className="flex items-center gap-1.5 text-xs font-bold text-pink-200 mb-2">
          <Sparkles size={12} className="text-rose-400" />
          <span>Curated Role Archetypes</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {SUMMARY_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                sound.playAction();
                onChange(preset.text);
              }}
              className="text-left p-2.5 rounded-xl bg-[#140516] hover:bg-[#220925] border border-pink-500/20 hover:border-pink-400/70 text-xs transition-all cursor-pointer group"
            >
              <div className="font-semibold text-pink-100 group-hover:text-rose-300 transition-colors">
                ✦ {preset.title}
              </div>
              <p className="text-pink-300/70 text-[11px] line-clamp-2 mt-0.5">
                {preset.text}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
