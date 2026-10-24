import React, { useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { suggestSkillsWithAi, getSavedAiConfig, isAiConfigReady } from '../../utils/aiService';
import { Field, Button, IconButton, SectionIndex, Chip, EmptyState } from '../ui/primitives';

const POPULAR_QA_KEYWORDS = [
  'Playwright', 'Cypress', 'Appium', 'CI/CD Jenkins', 'Docker',
  'Postman Runner', 'Kubernetes', 'Cucumber BDD', 'Charles Proxy',
  'Git', 'Grafana', 'JIRA Xray'
];

export default function SkillsEditor({
  skills,
  onChange,
  onOpenAiConfig,
}) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleCategoryChange = (index, field, value) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddCategory = () => {
    sound.playAction();
    const newCategory = {
      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: 'New Domain',
      items: 'Enter skills separated by commas...',
    };
    onChange([...skills, newCategory]);
  };

  const handleDeleteCategory = (index) => {
    sound.playAction();
    const updated = skills.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleAddSkillToCategory = (targetCatName, skillName) => {
    sound.playAction();
    const catIndex = skills.findIndex(
      (s) => s.category.toLowerCase().trim() === targetCatName.toLowerCase().trim()
    );

    if (catIndex >= 0) {
      const current = skills[catIndex].items || '';
      if (!current.toLowerCase().includes(skillName.toLowerCase())) {
        const separator = current.trim().endsWith(',') || !current.trim() ? ' ' : ', ';
        handleCategoryChange(catIndex, 'items', `${current.trim()}${separator}${skillName}`);
      }
    } else {
      // Create category
      const newCat = {
        id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        category: targetCatName,
        items: skillName,
      };
      onChange([...skills, newCat]);
    }
  };

  const handleFetchAiSuggestions = async () => {
    sound.playAction();
    const config = getSavedAiConfig();
    if (!isAiConfigReady(config)) {
      onOpenAiConfig();
      return;
    }

    setIsAiLoading(true);
    setErrorMsg(null);

    try {
      const suggestions = await suggestSkillsWithAi({
        currentSkills: skills,
        targetRole: 'QA Lead / Test Architect',
      });
      sound.playSuccess();
      setAiSuggestions(suggestions);
    } catch (err) {
      setErrorMsg(err.message || 'AI skill analysis failed.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={4}
          title="Core Competencies"
          action={<Chip>{skills?.length || 0} domains</Chip>}
        />

        {skills?.length === 0 ? (
          <EmptyState title="No skill domains yet." hint="Group by domain: Automation, API, Tooling." />
        ) : (
          <ul className="divide-y divide-[var(--rule)] border-t border-rule">
            {skills?.map((skill, index) => (
              <li key={skill.id || index} className="py-3">
                <div className="flex items-start gap-2">
                  <span className="dt-serif mt-2 shrink-0 text-[12px] text-signal">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Field
                      label="Domain"
                      value={skill.category}
                      onChange={(e) => handleCategoryChange(index, 'category', e.target.value)}
                      placeholder="Domain Name (e.g. Automation, Cloud)"
                    />
                    <Field
                      label="Skills"
                      multiline
                      rows={2}
                      value={skill.items}
                      onChange={(e) => handleCategoryChange(index, 'items', e.target.value)}
                      placeholder="Skills, separated by commas (e.g. Selenium WebDriver, Java, TestNG)"
                    />
                  </div>
                  <IconButton
                    label="Delete category"
                    title="Delete category"
                    tone="alarm"
                    size="sm"
                    className="mt-2"
                    onClick={() => handleDeleteCategory(index)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-3">
          <Button variant="quiet" size="sm" onClick={handleAddCategory}>
            <Plus size={12} aria-hidden="true" />
            Add Domain
          </Button>
        </div>
      </div>

      {/* AI skill gap advisor — a mono tool row, not a banner */}
      <div className="border-t border-rule pt-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="dt-label text-bone-52">AI Skill Gap Advisor</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFetchAiSuggestions}
            disabled={isAiLoading}
          >
            <Wand2 size={12} className={isAiLoading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{isAiLoading ? 'Scanning...' : 'Detect Skill Gaps'}</span>
          </Button>
        </div>

        {errorMsg && <p className="dt-data mt-1 text-alarm">{errorMsg}</p>}

        {aiSuggestions && (
          <div className="mt-2 space-y-2">
            <span className="dt-label block text-bone-32">Recommended in-demand additions</span>
            <ul className="divide-y divide-[var(--rule)]">
              {aiSuggestions.map((sug, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0 truncate">
                    <span className="dt-data block truncate text-bone-70">{sug.item}</span>
                    <span className="dt-data block text-[10px] text-bone-32">[{sug.category}]</span>
                  </div>
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => handleAddSkillToCategory(sug.category, sug.item)}
                    title={`Add ${sug.item} to ${sug.category}`}
                  >
                    + Add
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* keyword stream — quiet chips, no gradient */}
      <div className="border-t border-rule pt-4">
        <span className="dt-label mb-2 block text-bone-52">Quick Add Keywords</span>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_QA_KEYWORDS.map((kw, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleAddSkillToCategory('Tools', kw)}
              className="dt-label cursor-pointer rounded-[2px] border border-rule px-2 py-1 text-[9px] text-bone-32 transition-colors duration-[90ms] hover:border-rule-2 hover:text-bone-70"
              title={`Add "${kw}" to the Tools category`}
            >
              + {kw}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
