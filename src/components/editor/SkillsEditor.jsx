import React, { useState } from 'react';
import { Plus, Trash2, Sparkles, Wand2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { suggestSkillsWithAi, getSavedAiConfig, isAiConfigReady } from '../../utils/aiService';

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
    <div className="space-y-4 font-sans text-xs animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-pink-200 tracking-wide flex items-center gap-1.5">
          <Sparkles size={13} className="text-rose-400" />
          <span>Core Competencies & Skills ({skills?.length || 0})</span>
        </label>
        <button
          type="button"
          onClick={handleAddCategory}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_2px_12px_rgba(244,63,94,0.3)] active:scale-95"
        >
          <Plus size={13} />
          <span>Add Domain</span>
        </button>
      </div>

      {/* AI Skills Assistant Card */}
      <div className="p-3.5 rounded-2xl canvas-card space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
            <Sparkles size={13} className="text-rose-400 animate-pulse" />
            <span>AI Skill Gap Advisor</span>
          </span>

          <button
            type="button"
            onClick={handleFetchAiSuggestions}
            disabled={isAiLoading}
            className="px-3 py-1 text-[11px] font-semibold rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 text-white hover:opacity-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Wand2 size={12} className={isAiLoading ? 'animate-spin' : ''} />
            <span>{isAiLoading ? 'Scanning...' : 'Detect Skill Gaps'}</span>
          </button>
        </div>

        {errorMsg && (
          <p className="text-[11px] text-rose-300/90 font-sans bg-rose-950/40 p-2 rounded-lg border border-rose-500/30">
            ⚠ {errorMsg}
          </p>
        )}

        {aiSuggestions && (
          <div className="pt-1.5 space-y-2">
            <p className="text-[11px] text-pink-200 font-semibold">
              ✦ Recommended In-Demand Additions (Click + to add):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {aiSuggestions.map((sug, i) => (
                <div
                  key={i}
                  className="p-2 rounded-xl bg-[#1c081f] border border-pink-500/25 flex items-center justify-between gap-1.5 text-[11px]"
                >
                  <div className="truncate">
                    <span className="font-semibold text-pink-100 truncate">{sug.item}</span>
                    <span className="text-pink-300/60 text-[10px] block">[{sug.category}]</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddSkillToCategory(sug.category, sug.item)}
                    className="px-2 py-0.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold cursor-pointer shrink-0 transition-colors"
                    title={`Add ${sug.item} to ${sug.category}`}
                  >
                    + ADD
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {skills?.length === 0 && (
          <div className="p-4 rounded-2xl canvas-card text-center text-pink-300/70">
            <p className="text-xs mb-2.5">No skill domains yet.</p>
            <button
              type="button"
              onClick={handleAddCategory}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-pink-950/80 hover:bg-pink-900 text-pink-200 border border-pink-500/40 cursor-pointer transition-colors"
            >
              + Add First Skill Domain
            </button>
          </div>
        )}
        {skills?.map((skill, index) => (
          <div
            key={skill.id || index}
            className="p-3.5 rounded-2xl canvas-card space-y-2.5 hover:border-pink-400/50 transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={skill.category}
                  onChange={(e) => handleCategoryChange(index, 'category', e.target.value)}
                  placeholder="Domain Name (e.g. Automation, Cloud)"
                  className="w-full bg-[#160619] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400 transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => handleDeleteCategory(index)}
                className="p-1.5 rounded-lg text-pink-400/60 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                title="Delete category"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <textarea
              rows={2}
              value={skill.items}
              onChange={(e) => handleCategoryChange(index, 'items', e.target.value)}
              placeholder="Skills, separated by commas (e.g. Selenium WebDriver, Java, TestNG)"
              className="w-full bg-[#160619] border border-pink-500/25 rounded-xl p-2.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400 transition-colors leading-relaxed font-sans"
            />
          </div>
        ))}
      </div>

      {/* Recommended Keywords Pill Stream */}
      <div className="p-3 rounded-2xl canvas-card">
        <p className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5 mb-2">
          <Sparkles size={12} className="text-rose-400" />
          <span>Quick Add Keywords:</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_QA_KEYWORDS.map((kw, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleAddSkillToCategory('Tools', kw)}
              className="text-[10px] bg-[#220a26] hover:bg-[#2e0e33] border border-pink-500/25 hover:border-rose-400/60 text-pink-200 hover:text-white px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
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
