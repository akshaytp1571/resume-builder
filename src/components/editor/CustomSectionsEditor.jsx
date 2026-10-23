import React from 'react';
import { Plus, Trash2, Layers } from 'lucide-react';
import { sound } from '../../utils/soundEffects';

export default function CustomSectionsEditor({ customSections = [], onChange }) {
  const handleFieldChange = (index, field, value) => {
    const updated = [...customSections];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddSection = () => {
    sound.playAction();
    const newSection = {
      id: `custom-${Date.now()}`,
      title: 'Section Title',
      items: ['First entry.'],
    };
    onChange([...customSections, newSection]);
  };

  const handleDeleteSection = (index) => {
    sound.playAction();
    const updated = customSections.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleItemChange = (sectionIndex, itemIndex, value) => {
    const updated = [...customSections];
    const items = [...(updated[sectionIndex].items || [])];
    items[itemIndex] = value;
    updated[sectionIndex].items = items;
    onChange(updated);
  };

  const handleAddItem = (sectionIndex) => {
    sound.playAction();
    const updated = [...customSections];
    updated[sectionIndex].items = [...(updated[sectionIndex].items || []), ''];
    onChange(updated);
  };

  const handleDeleteItem = (sectionIndex, itemIndex) => {
    sound.playAction();
    const updated = [...customSections];
    updated[sectionIndex].items = (updated[sectionIndex].items || []).filter(
      (_, i) => i !== itemIndex
    );
    onChange(updated);
  };

  return (
    <div className="space-y-4 font-sans text-xs animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-pink-200 tracking-wide flex items-center gap-1.5">
          <Layers size={13} className="text-rose-400" />
          <span>Custom Sections ({customSections?.length || 0})</span>
        </label>
        <button
          type="button"
          onClick={handleAddSection}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_2px_12px_rgba(244,63,94,0.3)] active:scale-95"
        >
          <Plus size={13} />
          <span>Add Section</span>
        </button>
      </div>

      {customSections.length === 0 ? (
        <div className="p-4 rounded-2xl canvas-card text-center text-pink-300/70">
          <p className="text-xs mb-2.5">No custom sections added yet.</p>
          <button
            type="button"
            onClick={handleAddSection}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-pink-950/80 hover:bg-pink-900 text-pink-200 border border-pink-500/40 cursor-pointer transition-colors"
          >
            + Add First Section
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {customSections.map((section, index) => (
            <div
              key={section.id || index}
              className="p-3.5 rounded-2xl canvas-card space-y-2.5 hover:border-pink-400/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                  <Layers size={13} className="text-rose-400" />
                  Section #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteSection(index)}
                  className="p-1.5 rounded-lg text-pink-400/60 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="Delete section"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                  Section Heading
                </label>
                <input
                  type="text"
                  value={section.title || ''}
                  onChange={(e) => handleFieldChange(index, 'title', e.target.value)}
                  placeholder="e.g. Publications, Volunteering, Awards"
                  className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-pink-200">
                    Entries
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddItem(index)}
                    className="text-[11px] text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <Plus size={12} /> Add Entry
                  </button>
                </div>

                <div className="space-y-2">
                  {(section.items || []).map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start gap-2">
                      <span className="text-rose-400 text-xs mt-1.5 font-bold font-mono">
                        {itemIndex + 1}.
                      </span>
                      <textarea
                        rows={2}
                        value={item}
                        onChange={(e) => handleItemChange(index, itemIndex, e.target.value)}
                        placeholder="One line per entry..."
                        className="flex-1 bg-[#230a28] border border-pink-500/25 rounded-xl p-2.5 text-xs text-pink-50 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400 transition-colors leading-relaxed font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(index, itemIndex)}
                        className="p-1 mt-1 text-pink-400/60 hover:text-rose-300 cursor-pointer"
                        title="Remove entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
