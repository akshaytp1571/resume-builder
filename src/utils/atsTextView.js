/**
 * What the parser actually reads.
 *
 * An ATS does not see the design. It extracts a stream of text from the PDF and
 * tries to classify it into sections. So the useful question is not "does this
 * look good" but "what does this degrade to".
 *
 * This module produces that stream, deliberately in the *worst plausible*
 * shape: one column, no styling, headings and bullets only. If the plain-text
 * projection reads correctly, an ATS can parse the résumé. If a field is
 * missing here, it is missing from the export, whatever the preview shows.
 *
 * It is a debugging instrument as much as a user feature. Any time a template
 * looks right but the PDF parses badly, this is where the difference shows.
 *
 * Design rules, and why:
 *   - UPPERCASE section headings, because that is the convention parsers key on.
 *   - No columns. A two-column template flattens to interleaved nonsense; this
 *     view shows the single-column reading order so the problem is visible.
 *   - No tables, no icons, no glyphs. Anything that is not text is invisible.
 *   - Dates on the same line as the role, because a parser that finds an
 *     orphaned date often attaches it to the wrong entry.
 */

const SECTION_ORDER = [
  'summary',
  'skills',
  'experience',
  'projects',
  'education',
  'certifications',
  'languages',
];

/** Join the non-empty parts of a header line with a middot-free separator. */
function line(...parts) {
  return parts
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean)
    .join(' | ');
}

function bullets(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((b) => (b == null ? '' : String(b).trim()))
    .filter(Boolean)
    .map((b) => `- ${b}`);
}

/**
 * Project a resume into the plain text an ATS extracts.
 *
 * @param {object} resume  the normalized resume object
 * @param {object} [opts]
 * @param {string[]} [opts.only]  restrict to these section keys, in this order
 * @returns {{ text: string, sections: Array<{key:string,title:string,body:string}>, chars: number, words: number }}
 */
export function toAtsText(resume, opts = {}) {
  const data = resume && typeof resume === 'object' ? resume : {};
  const personal = data.personalInfo || {};
  const sections = [];

  const add = (key, title, lines) => {
    const body = (Array.isArray(lines) ? lines : []).filter((l) => l && l.trim()).join('\n');
    if (body) sections.push({ key, title, body });
  };

  // ---- header. Contact details must be text; a mailto: link is still text,
  // but an icon-only phone number is not.
  const headerLines = [
    line(personal.fullName),
    line(personal.title),
    line(personal.email, personal.phone, personal.location),
    line(personal.linkedin, personal.github, personal.website),
  ].filter(Boolean);

  add('header', 'CONTACT', headerLines);

  // ---- summary
  if (personal.summary && String(personal.summary).trim()) {
    add('summary', 'SUMMARY', [String(personal.summary).trim()]);
  }

  // ---- skills. One line per category; a parser reading "Testing: X, Y" gets
  // both the category and the keywords, which is what weighted matching wants.
  if (Array.isArray(data.skills) && data.skills.length) {
    add(
      'skills',
      'SKILLS',
      data.skills
        .map((s) => {
          if (!s) return '';
          const cat = (s.category || '').trim();
          const items = (s.items || '').trim();
          if (!cat && !items) return '';
          // A category with no items would emit a dangling "Empty: " — a stray
          // separator an ATS reads as a malformed label.
          if (cat && !items) return '';
          return cat ? `${cat}: ${items}` : items;
        })
        .filter(Boolean)
    );
  }

  // ---- experience
  if (Array.isArray(data.experience) && data.experience.length) {
    const lines = [];
    for (const job of data.experience) {
      if (!job) continue;
      lines.push(line(job.role, job.company, job.period));
      if (job.product) lines.push(String(job.product).trim());
      lines.push(...bullets(job.highlights));
      lines.push('');
    }
    add('experience', 'EXPERIENCE', lines);
  }

  // ---- projects
  if (Array.isArray(data.projects) && data.projects.length) {
    const lines = [];
    for (const proj of data.projects) {
      if (!proj) continue;
      lines.push(line(proj.name, proj.role, proj.period));
      if (proj.link) lines.push(String(proj.link).trim());
      lines.push(...bullets(proj.highlights));
      lines.push('');
    }
    add('projects', 'PROJECTS', lines);
  }

  // ---- education
  if (Array.isArray(data.education) && data.education.length) {
    const lines = [];
    for (const ed of data.education) {
      if (!ed) continue;
      lines.push(line(ed.school, ed.year));
      lines.push(line(ed.degree, ed.score));
    }
    add('education', 'EDUCATION', lines);
  }

  // ---- certifications
  if (Array.isArray(data.certifications) && data.certifications.length) {
    add(
      'certifications',
      'CERTIFICATIONS',
      data.certifications
        .filter(Boolean)
        .map((c) => line(c.name, c.issuer, c.year))
    );
  }

  // ---- languages
  if (Array.isArray(data.languages) && data.languages.length) {
    add(
      'languages',
      'LANGUAGES',
      data.languages
        .filter(Boolean)
        .map((l) => line(l.name, l.proficiency))
    );
  }

  // ---- custom sections, after the known ones so parser order is predictable
  if (Array.isArray(data.customSections) && data.customSections.length) {
    for (const cs of data.customSections) {
      if (!cs || !cs.title) continue;
      add(`custom:${cs.id || cs.title}`, String(cs.title).toUpperCase(), bullets(cs.items));
    }
  }

  const wanted = Array.isArray(opts.only) && opts.only.length ? opts.only : null;
  const chosen = wanted
    ? sections.filter((s) => wanted.includes(s.key) || s.key === 'header')
    : sections;

  // Header first, then whatever order the caller asked for.
  const ordered = wanted
    ? [
        ...chosen.filter((s) => s.key === 'header'),
        ...wanted.flatMap((k) => chosen.filter((s) => s.key === k)),
      ]
    : chosen;

  const text = ordered
    .map((s) => `${s.title}\n${s.body}`)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text,
    sections: ordered,
    chars: text.length,
    words: text ? text.split(/\s+/).filter(Boolean).length : 0,
  };
}

/** Filename for a downloaded projection. */
export function atsTextFilename(resume) {
  const name = resume?.personalInfo?.fullName || 'resume';
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'resume'}-ats-plain-text.txt`;
}

export { SECTION_ORDER };
