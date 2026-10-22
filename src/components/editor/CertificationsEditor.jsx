import React from 'react';
import { Plus, Trash2, Award, Sparkles } from 'lucide-react';
import { sound } from '../../utils/soundEffects';

const POPULAR_CERTS = [
  { name: 'ISTQB Certified Tester Foundation Level (CTFL)', issuer: 'ISTQB', year: '2021' },
  { name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', year: '2023' },
  { name: 'Selenium WebDriver Automation Specialist', issuer: 'External Provider', year: '2022' },
  { name: 'Postman API Fundamentals Student Expert', issuer: 'Postman', year: '2023' },
  { name: 'Certified ScrumMaster (CSM)', issuer: 'Scrum Alliance', year: '2024' },
];

export default function CertificationsEditor({ certifications = [], onChange }) {
  const handleFieldChange = (index, field, value) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddCert = () => {
    sound.playAction();
    const newCert = {
      id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: 'Certification Title',
      issuer: 'Issuing Body / Organization',
      year: new Date().getFullYear().toString(),
    };
    onChange([...certifications, newCert]);
  };

  const handleDeleteCert = (index) => {
    sound.playAction();
    const updated = certifications.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleApplyPreset = (preset) => {
    sound.playAction();
    const newCert = {
      id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...preset,
    };
    onChange([...certifications, newCert]);
  };

  return (
    <div className="space-y-4 font-sans text-xs animate-fade-in">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-pink-200 tracking-wide flex items-center gap-1.5">
          <Award size={13} className="text-rose-400" />
          <span>Certifications & Accreditations ({certifications?.length || 0})</span>
        </label>
        <button
          type="button"
          onClick={handleAddCert}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_2px_12px_rgba(244,63,94,0.3)] active:scale-95"
        >
          <Plus size={13} />
          <span>Add Cert</span>
        </button>
      </div>

      {certifications.length === 0 ? (
        <div className="p-4 rounded-2xl canvas-card text-center text-pink-300/70">
          <p className="text-xs mb-2.5">No certifications added yet.</p>
          <button
            type="button"
            onClick={handleAddCert}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-pink-950/80 hover:bg-pink-900 text-pink-200 border border-pink-500/40 cursor-pointer transition-colors"
          >
            + Add First Certification
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {certifications.map((cert, index) => (
            <div
              key={cert.id || index}
              className="p-3.5 rounded-2xl canvas-card space-y-2.5 hover:border-pink-400/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                  <Award size={13} className="text-rose-400" />
                  Certificate #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteCert(index)}
                  className="p-1.5 rounded-lg text-pink-400/60 hover:text-rose-300 hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="Delete certification"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                    Certification Title
                  </label>
                  <input
                    type="text"
                    value={cert.name || ''}
                    onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                    placeholder="e.g. ISTQB Certified Tester Foundation Level"
                    className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                      Issuing Body / Organization
                    </label>
                    <input
                      type="text"
                      value={cert.issuer || ''}
                      onChange={(e) => handleFieldChange(index, 'issuer', e.target.value)}
                      placeholder="e.g. ISTQB, AWS, Scrum Alliance"
                      className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-pink-200 mb-1">
                      Issue Year
                    </label>
                    <input
                      type="text"
                      value={cert.year || ''}
                      onChange={(e) => handleFieldChange(index, 'year', e.target.value)}
                      placeholder="e.g. 2023"
                      className="w-full bg-[#18071c] border border-pink-500/25 rounded-xl px-2.5 py-1.5 text-xs text-pink-100 placeholder:text-pink-300/30 focus:outline-none focus:border-rose-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggested Industry Certifications */}
      <div className="p-3 rounded-2xl canvas-card">
        <p className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5 mb-2">
          <Sparkles size={12} className="text-rose-400" />
          <span>Recommended Industry Credentials (Click to Add):</span>
        </p>
        <div className="space-y-1.5">
          {POPULAR_CERTS.map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="w-full text-left p-2 rounded-xl bg-[#220a26] hover:bg-[#2d0e32] border border-pink-500/20 text-pink-200 flex items-center justify-between transition-colors cursor-pointer group"
            >
              <span className="truncate text-xs font-medium">{preset.name}</span>
              <span className="text-[10px] text-rose-300 font-bold shrink-0 ml-2 group-hover:text-rose-200">+ ADD</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
