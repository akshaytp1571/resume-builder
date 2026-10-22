import mammoth from 'mammoth';
import { callAiChat, getSavedAiConfig } from './aiService';

// 1. Extract raw text from file (DOCX, JSON, TXT)
export async function extractTextFromFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return {
      type: 'docx',
      text: result.value || '',
    };
  }

  if (extension === 'json') {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      return {
        type: 'json',
        data: parsed,
        text,
      };
    } catch (e) {
      throw new Error('Invalid JSON resume file format.');
    }
  }

  // Plain text / Markdown / txt
  const text = await file.text();
  return {
    type: 'text',
    text,
  };
}

// 2. Rule-Based Fallback Parser (Offline / Zero-Config)
export function parseResumeHeuristically(rawText) {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed = {
    personalInfo: {
      fullName: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      relocation: '',
      linkedin: '',
      github: '',
      website: '',
      photo: '',
      showPhoto: true,
      photoStyle: 'square-frame',
    },
    summary: '',
    skills: [],
    experience: [],
    education: [],
    languages: [],
    certifications: [],
    projects: [],
    customSections: [],
  };

  // Find email, phone
  const emailMatch = rawText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
  if (emailMatch) parsed.personalInfo.email = emailMatch[1];

  const phoneMatch = rawText.match(/(\+?\d[\d\s\-()]{8,}\d)/);
  if (phoneMatch) parsed.personalInfo.phone = phoneMatch[1].trim();

  const linkedinMatch = rawText.match(/(linkedin\.com\/[^\s]+)/i);
  if (linkedinMatch) parsed.personalInfo.linkedin = linkedinMatch[1];

  const githubMatch = rawText.match(/(github\.com\/[^\s]+)/i);
  if (githubMatch) parsed.personalInfo.github = githubMatch[1];

  // Website / portfolio (anything that is not the linkedin/github already
  // captured and looks like a bare domain or URL).
  const siteMatch = rawText.match(
    /\b((?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*\.(?:com|io|dev|net|org|me|app)(?:\/[^\s]*)?)/i
  );
  if (siteMatch && !/linkedin|github/i.test(siteMatch[1])) {
    parsed.personalInfo.website = siteMatch[1];
  }

  // First non-empty lines are often Name & Title
  if (lines.length > 0) {
    parsed.personalInfo.fullName = lines[0].replace(/\|.*/, '').trim();
  }
  if (lines.length > 1 && !lines[1].includes('@') && !lines[1].match(/^\d/)) {
    parsed.personalInfo.title = lines[1].trim();
  }

  // "Relocating to UAE" / "Open to relocation" style lines are common in
  // headers and carry real signal for the Gulf job market.
  const relocMatch = rawText.match(/(relocat\w*[^\n]{0,40})/i);
  if (relocMatch) parsed.personalInfo.relocation = relocMatch[1].trim();

  // Section splitting
  let currentSection = '';
  const sectionContent = {
    summary: [],
    skills: [],
    experience: [],
    education: [],
    languages: [],
    certifications: [],
  };

  for (const line of lines.slice(1)) {
    const upper = line.toUpperCase();
    if (upper === 'SUMMARY' || upper.startsWith('PROFESSIONAL SUMMARY') || upper.startsWith('PROFILE')) {
      currentSection = 'summary';
      continue;
    } else if (upper.startsWith('SKILLS') || upper.startsWith('TECHNICAL SKILLS') || upper.startsWith('COMPETENCIES')) {
      currentSection = 'skills';
      continue;
    } else if (upper.startsWith('EXPERIENCE') || upper.startsWith('WORK EXPERIENCE') || upper.startsWith('EMPLOYMENT')) {
      currentSection = 'experience';
      continue;
    } else if (upper.startsWith('EDUCATION') || upper.startsWith('ACADEMIC')) {
      currentSection = 'education';
      continue;
    } else if (upper.startsWith('LANGUAGES')) {
      currentSection = 'languages';
      continue;
    } else if (upper.startsWith('CERTIFICATIONS') || upper.startsWith('CERTIFICATES')) {
      currentSection = 'certifications';
      continue;
    }

    if (currentSection) {
      sectionContent[currentSection].push(line);
    }
  }

  // Process Summary
  if (sectionContent.summary.length > 0) {
    parsed.summary = sectionContent.summary.join(' ');
  }

  // Process Skills
  if (sectionContent.skills.length > 0) {
    sectionContent.skills.forEach((sLine, idx) => {
      const parts = sLine.split(':');
      if (parts.length > 1) {
        parsed.skills.push({
          id: `skill-${idx}`,
          category: parts[0].trim(),
          items: parts.slice(1).join(':').trim(),
        });
      } else {
        parsed.skills.push({
          id: `skill-${idx}`,
          category: 'Core Competency',
          items: sLine,
        });
      }
    });
  }

  // Process Experience
  if (sectionContent.experience.length > 0) {
    let currentExp = null;
    sectionContent.experience.forEach((eLine, idx) => {
      // A header line is "Role | Company" or "Role – Company". A bare date
      // range ("2019 – 2021") or a bullet is NOT a header, so only treat a
      // line as a new role when it actually carries a title.
      const looksLikeHeader =
        eLine.includes('|') ||
        (!/\d{4}/.test(eLine) && (eLine.includes('–') || eLine.includes(' - '))) ||
        !currentExp;

      if (looksLikeHeader) {
        if (currentExp) parsed.experience.push(currentExp);
        const pipeParts = eLine.split('|');
        const dashParts = eLine.split(/\s+[–-]\s+/);
        let role = eLine;
        let company = '';
        if (pipeParts.length > 1) {
          role = pipeParts[0];
          company = pipeParts.slice(1).join('|');
        } else if (dashParts.length > 1) {
          role = dashParts[0];
          company = dashParts.slice(1).join(' - ');
        }
        currentExp = {
          id: `exp-${idx}`,
          role: role.trim(),
          company: company.trim(),
          period: '',
          product: '',
          highlights: [],
        };
      } else if (eLine.startsWith('•') || eLine.startsWith('-') || eLine.startsWith('*')) {
        currentExp?.highlights.push(eLine.replace(/^[•\-*]\s*/, '').trim());
      } else if (eLine.toLowerCase().startsWith('product:')) {
        currentExp.product = eLine;
      } else if (!currentExp.period && /^.{2,40}$/.test(eLine) && /[–-]/.test(eLine) && /\d/.test(eLine)) {
        // A short standalone date range belongs to the current role.
        currentExp.period = eLine.trim();
      } else {
        currentExp?.highlights.push(eLine);
      }
    });
    if (currentExp) parsed.experience.push(currentExp);
  }

  // Process Education
  if (sectionContent.education.length > 0) {
    sectionContent.education.forEach((eduLine, idx) => {
      // Common layouts:
      //   "School Name"
      //   "School Name – 2015 – 2019"
      //   "Degree, School Name, 2019"
      //   "School Name | Degree | CGPA 7.2"
      let school = eduLine;
      let degree = '';
      let score = '';
      let year = '';

      const yearMatch = eduLine.match(/\b(19|20)\d{2}\b(?:\s*[–-]\s*\b(?:19|20)\d{2}\b)?/);
      if (yearMatch) year = yearMatch[0].trim();

      const pipeParts = eduLine.split('|').map((p) => p.trim()).filter(Boolean);
      if (pipeParts.length >= 2) {
        school = pipeParts[0];
        degree = pipeParts[1] || '';
        if (pipeParts[2]) score = pipeParts[2];
      } else {
        // Strip a trailing year/date range off the end.
        let rest = eduLine.replace(/\b(19|20)\d{2}\b(\s*[–-]\s*\b(?:19|20)\d{2}\b)?/g, '').trim();
        rest = rest.replace(/[|,–-]+\s*$/, '').trim();

        // A degree is usually introduced by a keyword. The tail is bounded so
        // it stops before a score marker instead of swallowing it.
        const degreeMatch = rest.match(
          /\b(b\.?tech|b\.?e\.?|b\.?sc|b\.?a|b\.?com|m\.?tech|m\.?s\.?|m\.?sc|m\.?a|mba|ph\.?d|bachelor|master|diploma|class\s+xii?)\b[^,]*?(?=\s*[-–|,]\s*(?:cgpa|gpa|percentage|aggregate|marks)\b|$)/i
        );
        if (degreeMatch) {
          degree = degreeMatch[0].replace(/[\s\-–|,]+$/, '').trim();
          rest = rest.replace(degreeMatch[0], ' ').trim();
        }

        const scoreMatch = rest.match(/\b(cgpa|gpa|percentage|aggregate|marks)\s*:?\s*[\d.]+\s*\/?\s*[\d.]*/i);
        if (scoreMatch) {
          score = scoreMatch[0].trim();
          rest = rest.replace(scoreMatch[0], ' ').trim();
        }

        school = rest.replace(/^[|,–-]+|[|,–-]+$/g, '').trim() || school;
      }

      parsed.education.push({
        id: `edu-${idx}`,
        school,
        degree,
        score,
        year,
      });
    });
  }

  // Process Languages
  if (sectionContent.languages.length > 0) {
    sectionContent.languages.forEach((lLine, idx) => {
      lLine.split(/[,•|]/).forEach((name, i) => {
        if (name.trim()) {
          parsed.languages.push({
            id: `lang-${idx}-${i}`,
            name: name.trim(),
            proficiency: 'Fluent',
          });
        }
      });
    });
  }

  return parsed;
}

// 3. AI-Powered Deep Structured Parsing
export async function parseResumeWithAi(rawText) {
  const config = getSavedAiConfig();

  const systemPrompt = `You are a high-precision resume document parsing engine.
Extract all structured data from the provided raw resume text into strict, valid JSON matching this exact schema:
{
  "personalInfo": {
    "fullName": "Candidate Name",
    "title": "Professional Title / Headline",
    "email": "email address",
    "phone": "phone number",
    "location": "City, Country",
    "relocation": "Relocation / Visa status if any",
    "linkedin": "linkedin URL or handle",
    "github": "github URL or handle",
    "showPhoto": true,
    "photoStyle": "square-frame"
  },
  "summary": "Professional summary or career profile paragraph",
  "skills": [
    { "category": "Testing / API / Automation / Tools / etc.", "items": "Comma separated skills" }
  ],
  "experience": [
    {
      "role": "Job Title",
      "company": "Company Name & Location",
      "period": "Dates (e.g. 2021 - 2024)",
      "product": "Product or Project context if present",
      "highlights": ["bullet point 1", "bullet point 2"]
    }
  ],
  "education": [
    {
      "school": "University or School Name",
      "degree": "Degree and Major",
      "score": "GPA or Percentage if present",
      "year": "Graduation year"
    }
  ],
  "languages": [
    { "name": "Language Name", "proficiency": "Native / Fluent / Professional" }
  ],
  "certifications": [
    { "name": "Certification Title", "issuer": "Issuer or Body", "year": "Year" }
  ]
}

CRITICAL RULES:
1. Output ONLY pure, valid JSON.
2. NO markdown code blocks (\`\`\`json), NO conversational preamble.
3. Keep all factual dates, numbers, and achievements intact.`;

  const userPrompt = `RAW RESUME TEXT:\n${rawText}`;

  const responseText = await callAiChat({
    systemPrompt,
    userPrompt,
    config,
  });

  const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsedJson;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (e) {
    // Retry with the brace/bracket extraction used elsewhere so a chatty
    // model does not break the whole parse.
    parsedJson = extractJsonFromText(cleaned);
  }

  if (!parsedJson || typeof parsedJson !== 'object') {
    throw new Error('AI returned an unreadable structure.');
  }

  // Ensure ID properties and that every collection is a real array, because
  // models routinely omit empty sections.
  parsedJson.skills = toArray(parsedJson.skills).map((s, i) => ({ id: `skill-${i}`, ...s }));
  parsedJson.experience = toArray(parsedJson.experience).map((e, i) => ({ id: `exp-${i}`, ...e }));
  parsedJson.education = toArray(parsedJson.education).map((e, i) => ({ id: `edu-${i}`, ...e }));
  parsedJson.languages = toArray(parsedJson.languages).map((l, i) => ({ id: `lang-${i}`, ...l }));
  parsedJson.certifications = toArray(parsedJson.certifications).map((c, i) => ({ id: `cert-${i}`, ...c }));
  parsedJson.personalInfo = { ...parsedJson.personalInfo };

  return parsedJson;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

/** Extract the first balanced JSON object/array out of a string. */
function extractJsonFromText(text) {
  if (!text || typeof text !== 'string') throw new Error('Empty response from AI');
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = text.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = text.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return JSON.parse(text.substring(startIdx, endIdx + 1));
  }
  throw new Error('AI returned non-JSON response: ' + text.slice(0, 150));
}
