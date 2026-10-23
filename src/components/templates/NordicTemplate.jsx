import React from 'react';
import PhotoFrame from './PhotoFrame';
import ExtraSections from './ExtraSections';

export default function NordicTemplate({ data, theme }) {
  const { personalInfo, summary, skills, experience, education, languages, certifications, projects, customSections } = data;

  return (
    <div
      className="p-8 sm:p-12 font-serif text-slate-800 bg-[#fdfdfd]"
      style={{
        fontFamily: theme?.fontFamily?.includes('Merriweather')
          ? "'Merriweather', Georgia, serif"
          : "'Playfair Display', Georgia, serif",
      }}
    >
      {/* Luxury Centered Header */}
      <div className="text-center pb-6 border-b-2 border-slate-900/10 mb-6">
        {personalInfo?.showPhoto && personalInfo?.photo && (
          <div className="flex justify-center mb-4">
            <PhotoFrame
              personalInfo={personalInfo}
              size={96}
              borderColor="#334155"
              borderWidth="2px"
              shadow="0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)"
            />
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-wider uppercase text-slate-900">
          {personalInfo?.fullName || 'YOUR NAME'}
        </h1>
        <p className="font-sans text-sm tracking-widest uppercase font-semibold text-slate-600 mt-1">
          {personalInfo?.title || 'Professional Title'}
        </p>

        <div className="font-sans flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-3">
          {personalInfo?.location && <span>{personalInfo.location}</span>}
          {personalInfo?.phone && (
            <>
              <span>✦</span>
              <span>{personalInfo.phone}</span>
            </>
          )}
          {personalInfo?.email && (
            <>
              <span>✦</span>
              <span>{personalInfo.email}</span>
            </>
          )}
          {personalInfo?.relocation && (
            <>
              <span>✦</span>
              <span className="font-semibold text-slate-900">{personalInfo.relocation}</span>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="mb-6">
          <h2 className="text-xs font-sans font-bold tracking-widest uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">
            Executive Summary
          </h2>
          <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed text-justify font-sans">
            {summary}
          </p>
        </div>
      )}

      {/* Skills Grid */}
      {skills && skills.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-sans font-bold tracking-widest uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">
            Areas of Expertise
          </h2>
          <div className="font-sans grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {skills.map((s, idx) => (
              <div key={s.id || idx} className="border-l-2 border-slate-400 pl-2.5 py-0.5">
                <span className="font-bold text-slate-900">{s.category}: </span>
                <span className="text-slate-700">{s.items}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experience */}
      {experience && experience.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-sans font-bold tracking-widest uppercase text-slate-900 border-b border-slate-200 pb-1 mb-3">
            Career Chronology
          </h2>
          <div className="space-y-4">
            {experience.map((exp, idx) => (
              <div key={exp.id || idx}>
                <div className="flex justify-between items-baseline">
                  <h3 className="font-bold text-sm text-slate-900">{exp.role}</h3>
                  <span className="font-sans text-xs italic text-slate-600">{exp.period}</span>
                </div>
                <p className="font-sans text-xs font-semibold text-slate-700">{exp.company}</p>
                {exp.product && (
                  <p className="font-sans text-xs italic text-slate-600 mt-0.5">{exp.product}</p>
                )}
                {exp.highlights && (
                  <ul className="font-sans list-disc pl-5 mt-1.5 space-y-1 text-xs text-slate-700 leading-relaxed">
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

      {/* Education & Languages */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {education && education.length > 0 && (
          <div>
            <h2 className="text-xs font-sans font-bold tracking-widest uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">
              Academic History
            </h2>
            <div className="font-sans space-y-2 text-xs">
              {education.map((edu, idx) => (
                <div key={edu.id || idx}>
                  <p className="font-bold text-slate-900">{edu.school}</p>
                  <p className="text-slate-600">{edu.degree} {edu.score && `• ${edu.score}`}</p>
                  {edu.year && <p className="text-slate-500 text-[11px]">{edu.year}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {languages && languages.length > 0 && (
          <div>
            <h2 className="text-xs font-sans font-bold tracking-widest uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">
              Linguistic Fluency
            </h2>
            <div className="font-sans space-y-1.5 text-xs">
              {languages.map((l, idx) => (
                <div key={l.id || idx} className="flex justify-between text-slate-700">
                  <span className="font-semibold text-slate-900">{l.name}</span>
                  <span className="italic">{l.proficiency}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Certifications */}
      {certifications && certifications.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xs font-sans font-bold tracking-widest uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">
            Professional Certifications
          </h2>
          <div className="font-sans grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {certifications.map((c, idx) => (
              <div key={c.id || idx} className="border-l-2 border-slate-400 pl-2.5 py-0.5">
                <span className="font-bold text-slate-900">{c.name}</span>
                {c.issuer && <span className="text-slate-600"> – {c.issuer}</span>}
                {c.year && <span className="text-slate-500"> ({c.year})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <ExtraSections
        projects={projects}
        customSections={customSections}
        className="mt-6"
        renderHeading={(label) => (
          <h2 className="text-xs font-sans font-bold tracking-widest uppercase text-slate-900 border-b border-slate-200 pb-1 mb-2">
            {label}
          </h2>
        )}
      />
    </div>
  );
}
