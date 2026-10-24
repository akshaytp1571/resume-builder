import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { Button, IconButton, SectionIndex, Chip, EmptyState } from '../ui/primitives';

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
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={7}
          title="Languages"
          action={<Chip>{languages?.length || 0} languages</Chip>}
        />

        {languages?.length === 0 ? (
          <EmptyState title="No languages listed." hint="Name and proficiency, one per hairline row." />
        ) : (
          <ul className="divide-y divide-[var(--rule)] border-t border-rule">
            {languages?.map((lang, index) => (
              <li key={lang.id || index} className="flex items-center gap-2 py-2">
                <span className="dt-serif w-6 shrink-0 text-[12px] text-signal">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <input
                  type="text"
                  value={lang.name}
                  onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                  placeholder="e.g. English"
                  className="min-w-0 flex-1 border-0 border-b bg-transparent px-0 py-1 text-[15px] text-bone placeholder:text-bone-32 focus:outline-none focus-visible:outline-none"
                  style={{ borderBottomColor: 'var(--rule-2)' }}
                />

                <select
                  value={lang.proficiency || 'Conversational'}
                  onChange={(e) => handleFieldChange(index, 'proficiency', e.target.value)}
                  className="dt-data shrink-0 cursor-pointer rounded-[2px] border border-rule-2 bg-transparent px-1.5 py-1 text-bone focus:outline-none"
                >
                  {PROFICIENCY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-housing text-bone">
                      {opt}
                    </option>
                  ))}
                </select>

                <IconButton
                  label="Delete language"
                  title="Delete language"
                  tone="alarm"
                  size="sm"
                  onClick={() => handleDeleteLanguage(index)}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-3">
          <Button variant="quiet" size="sm" onClick={handleAddLanguage}>
            <Plus size={12} aria-hidden="true" />
            Add Language
          </Button>
        </div>
      </div>
    </div>
  );
}
