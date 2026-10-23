/**
 * Template capability registry.
 *
 * Not every template can show every section - the dense single-page layout has
 * no room for custom sections, for example. This registry is the single source
 * of truth so the template picker can warn the user before they switch, instead
 * of silently dropping a section they spent time writing.
 *
 * When you add a template, add its entry here. `sections` lists the optional
 * sections the template actually renders.
 */

export const OPTIONAL_SECTIONS = [
  { key: 'summary', label: 'Summary' },
  { key: 'skills', label: 'Skills' },
  { key: 'experience', label: 'Experience' },
  { key: 'education', label: 'Education' },
  { key: 'languages', label: 'Languages' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'projects', label: 'Projects' },
  { key: 'customSections', label: 'Custom sections' },
];

/** What each template renders. Keys must match OPTIONAL_SECTIONS. */
export const TEMPLATE_CAPABILITIES = {
  classic: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
  modern: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
  minimal: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
  creative: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
  executive: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
  compact: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
  tech: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
  academic: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
  startup: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'certifications',
    'projects',
    'customSections',
  ],
};

/**
 * Sections the user has filled in that the given template would not render.
 * Empty array means nothing would be lost.
 */
export function getDroppedSections(templateId, resumeData) {
  const supported = TEMPLATE_CAPABILITIES[templateId];
  if (!supported) return [];

  const dropped = [];
  for (const section of OPTIONAL_SECTIONS) {
    if (supported.includes(section.key)) continue;

    const value = resumeData?.[section.key];
    const hasContent = Array.isArray(value)
      ? value.length > 0
      : typeof value === 'string'
        ? value.trim().length > 0
        : false;

    if (hasContent) dropped.push(section.label);
  }
  return dropped;
}

/** True when the template renders the given section. */
export function templateSupports(templateId, sectionKey) {
  const supported = TEMPLATE_CAPABILITIES[templateId];
  if (!supported) return true;
  return supported.includes(sectionKey);
}
