import React, { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { refineBulletWithAi, getSavedAiConfig, isAiConfigReady } from '../../utils/aiService';
import { Field, Button, IconButton, SectionIndex, Chip, EmptyState } from '../ui/primitives';

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
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={5}
          title="Professional Experience"
          action={<Chip>{experience?.length || 0} roles</Chip>}
        />

        {experience?.length === 0 ? (
          <EmptyState
            title="No roles yet."
            hint="Add the most recent role first; the ledger reads top-down."
          />
        ) : (
          <ul className="divide-y divide-[var(--rule)] border-t border-rule">
            {experience?.map((exp, index) => {
              const isExpanded = expandedIndex === index;
              return (
                <li key={exp.id || index} className="py-3">
                  {/* header row — ordinal, role, company, controls */}
                  <div
                    className="flex cursor-pointer items-start justify-between gap-2"
                    onClick={() => {
                      sound.playBlip(750, 950, 0.02);
                      setExpandedIndex(isExpanded ? null : index);
                    }}
                  >
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="dt-serif shrink-0 text-[12px] text-signal">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-bone">
                          {exp.role || 'Role Name'}
                        </p>
                        <p className="dt-data truncate text-bone-32">
                          {exp.company} · {exp.period}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton
                        label="Delete role"
                        title="Delete role"
                        tone="alarm"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteExperience(index);
                        }}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </IconButton>
                      <span className="text-bone-32" aria-hidden="true">
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-4 border-t border-rule pt-3">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field
                          label="Role / Title"
                          value={exp.role}
                          onChange={(e) => handleFieldChange(index, 'role', e.target.value)}
                          placeholder="e.g. QA Lead / Test Architect"
                        />
                        <Field
                          label="Company & Location"
                          value={exp.company}
                          onChange={(e) => handleFieldChange(index, 'company', e.target.value)}
                          placeholder="e.g. Northwind Technologies, Austin"
                        />
                        <Field
                          label="Timeline / Dates"
                          value={exp.period}
                          onChange={(e) => handleFieldChange(index, 'period', e.target.value)}
                          placeholder="e.g. April 2021 – Present"
                        />
                        <Field
                          label="Project / Context Details"
                          value={exp.product || ''}
                          onChange={(e) => handleFieldChange(index, 'product', e.target.value)}
                          placeholder="e.g. Platform: FleetWorks logistics suite"
                        />
                      </div>

                      {/* accomplishments — numbered hairline rows, not cards */}
                      <div className="border-t border-rule pt-3">
                        <span className="dt-label mb-2 block text-bone-52">
                          Key Accomplishments & Impact ({exp.highlights?.length || 0})
                        </span>

                        <div className="divide-y divide-[var(--rule)]">
                          {exp.highlights?.map((hl, hIdx) => {
                            const isLoading = loadingBulletKey === `${index}-${hIdx}`;
                            return (
                              <div key={hIdx} className="py-2">
                                <div className="flex items-start gap-2">
                                  <span className="dt-serif mt-1.5 shrink-0 text-[12px] text-signal">
                                    {String(hIdx + 1).padStart(2, '0')}
                                  </span>
                                  <textarea
                                    rows={2}
                                    value={hl}
                                    onChange={(e) => handleHighlightChange(index, hIdx, e.target.value)}
                                    placeholder="Detail testing achievements, metrics, or automation results..."
                                    className="flex-1 resize-none border-0 border-b bg-transparent px-0 py-1 text-[13px] leading-[1.45] text-bone placeholder:text-bone-32 focus:outline-none focus-visible:outline-none"
                                    style={{ borderBottomColor: 'var(--rule-2)' }}
                                  />
                                  <IconButton
                                    label="Remove bullet"
                                    title="Remove bullet"
                                    tone="alarm"
                                    size="sm"
                                    className="mt-0.5"
                                    onClick={() => handleDeleteHighlight(index, hIdx)}
                                  >
                                    <Trash2 size={13} aria-hidden="true" />
                                  </IconButton>
                                </div>

                                <div className="mt-1 flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAiRefineBullet(index, hIdx)}
                                    disabled={isLoading || !hl}
                                    title="Enhance bullet using Google XYZ formula (Accomplished [X] as measured by [Y], by doing [Z])"
                                  >
                                    <Wand2
                                      size={11}
                                      className={isLoading ? 'animate-spin' : ''}
                                      aria-hidden="true"
                                    />
                                    <span>{isLoading ? 'Optimizing...' : 'AI Polish (XYZ)'}</span>
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-2">
                          <Button variant="quiet" size="sm" onClick={() => handleAddHighlight(index)}>
                            <Plus size={12} aria-hidden="true" />
                            Add Bullet
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="pt-3">
          <Button variant="quiet" size="sm" onClick={handleAddExperience}>
            <Plus size={12} aria-hidden="true" />
            Add Role
          </Button>
        </div>
      </div>
    </div>
  );
}
