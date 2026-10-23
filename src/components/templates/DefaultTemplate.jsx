import React from 'react';
import { LinkedinIcon, GithubIcon } from '../ui/Icons';
import PhotoFrame from './PhotoFrame';
import ExtraSections from './ExtraSections';

export default function DefaultTemplate({ data, theme }) {
  const { personalInfo, summary, skills, experience, education, languages, certifications, projects, customSections } = data;
  const primaryColor = theme?.primaryColor || '#3E5566';
  const secondaryColor = theme?.secondaryColor || '#56707F';

  // Single-page fit: active when theme.singlePage is not false or density is compact
  const isSinglePage = theme?.singlePage !== false;
  const isCompact = isSinglePage || theme?.fontSize === 'compact';

  return (
    <div
      className={`font-sans text-gray-800 bg-white transition-all ${
        isCompact ? 'px-8 py-5 leading-normal' : 'p-8 sm:p-10 leading-relaxed'
      }`}
      style={{
        fontFamily: theme?.fontFamily || "'Calibri', 'Candara', 'Segoe UI', system-ui, sans-serif",
        fontSize: isCompact ? '12px' : theme?.fontSize === 'relaxed' ? '14px' : '13px',
      }}
    >
      {/* Header Table / Grid: Exact replica of the original docx */}
      <div className={`flex items-center gap-5 ${isCompact ? 'pb-2.5' : 'pb-4'}`}>
        <PhotoFrame personalInfo={personalInfo} size={isCompact ? 96 : 115} />

        <div className="flex-1 min-w-0">
          <h1
            className={`${isCompact ? 'text-2xl' : 'text-2xl sm:text-3xl'} font-bold tracking-tight uppercase`}
            style={{ color: primaryColor }}
          >
            {personalInfo?.fullName || 'YOUR NAME'}
          </h1>
          <p
            className={`${isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'} font-semibold mt-0.5`}
            style={{ color: secondaryColor }}
          >
            {personalInfo?.title || 'Professional Title'}
          </p>

          <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-700 ${isCompact ? 'mt-1' : 'mt-2'}`}>
            {personalInfo?.location && <span>{personalInfo.location}</span>}
            {personalInfo?.location && personalInfo?.phone && <span className="text-gray-400">|</span>}
            {personalInfo?.phone && (
              <a href={`tel:${personalInfo.phone}`} className="hover:underline text-gray-700">
                {personalInfo.phone}
              </a>
            )}
            {personalInfo?.phone && personalInfo?.email && <span className="text-gray-400">|</span>}
            {personalInfo?.email && (
              <a href={`mailto:${personalInfo.email}`} className="hover:underline text-gray-700">
                {personalInfo.email}
              </a>
            )}
          </div>

          <div className={`flex flex-wrap items-center gap-2 ${isCompact ? 'mt-1' : 'mt-2'}`}>
            {personalInfo?.relocation && (
              <span
                className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded"
                style={{
                  color: primaryColor,
                  backgroundColor: `${secondaryColor}15`,
                  border: `1px solid ${secondaryColor}40`,
                }}
              >
                {personalInfo.relocation}
              </span>
            )}
            {personalInfo?.linkedin && (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <LinkedinIcon size={12} className="inline text-gray-500" />
                {personalInfo.linkedin}
              </span>
            )}
            {personalInfo?.github && (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <GithubIcon size={12} className="inline text-gray-500" />
                {personalInfo.github}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      {summary && (
        <div className={isCompact ? 'mt-2.5' : 'mt-4'}>
          <h2
            className="font-bold text-xs sm:text-sm uppercase tracking-wider pb-0.5"
            style={{
              color: primaryColor,
              borderBottom: `1.5px solid ${secondaryColor}`,
            }}
          >
            SUMMARY
          </h2>
          <p className={`text-justify text-gray-800 ${isCompact ? 'mt-1 leading-normal' : 'mt-2 leading-relaxed'}`}>
            {summary}
          </p>
        </div>
      )}

      {/* TECHNICAL SKILLS */}
      {skills && skills.length > 0 && (
        <div className={isCompact ? 'mt-2.5' : 'mt-4'}>
          <h2
            className="font-bold text-xs sm:text-sm uppercase tracking-wider pb-0.5"
            style={{
              color: primaryColor,
              borderBottom: `1.5px solid ${secondaryColor}`,
            }}
          >
            TECHNICAL SKILLS
          </h2>
          <div className={`space-y-0.5 ${isCompact ? 'mt-1' : 'mt-2'}`}>
            {skills.map((skill, index) => (
              <p key={skill.id || index} className="leading-snug">
                <strong className="font-semibold text-gray-900">{skill.category}: </strong>
                <span className="text-gray-800">{skill.items}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* EXPERIENCE */}
      {experience && experience.length > 0 && (
        <div className={isCompact ? 'mt-2.5' : 'mt-4'}>
          <h2
            className="font-bold text-xs sm:text-sm uppercase tracking-wider pb-0.5"
            style={{
              color: primaryColor,
              borderBottom: `1.5px solid ${secondaryColor}`,
            }}
          >
            EXPERIENCE
          </h2>
          <div className={isCompact ? 'space-y-2 mt-1' : 'space-y-3 mt-2'}>
            {experience.map((exp, index) => (
              <div key={exp.id || index}>
                <div className="flex flex-wrap items-baseline justify-between">
                  <h3 className="font-bold text-xs sm:text-sm" style={{ color: primaryColor }}>
                    {exp.role} {exp.company && <span className="font-medium text-gray-700">| {exp.company}</span>}
                  </h3>
                  {exp.period && (
                    <span className="text-xs italic font-medium" style={{ color: secondaryColor }}>
                      {exp.period}
                    </span>
                  )}
                </div>

                {exp.product && (
                  <p className="text-xs text-gray-700 italic mt-0.5 mb-1 font-medium">
                    {exp.product}
                  </p>
                )}

                {exp.highlights && exp.highlights.length > 0 && (
                  <ul className={`list-disc list-outside pl-4 text-xs ${isCompact ? 'space-y-0.5 leading-normal mt-0.5' : 'space-y-1 leading-relaxed mt-1.5'}`}>
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
        <div className={isCompact ? 'mt-2.5' : 'mt-4'}>
          <h2
            className="font-bold text-xs sm:text-sm uppercase tracking-wider pb-0.5"
            style={{
              color: primaryColor,
              borderBottom: `1.5px solid ${secondaryColor}`,
            }}
          >
            EDUCATION
          </h2>
          <div className={isCompact ? 'space-y-1 mt-1' : 'space-y-2 mt-2'}>
            {education.map((edu, index) => (
              <div key={edu.id || index} className="leading-snug">
                <div className="flex flex-wrap justify-between items-baseline">
                  <h4 className="font-semibold text-gray-900 text-xs">
                    {edu.school}
                  </h4>
                  {edu.year && <span className="text-xs text-gray-600">{edu.year}</span>}
                </div>
                <p className="text-xs text-gray-700">
                  {edu.degree}
                  {edu.score && <span className="font-medium text-gray-800"> – {edu.score}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LANGUAGES */}
      {languages && languages.length > 0 && (
        <div className={isCompact ? 'mt-2.5' : 'mt-4'}>
          <h2
            className="font-bold text-xs sm:text-sm uppercase tracking-wider pb-0.5"
            style={{
              color: primaryColor,
              borderBottom: `1.5px solid ${secondaryColor}`,
            }}
          >
            LANGUAGES
          </h2>
          <div className={`${isCompact ? 'mt-1' : 'mt-2'} flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-800`}>
            {languages.map((lang, index) => (
              <span key={lang.id || index} className="inline-flex items-center gap-1">
                <span className="font-medium text-gray-900">{lang.name}</span>
                {lang.proficiency && <span className="text-gray-500">({lang.proficiency})</span>}
                {index < languages.length - 1 && <span className="text-gray-300 ml-2">•</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CERTIFICATIONS (if any) */}
      {certifications && certifications.length > 0 && (
        <div className={isCompact ? 'mt-2.5' : 'mt-4'}>
          <h2
            className="font-bold text-xs sm:text-sm uppercase tracking-wider pb-0.5"
            style={{
              color: primaryColor,
              borderBottom: `1.5px solid ${secondaryColor}`,
            }}
          >
            CERTIFICATIONS
          </h2>
          <div className={`${isCompact ? 'space-y-0.5 mt-1' : 'space-y-1 mt-2'} text-xs`}>
            {certifications.map((cert, index) => (
              <p key={cert.id || index} className="leading-snug">
                <span className="font-semibold text-gray-900">{cert.name}</span>
                {cert.issuer && <span className="text-gray-700"> – {cert.issuer}</span>}
                {cert.year && <span className="text-gray-500"> ({cert.year})</span>}
              </p>
            ))}
          </div>
        </div>
      )}

      <ExtraSections
        projects={projects}
        customSections={customSections}
        className={isCompact ? 'mt-2.5' : 'mt-4'}
        renderHeading={(label) => (
          <h2
            className="font-bold text-xs sm:text-sm uppercase tracking-wider pb-0.5 mb-1"
            style={{
              color: primaryColor,
              borderBottom: `1.5px solid ${secondaryColor}`,
            }}
          >
            {label.toUpperCase()}
          </h2>
        )}
      />
    </div>
  );
}
