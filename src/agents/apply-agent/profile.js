/**
 * Candidate Profile for the Apply Agent
 *
 * Derived from the resume builder's resumeData so the apply agent fills
 * forms with exactly what the resume says. The frontend posts the profile
 * alongside the job; the agent never reads the resume builder's storage
 * directly.
 */

const EMPTY = {
  fullName: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  location: '',
  city: '',
  country: '',
  linkedin: '',
  github: '',
  website: '',
  currentTitle: '',
  currentCompany: '',
  resumePath: '',
  resumeFileName: '',
  coverLetter: '',
  skills: [],
  yearsExperience: '',
  noticePeriod: '',
  visaStatus: '',
};

/** Split a display name into first/last, tolerating middle names. */
function splitName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

/** "Bengaluru, Karnataka, India" -> { city: 'Bengaluru', country: 'India' } */
function splitLocation(location) {
  const parts = String(location || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: '', country: '' };
  if (parts.length === 1) return { city: parts[0], country: '' };
  return { city: parts[0], country: parts[parts.length - 1] };
}

/**
 * Build a fillable profile from the resume builder's resumeData shape.
 * Accepts either the full resumeData object or an already-flat profile.
 */
export function buildProfile(resumeData = {}, overrides = {}) {
  const personal = resumeData.personalInfo || resumeData || {};
  const fullName = personal.fullName || overrides.fullName || '';
  const { firstName, lastName } = splitName(fullName);
  const { city, country } = splitLocation(personal.location || '');

  const experience = resumeData.experience || [];
  const current = experience[0] || {};

  const skills = (resumeData.skills || [])
    .map((s) => String(s.items || '').split(/[,;|]/).map((i) => i.trim()))
    .flat()
    .filter(Boolean);

  return {
    ...EMPTY,
    ...overrides,
    fullName,
    firstName: overrides.firstName || firstName,
    lastName: overrides.lastName || lastName,
    email: personal.email || overrides.email || '',
    phone: personal.phone || overrides.phone || '',
    location: personal.location || overrides.location || '',
    city: overrides.city || city,
    country: overrides.country || country,
    linkedin: personal.linkedin || overrides.linkedin || '',
    github: personal.github || overrides.github || '',
    website: personal.website || overrides.website || '',
    currentTitle: overrides.currentTitle || current.role || '',
    currentCompany: overrides.currentCompany || current.company || '',
    skills: overrides.skills?.length ? overrides.skills : skills,
    coverLetter:
      overrides.coverLetter ||
      resumeData.summary ||
      '',
    yearsExperience:
      overrides.yearsExperience ||
      /(\d+)\s*\+?\s*years/i.exec(resumeData.summary || '')?.[0] ||
      '',
  };
}

/** Normalise a URL-ish string so it can be typed into a form field. */
export function normalizeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(v)) return `https://${v}`;
  return v;
}

/** Strip a LinkedIn profile URL down to the handle-ish form some forms want. */
export function linkedinHandle(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const m = /linkedin\.com\/in\/([^/?#]+)/i.exec(v);
  if (m) return m[1];
  return v.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

/**
 * The candidate's answers, keyed by a normalised field identity.
 * The filler matches form fields against these aliases.
 */
export function profileAnswers(profile) {
  return {
    fullname: profile.fullName,
    name: profile.fullName,
    firstname: profile.firstName,
    first_name: profile.firstName,
    lastname: profile.lastName,
    last_name: profile.lastName,
    surname: profile.lastName,
    email: profile.email,
    emailaddress: profile.email,
    phone: profile.phone,
    mobilenumber: profile.phone,
    mobile: profile.phone,
    contactnumber: profile.phone,
    location: profile.location,
    city: profile.city,
    country: profile.country,
    linkedin: normalizeUrl(profile.linkedin),
    linkedinprofile: normalizeUrl(profile.linkedin),
    linkedinurl: normalizeUrl(profile.linkedin),
    github: normalizeUrl(profile.github),
    githuburl: normalizeUrl(profile.github),
    website: normalizeUrl(profile.website),
    portfolio: normalizeUrl(profile.website),
    currenttitle: profile.currentTitle,
    currentcompany: profile.currentCompany,
    coverletter: profile.coverLetter,
    skills: profile.skills.join(', '),
    experience: profile.yearsExperience,
  };
}
