import React from 'react';
import { Plus, Trash2, GraduationCap } from 'lucide-react';
import { sound } from '../../utils/soundEffects';

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
    <div className="space-y-4 font-sans text-xs animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-pink-200 tracking-wide flex items-center gap-1.5">
          <GraduationCap size={13} className="text-rose-400" />
          <span>Education & Credentials ({education?.length || 0})</span>
        </label>
        <button
          type="button"
          onClick={handleAddEducation}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_2px_12px_rgba(244,63,94,0.3)] active:scale-95"
        >
          <Plus size={13} />
          <span>Add Degree</span>
        </button>
      </div>

      <div className="space-y-3">
        {education?.map((edu, index) => (
          <div
            key={edu.id || index}
            className="p-3.5 rounded-2xl canvas-card space-y-2.5 hover:border-pink-400/70 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-rose-300">
                Education #{index + 1}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteEducation(index)}
                className="p-1.5 rounded-lg text-pink-400/85 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                title="Delete entry"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                  Institution / University
                </label>
                <input
                  type="text"
                  value={edu.school}
                  onChange={(e) => handleFieldChange(index, 'school', e.target.value)}
                  placeholder="e.g. State University of Technology"
                  className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                  Degree & Major
                </label>
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => handleFieldChange(index, 'degree', e.target.value)}
                  placeholder="e.g. B.Tech Computer Science and Engineering"
                  className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                  Grade / CGPA
                </label>
                <input
                  type="text"
                  value={edu.score || ''}
                  onChange={(e) => handleFieldChange(index, 'score', e.target.value)}
                  placeholder="e.g. CGPA: 7.24 / 10.00"
                  className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                  Year of Completion
                </label>
                <input
                  type="text"
                  value={edu.year || ''}
                  onChange={(e) => handleFieldChange(index, 'year', e.target.value)}
                  placeholder="e.g. 2015 – 2019"
                  className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/70 focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
