import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { sound } from '../../utils/soundEffects';
import { Field, Button, IconButton, SectionIndex, Chip, EmptyState } from '../ui/primitives';

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
    <div className="space-y-5">
      <div>
        <SectionIndex
          index={8}
          title="Certifications"
          action={<Chip>{certifications?.length || 0} certs</Chip>}
        />

        {certifications.length === 0 ? (
          <EmptyState title="No certifications added yet." hint="Accreditation reads as currency; list the heavy ones." />
        ) : (
          <ul className="divide-y divide-[var(--rule)] border-t border-rule">
            {certifications.map((cert, index) => (
              <li key={cert.id || index} className="py-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="dt-serif text-[12px] text-signal">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <IconButton
                    label="Delete certification"
                    title="Delete certification"
                    tone="alarm"
                    size="sm"
                    onClick={() => handleDeleteCert(index)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </IconButton>
                </div>

                <div className="space-y-4">
                  <Field
                    label="Certification Title"
                    value={cert.name || ''}
                    onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                    placeholder="e.g. ISTQB Certified Tester Foundation Level"
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      label="Issuing Body / Organization"
                      value={cert.issuer || ''}
                      onChange={(e) => handleFieldChange(index, 'issuer', e.target.value)}
                      placeholder="e.g. ISTQB, AWS, Scrum Alliance"
                    />
                    <Field
                      label="Issue Year"
                      value={cert.year || ''}
                      onChange={(e) => handleFieldChange(index, 'year', e.target.value)}
                      placeholder="e.g. 2023"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="pt-3">
          <Button variant="quiet" size="sm" onClick={handleAddCert}>
            <Plus size={12} aria-hidden="true" />
            Add Cert
          </Button>
        </div>
      </div>

      {/* suggested credentials — hairline rows */}
      <div className="border-t border-rule pt-4">
        <span className="dt-label mb-1 block text-bone-52">Recommended Industry Credentials</span>
        <ul className="divide-y divide-[var(--rule)]">
          {POPULAR_CERTS.map((preset, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="group flex w-full cursor-pointer items-center justify-between gap-2 py-2 text-left"
              >
                <span className="min-w-0 truncate">
                  <span className="dt-data block truncate text-bone-70">{preset.name}</span>
                  <span className="dt-data block text-[10px] text-bone-32">
                    {preset.issuer} · {preset.year}
                  </span>
                </span>
                <span className="dt-label shrink-0 text-bone-32 transition-colors group-hover:text-bone-70">
                  + Add
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
