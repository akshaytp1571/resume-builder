/**
 * JSON Resume interop — https://jsonresume.org/schema, v1.0.0.
 *
 * WHY THIS EXISTS
 * The app's own backup format (`precision_resume_store_v2`) is private: it is
 * this app's shape and nothing else reads it. JSON Resume is the closest thing
 * the ecosystem has to a standard, so it is the format that lets someone bring
 * a resume in from elsewhere and — more importantly — leave with it.
 *
 * THE RULE: NO SILENT DATA LOSS.
 * Every conversion problem below is a place where a naive mapper would quietly
 * drop something the user typed. Losing a section is worse than refusing to
 * export, because the user does not find out until the data is gone.
 *
 * Deliberate design decisions, each with its reasoning:
 *
 * 1. SKILLS — internally each entry is `{ category, items }` where items is a
 *    comma-separated string. JSON Resume is `{ name, keywords[] }`, flat.
 *    We emit ONE entry per category, with `name = category` and `keywords` as
 *    the split items. Reading back, `name` becomes the category and the
 *    keywords are re-joined. This round-trips exactly and stays readable to
 *    other tools, which simply see a list of skill groups.
 *
 * 2. LOCATION — a single string here, an object in the schema. We write it to
 *    `basics.location.address` and, when reading, prefer `address` and fall
 *    back to joining the structured parts. The user's own string is never
 *    replaced by a guessed city.
 *
 * 3. CUSTOM SECTIONS — the schema has no equivalent. They are preserved under
 *    `x-customSections` (the `x-` prefix is the conventional extension
 *    namespace) and read back from there. An outside tool will ignore them,
 *    which is correct; our own round-trip keeps them.
 *
 * 4. PHOTO — a base64 data URL, often 100 KB+. Inlined into `basics.image` it
 *    makes the JSON unopenable in an editor. Excluded by default; pass
 *    `{ includePhoto: true }` to opt in.
 *
 * 5. DATES — internal dates are free text ("April 2021 – Present"). The schema
 *    wants `YYYY-MM-DD`. A text value that is not a clean date is NOT mangled
 *    into a wrong one: the original string is kept in `x-dateText` so the
 *    round-trip is lossless, and a best-effort ISO value is emitted alongside
 *    for tools that need one.
 */

const SCHEMA_URL = 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json';

/** Split "a, b, c" on commas that are not inside parentheses. */
function splitTopLevel(value) {
  const text = typeof value === 'string' ? value : '';
  if (!text.trim()) return [];

  const out = [];
  let depth = 0;
  let current = '';

  for (const ch of text) {
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);

    if (ch === ',' && depth === 0) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Best-effort ISO date from a human string. Returns '' when it cannot be sure.
 *
 * Deliberately conservative: "Mar 2021" -> "2021-03-01" is a safe widening,
 * but "2019" alone -> "2019-01-01" would invent a month the user never wrote,
 * so a bare year is returned as "2019" only when `allowYearOnly` is set, and
 * the caller always keeps the original text regardless.
 */
function toIsoDate(value, allowYearOnly = false) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';

  // Already ISO (possibly with a time part).
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // "April 2021" / "Apr 2021" / "April, 2021"
  const monthYear = text.match(/^([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()];
    if (month) return `${monthYear[2]}-${String(month).padStart(2, '0')}-01`;
  }

  // "04/2021" or "4/2021"
  const numeric = text.match(/^(\d{1,2})\/(\d{4})$/);
  if (numeric) {
    const month = Number(numeric[1]);
    if (month >= 1 && month <= 12) {
      return `${numeric[2]}-${String(month).padStart(2, '0')}-01`;
    }
  }

  // Bare year — only when explicitly allowed.
  if (allowYearOnly && /^\d{4}$/.test(text)) return text;

  return '';
}

/** Turn an ISO date back into something a human wrote, or the original text. */
function fromIsoDate(iso, fallback) {
  if (typeof fallback === 'string' && fallback.trim()) return fallback;
  const text = typeof iso === 'string' ? iso.trim() : '';
  if (!text) return '';

  const full = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) {
    const month = Number(full[2]);
    if (month >= 1 && month <= 12) {
      const name = Object.keys(MONTHS).find(
        (k) => k.length > 3 && MONTHS[k] === month
      );
      return `${name ? name[0].toUpperCase() + name.slice(1) : month} ${full[1]}`;
    }
  }
  if (/^\d{4}$/.test(text)) return text;
  return text;
}

/** Split "April 2021 – Present" into { start, end }. */
function splitPeriod(period) {
  const text = typeof period === 'string' ? period : '';
  if (!text.trim()) return { start: '', end: '' };

  // en dash, em dash, hyphen, "to"
  const parts = text.split(/\s*(?:–|—|-|\bto\b)\s*/i).filter(Boolean);
  if (parts.length >= 2) {
    return { start: parts[0].trim(), end: parts.slice(1).join(' - ').trim() };
  }
  return { start: text.trim(), end: '' };
}

const isPresent = (value) =>
  /^(present|current|now|ongoing)$/i.test(String(value || '').trim());

// --- internal -> JSON Resume ------------------------------------------------

/**
 * @param {object} resumeData  internal resume shape
 * @param {object} [options]
 * @param {boolean} [options.includePhoto=false]
 * @returns {object} a JSON Resume document
 */
export function toJsonResume(resumeData, options = {}) {
  const { includePhoto = false } = options;
  const data =
    resumeData && typeof resumeData === 'object' && !Array.isArray(resumeData)
      ? resumeData
      : {};
  const p =
    data.personalInfo && typeof data.personalInfo === 'object'
      ? data.personalInfo
      : {};

  const profiles = [];
  if (typeof p.linkedin === 'string' && p.linkedin.trim()) {
    profiles.push({
      network: 'LinkedIn',
      username: p.linkedin.replace(/^.*linkedin\.com\//i, '').replace(/\/$/, ''),
      url: p.linkedin.startsWith('http') ? p.linkedin : `https://${p.linkedin}`,
      'x-original': p.linkedin,
    });
  }
  if (typeof p.github === 'string' && p.github.trim()) {
    profiles.push({
      network: 'GitHub',
      username: p.github.replace(/^.*github\.com\//i, '').replace(/\/$/, ''),
      url: p.github.startsWith('http') ? p.github : `https://${p.github}`,
      'x-original': p.github,
    });
  }

  const basics = {
    name: p.fullName || '',
    label: p.title || '',
    email: p.email || '',
    phone: p.phone || '',
    url: p.website || '',
    summary: data.summary || '',
    location: p.location ? { address: p.location } : undefined,
    profiles: profiles.length ? profiles : undefined,
  };
  if (includePhoto && typeof p.photo === 'string' && p.photo) {
    basics.image = p.photo;
  }
  // `showPhoto` is a renderer preference with no schema equivalent. Preserve it
  // so a resume that deliberately hides the photo does not come back showing it.
  if (typeof p.showPhoto === 'boolean') basics['x-showPhoto'] = p.showPhoto;

  const work = (Array.isArray(data.experience) ? data.experience : []).map((e) => {
    const { start, end } = splitPeriod(e?.period);
    const entry = {
      name: e?.company || '',
      position: e?.role || '',
      summary: e?.product || '',
      highlights: Array.isArray(e?.highlights) ? e.highlights.slice() : [],
    };
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    if (startIso) entry.startDate = startIso;
    if (endIso) entry.endDate = endIso;
    // Keep the user's own words so nothing is lost in the round-trip.
    if (e?.period) entry['x-dateText'] = e.period;
    if (e?.location) entry['x-location'] = e.location;
    return entry;
  });

  const education = (Array.isArray(data.education) ? data.education : []).map((e) => {
    const { start, end } = splitPeriod(e?.period);
    const entry = {
      institution: e?.school || '',
      studyType: '',
      area: '',
      // `score` is the app's canonical field (every template, the DOCX exporter
      // and the ATS text view read it); `grade` is the internal alias. Read the
      // canonical one first so a resume carrying both cannot export the stale
      // half of the pair.
      score: e?.score || e?.grade || '',
    };
    // The internal model keeps the whole qualification in `degree`, and the
    // year range in `period`. `degree` is also read by older code paths, so
    // keep the full text there too.
    if (e?.degree) entry['x-degree'] = e.degree;
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    if (startIso) entry.startDate = startIso;
    if (endIso) entry.endDate = endIso;
    if (e?.period) entry['x-dateText'] = e.period;
    if (e?.location) entry['x-location'] = e.location;
    return entry;
  });

  const skills = (Array.isArray(data.skills) ? data.skills : []).map((s) => ({
    name: s?.category || '',
    keywords: splitTopLevel(s?.items),
  }));

  const projects = (Array.isArray(data.projects) ? data.projects : []).map((pr) => {
    const entry = {
      name: pr?.name || '',
      description: '',
      highlights: Array.isArray(pr?.highlights) ? pr.highlights.slice() : [],
    };
    if (pr?.role) entry['x-role'] = pr.role;
    if (pr?.period) entry['x-period'] = pr.period;
    if (pr?.link) entry.url = pr.link;
    return entry;
  });

  const languages = (Array.isArray(data.languages) ? data.languages : []).map((l) => ({
    language: l?.name || '',
    // `proficiency` is canonical; `level` is the internal alias.
    fluency: l?.proficiency || l?.level || '',
  }));

  const certificates = (Array.isArray(data.certifications) ? data.certifications : []).map(
    (c) => {
      const entry = { name: c?.name || '' };
      if (c?.issuer) entry.issuer = c.issuer;
      if (c?.year) entry.date = c.year;
      return entry;
    }
  );

  const doc = {
    $schema: SCHEMA_URL,
    basics,
  };
  if (work.length) doc.work = work;
  if (education.length) doc.education = education;
  if (skills.length) doc.skills = skills;
  if (projects.length) doc.projects = projects;
  if (languages.length) doc.languages = languages;
  if (certificates.length) doc.certificates = certificates;

  // No schema equivalent — preserved, not dropped.
  const customSections = Array.isArray(data.customSections) ? data.customSections : [];
  if (customSections.length) {
    doc['x-customSections'] = customSections.map((c) => ({
      title: c?.title || '',
      items: Array.isArray(c?.items) ? c.items.slice() : [],
    }));
  }

  doc.meta = {
    version: 'v1.0.0',
    lastModified: new Date().toISOString(),
  };

  return doc;
}

// --- JSON Resume -> internal ------------------------------------------------

const asText = (value) => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const asList = (value) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()) : [];

const asObjects = (value) =>
  Array.isArray(value)
    ? value.filter((v) => v && typeof v === 'object' && !Array.isArray(v))
    : [];

/**
 * @param {object} json  a JSON Resume document
 * @returns {object} internal resume shape, safe to hand to normalizeResume()
 * @throws {Error} when the input is not a plausible JSON Resume document
 */
export function fromJsonResume(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('That file does not contain a JSON Resume document.');
  }

  const basics =
    json.basics && typeof json.basics === 'object' && !Array.isArray(json.basics)
      ? json.basics
      : {};

  // Require at least one recognisable field. A file with no basics, no work, no
  // education and no skills is a corrupt or wrong file, not an empty resume —
  // silently producing a blank resume would look like the import worked.
  //
  // `basics` being present at all counts as recognisable, even when every field
  // in it is empty: our own export of a blank resume is exactly that shape, and
  // it must be able to read back what it wrote.
  const hasAnything =
    (json.basics && typeof json.basics === 'object') ||
    basics.name ||
    basics.label ||
    basics.email ||
    basics.summary ||
    json.work ||
    json.education ||
    json.skills ||
    json['x-customSections'];
  if (!hasAnything) {
    throw new Error(
      'That file has no recognisable JSON Resume fields (expected at least a "basics" object, work history, or skills).'
    );
  }

  const profiles = asObjects(basics.profiles);
  const findProfile = (network) => {
    const hit = profiles.find(
      (pr) => asText(pr.network).toLowerCase() === network.toLowerCase()
    );
    if (!hit) return '';
    // Prefer the text the user originally typed. Only fall back to the
    // absolute URL when the document came from another tool.
    return asText(hit['x-original']) || asText(hit.url) || asText(hit.username);
  };

  const location = basics.location;
  let locationText = '';
  if (typeof location === 'string') {
    locationText = location;
  } else if (location && typeof location === 'object') {
    locationText =
      asText(location.address) ||
      [location.city, location.region, location.countryCode || location.country]
        .filter(Boolean)
        .join(', ');
  }

  const personalInfo = {
    fullName: asText(basics.name),
    title: asText(basics.label),
    email: asText(basics.email),
    phone: asText(basics.phone),
    location: locationText,
    website: asText(basics.url),
    linkedin: findProfile('LinkedIn'),
    github: findProfile('GitHub'),
    photo: typeof basics.image === 'string' ? basics.image : '',
    // Honour a preserved preference; otherwise the presence of an image decides.
    showPhoto:
      typeof basics['x-showPhoto'] === 'boolean'
        ? basics['x-showPhoto']
        : Boolean(basics.image),
  };

  const experience = asObjects(json.work).map((w) => {
    const period =
      asText(w['x-dateText']) ||
      [fromIsoDate(w.startDate), fromIsoDate(w.endDate)].filter(Boolean).join(' – ');
    return {
      role: asText(w.position),
      company: asText(w.name),
      period,
      location: asText(w['x-location']),
      product: asText(w.summary),
      highlights: asList(w.highlights),
    };
  });

  const education = asObjects(json.education).map((e) => {
    const period =
      asText(e['x-dateText']) ||
      [fromIsoDate(e.startDate), fromIsoDate(e.endDate)].filter(Boolean).join(' – ');
    // Prefer the original full qualification text we stashed; otherwise
    // reassemble from the schema's studyType/area.
    const degree =
      asText(e['x-degree']) ||
      [asText(e.studyType), asText(e.area)].filter(Boolean).join(', ');
    // The schema's field is `score`. `grade` is this app's internal alias for
    // the same value, and every template, the DOCX exporter and the ATS text
    // view read `score` — so writing only `grade` made an imported grade
    // invisible everywhere. Emit both; they are the same string.
    const score = asText(e.score) || asText(e.grade);
    return {
      school: asText(e.institution),
      degree,
      period,
      location: asText(e['x-location']),
      score,
      grade: score,
    };
  });

  const skills = asObjects(json.skills).map((s) => ({
    category: asText(s.name),
    items: asList(s.keywords).join(', '),
  }));

  const projects = asObjects(json.projects).map((pr) => ({
    name: asText(pr.name),
    role: asText(pr['x-role']),
    period: asText(pr['x-period']),
    link: asText(pr.url),
    highlights: asList(pr.highlights),
  }));

  const languages = asObjects(json.languages).map((l) => {
    // `fluency` is the schema's field; `proficiency` is what every template,
    // the DOCX exporter and the ATS text view actually read. Emit both so an
    // imported language level is visible instead of silently dropped.
    const proficiency = asText(l.fluency) || asText(l.level) || asText(l.proficiency);
    return {
      name: asText(l.language),
      proficiency,
      level: proficiency,
    };
  });

  const certifications = asObjects(json.certificates).map((c) => ({
    name: asText(c.name),
    issuer: asText(c.issuer),
    year: asText(c.date),
  }));

  const customSections = asObjects(json['x-customSections']).map((c) => ({
    title: asText(c.title),
    items: asList(c.items),
  }));

  return {
    personalInfo,
    summary: asText(basics.summary),
    skills,
    experience,
    education,
    languages,
    certifications,
    projects,
    customSections,
  };
}

/** A filename-safe slug for the downloaded file. */
export function jsonResumeFilename(resumeData) {
  const name =
    resumeData?.personalInfo?.fullName ||
    resumeData?.personalInfo?.title ||
    'resume';
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'resume'}-jsonresume.json`;
}
