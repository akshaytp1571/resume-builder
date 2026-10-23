/**
 * Template data guard.
 *
 * Every resume template used to start with:
 *
 *   const { personalInfo, summary, skills, ... } = data;
 *
 * which throws the moment `data` is null or undefined, and then renders
 * `personalInfo.fullName` raw, which throws again if that field is an object
 * rather than a string. Both shapes are reachable: a JSON resume import, a
 * hand-edited localStorage value, or a partially-parsed DOCX.
 *
 * The component test suite found this (see KNOWN_CRASHES in
 * src/test/templates.test.jsx) — 108 template crashes were reproducible across
 * the hostile-data matrix.
 *
 * `normalizeResume()` in resumeStore.js is the real trust boundary and callers
 * should use it. This is the second line of defence: a template must never
 * throw on bad input even if a future caller forgets to normalise, because a
 * throwing template takes down the whole preview pane.
 */

/** Coerce anything to a displayable string. Objects and arrays become ''. */
export function text(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  return '';
}

/** An array of the given value, with null/undefined/non-object entries dropped. */
export function list(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item !== null && item !== undefined);
}

/** An array of strings, dropping anything that is not a non-empty string. */
export function stringList(value) {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string' && v.trim().length > 0);
}

/** A safe personalInfo object with every display field as a string. */
export function safePersonalInfo(data) {
  const raw = data && typeof data === 'object' ? data.personalInfo : null;
  const info = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    ...info,
    fullName: text(info.fullName),
    title: text(info.title),
    email: text(info.email),
    phone: text(info.phone),
    location: text(info.location),
    relocationPreference: text(info.relocationPreference),
    linkedin: text(info.linkedin),
    github: text(info.github),
    website: text(info.website),
    showPhoto: Boolean(info.showPhoto),
    photo: typeof info.photo === 'string' ? info.photo : '',
    photoStyle: typeof info.photoStyle === 'string' ? info.photoStyle : 'square',
  };
}

/**
 * Destructure a resume into render-safe pieces.
 *
 * Usage in a template:
 *   const { personalInfo, summary, skills, experience, ... } = safeResume(data);
 *
 * Guarantees: `data` may be null, undefined, a string, or an array — none throw.
 * Every list is a real array; every scalar is a string.
 */
export function safeResume(data) {
  const root = data && typeof data === 'object' && !Array.isArray(data) ? data : {};

  // Filtering the outer array is not enough: `highlights: "one string"` survives
  // a typeof-object check on its parent and then throws on `.map`. Every
  // template maps over these, so they must be real string arrays by the time a
  // template sees them.
  const objects = (value) =>
    list(value).filter((item) => typeof item === 'object' && !Array.isArray(item));
  const withBullets = (entry) => ({ ...entry, highlights: stringList(entry.highlights) });

  return {
    personalInfo: safePersonalInfo(root),
    summary: text(root.summary),
    skills: objects(root.skills).map((s) => ({
      ...s,
      category: text(s.category),
      items: text(s.items),
    })),
    experience: objects(root.experience).map(withBullets),
    education: objects(root.education).map((e) => ({
      ...e,
      degree: text(e.degree),
      school: text(e.school),
      period: text(e.period),
      location: text(e.location),
      grade: text(e.grade),
    })),
    languages: objects(root.languages).map((l) => ({
      ...l,
      name: text(l.name),
      level: text(l.level),
    })),
    certifications: objects(root.certifications).map((c) => ({
      ...c,
      name: text(c.name),
      issuer: text(c.issuer),
      year: text(c.year),
    })),
    projects: objects(root.projects).map((p) => ({
      ...withBullets(p),
      name: text(p.name),
      role: text(p.role),
      period: text(p.period),
      link: text(p.link),
    })),
    customSections: objects(root.customSections).map((c) => ({
      ...c,
      title: text(c.title),
      items: stringList(c.items),
    })),
  };
}

/** A safe theme object; never null, always has a templateId. */
export function safeTheme(theme) {
  const t = theme && typeof theme === 'object' && !Array.isArray(theme) ? theme : {};
  return {
    ...t,
    templateId: typeof t.templateId === 'string' && t.templateId ? t.templateId : 'classic',
    primaryColor: typeof t.primaryColor === 'string' ? t.primaryColor : '#3E5566',
    secondaryColor: typeof t.secondaryColor === 'string' ? t.secondaryColor : '#56707F',
    fontFamily: typeof t.fontFamily === 'string' ? t.fontFamily : 'Inter',
  };
}
