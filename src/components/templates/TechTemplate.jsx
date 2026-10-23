import React from 'react';
import { LinkedinIcon, GithubIcon } from '../ui/Icons';
import PhotoFrame from './PhotoFrame';
import ExtraSections from './ExtraSections';
import { safeResume } from './templateData';

/**
 * TechTemplate — "Developer Console".
 *
 * Deliberately NOT a recolour of the other templates: it is a two-column
 * console layout with a fixed left rail (stack / certs / languages) and a
 * wider main column (summary / experience / education / projects).
 * Section labels are monospace with a `// ` prefix, body text uses the
 * theme font, so it reads like a terminal without sacrificing legibility.
 *
 * Every list is guarded with Array.isArray, and every section renders
 * nothing when empty — hostile input (missing keys, empty arrays, no photo,
 * a 60-character job title) must not throw or blow out the layout.
 */

const MONO =
  "'ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace";

export default function TechTemplate({ data, theme }) {
  const {
    personalInfo,
    summary,
    skills,
    experience,
    education,
    languages,
    certifications,
    projects,
    customSections,
  } = safeResume(data);

  const primaryColor = theme?.primaryColor || '#0f766e';
  const secondaryColor = theme?.secondaryColor || '#334155';
  const isSinglePage = theme?.singlePage !== false;
  const dense = isSinglePage || theme?.fontSize === 'compact';

  // Hostile input: arrays can contain null holes, so every list drops them.
  const list = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);
  const skillList = list(skills);
  const experienceList = list(experience);
  const educationList = list(education);
  const languageList = list(languages);
  const certificationList = list(certifications);
  const projectList = list(projects);
  const customSectionList = list(customSections);

  const gap = dense ? 'mt-3' : 'mt-4';
  const body = dense ? 'text-[11px] leading-snug' : 'text-xs leading-relaxed';

  const Label = ({ children }) => (
    <h2
      className="font-semibold uppercase pb-1 mb-1.5 border-b"
      style={{
        fontFamily: MONO,
        color: primaryColor,
        borderColor: `${secondaryColor}55`,
        fontSize: dense ? '9.5px' : '10.5px',
        letterSpacing: '0.08em',
      }}
    >
      <span style={{ opacity: 0.55 }}>// </span>
      {children}
    </h2>
  );

  return (
    <div
      className={`bg-white text-gray-800 ${dense ? 'px-7 py-5' : 'p-8 sm:p-9'}`}
      style={{
        fontFamily:
          theme?.fontFamily || "'Calibri', 'Candara', 'Segoe UI', system-ui, sans-serif",
        fontSize: dense ? '11.5px' : '12.5px',
      }}
    >
      {/* ── Console header ───────────────────────────────────────────── */}
      <div className="flex items-start gap-4 pb-3 border-b-2" style={{ borderColor: primaryColor }}>
        <PhotoFrame personalInfo={personalInfo} size={dense ? 74 : 88} borderColor={primaryColor} />
        <div className="flex-1 min-w-0">
          <h1
            className={`font-bold tracking-tight break-words ${dense ? 'text-xl' : 'text-2xl'}`}
            style={{ color: primaryColor }}
          >
            {personalInfo?.fullName || 'YOUR NAME'}
          </h1>
          {personalInfo?.title && (
            <p
              className={`mt-0.5 break-words font-medium ${dense ? 'text-[11px]' : 'text-xs'}`}
              style={{ fontFamily: MONO, color: secondaryColor }}
            >
              {personalInfo.title}
            </p>
          )}

          <div
            className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-gray-600 break-all"
            style={{ fontFamily: MONO }}
          >
            {personalInfo?.location && <span>{personalInfo.location}</span>}
            {personalInfo?.email && (
              <a href={`mailto:${personalInfo.email}`} className="hover:underline">
                {personalInfo.email}
              </a>
            )}
            {personalInfo?.phone && (
              <a href={`tel:${personalInfo.phone}`} className="hover:underline">
                {personalInfo.phone}
              </a>
            )}
            {personalInfo?.linkedin && (
              <span className="inline-flex items-center gap-1">
                <LinkedinIcon size={10} />
                {personalInfo.linkedin}
              </span>
            )}
            {personalInfo?.github && (
              <span className="inline-flex items-center gap-1">
                <GithubIcon size={10} />
                {personalInfo.github}
              </span>
            )}
            {personalInfo?.relocation && (
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${secondaryColor}18`, color: secondaryColor }}
              >
                {personalInfo.relocation}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Rail + main column ───────────────────────────────────────── */}
      <div className="flex gap-5 items-start mt-3">
        {/* LEFT RAIL */}
        <aside className="w-[30%] shrink-0 space-y-3">
          {skillList.length > 0 && (
            <section>
              <Label>STACK</Label>
              <div className="space-y-1.5">
                {skillList.map((skill, i) => (
                  <div key={skill.id || i} className="break-words">
                    {skill.category && (
                      <div
                        className="font-semibold text-gray-900 uppercase"
                        style={{
                          fontFamily: MONO,
                          fontSize: dense ? '8.5px' : '9.5px',
                          letterSpacing: '0.06em',
                          color: primaryColor,
                        }}
                      >
                        {skill.category}
                      </div>
                    )}
                    <div className={`text-gray-700 ${body}`}>{skill.items}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {certificationList.length > 0 && (
            <section>
              <Label>CERTS</Label>
              <ul className="space-y-1">
                {certificationList.map((cert, i) => (
                  <li key={cert.id || i} className={`break-words ${body}`}>
                    <span className="font-semibold text-gray-900">{cert.name}</span>
                    {cert.issuer && <span className="text-gray-600"> — {cert.issuer}</span>}
                    {cert.year && (
                      <span className="text-gray-500" style={{ fontFamily: MONO }}>
                        {' '}
                        [{cert.year}]
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {languageList.length > 0 && (
            <section>
              <Label>LANGS</Label>
              <ul className="space-y-0.5">
                {languageList.map((lang, i) => (
                  <li key={lang.id || i} className={`flex flex-wrap gap-x-1 ${body}`}>
                    <span className="font-medium text-gray-900">{lang.name}</span>
                    {lang.proficiency && (
                      <span className="text-gray-500">({lang.proficiency})</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        {/* MAIN COLUMN */}
        <main className="flex-1 min-w-0">
          {summary && (
            <section>
              <Label>SUMMARY</Label>
              <p className={`text-justify text-gray-800 break-words ${body}`}>{summary}</p>
            </section>
          )}

          {experienceList.length > 0 && (
            <section className={summary ? gap : ''}>
              <Label>EXPERIENCE</Label>
              <div className="space-y-2.5">
                {experienceList.map((exp, i) => (
                  <div key={exp.id || i} className="break-words">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <h3
                        className={`font-bold break-words min-w-0 ${dense ? 'text-[11.5px]' : 'text-xs'}`}
                        style={{ color: primaryColor }}
                      >
                        {exp.role}
                      </h3>
                      {exp.period && (
                        <span
                          className="text-[10px] shrink-0 text-gray-500"
                          style={{ fontFamily: MONO }}
                        >
                          {exp.period}
                        </span>
                      )}
                    </div>
                    {exp.company && (
                      <p
                        className="text-[10.5px] font-medium text-gray-600 break-words"
                        style={{ fontFamily: MONO }}
                      >
                        @ {exp.company}
                      </p>
                    )}
                    {exp.product && (
                      <p className={`italic text-gray-600 ${body}`}>{exp.product}</p>
                    )}
                    {Array.isArray(exp.highlights) && exp.highlights.length > 0 && (
                      <ul className={`mt-0.5 space-y-0.5 pl-3.5 list-disc list-outside ${body}`}>
                        {exp.highlights.map((item, h) => (
                          <li key={h} className="break-words">
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {educationList.length > 0 && (
            <section className={(summary || experienceList.length > 0) ? gap : ''}>
              <Label>EDUCATION</Label>
              <div className="space-y-1">
                {educationList.map((edu, i) => (
                  <div key={edu.id || i} className="break-words">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="font-semibold text-gray-900 text-[11px] break-words min-w-0">
                        {edu.school}
                      </span>
                      {edu.year && (
                        <span
                          className="text-[10px] shrink-0 text-gray-500"
                          style={{ fontFamily: MONO }}
                        >
                          {edu.year}
                        </span>
                      )}
                    </div>
                    <p className={`text-gray-700 ${body}`}>
                      {edu.degree}
                      {edu.score && <span className="text-gray-600"> · {edu.score}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <ExtraSections
            projects={projectList}
            customSections={customSectionList}
            dense={dense}
            className={gap}
            renderHeading={(label) => <Label>{label}</Label>}
          />
        </main>
      </div>
    </div>
  );
}
