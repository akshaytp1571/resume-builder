import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Briefcase, Sparkles } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { refineBulletWithAi, getSavedAiConfig, isAiConfigReady } from '../../utils/aiService';

export default function ExperienceEditor({
  experience,
  onChange,
  onTriggerAiRefine,
  onOpenAiConfig,
}) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [loadingBulletKey, setLoadingBulletKey] = useState(null);

  const handleFieldChange = (index, field, value) => {
    const updated = [...experience];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddExperience = () => {
    sound.playAction();
    const newExp = {
      id: `exp-${Date.now()}`,
      role: 'QA Lead / Senior QA Engineer',
      company: 'Enterprise Organization, Location',
      period: '2023 – Present',
      product: 'Product / System Architecture details',
      highlights: [
        'Formulated end-to-end testing strategy across web and mobile platforms.',
        'Automated regression suites reducing validation cycle time by 40%.',
      ],
    };
    const updated = [newExp, ...experience];
    onChange(updated);
    setExpandedIndex(0);
  };

  const handleDeleteExperience = (index) => {
    sound.playAction();
    const updated = experience.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleHighlightChange = (expIndex, hIndex, value) => {
    const updated = [...experience];
    const highlights = [...updated[expIndex].highlights];
    highlights[hIndex] = value;
    updated[expIndex].highlights = highlights;
    onChange(updated);
  };

  const handleAddHighlight = (expIndex) => {
    sound.playAction();
    const updated = [...experience];
    updated[expIndex].highlights = [
      ...(updated[expIndex].highlights || []),
      'Executed performance and API reliability tests using JMeter and Postman.',
    ];
    onChange(updated);
  };

  const handleDeleteHighlight = (expIndex, hIndex) => {
    sound.playAction();
    const updated = [...experience];
    updated[expIndex].highlights = updated[expIndex].highlights.filter((_, i) => i !== hIndex);
    onChange(updated);
  };

  // AI Refine specific bullet
  const handleAiRefineBullet = async (expIndex, hIndex) => {
    sound.playAction();
    const currentBullet = experience[expIndex].highlights[hIndex];
    const roleContext = `${experience[expIndex].role} at ${experience[expIndex].company}`;
    const bulletKey = `${expIndex}-${hIndex}`;

    const config = getSavedAiConfig();
    if (!isAiConfigReady(config)) {
      onOpenAiConfig();
      return;
    }

    setLoadingBulletKey(bulletKey);

    try {
      const refined = await refineBulletWithAi({
        bullet: currentBullet,
        roleContext,
      });

      onTriggerAiRefine({
        title: 'AI Bullet Polish (Google XYZ Formula)',
        originalText: currentBullet,
        refinedText: refined,
        onApply: (appliedText) => {
          handleHighlightChange(expIndex, hIndex, appliedText);
        },
        onRegenerate: async (instructions) => {
          return await refineBulletWithAi({
            bullet: currentBullet,
            roleContext,
            extraInstructions: instructions,
          });
        },
      });
    } catch (err) {
      alert(err.message || 'AI refinement error');
    } finally {
      setLoadingBulletKey(null);
    }
  };

  return (
    <div className="space-y-4 font-sans text-xs animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-pink-200 tracking-wide flex items-center gap-1.5">
          <Briefcase size={13} className="text-rose-400" />
          <span>Professional Experience ({experience?.length || 0})</span>
        </label>
        <button
          type="button"
          onClick={handleAddExperience}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_2px_12px_rgba(244,63,94,0.3)] active:scale-95"
        >
          <Plus size={13} />
          <span>Add Role</span>
        </button>
      </div>

      <div className="space-y-3">
        {experience?.map((exp, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <div
              key={exp.id || index}
              className={`rounded-2xl border transition-all overflow-hidden canvas-card ${
                isExpanded
                  ? 'border-pink-500/50 shadow-[0_8px_30px_rgba(225,29,72,0.18)]'
                  : 'border-pink-500/20 hover:border-pink-400/40'
              }`}
            >
              {/* Header card banner */}
              <div
                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-pink-900/15 transition-colors"
                onClick={() => {
                  sound.playBlip(750, 950, 0.02);
                  setExpandedIndex(isExpanded ? null : index);
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-[#2b0c32] border border-pink-500/40 flex items-center justify-center text-rose-300 shrink-0">
                    <Briefcase size={13} />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-pink-50 truncate">
                      {exp.role || 'Role Name'}
                    </p>
                    <p className="text-[11px] text-pink-300/70 truncate">
                      {exp.company} • {exp.period}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteExperience(index);
                    }}
                    className="p-1.5 rounded-lg text-pink-400/60 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                    title="Delete role"
                  >
                    <Trash2 size={13} />
                  </button>
                  <div className="text-pink-300 p-1">
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                </div>
              </div>

              {/* Expanded Edit Form */}
              {isExpanded && (
                <div className="p-4 pt-2 space-y-3.5 border-t border-pink-500/20 bg-[#17061a]/90">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                        Role / Title
                      </label>
                      <input
                        type="text"
                        value={exp.role}
                        onChange={(e) => handleFieldChange(index, 'role', e.target.value)}
                        placeholder="e.g. QA Lead / Test Architect"
                        className="w-full bg-[#1e0823] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                        Company & Location
                      </label>
                      <input
                        type="text"
                        value={exp.company}
                        onChange={(e) => handleFieldChange(index, 'company', e.target.value)}
                        placeholder="e.g. Northwind Technologies, Austin"
                        className="w-full bg-[#1e0823] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                        Timeline / Dates
                      </label>
                      <input
                        type="text"
                        value={exp.period}
                        onChange={(e) => handleFieldChange(index, 'period', e.target.value)}
                        placeholder="e.g. April 2021 – Present"
                        className="w-full bg-[#1e0823] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                        Project / Context Details
                      </label>
                      <input
                        type="text"
                        value={exp.product || ''}
                        onChange={(e) => handleFieldChange(index, 'product', e.target.value)}
                        placeholder="e.g. Platform: FleetWorks logistics suite"
                        className="w-full bg-[#1e0823] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
                      />
                    </div>
                  </div>

                  {/* Highlights Bullet List */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-[11px] font-semibold text-pink-200 tracking-wide">
                        Key Accomplishments & Impact ({exp.highlights?.length || 0})
                      </label>
                      <button
                        type="button"
                        onClick={() => handleAddHighlight(index)}
                        className="text-[11px] text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <Plus size={12} /> Add Bullet
                      </button>
                    </div>

                    <div className="space-y-3">
                      {exp.highlights?.map((hl, hIdx) => {
                        const isLoading = loadingBulletKey === `${index}-${hIdx}`;
                        return (
                          <div key={hIdx} className="space-y-1.5 bg-[#1b081e] p-2.5 rounded-xl border border-pink-500/20">
                            <div className="flex items-start gap-2">
                              <span className="text-rose-400 text-xs mt-1.5 font-bold font-mono">{hIdx + 1}.</span>
                              <textarea
                                rows={2}
                                value={hl}
                                onChange={(e) => handleHighlightChange(index, hIdx, e.target.value)}
                                placeholder="Detail testing achievements, metrics, or automation results..."
                                className="flex-1 bg-[#230a28] border border-pink-500/25 rounded-xl p-2.5 text-xs text-pink-50 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400 transition-colors leading-relaxed font-sans"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteHighlight(index, hIdx)}
                                className="p-1 mt-1 text-pink-400/60 hover:text-rose-300 cursor-pointer"
                                title="Remove bullet"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <div className="flex justify-end pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleAiRefineBullet(index, hIdx)}
                                disabled={isLoading || !hl}
                                className="px-2.5 py-1 text-[10.5px] font-semibold rounded-lg bg-pink-950/80 hover:bg-pink-900 border border-pink-500/40 text-pink-200 transition-all cursor-pointer flex items-center gap-1 shadow-xs disabled:opacity-50"
                                title="Enhance bullet using Google XYZ formula (Accomplished [X] as measured by [Y], by doing [Z])"
                              >
                                <Sparkles size={11} className={isLoading ? 'animate-spin' : 'text-rose-400'} />
                                <span>{isLoading ? 'Optimizing...' : 'AI Polish (XYZ)'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
