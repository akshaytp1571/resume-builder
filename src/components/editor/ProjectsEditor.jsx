import React from 'react';
import { Plus, Trash2, FolderGit2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';

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
    <div className="space-y-4 font-sans text-xs animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-pink-200 tracking-wide flex items-center gap-1.5">
          <FolderGit2 size={13} className="text-rose-400" />
          <span>Projects & Side Work ({projects?.length || 0})</span>
        </label>
        <button
          type="button"
          onClick={handleAddProject}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_2px_12px_rgba(244,63,94,0.3)] active:scale-95"
        >
          <Plus size={13} />
          <span>Add Project</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="p-4 rounded-2xl canvas-card text-center text-pink-300/70">
          <p className="text-xs mb-2.5">No projects added yet.</p>
          <button
            type="button"
            onClick={handleAddProject}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-pink-950/80 hover:bg-pink-900 text-pink-200 border border-pink-500/40 cursor-pointer transition-colors"
          >
            + Add First Project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project, index) => (
            <div
              key={project.id || index}
              className="p-3.5 rounded-2xl canvas-card space-y-2.5 hover:border-pink-400/70 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                  <FolderGit2 size={13} className="text-rose-400" />
                  Project #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteProject(index)}
                  className="p-1.5 rounded-lg text-pink-400/85 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="Delete project"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={project.name || ''}
                    onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                    placeholder="e.g. Order-to-Cash Test Automation Suite"
                    className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                    Your Role
                  </label>
                  <input
                    type="text"
                    value={project.role || ''}
                    onChange={(e) => handleFieldChange(index, 'role', e.target.value)}
                    placeholder="e.g. QA Lead / Automation Engineer"
                    className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                    Period
                  </label>
                  <input
                    type="text"
                    value={project.period || ''}
                    onChange={(e) => handleFieldChange(index, 'period', e.target.value)}
                    placeholder="e.g. 2023 – 2024"
                    className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                    Link (repository, demo or case study)
                  </label>
                  <input
                    type="text"
                    value={project.link || ''}
                    onChange={(e) => handleFieldChange(index, 'link', e.target.value)}
                    placeholder="e.g. github.com/example/project"
                    className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-pink-200">
                    Highlights
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddHighlight(index)}
                    className="text-[11px] text-rose-300 hover:text-rose-200 flex items-center gap-1 cursor-pointer font-semibold"
                  >
                    <Plus size={12} /> Add Bullet
                  </button>
                </div>

                <div className="space-y-2">
                  {(project.highlights || []).map((hl, hIdx) => (
                    <div key={hIdx} className="flex items-start gap-2">
                      <span className="text-rose-400 text-xs mt-1.5 font-bold font-mono">
                        {hIdx + 1}.
                      </span>
                      <textarea
                        rows={2}
                        value={hl}
                        onChange={(e) => handleHighlightChange(index, hIdx, e.target.value)}
                        placeholder="What you built, and the measurable result..."
                        className="flex-1 bg-[#230a28] border border-pink-500/25 rounded-xl p-2.5 text-xs text-pink-50 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400 transition-colors leading-relaxed font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteHighlight(index, hIdx)}
                        className="p-1 mt-1 text-pink-400/85 hover:text-rose-300 cursor-pointer"
                        title="Remove bullet"
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
