import React from 'react';
import { LinkedinIcon, GithubIcon } from '../ui/Icons';
import PhotoFrame from './PhotoFrame';
import ExtraSections from './ExtraSections';
import { safeResume } from './templateData';

/**
 * StartupTemplate — "Startup One-Pager".
 *
 * The layout difference is the header: a full-bleed band in the primary
 * colour, split into two columns — identity on the left, contact block
 * right-aligned — with a large name and an accent underline beneath it.
 * The body below is a compact single column with pill-style skills, tuned
 * for density without looking cramped.
 *
 * Guards: every list goes through Array.isArray, empty sections render
 * nothing, long titles/company names wrap rather than overflow, and a
 * missing photo simply omits the frame.
 */

export default function StartupTemplate({ data, theme }) {
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

  const primaryColor = theme?.primaryColor || '#ea580c';
  const secondaryColor = theme?.secondaryColor || '#1f2937';
  const accentColor = theme?.accentColor || primaryColor;
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

  const Heading = ({ children }) => (
    <h2
      className="font-extrabold uppercase pb-1 mb-1.5"
      style={{
        color: secondaryColor,
        fontSize: dense ? '9.5px' : '10.5px',
        letterSpacing: '0.14em',
        borderBottom: `2px solid ${primaryColor}`,
      }}
    >
      {children}
    </h2>
  );

  // Split skills into individual pills: one category with many comma-separated
  // items becomes many pills, which is what "pill-style skills" means here.
  const skillPills = skillList.flatMap((skill, i) => {
    const items = typeof skill?.items === 'string'
      ? skill.items.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (items.length === 0 && skill?.category) {
      return [{ key: skill.id || `s-${i}`, label: skill.category }];
    }
    return items.map((label, j) => ({ key: `${skill?.id || i}-${j}`, label }));
  });

  return (
    <div
      className="bg-white text-gray-800"
      style={{
        fontFamily:
          theme?.fontFamily || "'Calibri', 'Candara', 'Segoe UI', system-ui, sans-serif",
        fontSize: dense ? '11.5px' : '12.5px',
      }}
    >
      {/* ── Two-column header band ────────────────────────────────────── */}
      <header
        className={`flex items-start justify-between gap-4 ${dense ? 'px-7 py-4' : 'px-9 py-5'}`}
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <PhotoFrame
            personalInfo={personalInfo}
            size={dense ? 68 : 80}
            borderColor="#ffffff"
            borderWidth="2px"
          />
          <div className="min-w-0">
            <h1
              className={`font-black leading-none text-white break-words ${
                dense ? 'text-2xl' : 'text-3xl'
              }`}
              style={{ letterSpacing: '-0.01em' }}
            >
              {personalInfo?.fullName || 'YOUR NAME'}
            </h1>
            {personalInfo?.title && (
              <p
                className={`mt-1 font-semibold break-words ${dense ? 'text-[11px]' : 'text-xs'}`}
                style={{ color: '#ffffff', opacity: 0.92 }}
              >
                {personalInfo.title}
              </p>
            )}
            {/* accent underline */}
            <div
              className="mt-1.5 h-[3px] w-14 rounded-full"
              style={{ backgroundColor: '#ffffff', opacity: 0.55 }}
            />
          </div>
        </div>

        <div
          className={`text-right shrink-0 space-y-0.5 max-w-[42%] ${
            dense ? 'text-[10px]' : 'text-[10.5px]'
          }`}
          style={{ color: '#ffffff', opacity: 0.95 }}
        >
          {personalInfo?.location && <p className="break-words">{personalInfo.location}</p>}
          {personalInfo?.email && (
            <p className="break-all">
              <a href={`mailto:${personalInfo.email}`} className="hover:underline">
                {personalInfo.email}
              </a>
            </p>
          )}
          {personalInfo?.phone && (
            <p>
              <a href={`tel:${personalInfo.phone}`} className="hover:underline">
                {personalInfo.phone}
              </a>
            </p>
          )}
          {personalInfo?.linkedin && (
            <p className="inline-flex items-center gap-1 break-all justify-end">
              <LinkedinIcon size={10} />
              {personalInfo.linkedin}
            </p>
          )}
          {personalInfo?.github && (
            <p className="inline-flex items-center gap-1 break-all justify-end">
              <GithubIcon size={10} />
              {personalInfo.github}
            </p>
          )}
          {personalInfo?.relocation && (
            <p className="pt-0.5 text-[9.5px] font-semibold uppercase tracking-wide">
              {personalInfo.relocation}
            </p>
          )}
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className={`${dense ? 'px-7 py-4' : 'px-9 py-5'}`}>
        {summary && (
          <section>
            <Heading>Profile</Heading>
            <p className={`text-gray-800 break-words ${body}`}>{summary}</p>
          </section>
        )}

        {skillPills.length > 0 && (
          <section className={summary ? gap : ''}>
            <Heading>Skills</Heading>
            <div className="flex flex-wrap gap-1">
              {skillPills.map((pill) => (
                <span
                  key={pill.key}
                  className="rounded-full px-2 py-[1px] font-medium text-gray-800 break-words"
                  style={{
                    fontSize: dense ? '9.5px' : '10px',
                    backgroundColor: `${primaryColor}14`,
                    border: `1px solid ${primaryColor}40`,
                  }}
                >
                  {pill.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {experienceList.length > 0 && (
          <section className={summary || skillPills.length > 0 ? gap : ''}>
            <Heading>Experience</Heading>
            <div className="space-y-2">
              {experienceList.map((exp, i) => (
                <div key={exp.id || i} className="break-words">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <h3
                      className={`font-bold break-words min-w-0 ${dense ? 'text-[11.5px]' : 'text-xs'}`}
                      style={{ color: secondaryColor }}
                    >
                      {exp.role}
                      {exp.company && (
                        <span className="font-medium text-gray-600"> · {exp.company}</span>
                      )}
                    </h3>
                    {exp.period && (
                      <span
                        className="text-[9.5px] font-semibold uppercase tracking-wide shrink-0 px-1.5 py-[1px] rounded"
                        style={{
                          color: primaryColor,
                          backgroundColor: `${primaryColor}14`,
                        }}
                      >
                        {exp.period}
                      </span>
                    )}
                  </div>
                  {exp.product && (
                    <p className={`italic text-gray-600 ${body}`}>{exp.product}</p>
                  )}
                  {Array.isArray(exp.highlights) && exp.highlights.length > 0 && (
                    <ul className={`mt-0.5 pl-3.5 list-disc list-outside ${body}`}>
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

        {/* Education + Certifications share one row to save vertical space. */}
        {(educationList.length > 0 || certificationList.length > 0) && (
          <div
            className={`${gap} grid gap-x-5`}
            style={{
              gridTemplateColumns:
                educationList.length > 0 && certificationList.length > 0 ? '1fr 1fr' : '1fr',
            }}
          >
            {educationList.length > 0 && (
              <section>
                <Heading>Education</Heading>
                <div className="space-y-1">
                  {educationList.map((edu, i) => (
                    <div key={edu.id || i} className="break-words">
                      <p className="font-semibold text-gray-900 text-[11px]">{edu.school}</p>
                      <p className={`text-gray-700 ${body}`}>
                        {edu.degree}
                        {edu.score && <span className="text-gray-600"> · {edu.score}</span>}
                      </p>
                      {edu.year && <p className="text-[9.5px] text-gray-500">{edu.year}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {certificationList.length > 0 && (
              <section>
                <Heading>Certifications</Heading>
                <ul className="space-y-0.5">
                  {certificationList.map((cert, i) => (
                    <li key={cert.id || i} className={`break-words ${body}`}>
                      <span className="font-semibold text-gray-900">{cert.name}</span>
                      {cert.issuer && <span className="text-gray-600"> — {cert.issuer}</span>}
                      {cert.year && <span className="text-gray-500"> ({cert.year})</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        <ExtraSections
          projects={projectList}
          customSections={customSectionList}
          dense={dense}
          className={gap}
          renderHeading={(label) => <Heading>{label}</Heading>}
        />

        {languageList.length > 0 && (
          <section className={gap}>
            <Heading>Languages</Heading>
            <div className="flex flex-wrap gap-1">
              {languageList.map((lang, i) => (
                <span
                  key={lang.id || i}
                  className="rounded px-1.5 py-[1px] text-gray-800 break-words"
                  style={{
                    fontSize: dense ? '9.5px' : '10px',
                    border: `1px solid ${secondaryColor}30`,
                  }}
                >
                  <span className="font-semibold">{lang.name}</span>
                  {lang.proficiency && (
                    <span className="text-gray-500"> · {lang.proficiency}</span>
                  )}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Accent underline closing the page. */}
      <div className="h-1.5" style={{ backgroundColor: accentColor }} />
    </div>
  );
}
