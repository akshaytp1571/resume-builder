import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { Field, Button, IconButton, SectionIndex, Chip, EmptyState } from '../ui/primitives';

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
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={9}
          title="Custom Sections"
          action={<Chip>{customSections?.length || 0} sections</Chip>}
        />

        {customSections.length === 0 ? (
          <EmptyState title="No custom sections added yet." hint="Publications, volunteering, awards — one heading, one line each." />
        ) : (
          <ul className="divide-y divide-[var(--rule)] border-t border-rule">
            {customSections.map((section, index) => (
              <li key={section.id || index} className="py-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="dt-serif text-[12px] text-signal">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <IconButton
                    label="Delete section"
                    title="Delete section"
                    tone="alarm"
                    size="sm"
                    onClick={() => handleDeleteSection(index)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </IconButton>
                </div>

                <Field
                  label="Section Heading"
                  value={section.title || ''}
                  onChange={(e) => handleFieldChange(index, 'title', e.target.value)}
                  placeholder="e.g. Publications, Volunteering, Awards"
                />

                <div className="border-t border-rule pt-3">
                  <span className="dt-label mb-2 block text-bone-52">Entries</span>

                  <div className="divide-y divide-[var(--rule)]">
                    {(section.items || []).map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-start gap-2 py-2">
                        <span className="dt-serif mt-1.5 shrink-0 text-[12px] text-signal">
                          {String(itemIndex + 1).padStart(2, '0')}
                        </span>
                        <textarea
                          rows={2}
                          value={item}
                          onChange={(e) => handleItemChange(index, itemIndex, e.target.value)}
                          placeholder="One line per entry..."
                          className="flex-1 resize-none border-0 border-b bg-transparent px-0 py-1 text-[13px] leading-[1.45] text-bone placeholder:text-bone-32 focus:outline-none focus-visible:outline-none"
                          style={{ borderBottomColor: 'var(--rule-2)' }}
                        />
                        <IconButton
                          label="Remove entry"
                          title="Remove entry"
                          tone="alarm"
                          size="sm"
                          className="mt-0.5"
                          onClick={() => handleDeleteItem(index, itemIndex)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </IconButton>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button variant="quiet" size="sm" onClick={() => handleAddItem(index)}>
                      <Plus size={12} aria-hidden="true" />
                      Add Entry
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-3">
          <Button variant="quiet" size="sm" onClick={handleAddSection}>
            <Plus size={12} aria-hidden="true" />
            Add Section
          </Button>
        </div>
      </div>
    </div>
  );
}
