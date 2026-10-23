/**
 * Cover letter model, rendering and local drafting.
 *
 * Pure: no React, no network, no storage. Everything here is a function of its
 * arguments, so it can be unit-tested and reused by the DOCX exporter, the
 * editor and (later) the apply agent.
 */

const MANAGER_FALLBACK = 'Dear Hiring Manager,';

/** Coerce anything to a trimmed string. */
function str(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

/** "2026-10-23" in local time — the date the letter is dated with. */
function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Format an ISO date for display. Falls back to the raw string rather than
 * "Invalid Date", and to today when empty.
 */
export function formatLetterDate(iso) {
  const raw = str(iso);
  if (!raw) {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** A blank letter. */
export function createCoverLetter() {
  return {
    id: `letter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    jobTitle: '',
    company: '',
    hiringManager: '',
    body: '',
    date: todayIso(),
  };
}

/** Normalise an arbitrary value into a letter object. Never throws. */
export function normalizeCoverLetter(letter) {
  const src = letter && typeof letter === 'object' && !Array.isArray(letter) ? letter : {};
  return {
    id: str(src.id) || `letter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    jobTitle: str(src.jobTitle),
    company: str(src.company),
    hiringManager: str(src.hiringManager),
    body: str(src.body),
    date: str(src.date) || todayIso(),
  };
}

/** True when the user has actually written something worth exporting. */
export function isCoverLetterEmpty(letter) {
  const l = normalizeCoverLetter(letter);
  return !l.body && !l.jobTitle && !l.company;
}

/** Split a body into paragraphs, collapsing runs of blank lines. */
function paragraphsOf(text) {
  return str(text)
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Render a letter as plain text: date, salutation, body paragraphs, sign-off.
 *
 * Deliberately plain text with real blank lines rather than HTML — it is what
 * the user copies into an email, and what the DOCX exporter turns into runs.
 */
export function renderCoverLetter(letter, resumeData) {
  const l = normalizeCoverLetter(letter);
  const personal =
    resumeData && typeof resumeData === 'object' && !Array.isArray(resumeData)
      ? resumeData.personalInfo || {}
      : {};
  const name = str(personal.fullName);
  const contact = [str(personal.email), str(personal.phone), str(personal.location)]
    .filter(Boolean)
    .join(' · ');

  const lines = [];

  // Letterhead: who it is from.
  if (name) lines.push(name);
  if (contact) lines.push(contact);
  if (name || contact) lines.push('');

  lines.push(formatLetterDate(l.date));
  lines.push('');

  // Recipient block, only the parts we actually know.
  const recipient = [];
  if (l.hiringManager) recipient.push(l.hiringManager);
  if (l.company) recipient.push(l.company);
  if (recipient.length) {
    lines.push(...recipient);
    lines.push('');
  }

  lines.push(l.hiringManager ? `Dear ${l.hiringManager},` : MANAGER_FALLBACK);
  lines.push('');

  const body = paragraphsOf(l.body);
  if (body.length) {
    body.forEach((p) => {
      lines.push(p);
      lines.push('');
    });
  } else {
    // An empty letter still renders as a valid, honest document.
    lines.push('(No letter written yet.)');
    lines.push('');
  }

  lines.push('Sincerely,');
  if (name) lines.push(name);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------------------------------------------------------------------------
// Local drafting
// ---------------------------------------------------------------------------

/**
 * Split a skills string on commas that are NOT inside parentheses.
 *
 * A naive split turns "cross-platform testing (web, Android, iOS)" into
 * "cross-platform testing (web" plus two junk fragments, which then read as
 * broken prose in the draft.
 */
function splitTopLevel(text) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of str(text)) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Flatten `skills: [{ category, items: "a, b" }]` into a list of skill names. */
function skillNames(resumeData, limit = 6) {
  const out = [];
  const seen = new Set();
  for (const group of arr(resumeData?.skills)) {
    if (!group || typeof group !== 'object') continue;
    const items =
      typeof group.items === 'string'
        ? splitTopLevel(group.items)
        : arr(group.items).map((i) => str(i));
    for (const item of items) {
      const name = str(item);
      // Skip anything absurdly long: it reads as a clause, not a skill.
      if (!name || name.length > 42) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/** Join a list as "a, b and c". */
function joinNatural(items) {
  const list = arr(items).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/**
 * Lowercase a skill or role for mid-sentence use, keeping acronyms and names.
 *
 * "Manual functional testing" -> "manual functional testing", but "Postman",
 * "JMeter", "SQL" and "QA Lead" stay as written: they are product names,
 * acronyms or job titles, and lowercasing them reads as a typo.
 */
function lowerMidSentence(text) {
  const s = str(text);
  if (!s) return '';
  const first = s.split(/\s+/)[0];
  // Acronyms (SQL, API), CamelCase product names (WebDriver, JMeter), and
  // single-word names ("Postman", "Selenium") keep their case.
  if (/^[A-Z]{2,}/.test(first) || /[a-z][A-Z]/.test(first)) return s;
  if (s === first) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** The most recent role, preferring the one marked current. */
function mostRecentRole(resumeData) {
  const roles = arr(resumeData?.experience).filter(
    (e) => e && typeof e === 'object' && (str(e.role) || str(e.company))
  );
  if (roles.length === 0) return null;
  const current = roles.find((e) => /present|current|now/i.test(str(e.period)));
  return current || roles[0];
}

/** First sentence of the summary, if it is short enough to reuse as an opener. */
function openerSentence(summary) {
  const text = str(summary);
  if (!text) return '';
  const match = text.match(/^[^.!?]+[.!?]/);
  const first = match ? match[0].trim() : text;
  // A 300-character "sentence" is not an opener, it is the whole summary.
  return first.length <= 220 ? first : '';
}

/**
 * Draft a letter body from the resume itself.
 *
 * No AI, no network, and no placeholders: every sentence is assembled from
 * data that actually exists in the resume. When the resume is sparse the draft
 * gets shorter rather than falling back to "[Company]" filler — a two-sentence
 * honest draft is more useful than a five-sentence skeleton the user has to
 * delete line by line.
 */
export function suggestCoverLetter(resumeData, jobDescription) {
  const data =
    resumeData && typeof resumeData === 'object' && !Array.isArray(resumeData)
      ? resumeData
      : {};
  const jd = str(jobDescription);

  const personal =
    data.personalInfo && typeof data.personalInfo === 'object' ? data.personalInfo : {};
  const name = str(personal.fullName);
  const headline = str(personal.title);
  const summary = str(data.summary);
  const skills = skillNames(data, 6);
  const role = mostRecentRole(data);

  const roleTitle = role ? str(role.role) : '';
  const roleCompany = role ? str(role.company) : '';
  const rolePeriod = role ? str(role.period) : '';
  const highlight = role ? str(arr(role.highlights).find((h) => typeof h === 'string')) : '';

  const paragraphs = [];

  // --- Opening: who I am, and what I do ------------------------------------
  // Assembled clause by clause so a resume with only a name, or only a role,
  // still yields a grammatical sentence instead of a dangling fragment.
  let opening = '';
  const label = roleTitle || headline;

  if (name && label) {
    opening = `I am ${name}, a ${lowerMidSentence(label)}`;
    if (roleCompany) {
      opening += /present|current|now/i.test(rolePeriod)
        ? `, currently at ${roleCompany}.`
        : `, most recently at ${roleCompany}.`;
    } else {
      opening += '.';
    }
  } else if (name) {
    opening = `I am ${name}.`;
    if (roleTitle && roleCompany) {
      opening += ` I am currently ${roleTitle} at ${roleCompany}.`;
    }
  } else if (label) {
    opening = `I am a ${lowerMidSentence(label)}`;
    if (roleCompany) {
      opening += /present|current|now/i.test(rolePeriod)
        ? `, currently at ${roleCompany}.`
        : `, most recently at ${roleCompany}.`;
    } else {
      opening += '.';
    }
  }

  // Reuse the summary's first sentence as an extra opener, unless the opening
  // above already said the same thing.
  const opener = openerSentence(summary);
  if (opener) {
    const probe = opener.toLowerCase().replace(/[.!?]$/, '').slice(0, 40);
    if (!opening.toLowerCase().includes(probe)) {
      opening = opening ? `${opening} ${opener}` : opener;
    }
  }

  if (opening) paragraphs.push(opening.trim());

  // --- Body: what I actually do --------------------------------------------
  const bodyParts = [];
  if (highlight) {
    bodyParts.push(highlight.replace(/[.!?]+$/, '') + '.');
  }
  if (skills.length) {
    const lowered = skills.slice(0, 5).map(lowerMidSentence);
    bodyParts.push(`Day to day that has meant working with ${joinNatural(lowered)}.`);
  }
  if (bodyParts.length) paragraphs.push(bodyParts.join(' '));

  // --- Closing: tie back to the posting, or stay honest ---------------------
  const jdHint = jd
    ? ` I would like to bring that experience to the role described in your posting${
        roleCompany ? '' : ''
      }.`
    : '';
  if (jdHint) {
    paragraphs.push(jdHint.trim());
  }

  if (paragraphs.length === 0) {
    // Nothing at all to work with. Say so plainly instead of emitting filler.
    return 'I would like to be considered for this role. My resume has the details of my background.';
  }

  return paragraphs.join('\n\n');
}

/** Word count for the live counter in the editor. */
export function countWords(text) {
  const t = str(text);
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}
