import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { refineSummaryWithAi, getSavedAiConfig, isAiConfigReady } from '../../utils/aiService';
import { Field, Button, SectionIndex, Chip } from '../ui/primitives';

/**
 * Section editors share one pattern:
 *   SectionIndex (serif numeral + mono title)
 *   ledger fields (bottom rule only)
 *   quiet mono actions
 *   hairline-separated groups, never cards
 *
 * No icons per section header, no emoji, no gradient buttons, no glow.
 */

const SUMMARY_PRESETS = [
  {
    title: 'QA Lead (original)',
    text: 'QA Lead with 5 years of experience in software testing for enterprise web and mobile products. Led a QA team for an end-to-end Order-to-Cash automation platform for a leading ready-mix concrete and cement manufacturer, covering three mobile apps and a central web interface. Hands-on in manual functional testing, API testing (Postman, Rest Assured), performance testing (JMeter), and Selenium automation. Experienced in production L2 support, team leadership, and Agile delivery using JIRA.',
  },
  {
    title: 'Automation & API',
    text: 'Results-driven QA Lead and Test Automation Engineer with 5+ years of specialized experience in architecting robust Selenium, Rest Assured, and JMeter test suites. Proven track record in orchestrating multi-platform testing across iOS, Android, and distributed cloud applications with high test coverage and rapid defect turnaround.',
  },
  {
    title: 'Enterprise & L2',
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
  const optimal = words >= 35 && words <= 100;

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

      onTriggerAiRefine({
        title: 'AI summary refinement',
        originalText: summary,
        refinedText: refined,
        onApply: (appliedText) => onChange(appliedText),
        onRegenerate: async (instructions) => {
          return refineSummaryWithAi({
            summary,
            tone: selectedTone,
            extraInstructions: instructions,
          });
        },
      });
    } catch (err) {
      setErrorMsg(err.message || 'Refinement failed. Check the AI configuration.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={3}
          title="Summary"
          action={
            <Chip tone={optimal ? 'present' : 'missing'}>
              {words} {words === 1 ? 'word' : 'words'}
              {optimal ? '' : ' · 40–80'}
            </Chip>
          }
        />

        <Field
          label="Career narrative"
          multiline
          rows={6}
          value={summary || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Two or three sentences: what you do, at what scale, and the result."
        />
      </div>

      {/* AI refinement — a tool, not a feature banner. */}
      <div className="border-t border-rule pt-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="dt-label text-bone-52">Refine with AI</span>
          <button
            type="button"
            onClick={onOpenAiConfig}
            className="dt-data cursor-pointer text-bone-32 underline underline-offset-2 transition-colors hover:text-bone-70"
          >
            Configure provider
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="summary-tone" className="sr-only">
            Tone
          </label>
          <select
            id="summary-tone"
            value={selectedTone}
            onChange={(e) => setSelectedTone(e.target.value)}
            className="min-w-[150px] flex-1 rounded-[2px] border border-rule-2 bg-transparent px-2 py-1.5 font-mono text-[11px] text-bone focus:outline-none"
          >
            <option value="Executive & Metric-Driven">Tone: executive & metrics</option>
            <option value="High-Impact & Direct">Tone: high-impact & direct</option>
            <option value="Lead QA Architect Focus">Tone: lead architect</option>
            <option value="Agile & Product Delivery">Tone: agile & delivery</option>
          </select>

          <Button
            variant="quiet"
            size="sm"
            onClick={handleAiRefine}
            disabled={isAiLoading || !summary}
          >
            <Wand2 size={12} className={isAiLoading ? 'animate-spin' : ''} aria-hidden="true" />
            {isAiLoading ? 'Polishing…' : 'Polish'}
          </Button>
        </div>

        {errorMsg && <p className="dt-data mt-2 text-alarm">{errorMsg}</p>}
      </div>

      {/* presets — hairline rows, not cards */}
      <div className="border-t border-rule pt-4">
        <span className="dt-label mb-2 block text-bone-52">Starting points</span>
        <div className="divide-y divide-[var(--rule)]">
          {SUMMARY_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                sound.playAction();
                onChange(preset.text);
              }}
              className="group w-full cursor-pointer py-2 text-left"
            >
              <span className="dt-data block text-bone-70 transition-colors group-hover:text-bone">
                {preset.title}
              </span>
              <span className="mt-0.5 line-clamp-2 block font-sans text-[12px] leading-snug text-bone-32">
                {preset.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
