import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { Field, Button, IconButton, SectionIndex, Chip, EmptyState } from '../ui/primitives';

export default function ProjectsEditor({ projects = [], onChange }) {
  const handleFieldChange = (index, field, value) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddProject = () => {
    sound.playAction();
    const newProject = {
      id: `proj-${Date.now()}`,
      name: 'Project Name',
      role: 'Role / Contribution',
      period: '2023 – 2024',
      link: '',
      highlights: ['Describe the outcome and the metric it moved.'],
    };
    onChange([...projects, newProject]);
  };

  const handleDeleteProject = (index) => {
    sound.playAction();
    const updated = projects.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleHighlightChange = (projIndex, hIndex, value) => {
    const updated = [...projects];
    const highlights = [...(updated[projIndex].highlights || [])];
    highlights[hIndex] = value;
    updated[projIndex].highlights = highlights;
    onChange(updated);
  };

  const handleAddHighlight = (projIndex) => {
    sound.playAction();
    const updated = [...projects];
    updated[projIndex].highlights = [...(updated[projIndex].highlights || []), ''];
    onChange(updated);
  };

  const handleDeleteHighlight = (projIndex, hIndex) => {
    sound.playAction();
    const updated = [...projects];
    updated[projIndex].highlights = (updated[projIndex].highlights || []).filter(
      (_, i) => i !== hIndex
    );
    onChange(updated);
  };

  return (
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={6}
          title="Projects"
          action={<Chip>{projects?.length || 0} projects</Chip>}
        />

        {projects.length === 0 ? (
          <EmptyState title="No projects added yet." hint="Side work counts: name it, date it, measure it." />
        ) : (
          <ul className="divide-y divide-[var(--rule)] border-t border-rule">
            {projects.map((project, index) => (
              <li key={project.id || index} className="py-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="dt-serif text-[12px] text-signal">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <IconButton
                    label="Delete project"
                    title="Delete project"
                    tone="alarm"
                    size="sm"
                    onClick={() => handleDeleteProject(index)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </IconButton>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    className="sm:col-span-2"
                    label="Project Name"
                    value={project.name || ''}
                    onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                    placeholder="e.g. Order-to-Cash Test Automation Suite"
                  />
                  <Field
                    label="Your Role"
                    value={project.role || ''}
                    onChange={(e) => handleFieldChange(index, 'role', e.target.value)}
                    placeholder="e.g. QA Lead / Automation Engineer"
                  />
                  <Field
                    label="Period"
                    value={project.period || ''}
                    onChange={(e) => handleFieldChange(index, 'period', e.target.value)}
                    placeholder="e.g. 2023 – 2024"
                  />
                  <Field
                    className="sm:col-span-2"
                    label="Link (repository, demo or case study)"
                    value={project.link || ''}
                    onChange={(e) => handleFieldChange(index, 'link', e.target.value)}
                    placeholder="e.g. github.com/example/project"
                  />
                </div>

                <div className="border-t border-rule pt-3">
                  <span className="dt-label mb-2 block text-bone-52">Highlights</span>

                  <div className="divide-y divide-[var(--rule)]">
                    {(project.highlights || []).map((hl, hIdx) => (
                      <div key={hIdx} className="flex items-start gap-2 py-2">
                        <span className="dt-serif mt-1.5 shrink-0 text-[12px] text-signal">
                          {String(hIdx + 1).padStart(2, '0')}
                        </span>
                        <textarea
                          rows={2}
                          value={hl}
                          onChange={(e) => handleHighlightChange(index, hIdx, e.target.value)}
                          placeholder="What you built, and the measurable result..."
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
                    ))}
                  </div>

                  <div className="pt-2">
                    <Button variant="quiet" size="sm" onClick={() => handleAddHighlight(index)}>
                      <Plus size={12} aria-hidden="true" />
                      Add Bullet
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-3">
          <Button variant="quiet" size="sm" onClick={handleAddProject}>
            <Plus size={12} aria-hidden="true" />
            Add Project
          </Button>
        </div>
      </div>
    </div>
  );
}
