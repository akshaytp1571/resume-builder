import React from 'react';
import ExtraSections from './ExtraSections';

export default function MinimalTemplate({ data, theme }) {
  const { personalInfo, summary, skills, experience, education, languages, certifications, projects, customSections } = data;
  const isCompact = theme?.singlePage !== false || theme?.fontSize === 'compact';

  return (
    <div
      className={`font-sans text-gray-900 bg-white ${isCompact ? 'px-8 py-5 leading-normal' : 'p-8 sm:p-12 leading-relaxed'}`}
      style={{
        fontFamily: theme?.fontFamily || "'Inter', system-ui, sans-serif",
        fontSize: isCompact ? '12px' : '13px',
      }}
    >
      {/* Clean ATS Header */}
      <div className="text-center border-b pb-4 mb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-gray-950">
          {personalInfo?.fullName || 'YOUR NAME'}
        </h1>
        <p className="text-sm font-medium text-gray-700 mt-1">
          {personalInfo?.title || 'Professional Title'}
        </p>

        <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-xs text-gray-600 mt-2">
          {personalInfo?.location && <span>{personalInfo.location}</span>}
          {personalInfo?.phone && (
            <>
              <span>•</span>
              <a href={`tel:${personalInfo.phone}`} className="hover:underline">{personalInfo.phone}</a>
            </>
          )}
          {personalInfo?.email && (
            <>
              <span>•</span>
              <a href={`mailto:${personalInfo.email}`} className="hover:underline">{personalInfo.email}</a>
            </>
          )}
          {personalInfo?.relocation && (
            <>
              <span>•</span>
              <span className="font-semibold text-gray-800">{personalInfo.relocation}</span>
            </>
          )}
        </div>
      </div>

      {/* SUMMARY */}
      {summary && (
        <div className="mb-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-gray-950 border-b border-gray-300 pb-1 mb-2">
            Professional Summary
          </h2>
          <p className="text-gray-700 leading-relaxed text-justify">
            {summary}
          </p>
        </div>
      )}

      {/* SKILLS */}
      {skills && skills.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-gray-950 border-b border-gray-300 pb-1 mb-2">
            Technical & Domain Competencies
          </h2>
          <div className="space-y-1">
            {skills.map((skill, idx) => (
              <p key={skill.id || idx} className="leading-snug">
                <span className="font-semibold text-gray-900">{skill.category}: </span>
                <span className="text-gray-700">{skill.items}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* EXPERIENCE */}
      {experience && experience.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-gray-950 border-b border-gray-300 pb-1 mb-2">
            Professional Experience
          </h2>
          <div className="space-y-4">
            {experience.map((exp, idx) => (
              <div key={exp.id || idx}>
                <div className="flex justify-between items-baseline font-semibold text-gray-950">
                  <span>{exp.role} – {exp.company}</span>
                  <span className="text-xs font-normal text-gray-600">{exp.period}</span>
                </div>
                {exp.product && (
                  <p className="text-xs text-gray-600 italic mt-0.5">{exp.product}</p>
                )}
                {exp.highlights && (
                  <ul className="list-disc pl-5 mt-1.5 space-y-1 text-gray-700 text-xs">
                    {exp.highlights.map((item, hIdx) => (
                      <li key={hIdx}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDUCATION */}
      {education && education.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-gray-950 border-b border-gray-300 pb-1 mb-2">
            Education
          </h2>
          <div className="space-y-2">
            {education.map((edu, idx) => (
              <div key={edu.id || idx} className="flex justify-between items-baseline">
                <div>
                  <p className="font-semibold text-gray-900">{edu.school}</p>
                  <p className="text-xs text-gray-600">{edu.degree} {edu.score && `• ${edu.score}`}</p>
                </div>
                {edu.year && <span className="text-xs text-gray-500">{edu.year}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LANGUAGES */}
      {languages && languages.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-gray-950 border-b border-gray-300 pb-1 mb-2">
            Languages
          </h2>
          <p className="text-xs text-gray-800">
            {languages.map((l) => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`).join('  •  ')}
          </p>
        </div>
      )}

      {/* CERTIFICATIONS */}
      {certifications && certifications.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-bold tracking-widest uppercase text-gray-950 border-b border-gray-300 pb-1 mb-2">
            Certifications & Credentials
          </h2>
          <div className="space-y-1 text-xs text-gray-800">
            {certifications.map((cert, index) => (
              <p key={cert.id || index}>
                <span className="font-semibold text-gray-900">{cert.name}</span>
                {cert.issuer && <span> – {cert.issuer}</span>}
                {cert.year && <span className="text-gray-500"> ({cert.year})</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      <ExtraSections
        projects={projects}
        customSections={customSections}
        renderHeading={(label) => (
          <h2 className="text-xs font-bold tracking-widest uppercase text-gray-950 border-b border-gray-300 pb-1 mb-2">
            {label}
          </h2>
        )}
      />
    </div>
  );
}
