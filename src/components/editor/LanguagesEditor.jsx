import React from 'react';
import { Plus, Trash2, Languages as LangIcon } from 'lucide-react';
import { sound } from '../../utils/soundEffects';

const PROFICIENCY_OPTIONS = [
  'Native',
  'Full Professional',
  'Professional Working',
  'Conversational',
  'Elementary',
];

export default function LanguagesEditor({ languages, onChange }) {
  const handleFieldChange = (index, field, value) => {
    const updated = [...languages];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddLanguage = () => {
    sound.playAction();
    const newLang = {
      id: `lang-${Date.now()}`,
      name: 'Language Name',
      proficiency: 'Conversational',
    };
    onChange([...languages, newLang]);
  };

  const handleDeleteLanguage = (index) => {
    sound.playAction();
    const updated = languages.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4 font-sans text-xs animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-pink-200 tracking-wide flex items-center gap-1.5">
          <LangIcon size={13} className="text-rose-400" />
          <span>Languages & Fluency ({languages?.length || 0})</span>
        </label>
        <button
          type="button"
          onClick={handleAddLanguage}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_2px_12px_rgba(244,63,94,0.3)] active:scale-95"
        >
          <Plus size={13} />
          <span>Add Language</span>
        </button>
      </div>

      <div className="space-y-2.5">
        {languages?.map((lang, index) => (
          <div
            key={lang.id || index}
            className="flex items-center gap-2 p-2.5 rounded-2xl canvas-card hover:border-pink-400/50 transition-all"
          >
            <input
              type="text"
              value={lang.name}
              onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
              placeholder="e.g. English"
              className="flex-1 bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
            />
            <select
              value={lang.proficiency || 'Conversational'}
              onChange={(e) => handleFieldChange(index, 'proficiency', e.target.value)}
              className="bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-rose-300 focus:outline-none focus:border-rose-400 font-semibold"
            >
              {PROFICIENCY_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-[#1e0823] text-pink-100">
                  {opt}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleDeleteLanguage(index)}
              className="p-1.5 rounded-lg text-pink-400/60 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
              title="Delete language"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
