import React from 'react';

/**
 * Projects + Custom Sections, shared by every template.
 *
 * Both live in the resume data model for every user, but each template used to
 * render neither, so anything typed into those editors vanished on export. One
 * component keeps all six templates consistent and makes the "skip when empty"
 * guard impossible to forget.
 *
 * Props:
 *   projects        [{ name, role, period, link, highlights: [] }]
 *   customSections  [{ title, items: [] }]
 *   renderHeading   (label) => JSX, so each template keeps its own heading style
 *   className       extra wrapper spacing (the template's own section rhythm)
 *   dense           smaller type for the compact layouts
 */
export default function ExtraSections({
  projects,
  customSections,
  renderHeading,
  className = '',
  dense = false,
}) {
  const projectList = Array.isArray(projects) ? projects : [];
  const sectionList = Array.isArray(customSections) ? customSections : [];
  if (projectList.length === 0 && sectionList.length === 0) return null;

  const bodyText = dense ? 'text-[10.5px]' : 'text-xs';
  const metaText = dense ? 'text-[10px]' : 'text-[11px]';
  const heading = typeof renderHeading === 'function' ? renderHeading : (label) => <h2>{label}</h2>;

  return (
    <div className={`${dense ? 'space-y-2' : 'space-y-3'} ${className}`}>
      {projectList.length > 0 && (
        <div>
          {heading('Projects')}
          <div className={dense ? 'space-y-1.5' : 'space-y-2'}>
            {projectList.map((project, idx) => (
              <div key={project.id || idx}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className={`font-semibold text-gray-900 ${bodyText}`}>
                    {project.name}
                    {project.role && (
                      <span className="font-normal text-gray-600"> — {project.role}</span>
                    )}
                  </p>
                  {project.period && (
                    <span className={`italic text-gray-500 ${metaText}`}>{project.period}</span>
                  )}
                </div>
                {project.link && (
                  <a
                    href={/^https?:\/\//i.test(project.link) ? project.link : `https://${project.link}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`${metaText} underline underline-offset-2 break-all`}
                  >
                    {project.link}
                  </a>
                )}
                {Array.isArray(project.highlights) && project.highlights.length > 0 && (
                  <ul className={`list-disc list-outside pl-4 mt-0.5 text-gray-700 ${bodyText}`}>
                    {project.highlights.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sectionList.map((section, idx) => (
        <div key={section.id || idx}>
          {heading(section.title)}
          {Array.isArray(section.items) && section.items.length > 0 && (
            <ul className={`list-disc list-outside pl-4 text-gray-700 ${bodyText}`}>
              {section.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
