import React from 'react';
import PhotoFrame from './PhotoFrame';
import ExtraSections from './ExtraSections';
import { safeResume } from './templateData';

export default function CompactTemplate({ data, theme }) {
  const { personalInfo, summary, skills, experience, education, languages, certifications, projects, customSections } = safeResume(data);
  const primaryColor = theme?.primaryColor || '#4f46e5';

  return (
    <div
      className="p-6 sm:p-8 font-sans text-gray-900 bg-white"
      style={{
        fontFamily: theme?.fontFamily || "'Inter', system-ui, sans-serif",
        fontSize: '12px',
        lineHeight: 1.35,
      }}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between border-b-2 pb-3 mb-3" style={{ borderColor: primaryColor }}>
        <div className="flex items-center gap-4">
          {personalInfo?.showPhoto && personalInfo?.photo && (
            <PhotoFrame
              personalInfo={personalInfo}
              size={64}
              borderColor="#d1d5db"
              borderWidth="1px"
              shadow="0 1px 2px 0 rgba(0,0,0,0.05)"
            />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight" style={{ color: primaryColor }}>
              {personalInfo?.fullName || 'YOUR NAME'}
            </h1>
            <p className="text-xs font-bold text-gray-700">
              {personalInfo?.title || 'Professional Title'}
            </p>
            {personalInfo?.relocation && (
              <span className="inline-block text-[10.5px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded mt-0.5">
                ✦ {personalInfo.relocation}
              </span>
            )}
          </div>
        </div>

        {/* Contact details list */}
        <div className="text-right text-[11px] text-gray-600 space-y-0.5">
          {personalInfo?.email && <p>{personalInfo.email}</p>}
          {personalInfo?.phone && <p>{personalInfo.phone}</p>}
          {personalInfo?.location && <p>{personalInfo.location}</p>}
          {personalInfo?.linkedin && <p className="text-indigo-600">{personalInfo.linkedin}</p>}
        </div>
      </div>

      {/* Grid Layout: 2 Columns */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left Column (8 cols): Summary + Experience */}
        <div className="col-span-8 space-y-3">
          {summary && (
            <div>
              <h2
                className="text-[11px] font-black uppercase tracking-wider mb-1"
                style={{ color: primaryColor }}
              >
                Profile Summary
              </h2>
              <p className="text-[11.5px] text-gray-700 text-justify leading-relaxed">
                {summary}
              </p>
            </div>
          )}

          {experience && experience.length > 0 && (
            <div>
              <h2
                className="text-[11px] font-black uppercase tracking-wider mb-1"
                style={{ color: primaryColor }}
              >
                Experience
              </h2>
              <div className="space-y-3">
                {experience.map((exp, idx) => (
                  <div key={exp.id || idx}>
                    <div className="flex justify-between items-baseline font-bold text-xs text-gray-900">
                      <span>{exp.role} – {exp.company}</span>
                      <span className="text-[10.5px] font-medium text-gray-500">{exp.period}</span>
                    </div>
                    {exp.product && (
                      <p className="text-[11px] text-gray-600 italic font-medium">{exp.product}</p>
                    )}
                    {exp.highlights && (
                      <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px] text-gray-700">
                        {exp.highlights.map((h, hIdx) => (
                          <li key={hIdx}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <ExtraSections
            projects={projects}
            customSections={customSections}
            dense
            renderHeading={(label) => (
              <h2
                className="text-[11px] font-black uppercase tracking-wider mb-1"
                style={{ color: primaryColor }}
              >
                {label}
              </h2>
            )}
          />
        </div>

        {/* Right Column (4 cols): Skills, Education, Languages */}
        <div className="col-span-4 space-y-3 border-l pl-4 border-gray-200">
          {skills && skills.length > 0 && (
            <div>
              <h2
                className="text-[11px] font-black uppercase tracking-wider mb-1.5"
                style={{ color: primaryColor }}
              >
                Technical Skills
              </h2>
              <div className="space-y-2">
                {skills.map((s, idx) => (
                  <div key={s.id || idx}>
                    <p className="font-bold text-[11px] text-gray-800">{s.category}</p>
                    <p className="text-[10.5px] text-gray-600 leading-tight">{s.items}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {education && education.length > 0 && (
            <div>
              <h2
                className="text-[11px] font-black uppercase tracking-wider mb-1.5"
                style={{ color: primaryColor }}
              >
                Education
              </h2>
              <div className="space-y-2">
                {education.map((edu, idx) => (
                  <div key={edu.id || idx} className="text-[11px]">
                    <p className="font-bold text-gray-900">{edu.school}</p>
                    <p className="text-gray-600">{edu.degree}</p>
                    <div className="flex justify-between text-[10px] text-indigo-700 font-semibold">
                      <span>{edu.score}</span>
                      <span>{edu.year}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {languages && languages.length > 0 && (
            <div>
              <h2
                className="text-[11px] font-black uppercase tracking-wider mb-1.5"
                style={{ color: primaryColor }}
              >
                Languages
              </h2>
              <div className="flex flex-wrap gap-1 text-[10.5px]">
                {languages.map((l, idx) => (
                  <span key={l.id || idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {certifications && certifications.length > 0 && (
            <div>
              <h2
                className="text-[11px] font-black uppercase tracking-wider mb-1.5"
                style={{ color: primaryColor }}
              >
                Certifications
              </h2>
              <div className="space-y-1.5 text-[10.5px]">
                {certifications.map((c, idx) => (
                  <div key={c.id || idx}>
                    <p className="font-bold text-gray-900 leading-tight">{c.name}</p>
                    <p className="text-gray-500 text-[10px]">{c.issuer} {c.year && `(${c.year})`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
