import React from 'react';
import { Mail, Phone, MapPin, Briefcase, Award } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from '../ui/Icons';
import PhotoFrame from './PhotoFrame';
import ExtraSections from './ExtraSections';

export default function ModernTemplate({ data, theme }) {
  const { personalInfo, summary, skills, experience, education, languages, certifications, projects, customSections } = data;
  const primaryColor = theme?.primaryColor || '#0f766e';
  const secondaryColor = theme?.secondaryColor || '#0d9488';

  return (
    <div
      className="flex min-h-[297mm] font-sans bg-white text-gray-800"
      style={{
        fontFamily: theme?.fontFamily || "'Inter', system-ui, sans-serif",
      }}
    >
      {/* LEFT SIDEBAR */}
      <div
        className="w-[34%] p-6 text-white flex flex-col justify-between"
        style={{
          background: `linear-gradient(180deg, ${primaryColor} 0%, #0f172a 100%)`,
        }}
      >
        <div>
          {/* Photo */}
          <div className="flex justify-center mb-6">
            <PhotoFrame
              personalInfo={personalInfo}
              size={120}
              borderColor="rgba(255,255,255,0.2)"
              borderWidth="4px"
              shadow="0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)"
            />
          </div>

          {/* Contact Details */}
          <div className="space-y-3 text-xs mb-8">
            <h3 className="text-[11px] font-bold tracking-widest text-teal-200 uppercase border-b border-white/20 pb-1.5 mb-3">
              Contact
            </h3>

            {personalInfo?.email && (
              <a
                href={`mailto:${personalInfo.email}`}
                className="flex items-center gap-2.5 text-white/90 hover:text-white transition-colors"
              >
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <Mail size={12} className="text-teal-200" />
                </div>
                <span className="truncate">{personalInfo.email}</span>
              </a>
            )}

            {personalInfo?.phone && (
              <a
                href={`tel:${personalInfo.phone}`}
                className="flex items-center gap-2.5 text-white/90 hover:text-white transition-colors"
              >
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <Phone size={12} className="text-teal-200" />
                </div>
                <span>{personalInfo.phone}</span>
              </a>
            )}

            {personalInfo?.location && (
              <div className="flex items-center gap-2.5 text-white/90">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <MapPin size={12} className="text-teal-200" />
                </div>
                <span>{personalInfo.location}</span>
              </div>
            )}

            {personalInfo?.linkedin && (
              <div className="flex items-center gap-2.5 text-white/90">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <LinkedinIcon size={12} className="text-teal-200" />
                </div>
                <span className="truncate">{personalInfo.linkedin}</span>
              </div>
            )}

            {personalInfo?.github && (
              <div className="flex items-center gap-2.5 text-white/90">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center shrink-0">
                  <GithubIcon size={12} className="text-teal-200" />
                </div>
                <span className="truncate">{personalInfo.github}</span>
              </div>
            )}

            {personalInfo?.relocation && (
              <div className="mt-3 inline-block bg-teal-400/20 text-teal-200 border border-teal-300/30 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                ✈️ {personalInfo.relocation}
              </div>
            )}
          </div>

          {/* Skills Badges */}
          {skills && skills.length > 0 && (
            <div className="mb-8">
              <h3 className="text-[11px] font-bold tracking-widest text-teal-200 uppercase border-b border-white/20 pb-1.5 mb-3">
                Key Skills
              </h3>
              <div className="space-y-3">
                {skills.map((skill, idx) => (
                  <div key={skill.id || idx}>
                    <p className="text-[11px] font-semibold text-teal-300 mb-1">
                      {skill.category}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {skill.items.split(/[,|]/).map((item, i) => (
                        <span
                          key={i}
                          className="text-[10.5px] bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded text-white/90"
                        >
                          {item.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education in sidebar */}
          {education && education.length > 0 && (
            <div className="mb-6">
              <h3 className="text-[11px] font-bold tracking-widest text-teal-200 uppercase border-b border-white/20 pb-1.5 mb-3">
                Education
              </h3>
              <div className="space-y-3">
                {education.map((edu, idx) => (
                  <div key={edu.id || idx} className="text-xs">
                    <p className="font-semibold text-white leading-tight">{edu.degree}</p>
                    <p className="text-white/80 text-[11px] mt-0.5">{edu.school}</p>
                    <div className="flex justify-between text-[10px] text-teal-200 mt-0.5">
                      <span>{edu.score}</span>
                      <span>{edu.year}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {languages && languages.length > 0 && (
            <div>
              <h3 className="text-[11px] font-bold tracking-widest text-teal-200 uppercase border-b border-white/20 pb-1.5 mb-3">
                Languages
              </h3>
              <div className="space-y-1.5 text-xs">
                {languages.map((lang, idx) => (
                  <div key={lang.id || idx} className="flex justify-between items-center">
                    <span className="text-white font-medium">{lang.name}</span>
                    <span className="text-[10px] text-teal-300 bg-white/10 px-1.5 py-0.5 rounded">
                      {lang.proficiency || 'Proficient'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT MAIN CONTENT */}
      <div className="w-[66%] p-8 flex flex-col justify-between">
        <div>
          {/* Header Title */}
          <div className="border-b pb-4 mb-6">
            <h1
              className="text-3xl font-extrabold tracking-tight uppercase"
              style={{ color: primaryColor }}
            >
              {personalInfo?.fullName || 'YOUR NAME'}
            </h1>
            <p className="text-base font-semibold text-gray-600 mt-1">
              {personalInfo?.title || 'Professional Title'}
            </p>
          </div>

          {/* Professional Summary */}
          {summary && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase size={16} style={{ color: primaryColor }} />
                <h2
                  className="font-bold text-xs uppercase tracking-wider"
                  style={{ color: primaryColor }}
                >
                  Executive Profile
                </h2>
              </div>
              <p className="text-xs sm:text-[13px] text-gray-700 leading-relaxed text-justify bg-slate-50 p-3 rounded-lg border border-slate-100">
                {summary}
              </p>
            </div>
          )}

          {/* Experience Timeline */}
          {experience && experience.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase size={16} style={{ color: primaryColor }} />
                <h2
                  className="font-bold text-xs uppercase tracking-wider"
                  style={{ color: primaryColor }}
                >
                  Professional Experience
                </h2>
              </div>

              <div className="space-y-5 border-l-2 pl-4 ml-2" style={{ borderColor: `${primaryColor}40` }}>
                {experience.map((exp, idx) => (
                  <div key={exp.id || idx} className="relative">
                    {/* Timeline dot */}
                    <span
                      className="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: primaryColor }}
                    />

                    <div className="flex flex-wrap justify-between items-baseline">
                      <h3 className="font-bold text-sm text-gray-900">{exp.role}</h3>
                      {exp.period && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {exp.period}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold" style={{ color: secondaryColor }}>
                      {exp.company}
                    </p>

                    {exp.product && (
                      <p className="text-[11px] text-gray-600 italic mt-0.5 mb-2 font-medium">
                        {exp.product}
                      </p>
                    )}

                    {exp.highlights && exp.highlights.length > 0 && (
                      <ul className="list-disc list-outside pl-3.5 space-y-1 text-xs text-gray-700 leading-relaxed mt-2">
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

          {/* Certifications */}
          {certifications && certifications.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award size={16} style={{ color: primaryColor }} />
                <h2
                  className="font-bold text-xs uppercase tracking-wider"
                  style={{ color: primaryColor }}
                >
                  Certifications & Honors
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {certifications.map((cert, idx) => (
                  <div key={cert.id || idx} className="p-2.5 rounded-md border border-gray-200 bg-gray-50/50">
                    <p className="font-semibold text-gray-900">{cert.name}</p>
                    <p className="text-gray-500 text-[11px]">{cert.issuer} {cert.year && `• ${cert.year}`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ExtraSections
            projects={projects}
            customSections={customSections}
            className={certifications?.length ? 'mt-6' : ''}
            renderHeading={(label) => (
              <div className="flex items-center gap-2 mb-2">
                <Award size={16} style={{ color: primaryColor }} />
                <h2
                  className="font-bold text-xs uppercase tracking-wider"
                  style={{ color: primaryColor }}
                >
                  {label}
                </h2>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
