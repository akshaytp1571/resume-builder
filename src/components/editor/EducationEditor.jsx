import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { Field, Button, IconButton, SectionIndex, Chip, EmptyState } from '../ui/primitives';

export default function EducationEditor({ education, onChange }) {
  const handleFieldChange = (index, field, value) => {
    const updated = [...education];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddEducation = () => {
    sound.playAction();
    const newEdu = {
      id: `edu-${Date.now()}`,
      school: 'Institution / University Name',
      degree: 'Degree or Technical Certification',
      score: 'Grade / CGPA',
      year: 'Graduation Year',
    };
    onChange([...education, newEdu]);
  };

  const handleDeleteEducation = (index) => {
    sound.playAction();
    const updated = education.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={7}
          title="Education"
          action={<Chip>{education?.length || 0} entries</Chip>}
        />

        {education?.length === 0 ? (
          <EmptyState title="No credentials yet." hint="Highest qualification first." />
        ) : (
          <ul className="divide-y divide-[var(--rule)] border-t border-rule">
            {education?.map((edu, index) => (
              <li key={edu.id || index} className="py-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="dt-serif text-[12px] text-signal">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <IconButton
                    label="Delete entry"
                    title="Delete entry"
                    tone="alarm"
                    size="sm"
                    onClick={() => handleDeleteEducation(index)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </IconButton>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    className="sm:col-span-2"
                    label="Institution / University"
                    value={edu.school}
                    onChange={(e) => handleFieldChange(index, 'school', e.target.value)}
                    placeholder="e.g. State University of Technology"
                  />
                  <Field
                    className="sm:col-span-2"
                    label="Degree & Major"
                    value={edu.degree}
                    onChange={(e) => handleFieldChange(index, 'degree', e.target.value)}
                    placeholder="e.g. B.Tech Computer Science and Engineering"
                  />
                  <Field
                    label="Grade / CGPA"
                    value={edu.score || ''}
                    onChange={(e) => handleFieldChange(index, 'score', e.target.value)}
                    placeholder="e.g. CGPA: 7.24 / 10.00"
                  />
                  <Field
                    label="Year of Completion"
                    value={edu.year || ''}
                    onChange={(e) => handleFieldChange(index, 'year', e.target.value)}
                    placeholder="e.g. 2015 – 2019"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-3">
          <Button variant="quiet" size="sm" onClick={handleAddEducation}>
            <Plus size={12} aria-hidden="true" />
            Add Degree
          </Button>
        </div>
      </div>
    </div>
  );
}
