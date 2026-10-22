import React from 'react';
import { Mail, Phone, MapPin, Sparkles } from 'lucide-react';

export default function CreativeTemplate({ data, theme }) {
  const { personalInfo, summary, skills, experience, education, languages } = data;
  const primaryColor = theme?.primaryColor || '#059669';

  return (
    <div
      className="font-sans text-gray-800 bg-white"
      style={{
        fontFamily: theme?.fontFamily || "'Poppins', sans-serif",
      }}
    >
      {/* Top Emerald Gradient Banner */}
      <div
        className="p-8 text-white relative"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, #064e3b 100%)`,
        }}
      >
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {personalInfo?.showPhoto && personalInfo?.photo && (
            <div
              className={`w-28 h-28 shrink-0 overflow-hidden border-4 border-white shadow-2xl bg-white ${
                personalInfo.photoStyle === 'circle'
                  ? 'rounded-full'
                  : personalInfo.photoStyle === 'rounded'
                  ? 'rounded-2xl'
                  : 'rounded-lg'
              }`}
            >
              <img
                src={personalInfo.photo}
                alt={personalInfo.fullName}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="text-center sm:text-left flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold backdrop-blur-md mb-2">
              <Sparkles size={12} />
              {personalInfo?.relocation || 'Available for Opportunities'}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {personalInfo?.fullName || 'YOUR NAME'}
            </h1>
            <p className="text-emerald-100 font-medium text-sm mt-1">
              {personalInfo?.title || 'Professional Title'}
            </p>

            <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs text-emerald-100 mt-3">
              {personalInfo?.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={13} /> {personalInfo.email}
                </span>
              )}
              {personalInfo?.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone size={13} /> {personalInfo.phone}
                </span>
              )}
              {personalInfo?.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} /> {personalInfo.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="p-8 space-y-6">
        {/* Summary Card */}
        {summary && (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100/80">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
              Professional Synopsis
            </h2>
            <p className="text-xs sm:text-[13px] text-gray-700 leading-relaxed text-justify">
              {summary}
            </p>
          </div>
        )}

        {/* Skills Pills */}
        {skills && skills.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-emerald-500/30 pb-1 mb-3">
              Core Technical Competencies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skills.map((skill, idx) => (
                <div key={skill.id || idx} className="p-3 rounded-lg border border-gray-100 bg-gray-50/70">
                  <p className="text-xs font-bold text-emerald-700 mb-1.5">{skill.category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {skill.items.split(/[,|]/).map((item, i) => (
                      <span
                        key={i}
                        className="text-[11px] bg-white border border-gray-200 text-gray-800 px-2 py-0.5 rounded-full font-medium shadow-2xs"
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

        {/* Experience Cards */}
        {experience && experience.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-emerald-500/30 pb-1 mb-3">
              Career Experience
            </h2>
            <div className="space-y-4">
              {experience.map((exp, idx) => (
                <div key={exp.id || idx} className="p-4 rounded-xl border border-gray-200/80 hover:border-emerald-300 transition-colors">
                  <div className="flex flex-wrap justify-between items-baseline">
                    <h3 className="font-bold text-sm text-gray-900">{exp.role}</h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {exp.period}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-emerald-700 mt-0.5">{exp.company}</p>
                  {exp.product && (
                    <p className="text-xs text-gray-600 italic mt-1 font-medium bg-gray-50 p-2 rounded">
                      {exp.product}
                    </p>
                  )}
                  {exp.highlights && (
                    <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-gray-700 leading-relaxed">
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

        {/* Education & Languages side-by-side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {education && education.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-emerald-500/30 pb-1 mb-3">
                Education
              </h2>
              <div className="space-y-3">
                {education.map((edu, idx) => (
                  <div key={edu.id || idx} className="text-xs">
                    <p className="font-bold text-gray-900">{edu.school}</p>
                    <p className="text-gray-600">{edu.degree}</p>
                    <div className="flex justify-between text-[11px] text-emerald-700 font-medium mt-0.5">
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-emerald-500/30 pb-1 mb-3">
                Languages
              </h2>
              <div className="space-y-2">
                {languages.map((l, idx) => (
                  <div key={l.id || idx} className="flex justify-between items-center text-xs p-2 rounded bg-gray-50 border border-gray-100">
                    <span className="font-semibold text-gray-800">{l.name}</span>
                    <span className="text-emerald-700 font-medium text-[11px]">{l.proficiency}</span>
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
