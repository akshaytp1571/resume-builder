import React from 'react';
import { LinkedinIcon, GithubIcon } from '../ui/Icons';
import PhotoFrame from './PhotoFrame';
import ExtraSections from './ExtraSections';
import { safeResume } from './templateData';

/**
 * AcademicTemplate — "Academic CV".
 *
 * A single dense column, serif throughout, with numbered section headings.
 * Ordering is deliberate: Summary, Education, Experience, Projects,
 * Publications (customSections), Certifications, Languages — the order a
 * research committee expects, education before employment.
 *
 * Line height is generous so a long publications list stays readable even
 * at 10.5px. Every list is Array.isArray-guarded and empty sections vanish.
 */

const SERIF = "'Georgia', 'Cambria', 'Times New Roman', 'Source Serif Pro', serif";

export default function AcademicTemplate({ data, theme }) {
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

  const primaryColor = theme?.primaryColor || '#7c2d12';
  const secondaryColor = theme?.secondaryColor || '#4b5563';
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
  const body = dense ? 'text-[11px] leading-[1.55]' : 'text-xs leading-relaxed';

  const hasProjects = projectList.length > 0;
  const hasCustom = customSectionList.length > 0;

  // Section numbers come from a precomputed ordered list of the labels that
  // will actually render. A lookup beats a running counter here because
  // ExtraSections emits its headings after this component's JSX, so anything
  // order-dependent would number them wrongly.
  const numberedLabels = [];
  if (summary) numberedLabels.push('Summary');
  if (educationList.length > 0) numberedLabels.push('Education');
  if (experienceList.length > 0) numberedLabels.push('Experience');
  if (skillList.length > 0) numberedLabels.push('Skills');
  if (hasProjects) numberedLabels.push('Projects');
  if (hasCustom) {
    for (const section of customSectionList) {
      numberedLabels.push(String(section?.title || 'Section'));
    }
  }
  if (certificationList.length > 0) numberedLabels.push('Certifications');
  if (languageList.length > 0) numberedLabels.push('Languages');

  const numberOf = (label) => {
    const wanted = String(label || '').trim().toLowerCase();
    const idx = numberedLabels.findIndex((l) => l.toLowerCase() === wanted);
    return idx === -1 ? 0 : idx + 1;
  };

  const Heading = ({ children, index }) => (
    <h2
      className="font-bold uppercase tracking-wide pb-0.5 mb-1"
      style={{
        fontFamily: SERIF,
        color: primaryColor,
        borderBottom: `1px solid ${secondaryColor}66`,
        fontSize: dense ? '10px' : '11px',
        letterSpacing: '0.12em',
      }}
    >
      {index > 0 ? <span style={{ opacity: 0.6, marginRight: '0.4em' }}>{index}.</span> : null}
      {children}
    </h2>
  );

  return (
    <div
      className={`bg-white text-gray-800 ${dense ? 'px-8 py-6' : 'p-9 sm:p-11'}`}
      style={{
        fontFamily: theme?.fontFamily ? `${theme.fontFamily}, ${SERIF}` : SERIF,
        fontSize: dense ? '11.5px' : '12.5px',
      }}
    >
      {/* ── Centred academic masthead ─────────────────────────────────── */}
      <header className="text-center pb-2">
        <div className="flex items-center justify-center gap-4">
          <PhotoFrame
            personalInfo={personalInfo}
            size={dense ? 64 : 74}
            shape="circle"
            borderColor={secondaryColor}
            borderWidth="2px"
            shadow=""
          />
          <div className="min-w-0">
            <h1
              className={`font-bold break-words ${dense ? 'text-xl' : 'text-2xl'}`}
              style={{ fontFamily: SERIF, color: primaryColor, letterSpacing: '0.02em' }}
            >
              {personalInfo?.fullName || 'YOUR NAME'}
            </h1>
            {personalInfo?.title && (
              <p className="text-[11px] italic text-gray-700 break-words">{personalInfo.title}</p>
            )}
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10.5px] text-gray-600 break-all">
          {personalInfo?.location && <span>{personalInfo.location}</span>}
          {personalInfo?.email && (
            <>
              <span className="text-gray-400">•</span>
              <a href={`mailto:${personalInfo.email}`} className="hover:underline">
                {personalInfo.email}
              </a>
            </>
          )}
          {personalInfo?.phone && (
            <>
              <span className="text-gray-400">•</span>
              <a href={`tel:${personalInfo.phone}`} className="hover:underline">
                {personalInfo.phone}
              </a>
            </>
          )}
          {personalInfo?.linkedin && (
            <>
              <span className="text-gray-400">•</span>
              <span className="inline-flex items-center gap-1">
                <LinkedinIcon size={10} />
                {personalInfo.linkedin}
              </span>
            </>
          )}
          {personalInfo?.github && (
            <>
              <span className="text-gray-400">•</span>
              <span className="inline-flex items-center gap-1">
                <GithubIcon size={10} />
                {personalInfo.github}
              </span>
            </>
          )}
        </div>
        {personalInfo?.relocation && (
          <p className="mt-0.5 text-[10px] italic text-gray-500">{personalInfo.relocation}</p>
        )}
      </header>

      <div className="border-t" style={{ borderColor: primaryColor }} />

      {/* ── 1. Summary ────────────────────────────────────────────────── */}
      {summary && (
        <section className={gap}>
          <Heading index={numberOf('Summary')}>Summary</Heading>
          <p className={`text-justify text-gray-800 break-words ${body}`}>{summary}</p>
        </section>
      )}

      {/* ── 2. Education ──────────────────────────────────────────────── */}
      {educationList.length > 0 && (
        <section className={gap}>
          <Heading index={numberOf('Education')}>Education</Heading>
          <div className="space-y-1.5">
            {educationList.map((edu, i) => (
              <div key={edu.id || i} className="break-words">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-semibold text-gray-900 text-[11.5px] break-words min-w-0">
                    {edu.school}
                  </span>
                  {edu.year && (
                    <span className="text-[10.5px] shrink-0 italic text-gray-600">{edu.year}</span>
                  )}
                </div>
                <p className={`text-gray-700 ${body}`}>
                  {edu.degree}
                  {edu.score && <span className="text-gray-600"> — {edu.score}</span>}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 3. Experience ─────────────────────────────────────────────── */}
      {experienceList.length > 0 && (
        <section className={gap}>
          <Heading index={numberOf('Experience')}>Experience</Heading>
          <div className="space-y-2.5">
            {experienceList.map((exp, i) => (
              <div key={exp.id || i} className="break-words">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="font-semibold text-gray-900 text-[11.5px] break-words min-w-0">
                    {exp.role}
                  </span>
                  {exp.period && (
                    <span className="text-[10.5px] shrink-0 italic text-gray-600">{exp.period}</span>
                  )}
                </div>
                {exp.company && (
                  <p className="text-[10.5px] italic text-gray-700 break-words">{exp.company}</p>
                )}
                {exp.product && (
                  <p className={`text-gray-600 italic ${body}`}>{exp.product}</p>
                )}
                {Array.isArray(exp.highlights) && exp.highlights.length > 0 && (
                  <ul className={`mt-0.5 pl-4 list-disc list-outside ${body}`}>
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

      {/* ── Skills (unnumbered, folded in before projects) ────────────── */}
      {skillList.length > 0 && (
        <section className={gap}>
          <Heading index={numberOf('Skills')}>Skills</Heading>
          <div className="space-y-0.5">
            {skillList.map((skill, i) => (
              <p key={skill.id || i} className={`break-words ${body}`}>
                {skill.category && (
                  <span className="font-semibold text-gray-900">{skill.category}: </span>
                )}
                <span className="text-gray-700">{skill.items}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {/* ── Projects + Publications (customSections) ──────────────────── */}
      {(hasProjects || hasCustom) && (
        <ExtraSections
          projects={projectList}
          customSections={customSectionList}
          dense={dense}
          className={gap}
          renderHeading={(label) => <Heading index={numberOf(label)}>{label}</Heading>}
        />
      )}

      {/* ── Certifications ────────────────────────────────────────────── */}
      {certificationList.length > 0 && (
        <section className={gap}>
          <Heading index={numberOf('Certifications')}>Certifications</Heading>
          <ul className="space-y-0.5">
            {certificationList.map((cert, i) => (
              <li key={cert.id || i} className={`break-words ${body}`}>
                <span className="font-semibold text-gray-900">{cert.name}</span>
                {cert.issuer && <span className="text-gray-700"> — {cert.issuer}</span>}
                {cert.year && <span className="text-gray-600"> ({cert.year})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Languages ─────────────────────────────────────────────────── */}
      {languageList.length > 0 && (
        <section className={gap}>
          <Heading index={numberOf('Languages')}>Languages</Heading>
          <p className={`text-gray-800 break-words ${body}`}>
            {languageList
              .map((lang) =>
                lang?.proficiency ? `${lang.name || ''} (${lang.proficiency})` : lang?.name || ''
              )
              .filter(Boolean)
              .join(' · ')}
          </p>
        </section>
      )}
    </div>
  );
}
