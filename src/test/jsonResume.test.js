import { describe, it, expect } from 'vitest';
import {
  toJsonResume,
  fromJsonResume,
  jsonResumeFilename,
} from '../utils/jsonResume.js';
import { normalizeResume } from '../utils/resumeStore.js';
import { fullResume, emptyResume, hostileResumes } from './fixtures.js';
import { INITIAL_RESUME_DATA } from '../data/initialData.js';

/** The fields the internal model can hold and the schema can carry. */
function comparable(resume) {
  const n = normalizeResume(resume);
  return {
    personalInfo: {
      fullName: n.personalInfo.fullName,
      title: n.personalInfo.title,
      email: n.personalInfo.email,
      phone: n.personalInfo.phone,
      location: n.personalInfo.location,
      website: n.personalInfo.website,
      linkedin: n.personalInfo.linkedin,
      github: n.personalInfo.github,
    },
    summary: n.summary,
    skills: n.skills.map((s) => ({ category: s.category, items: s.items })),
    experience: n.experience.map((e) => ({
      role: e.role,
      company: e.company,
      period: e.period,
      product: e.product,
      highlights: e.highlights,
    })),
    education: n.education.map((e) => ({
      school: e.school,
      degree: e.degree,
      period: e.period,
      // `score` is the field every template reads. Comparing `grade` instead
      // used to pass for the wrong reason: the export dropped the value, the
      // import read it into a field nothing renders, and both sides came back
      // empty.
      score: e.score,
    })),
    projects: n.projects.map((p) => ({
      name: p.name,
      role: p.role,
      period: p.period,
      link: p.link,
      highlights: p.highlights,
    })),
    languages: n.languages.map((l) => ({
      name: l.name,
      // `proficiency` is canonical here, for the same reason as `score`.
      proficiency: l.proficiency,
    })),
    customSections: n.customSections.map((c) => ({
      title: c.title,
      items: c.items,
    })),
  };
}

describe('JSON Resume round-trip fidelity', () => {
  it('survives the real sample resume unchanged', () => {
    const original = comparable(INITIAL_RESUME_DATA);
    const round = comparable(fromJsonResume(toJsonResume(INITIAL_RESUME_DATA)));
    expect(round).toEqual(original);
  });

  it('survives the full test fixture unchanged', () => {
    const original = comparable(fullResume());
    const round = comparable(fromJsonResume(toJsonResume(fullResume())));
    expect(round).toEqual(original);
  });

  it('survives every hostile fixture without throwing or losing shape', () => {
    for (const [label, resume] of hostileResumes()) {
      expect(
        () => fromJsonResume(toJsonResume(resume)),
        `threw on "${label}"`
      ).not.toThrow();
      // The result must still be a valid internal resume.
      expect(() => normalizeResume(fromJsonResume(toJsonResume(resume)))).not.toThrow();
    }
  });

  it('survives an empty resume', () => {
    expect(() => fromJsonResume(toJsonResume(emptyResume()))).not.toThrow();
  });
});

describe('JSON Resume — the specific traps', () => {
  it('keeps skill categories through the flat schema', () => {
    const resume = {
      personalInfo: { fullName: 'A' },
      skills: [
        { id: 's1', category: 'Testing', items: 'manual, regression, end-to-end' },
        { id: 's2', category: 'API', items: 'Postman, Rest Assured' },
      ],
    };
    const json = toJsonResume(resume);
    expect(json.skills).toEqual([
      { name: 'Testing', keywords: ['manual', 'regression', 'end-to-end'] },
      { name: 'API', keywords: ['Postman', 'Rest Assured'] },
    ]);

    const back = fromJsonResume(json);
    expect(back.skills).toEqual([
      { category: 'Testing', items: 'manual, regression, end-to-end' },
      { category: 'API', items: 'Postman, Rest Assured' },
    ]);
  });

  it('does not split commas inside parentheses', () => {
    const resume = {
      personalInfo: { fullName: 'A' },
      skills: [
        {
          id: 's1',
          category: 'Testing',
          items: 'cross-platform testing (web, Android, iOS), manual',
        },
      ],
    };
    const json = toJsonResume(resume);
    expect(json.skills[0].keywords).toEqual([
      'cross-platform testing (web, Android, iOS)',
      'manual',
    ]);
    expect(fromJsonResume(json).skills[0].items).toBe(
      'cross-platform testing (web, Android, iOS), manual'
    );
  });

  it('keeps the location string, never a guessed city', () => {
    const resume = {
      personalInfo: { fullName: 'A', location: 'Springfield, USA' },
    };
    const json = toJsonResume(resume);
    expect(json.basics.location).toEqual({ address: 'Springfield, USA' });
    expect(fromJsonResume(json).personalInfo.location).toBe('Springfield, USA');
  });

  it('reads a structured location from another tool', () => {
    const json = {
      basics: {
        name: 'A',
        location: { city: 'Berlin', region: 'BE', countryCode: 'DE' },
      },
    };
    expect(fromJsonResume(json).personalInfo.location).toBe('Berlin, BE, DE');
  });

  it('preserves customSections rather than dropping them', () => {
    const resume = {
      personalInfo: { fullName: 'A' },
      customSections: [
        { id: 'c1', title: 'Publications', items: ['A blog post, 2023'] },
      ],
    };
    const json = toJsonResume(resume);
    expect(json['x-customSections']).toEqual([
      { title: 'Publications', items: ['A blog post, 2023'] },
    ]);
    expect(fromJsonResume(json).customSections).toEqual([
      { title: 'Publications', items: ['A blog post, 2023'] },
    ]);
  });

  it('keeps free-text dates that are not clean ISO values', () => {
    const resume = {
      personalInfo: { fullName: 'A' },
      experience: [
        {
          id: 'e1',
          role: 'QA Lead',
          company: 'Acme',
          period: 'April 2021 – Present',
          highlights: [],
        },
      ],
    };
    const json = toJsonResume(resume);
    expect(json.work[0]['x-dateText']).toBe('April 2021 – Present');
    expect(json.work[0].startDate).toBe('2021-04-01');
    // "Present" must not become an invented end date.
    expect(json.work[0].endDate).toBeUndefined();
    expect(fromJsonResume(json).experience[0].period).toBe('April 2021 – Present');
  });

  it('keeps a period it cannot parse verbatim', () => {
    const resume = {
      personalInfo: { fullName: 'A' },
      experience: [
        { id: 'e1', role: 'R', company: 'C', period: 'sometime in 2019', highlights: [] },
      ],
    };
    const json = toJsonResume(resume);
    expect(json.work[0].startDate).toBeUndefined();
    expect(fromJsonResume(json).experience[0].period).toBe('sometime in 2019');
  });

  it('excludes the photo by default and includes it on request', () => {
    const resume = {
      personalInfo: { fullName: 'A', photo: 'data:image/png;base64,AAAA' },
    };
    expect(toJsonResume(resume).basics.image).toBeUndefined();
    expect(toJsonResume(resume, { includePhoto: true }).basics.image).toBe(
      'data:image/png;base64,AAAA'
    );
  });
});

describe('JSON Resume — hostile input', () => {
  it('throws a readable error for null', () => {
    expect(() => fromJsonResume(null)).toThrow(/JSON Resume/i);
  });

  it('throws a readable error for an array', () => {
    expect(() => fromJsonResume([])).toThrow(/JSON Resume/i);
  });

  it('throws a readable error for an empty object', () => {
    expect(() => fromJsonResume({})).toThrow(/recognisable/i);
  });

  it('throws a readable error for a string', () => {
    expect(() => fromJsonResume('not json')).toThrow(/JSON Resume/i);
  });

  it('tolerates wrong types inside a real document', () => {
    const json = {
      basics: { name: 'A', profiles: 'not an array', location: 42 },
      work: 'not an array',
      skills: [null, { name: 'X', keywords: 'not an array' }],
      education: [{ institution: 123 }],
    };
    expect(() => fromJsonResume(json)).not.toThrow();
    const out = fromJsonResume(json);
    expect(out.personalInfo.fullName).toBe('A');
    expect(out.skills).toEqual([{ category: 'X', items: '' }]);
    expect(out.education[0].school).toBe('123');
  });

  it('handles a resume with only a name', () => {
    const out = fromJsonResume({ basics: { name: 'Solo' } });
    expect(out.personalInfo.fullName).toBe('Solo');
    expect(out.skills).toEqual([]);
  });
});

describe('JSON Resume — document shape', () => {
  it('emits $schema and meta', () => {
    const json = toJsonResume(INITIAL_RESUME_DATA);
    expect(json.$schema).toContain('jsonresume');
    expect(json.meta.version).toBe('v1.0.0');
    expect(typeof json.meta.lastModified).toBe('string');
  });

  it('emits the required basics fields as strings', () => {
    const json = toJsonResume(INITIAL_RESUME_DATA);
    for (const key of ['name', 'label', 'email', 'phone', 'url', 'summary']) {
      expect(typeof json.basics[key], key).toBe('string');
    }
  });

  it('omits empty collections rather than emitting []', () => {
    const json = toJsonResume({ personalInfo: { fullName: 'A' } });
    expect(json.work).toBeUndefined();
    expect(json.skills).toBeUndefined();
    expect(json['x-customSections']).toBeUndefined();
  });

  it('maps linkedin and github to profiles', () => {
    const json = toJsonResume({
      personalInfo: {
        fullName: 'A',
        linkedin: 'linkedin.com/in/example',
        github: 'github.com/example',
      },
    });
    expect(json.basics.profiles).toEqual([
      {
        network: 'LinkedIn',
        username: 'in/example',
        url: 'https://linkedin.com/in/example',
        'x-original': 'linkedin.com/in/example',
      },
      {
        network: 'GitHub',
        username: 'example',
        url: 'https://github.com/example',
        'x-original': 'github.com/example',
      },
    ]);
  });

  it('produces a filename-safe slug', () => {
    expect(jsonResumeFilename({ personalInfo: { fullName: 'Alex Morgan' } })).toBe(
      'alex-morgan-jsonresume.json'
    );
    expect(jsonResumeFilename({})).toBe('resume-jsonresume.json');
    expect(jsonResumeFilename({ personalInfo: { fullName: '!!!' } })).toBe(
      'resume-jsonresume.json'
    );
  });
});

/**
 * Regression tests for the fields that used to vanish.
 *
 * `toJsonResume` had a literal `\n` typed into the middle of two object
 * literals, which commented out the `score` and `fluency` properties entirely.
 * `fromJsonResume` then read the values back into `grade` and `level`, which
 * no template, the DOCX exporter or the ATS text view ever reads. The net
 * effect was that an education grade and a language level survived a JSON
 * Resume round-trip as far as the data model and then disappeared from every
 * rendered output — in a module whose header promises no silent data loss.
 */
describe('JSON Resume — the fields that used to vanish', () => {
  it('writes the education grade into the schema field', () => {
    const doc = toJsonResume({
      personalInfo: { fullName: 'A' },
      education: [{ school: 'MIT', degree: 'BSc', score: 'CGPA: 8.00/10.00' }],
    });
    expect(doc.education[0].score).toBe('CGPA: 8.00/10.00');
  });

  it('writes the language level into the schema field', () => {
    const doc = toJsonResume({
      personalInfo: { fullName: 'A' },
      languages: [{ name: 'Tamil', proficiency: 'Native' }],
    });
    expect(doc.languages[0].fluency).toBe('Native');
  });

  it('reads an imported grade back into the field templates render', () => {
    const resume = fromJsonResume({
      basics: { name: 'A' },
      education: [{ institution: 'MIT', studyType: 'BSc', score: 'CGPA: 8.00/10.00' }],
    });
    expect(resume.education[0].score).toBe('CGPA: 8.00/10.00');
  });

  it('reads an imported language level back into the field templates render', () => {
    const resume = fromJsonResume({
      basics: { name: 'A' },
      languages: [{ language: 'Tamil', fluency: 'Native' }],
    });
    expect(resume.languages[0].proficiency).toBe('Native');
  });

  it('keeps the alias in step so neither half of the pair can go stale', () => {
    const resume = fromJsonResume({
      basics: { name: 'A' },
      education: [{ institution: 'MIT', score: '3.9' }],
      languages: [{ language: 'Tamil', fluency: 'Native' }],
    });
    expect(resume.education[0].grade).toBe('3.9');
    expect(resume.languages[0].level).toBe('Native');
  });

  it('survives a document that only carries the alias spelling', () => {
    const resume = fromJsonResume({
      basics: { name: 'A' },
      education: [{ institution: 'MIT', grade: '3.9' }],
      languages: [{ language: 'Tamil', level: 'Native' }],
    });
    expect(resume.education[0].score).toBe('3.9');
    expect(resume.languages[0].proficiency).toBe('Native');
  });
});
